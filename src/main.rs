#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().map(String::as_str) == Some("check") {
        // bovabon_edu check [data/x.toml ...]  — kiểm định kho (không chỉ định file = toàn bộ kho nhúng)
        let files = args[1..].to_vec();
        let opts = bovabon_edu::verify::Options::default();
        match bovabon_edu::verify::check_files(&files, &opts) {
            Ok((t, q)) => {
                println!("✅ Hợp lệ: {t} lộ trình, {q} câu hỏi");
                return;
            }
            Err(e) => {
                eprintln!("❌ Chưa đạt:\n{e}");
                std::process::exit(1);
            }
        }
    }
    let (app, questions, tracks) = bovabon_edu::build_app().unwrap_or_else(|e| {
        eprintln!("❌ Kho dữ liệu không hợp lệ:\n{e}");
        std::process::exit(1);
    });
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);
    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".into());
    let addr = format!("{host}:{port}");
    println!("📚 Bovabon Edu — {questions} câu hỏi / {tracks} lộ trình");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap_or_else(|e| {
        eprintln!("Không bind được {addr}: {e}");
        std::process::exit(1);
    });
    println!("🚀 Mở trình duyệt: http://{addr}");
    axum::serve(listener, app).await.unwrap();
}
