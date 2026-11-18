# Bovabon Edu

LMS ôn tập lập trình **không cần đăng nhập**, viết bằng **Rust** (axum + Boa). Một file binary duy nhất chứa sẵn giao diện, kho câu hỏi và bộ chấm.

| Nhóm | Lộ trình | Câu hỏi | Bài code |
|---|---|---|---|
| Frontend | React · React Native · Frontend Developer (JS, HTML/CSS, Browser) · TypeScript · Vue 3 & Vue Router · Next.js & TanStack · Testing (Vitest/Jest/Playwright) · Styling & Build (Tailwind, Sass, Vite) | 359 | 57 (JavaScript) |
| Backend | Node.js & Express · Go · Python Flask & FastAPI · Django · Web API & HTTP · Rust · PHP & Laravel · SQL & CSDL (SQLite/PostgreSQL/Redis) · DevOps (Git, Docker, Kubernetes, nginx, Terraform) | 294 | 51 (JS · Go · Python · Rust · PHP) |
| Ngoại ngữ | Tiếng Anh cho Developer (từ vựng, đọc docs, viết commit/PR, phỏng vấn) · Ngữ pháp tiếng Anh A2 → C1 (theo khung CEFR) | 75 | 8 (JavaScript) |

Dạng bài: **trắc nghiệm** (1 hoặc nhiều đáp án, chấm điểm một phần), **điền khuyết**, **tự luận** (chấm theo ý chính + đáp án mẫu), **bài tập code** chấm bằng bộ unit test có sẵn. Mỗi module có bài học tóm tắt; câu hỏi và module có liên kết tham khảo tới [DevDocs](https://devdocs.io) (nội dung câu hỏi là tự soạn, chỉ dẫn link về tài liệu gốc).

Tiến độ, câu đã đánh dấu, lịch sử thi thử lưu trong `localStorage` của trình duyệt (có xuất/nhập file JSON ở trang *Tiến độ*).

## Chạy

```bash
cargo run --release          # http://127.0.0.1:8080
PORT=3000 HOST=0.0.0.0 cargo run --release
```

Bài code JavaScript chạy trong sandbox **Boa** (giới hạn vòng lặp, độ sâu đệ quy, timeout). Bài **Python** cần `python3`, **Go** cần `go`, **Rust** cần `rustc`, **PHP** cần `php` (8.x) trên máy chủ.

| Biến môi trường | Ý nghĩa |
|---|---|
| `PORT`, `HOST` | Địa chỉ lắng nghe (mặc định `127.0.0.1:8080`) |
| `BOVABON_DATA_DIR` | Thư mục chứa `*.toml` / `*.json` thay cho kho dữ liệu nhúng sẵn |
| `BOVABON_PYTHON`, `BOVABON_GO`, `BOVABON_RUSTC`, `BOVABON_PHP` | Đường dẫn trình thông dịch / toolchain |

> Runner Python/Go/Rust/PHP chạy code của người học trực tiếp trên máy chủ (có timeout, không có sandbox hệ điều hành). Chỉ mở ra mạng ngoài khi đặt server trong container/VM cô lập.

## App macOS (`Bovabon Edu.app`)

```bash
./scripts/bundle-macos.sh          # → dist/Bovabon Edu.app
./scripts/bundle-macos.sh --dmg    # → thêm dist/BovabonEdu.dmg
```

App mở một cửa sổ riêng (WKWebView gốc của macOS, qua `wry`/`tao`) và tự chạy server Rust nền trên `127.0.0.1` cổng ngẫu nhiên — không cần trình duyệt, không chiếm cổng 8080. Có menu Sửa (Cmd+C/V/Z/A trong ô code), link DevDocs mở bằng trình duyệt mặc định, file xuất tiến độ lưu vào `~/Downloads`. Tiến độ học lưu trong bộ nhớ WebView của app (tách biệt với trình duyệt).

App được ký ad-hoc: chạy ngay trên máy đã build. Mang sang Mac khác thì Gatekeeper sẽ chặn — chuột phải → *Open* (hoặc `xattr -dr com.apple.quarantine "Bovabon Edu.app"`); muốn phân phối chính thức cần ký Developer ID + notarize.

Bản desktop là một binary riêng (`--features desktop --bin bovabon-desktop`), bản server `bovabon_edu` không bị kéo thêm phụ thuộc giao diện.

## Kiểm định kho dữ liệu

```bash
cargo test --release                              # toàn bộ kho nhúng
./target/release/bovabon_edu check                # như trên, không cần cargo
./target/release/bovabon_edu check data/vue.toml  # chỉ kiểm một file (chưa cần nhúng)
```

Bộ kiểm định (`src/verify.rs`, dùng chung cho test và lệnh `check`) đảm bảo: mọi lộ trình có đủ 5 dạng câu hỏi, đáp án mẫu được chấm đúng, API công khai không lộ đáp án, **mọi lời giải code pass toàn bộ test và mọi code khởi đầu đều fail** (nhưng vẫn biên dịch được), mọi đường dẫn `sources` tồn tại trong chỉ mục DevDocs (`scripts/devdocs-index.sh <slug>` tải về `.devdocs/`).

### Soạn lộ trình mới bằng agent (Codex CLI)

`AGENTS.md` là hướng dẫn soạn nội dung cho agent; mỗi việc nằm trong `scripts/codex-jobs/<tên>.txt`.

```bash
./scripts/codex-run.sh -j 4            # chạy mọi job song song, log ở .codex-logs/
./scripts/codex-run.sh vue rust        # chỉ vài job
```

Mỗi agent chỉ tạo một file `data/<x>.toml` và tự chạy `check` tới khi đạt; sau khi rà soát, thêm file vào `EMBEDDED` trong `src/bank.rs`.

## Định dạng dữ liệu (`data/*.toml`)

```toml
id = "react"; title = "React"; icon = "⚛️"; color = "#0ea5e9"
group = "Frontend"            # hoặc "Backend"
docs = ["react"]              # slug DevDocs của lộ trình

[[modules]]
id = "react-hooks"; title = "Hooks"; description = "…"
sources = ["react/reference/react/useeffect"]   # đường dẫn tương đối trên devdocs.io
lesson = ''' Markdown… '''

[[questions]]
id = "rx-001"; module = "react-hooks"; difficulty = 2
type = "single"               # single | multiple | fill | essay | code
prompt = "Markdown… dùng {{blank}} cho ô điền"
options = ["…"]; answer = [0]                    # single / multiple
blanks = [["useId"], ["a", "b"]]                 # fill: mỗi ô một danh sách đáp án chấp nhận
keywords = [["ý 1", "từ đồng nghĩa"]]; min_keywords = 2; model_answer = "…"   # essay
lang = "javascript"           # code: javascript | python | go | rust | php
starter = "…"; solution = "…"; tests = "…"; hints = ["…"]
explanation = "…"; sources = ["http/reference/status"]
```

Cú pháp test:
- **JavaScript** — giống Jest: `test`, `describe`, `expect(...).toBe/toEqual/toThrow/...`, `jest.fn`, fake timers (`jest.advanceTimersByTime`), `renderHook`/`act` cho hook React.
- **Python** — `@test("tên")` + `expect(x).to_equal(...)`, `.to_raise(Exc)`, `.not_`…; hỗ trợ `async def`.
- **Go** — `var _ = Test("tên", func(t *T) { t.Errorf(...) })`; lời giải không được khai báo `main`, `T`, `Test`.
- **Rust** — `bovabon_tests! { "tên" => { assert_eq!(f(1), 2); }, }`; chỉ `std`, lời giải không khai báo `main`.
- **PHP** — `test('tên', function () { expect(f(1))->toBe(2); });` (cú pháp kiểu Pest: `toBe/toEqual/toThrow/…`, `->not->`).
