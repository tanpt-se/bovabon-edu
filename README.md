# Bovabon Edu

LMS ôn tập lập trình **không cần đăng nhập**, viết bằng **Rust** (axum + Boa). Một file binary duy nhất chứa sẵn giao diện, kho câu hỏi và bộ chấm.

| Nhóm | Lộ trình | Câu hỏi | Bài code |
|---|---|---|---|
| Frontend | React · React Native · JavaScript & trình duyệt · TypeScript · Vue · Angular & RxJS · Next.js · Testing · Styling & Build | 793 | 111 (JavaScript) |
| Backend | Node.js · Go · Python · Django · Web API · Rust · PHP & Laravel · SQL · DevOps | 536 | 76 (JavaScript, Go, Python, Rust, PHP) |
| Ngoại ngữ | Tiếng Anh cho IT · Ngữ pháp · Từ vựng · Cụm từ theo ngữ cảnh · CEFR A1–C2 | 672 | 0 |
| **Tổng** | **28 lộ trình** | **2.001** | **187** |

Dạng bài: **trắc nghiệm** (1 hoặc nhiều đáp án, chấm điểm một phần), **điền khuyết**, **tự luận** (chấm theo ý chính + đáp án mẫu), **bài tập code** chấm bằng bộ unit test có sẵn. Lộ trình lập trình có đủ 5 dạng câu hỏi; lộ trình tiếng Anh dùng trắc nghiệm, điền khuyết và tự luận, không có bài code. Mỗi module có bài học tóm tắt; câu hỏi và module có liên kết tham khảo tới [DevDocs](https://devdocs.io) (nội dung câu hỏi là tự soạn, chỉ dẫn link về tài liệu gốc).

Tiến độ, câu đã đánh dấu, lịch sử thi thử lưu trong `localStorage` của trình duyệt (có xuất/nhập file JSON ở trang *Tiến độ*).

## Chạy

```bash
cargo run --release --bin bovabon_edu          # http://127.0.0.1:8080
PORT=3000 HOST=0.0.0.0 cargo run --release --bin bovabon_edu
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

## Đồng bộ đám mây (tuỳ chọn)

Mặc định không cần tài khoản: tiến độ và cài đặt lưu trên máy. Ai muốn dùng nhiều máy thì vào **Cài đặt → Đồng bộ** (giống Settings Sync của VS Code):

- Đăng ký bằng **email + mã OTP** từ app authenticator (Google Authenticator, 1Password, Authy…): quét QR → nhập mã 6 số → lưu 8 mã dự phòng 16 ký tự. Không mật khẩu, không gửi email (email chỉ là tên tài khoản).
- Đăng nhập trên máy khác bằng email + mã OTP (hoặc mã dự phòng). Dữ liệu trên máy được **gộp** với bản trên đám mây (câu trả lời/bài code lấy bản mới hơn, điểm cao nhất, đánh dấu theo thao tác mới nhất, hoạt động lấy max), sau đó tự đồng bộ vài giây sau mỗi thay đổi.

Backend nằm trong `cloud/` (Cloudflare Workers + D1, gói Workers Paid):

```bash
cd cloud && npm install
npm run migrate:local && npm run dev        # API cục bộ http://127.0.0.1:8799 (cần cloud/.dev.vars có ENC_KEY)
python3 test/e2e.py                          # 33 kiểm tra end-to-end (đăng ký, OTP, giới hạn body, replay, khoá tạm, xung đột phiên bản…)
npm run migrate:remote && npm run deploy     # production
```

- TOTP secret được mã hoá AES-GCM bằng secret `ENC_KEY` (`wrangler secret put ENC_KEY`); token phiên chỉ lưu dạng SHA-256. **Mất `ENC_KEY` = mọi tài khoản phải đăng ký lại**, hãy cất bản sao trong trình quản lý mật khẩu.
- Chống đoán mã: sai 5 lần → khoá 15 phút; mỗi mã OTP chỉ dùng một lần.
- Mã dự phòng mới có 16 ký tự ngẫu nhiên; mã 8 ký tự từ bản cũ vẫn dùng được đến khi sử dụng hoặc tạo lại mã trong Cài đặt.
- Ghi dữ liệu có kiểm tra phiên bản (`baseVersion`); khi hai máy ghi cùng lúc server trả 409 kèm bản mới nhất để client gộp lại.
- Địa chỉ API mặc định là hằng `SYNC_DEFAULT_API` trong `static/app.js`; có thể trỏ sang API khác (vd. bản cục bộ) bằng `localStorage['bovabon.sync'] = '{"api":"http://127.0.0.1:8799"}'`.

## Kiểm định kho dữ liệu

```bash
cargo test --release                              # toàn bộ kho nhúng
./target/release/bovabon_edu check                # như trên, không cần cargo
./target/release/bovabon_edu check data/vue.toml  # chỉ kiểm một file (chưa cần nhúng)
```

Bộ kiểm định (`src/verify.rs`, dùng chung cho test và lệnh `check`) đảm bảo: lộ trình lập trình có đủ 5 dạng câu hỏi và lộ trình tiếng Anh không có bài code, đáp án mẫu được chấm đúng, API công khai không lộ đáp án, **mọi lời giải code pass toàn bộ test và mọi code khởi đầu đều fail** (nhưng vẫn biên dịch được), mọi đường dẫn `sources` tồn tại trong chỉ mục DevDocs (`scripts/devdocs-index.sh <slug>` tải về `.devdocs/`).

### Soạn lộ trình mới bằng agent (Codex CLI)

`AGENTS.md` là hướng dẫn soạn nội dung cho agent; mỗi việc nằm trong `scripts/codex-jobs/<tên>.txt`.

```bash
./scripts/codex-run.sh -j 4            # chạy mọi job song song, log ở .codex-logs/
./scripts/codex-run.sh vue rust        # chỉ vài job
./scripts/codex-pipeline.sh            # toàn bộ: giao diện → CEFR + DevDocs → dịch tiếng Anh
```

Mỗi agent chỉ tạo file data được giao và tự chạy `check` tới khi đạt. `build.rs` tự nhúng mọi `data/*.toml`; khi thêm lộ trình, cập nhật thêm danh mục trong `data/categories.toml`.

## Danh mục học (`data/categories.toml`)

Sidebar và trang chủ hiển thị **danh mục** (JavaScript, TypeScript, Styling, React, React Native, Next.js, Vue, Angular, Testing, Build & Tooling, Node.js, Python, Go, PHP & Laravel, Rust, Web API, SQL, DevOps; khu Tiếng Anh: CEFR A1–C2, Ngữ pháp, Từ vựng, Cụm từ theo ngữ cảnh, Giao tiếp, Đọc & viết tài liệu, Phỏng vấn). Mỗi danh mục gom các module (mục con) từ một hay nhiều file lộ trình — ví dụ **Python** = Flask + FastAPI + Django. Bấm vào danh mục để luyện toàn bộ, thi thử, ôn phỏng vấn (tự luận) hoặc làm bài code của cả danh mục. Sửa `data/categories.toml` để đổi cách nhóm; mỗi module thuộc đúng 1 danh mục.

## Đa ngôn ngữ (Tiếng Việt / English)

Nút 🌐 ở cuối sidebar đổi ngôn ngữ (lưu trong trình duyệt, tải lại trang).
- **Giao diện**: từ điển `static/i18n.js` (khoá là chuỗi tiếng Việt nguyên văn).
- **Nội dung**: file dịch `data/i18n/en/<file>.toml` theo id module/câu hỏi; API nhận `?lang=en`, phần chưa dịch hiển thị tiếng Việt. Kiểm định: `./target/release/bovabon_edu check data/i18n/en/<file>.toml`.

## Tài liệu gốc DevDocs

Mỗi module có tab **Tài liệu gốc**: đọc ngay trong app các trang DevDocs trong `sources` (tải trực tiếp từ DevDocs khi xem, cần mạng; không lưu nội dung tài liệu vào kho). Mục lục `.devdocs/<slug>.json` dùng làm khung để Codex mở rộng bài học (job `devdocs-*`).

## Lộ trình CEFR (A1 → C2)

Khu Tiếng Anh có nhóm **Lộ trình CEFR** sáu bậc A1–C2 theo đề cương [docs/cefr-syllabus.md](docs/cefr-syllabus.md) (căn cứ CEFR Companion Volume 2020, British Council–EAQUALS Core Inventory, English Grammar/Vocabulary Profile). Mỗi bậc nằm trong `data/english-cefr-<bậc>.toml`; ngữ pháp A2–C1 bổ sung trong `data/english-grammar.toml`.

## Định dạng dữ liệu (`data/*.toml`)

```toml
id = "react"; title = "React"; icon = "⚛️"; color = "#0ea5e9"
group = "Frontend"            # hoặc "Backend"
area = "dev"                  # "dev" (mặc định, có bài code) | "english" (khu Tiếng Anh: không có bài code)
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
