//! Bovabon Edu dạng app desktop: server Rust chạy nền trên cổng ngẫu nhiên (chỉ 127.0.0.1)
//! và hiển thị giao diện trong cửa sổ WebView gốc của hệ điều hành (WKWebView trên macOS).

use muda::{Menu, PredefinedMenuItem, Submenu};
use std::path::PathBuf;
use tao::{
    dpi::LogicalSize,
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoopBuilder},
    window::WindowBuilder,
};
use wry::{NewWindowResponse, WebViewBuilder};

fn open_external(url: &str) {
    if url.starts_with("https://") || url.starts_with("http://") {
        #[cfg(target_os = "macos")]
        let _ = std::process::Command::new("open").arg(url).spawn();
        #[cfg(target_os = "windows")]
        let _ = std::process::Command::new("cmd").args(["/C", "start", "", url]).spawn();
        #[cfg(all(unix, not(target_os = "macos")))]
        let _ = std::process::Command::new("xdg-open").arg(url).spawn();
    }
}

fn fatal(msg: &str) -> ! {
    eprintln!("❌ {msg}");
    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "display alert \"Bovabon Edu không khởi động được\" message \"{}\" as critical",
            msg.replace('\\', "\\\\").replace('"', "'")
        );
        let _ = std::process::Command::new("osascript").args(["-e", &script]).status();
    }
    std::process::exit(1);
}

fn main() {
    // 1. Server chạy trên thread riêng với runtime tokio riêng.
    let (app, _, _) = bovabon_edu::build_app().unwrap_or_else(|e| fatal(&format!("Kho dữ liệu không hợp lệ:\n{e}")));
    let std_listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap_or_else(|e| fatal(&format!("Không mở được cổng: {e}")));
    std_listener.set_nonblocking(true).expect("nonblocking");
    let port = std_listener.local_addr().expect("addr").port();
    std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_multi_thread().enable_all().build().expect("tokio runtime");
        rt.block_on(async move {
            let listener = tokio::net::TcpListener::from_std(std_listener).expect("listener");
            axum::serve(listener, app).await.expect("server");
        });
    });
    let origin = format!("http://127.0.0.1:{port}");

    // 2. Cửa sổ + menu (menu Edit bắt buộc trên macOS để Cmd+C/V/Z/A hoạt động trong WebView).
    let event_loop = EventLoopBuilder::new().build();
    let menu = Menu::new();
    let app_menu = Submenu::with_items(
        "Bovabon Edu",
        true,
        &[
            &PredefinedMenuItem::about(Some("Giới thiệu Bovabon Edu"), None),
            &PredefinedMenuItem::separator(),
            &PredefinedMenuItem::hide(Some("Ẩn Bovabon Edu")),
            &PredefinedMenuItem::separator(),
            &PredefinedMenuItem::quit(Some("Thoát Bovabon Edu")),
        ],
    )
    .expect("menu");
    let edit_menu = Submenu::with_items(
        "Sửa",
        true,
        &[
            &PredefinedMenuItem::undo(Some("Hoàn tác")),
            &PredefinedMenuItem::redo(Some("Làm lại")),
            &PredefinedMenuItem::separator(),
            &PredefinedMenuItem::cut(Some("Cắt")),
            &PredefinedMenuItem::copy(Some("Sao chép")),
            &PredefinedMenuItem::paste(Some("Dán")),
            &PredefinedMenuItem::select_all(Some("Chọn tất cả")),
        ],
    )
    .expect("menu");
    let window_menu = Submenu::with_items(
        "Cửa sổ",
        true,
        &[
            &PredefinedMenuItem::minimize(Some("Thu nhỏ")),
            &PredefinedMenuItem::fullscreen(Some("Toàn màn hình")),
            &PredefinedMenuItem::close_window(Some("Đóng cửa sổ")),
        ],
    )
    .expect("menu");
    menu.append_items(&[&app_menu, &edit_menu, &window_menu]).expect("menu");
    #[cfg(target_os = "macos")]
    menu.init_for_nsapp();

    let window = WindowBuilder::new()
        .with_title("Bovabon Edu")
        .with_inner_size(LogicalSize::new(1320.0, 860.0))
        .with_min_inner_size(LogicalSize::new(420.0, 560.0))
        .build(&event_loop)
        .unwrap_or_else(|e| fatal(&format!("Không tạo được cửa sổ: {e}")));

    let nav_origin = origin.clone();
    let downloads = std::env::var_os("HOME").map(|h| PathBuf::from(h).join("Downloads"));
    let _webview = WebViewBuilder::new()
        .with_url(&origin)
        .with_devtools(cfg!(debug_assertions))
        // Link ngoài (DevDocs…) mở bằng trình duyệt mặc định, không rời khỏi app.
        .with_navigation_handler(move |url| {
            if url.starts_with(&nav_origin) || url.starts_with("about:") || url.starts_with("blob:") || url.starts_with("data:") {
                true
            } else {
                open_external(&url);
                false
            }
        })
        .with_new_window_req_handler(|url, _| {
            open_external(&url);
            NewWindowResponse::Deny
        })
        // Xuất tiến độ (.json) → lưu vào ~/Downloads.
        .with_download_started_handler(move |_url, path| {
            if let Some(dir) = &downloads {
                let name = path.file_name().map(|n| n.to_owned()).unwrap_or_else(|| "bovabon-edu-progress.json".into());
                *path = dir.join(name);
            }
            true
        })
        .build(&window)
        .unwrap_or_else(|e| fatal(&format!("Không tạo được WebView: {e}")));

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        if let Event::WindowEvent { event: WindowEvent::CloseRequested, .. } = event {
            *control_flow = ControlFlow::Exit;
        }
    });
}
