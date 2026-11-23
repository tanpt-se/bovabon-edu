# Bàn giao cho Codex: bổ sung câu hỏi SE (Junior → Lead) và Luyện thi IELTS 6.5

Cập nhật: 2026-11-22. Tài liệu này dành cho agent (Codex) và người điều phối tiếp tục phát triển kho câu hỏi Bovabon Edu.
Đọc theo thứ tự:
1. `CLAUDE.md` — kiến trúc.
2. `AGENTS.md` — quy tắc soạn, định dạng TOML, cú pháp test, mục "Cấp độ & chỉ tiêu".
3. Tài liệu này.
4. Khung nội dung: `docs/se-levels.md` (SE) và `docs/ielts-6.5-syllabus.md` (IELTS).

## 1. Mục tiêu

| Khu | Mục tiêu đầu ra | Đo bằng |
|---|---|---|
| Lập trình (SE) | Mỗi lộ trình có câu hỏi phủ đủ 4 cấp **Junior → Middle → Senior → Lead**, đủ số lượng để luyện và phỏng vấn ở cấp nào cũng được. Có thêm lộ trình **System Design & Tech Lead**. | `python3 scripts/bank-stats.py` (tag `level:*`) |
| Tiếng Anh | Khu **Luyện thi IELTS 6.5** gồm 7 lộ trình (ngữ pháp, từ vựng, 4 kỹ năng). Nội dung học sâu: học xong nắm chắc kiến thức và chiến lược tiệm cận band 6.5 (B2 vững). | `python3 scripts/bank-stats.py` (tag `band:*`, độ dài lesson) |

Nội dung đã có (CEFR A1–C2, Tiếng Anh cho IT, Cụm từ theo ngữ cảnh) giữ nguyên. IELTS là khu bổ sung, nối tiếp CEFR B1–B2.

## 2. Trạng thái kho lúc bàn giao

- 29 lộ trình, khoảng 2.400 câu.
- Có bản dịch EN cho mọi lộ trình cũ, trong `data/i18n/en/`.

**Lộ trình dev (18 file):**
- Mọi câu đã được **gắn tag level tự động** theo `difficulty` (1→junior, 2→middle, 3→senior). Bản gốc trước khi gắn lưu ở `.codex-logs/baseline-handoff/`.
- Chưa có câu `level:lead` nào và chưa có module `<id>-lead`.
- Thiếu khoảng **960 câu** để đạt chỉ tiêu (xem `python3 scripts/bank-stats.py`):

| Lộ trình | Hiện có | Cần thêm (ước tính) |
|---|---|---|
| angular | 72 | +48 |
| databases | 62 | +58 |
| devops | 73 | +47 |
| django | 66 | +54 |
| frontend-tooling | 62 | +58 |
| frontend | 83 | +55 |
| go | 53 | +67 |
| nextjs | 67 | +53 |
| nodejs | 47 | +73 |
| php-laravel | 69 | +51 |
| python-backend | 53 | +67 |
| react-native | 156 | +23 |
| react | 155 | +21 |
| rust | 60 | +60 |
| testing | 63 | +57 |
| typescript | 64 | +56 |
| vue | 71 | +49 |
| web-api | 53 | +67 |

**Lộ trình mới chưa có file:**
- `data/system-design.toml`: ≥ 120 câu.
- 7 file `data/english-ielts-*.toml`: ≥ 740 câu.

**Danh mục đã khai báo sẵn** trong `data/categories.toml`; bản dịch tên ở `data/i18n/en/categories.toml` và `static/i18n.js`:
- Module `<id>-lead` của từng lộ trình dev.
- Danh mục `system-design`, nhóm "Kiến trúc & Lead".
- 6 danh mục nhóm "Luyện thi IELTS 6.5".

Module chưa có dữ liệu sẽ tự ẩn. **Không cần sửa `categories.toml`** khi làm đúng id module đã quy định.

**Lỗi đang tồn tại (cần sửa trước):**
- `english-cefr-c1` câu `cefr-c1-x067` và `english-cefr-c2` câu `cefr-c2-x056`: `model_answer` không khớp đủ từ khoá. Kho có lỗi này thì `cargo test` và bundle sẽ fail. Đã có job `fix-cefr-essays`.

## 3. Danh sách job (`scripts/codex-jobs/`)

| Job | File được sửa | Loại |
|---|---|---|
| `fix-cefr-essays` | `english-cefr-c1/c2.toml` | sửa lỗi, 1 lượt |
| `lvl-<lộ trình>` × 18 | `data/<lộ trình>.toml` | chạy lặp tới chỉ tiêu level |
| `system-design` | `data/system-design.toml` | tạo mới, chạy lặp |
| `ielts-grammar`, `ielts-vocab`, `ielts-reading`, `ielts-listening`, `ielts-writing-task1`, `ielts-writing-task2`, `ielts-speaking` | `data/english-ielts-<…>.toml` | tạo mới, chạy lặp |
| `en-<file>` | `data/i18n/en/<file>.toml` | dịch phần còn thiếu (đã có cho mọi file, kể cả file mới) |

Mỗi job chỉ sửa **một** file data, nên các làn chạy song song không đụng nhau.

### Điều phối model

`scripts/codex-run.sh` chọn model và reasoning effort cho từng job theo bảng `scripts/codex-models.conf`, dùng dòng đầu tiên khớp tên job:

| Job | Model / effort | Lý do |
|---|---|---|
| `lvl-*`, `system-design`, `ielts-reading`, `ielts-writing-*`, `ui-*` | `gpt-6.2-astra` / high | Câu Senior/Lead, bài code, trade-off kiến trúc; TRUE/FALSE/NOT GIVEN phải chặt; bài mẫu band 7 |
| `ielts-grammar`, `ielts-vocab`, `ielts-listening`, `ielts-speaking`, `cefr-*`, `devdocs-*` | `gpt-6.2-sol` / high | Soạn theo khuôn rõ, khối lượng lớn |
| `en-*` (dịch) | `gpt-6.2-sol` / medium | Dịch có cấu trúc, ít suy luận |
| `fix-*` | `gpt-6.2-sol` / low | Sửa lỗi nhỏ |

Không dùng effort `max`/`ultra` cho pipeline, vì chậm và tốn quota.
Muốn ghi đè tạm thời, chạy kèm biến môi trường (ví dụ khi sắp hết quota):

```bash
CODEX_MODEL=gpt-6.2-sol CODEX_EFFORT=medium ./scripts/codex-handoff.sh
```

Bảng được đọc lại ở mỗi lượt, nên sửa `codex-models.conf` khi pipeline đang chạy sẽ áp dụng từ lượt kế tiếp. Model đã dùng được ghi ở dòng đầu mỗi `.codex-logs/<job>.log`.
"Chạy lặp" nghĩa là mỗi lượt Codex thêm khoảng 30 câu, chạy `check` cho tới khi ✅, rồi dừng. Pipeline kiểm `bank-stats --check` và gọi lượt tiếp nếu chưa đạt.

## 4. Cách chạy

```bash
./scripts/codex-handoff.sh                 # tất cả làn, 3 làn song song, tối đa 8 lượt/làn
./scripts/codex-handoff.sh -j 4 lvl-react lvl-go ielts-reading   # chỉ một số làn
./scripts/codex-handoff.sh --translate-only                       # chỉ build lại + dịch EN + test
python3 scripts/bank-stats.py               # bảng tiến độ toàn kho
python3 scripts/bank-stats.py data/go.toml  # phần còn thiếu của 1 file
```

Pipeline làm lần lượt:
1. Chạy các làn.
2. `cargo build --release` (bản dịch được kiểm định trên kho nhúng nên phải build lại).
3. Các job `en-<file>`.
4. `cargo test --release` và bảng `bank-stats`.

Log nằm ở `.codex-logs/_handoff.txt` và `.codex-logs/<job>.log` / `.md`. Tóm tắt từng lượt ở `<job>.roundN.md`.

**Khi Codex hết quota:**
- Làn tự dừng (có báo ⛔).
- Chạy lại cùng lệnh sau giờ reset. Làn nào đã đạt chỉ tiêu sẽ được bỏ qua, làn dở làm tiếp theo `bank-stats`.

**Thứ tự ưu tiên** nếu quota có hạn:
1. `fix-cefr-essays`.
2. `ielts-grammar`, `ielts-vocab`, `ielts-reading`.
3. `lvl-*` của các lộ trình phổ biến: react, nodejs, typescript, databases, web-api.
4. `system-design`.
5. Các IELTS còn lại, rồi các `lvl-*` còn lại.

## 5. Tiêu chí nghiệm thu (người điều phối kiểm)

1. `python3 scripts/bank-stats.py`: mọi dòng `dev` và `ielts` là ✅.
2. `./target/release/bovabon_edu check` (toàn kho) ✅ và `cargo test --release` pass.
3. Đọc mẫu ngẫu nhiên khoảng 10 câu/lộ trình:
   - Câu `level:lead` là câu ra quyết định có ràng buộc (không phải câu trivia khó).
   - Câu IELTS có văn bản tự soạn, giải thích trích căn cứ.
   - Lesson IELTS đủ chiến lược, mẫu câu và lỗi hay gặp.
4. Bản dịch EN: không còn module hay câu mới thiếu bản dịch. Đếm bằng `python3 scripts/bank-stats.py --i18n`.
5. Bundle lại app (thoát app trước):

```bash
osascript -e 'quit app "Bovabon Edu"'
```

```bash
./scripts/bundle-macos.sh --dmg
```

## 6. Quy tắc quan trọng (nhắc lại)

- **Id ổn định:** không đổi id lộ trình, module hay câu cũ, vì tiến độ người học lưu theo id. Câu mới dùng tiền tố quy định: `<lộ trình>-lv###`, `<lộ trình>-lvc##`, `sd-###`, `ig-`, `iv-`, `ir-`, `il-`, `iw1-`, `iw2-`, `isp-`.
- **Nội dung tự soạn:**
  - Không chép tài liệu, sách, đề IELTS thật hay bài mẫu trên mạng.
  - Ví dụ số liệu trong system design ghi rõ là ước lượng.
  - Không bịa nghiên cứu hay số liệu có thật.
- Giải thích bằng tiếng Việt, code và ví dụ tiếng Anh. Lộ trình tiếng Anh giữ câu hỏi bằng tiếng Anh.
- Codex **không** sửa `src/`, `static/`, `tests/`, `categories.toml` và **không** chạy `cargo`. Pipeline do người điều phối chạy sẽ tự build và test.
- Giới hạn của app: chỉ có chữ, không có audio hay ghi âm; essay chấm theo từ khoá. Cách xử lý đã nêu ở `docs/ielts-6.5-syllabus.md` mục 1 và 4. Đừng hứa với người học điều app không đo được.

## 7. Việc sau đợt này (gợi ý, không thuộc job Codex)

- Giao diện: bộ lọc theo level (Junior/Middle/Senior/Lead) và band (5.5/6.5/7) ở trang luyện tập và thi thử. Tag đã có trong `PublicQuestion.tags`, chỉ cần UI.
- Đề thi thử IELTS theo đúng cấu trúc (40 câu Reading tính 60 phút), cùng bảng quy đổi điểm tham khảo.
