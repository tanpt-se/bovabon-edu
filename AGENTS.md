# Hướng dẫn soạn nội dung cho Bovabon Edu (dành cho agent)

Bovabon Edu là LMS ôn tập lập trình (Rust/axum). Kho câu hỏi là các file `data/<lộ-trình>.toml`.
Nhiệm vụ thường gặp: **soạn một lộ trình mới** = tạo đúng **một** file `data/<file>.toml`.

## Quy tắc bắt buộc

1. **Chỉ tạo/sửa file data được giao.** Không sửa `src/`, `static/`, `tests/`, `Cargo.toml`, file data khác, không chạy `cargo build`/`cargo test` (binary kiểm định đã build sẵn). Có thể tạo file nháp trong `/tmp`.
2. **Tự kiểm định** bằng:
   ```bash
   ./target/release/bovabon_edu check data/<file>.toml
   ```
   Lặp lại sửa → chạy cho tới khi in `✅ Hợp lệ`. Không được kết thúc khi còn lỗi.
3. **Nội dung tự soạn**: giải thích bằng **tiếng Việt** (thuật ngữ giữ tiếng Anh), ví dụ/code tiếng Anh. Không sao chép nguyên văn tài liệu (DevDocs, MDN, sách…). Kiến thức phải **chính xác và cập nhật** (phiên bản mới, không khuyên dùng API đã deprecated trừ khi đang hỏi về việc đó).
4. `sources` / `docs` chỉ dùng **đường dẫn có trong DevDocs** — tra trong `.devdocs/<slug>.json` (trường `entries[].path`), ví dụ:
   ```bash
   python3 -c "import json;[print(e['path']) for e in json.load(open('.devdocs/vue~3.json'))['entries'] if 'computed' in e['path']]"
   ```
   Đường dẫn dạng `<slug>/<path>` (có thể thêm `#anchor`). Không dùng URL tuyệt đối.
5. Không có mạng; chỉ dùng thư viện chuẩn của ngôn ngữ trong bài code.

## Quy mô một lộ trình

- 4–6 module; mỗi module có `lesson` (Markdown, ≥ 200 ký tự, có bảng/ví dụ/lỗi hay gặp) và `sources`.
- **35–45 câu hỏi**, đủ 5 dạng: `single` (~40%), `multiple` (~15%), `fill` (~15%), `essay` (2–3 câu), `code` (**5–6 bài**, rải đều các module).
- `difficulty`: 1 (cơ bản), 2 (trung bình), 3 (nâng cao) — trộn cả ba.
- id câu hỏi: `<tiền-tố>-<số>` duy nhất toàn kho (vd. `vue-001`, `vue-c01`). Tiền tố do người giao việc chỉ định.
- Câu hỏi hướng **hiểu bản chất & tình huống thực tế** (debug, chọn giải pháp, đọc code), tránh câu đố mẹo.

## Mở rộng một lộ trình có sẵn

Khi được giao **mở rộng** `data/<file>.toml` đã tồn tại:
- Chỉ sửa đúng file đó. **Giữ nguyên** `id` lộ trình, id module và id câu hỏi cũ (tiến độ người học lưu theo id); được phép sửa lỗi/viết lại cho hay hơn nội dung câu cũ.
- Câu mới dùng tiền tố được giao (vd. `react-x001`) để không trùng id cũ; module mới đặt id mới.
- Có thể mở rộng `lesson` của module cũ (thêm bảng, ví dụ, lỗi hay gặp) và thêm module mới.
- Không giới hạn 35–45 câu như lộ trình mới — làm theo quy mô trong đề bài. Làm theo từng đợt (mỗi đợt ~20 câu) và chạy `check` sau mỗi đợt để không dồn lỗi.
- Lộ trình không có DevDocs (vd. tiếng Anh): không khai báo `docs`/`sources`.

## Định dạng TOML

```toml
id = "vue"                      # id lộ trình
title = "Vue 3 & Vue Router"
icon = "🟢"
color = "#42b883"
group = "Frontend"              # Frontend | Backend | Ngoại ngữ | ...
docs = ["vue~3", "vue_router~5"]  # slug DevDocs
description = "Mô tả ngắn 1–2 câu."

[[modules]]
id = "vue-reactivity"
title = "Reactivity"
description = "ref, reactive, computed, watch…"
sources = ["vue~3/api/reactivity-core"]
lesson = '''
### Tiêu đề
Markdown…
'''

[[questions]]
id = "vue-001"
module = "vue-reactivity"
type = "single"                  # single | multiple | fill | essay | code
difficulty = 2
prompt = "Markdown. Có thể chứa ```code```."
options = ["A", "B", "C", "D"]   # single/multiple; không trùng nhau
answer = [1]                     # chỉ số (0-based); single đúng 1, multiple >= 2
explanation = "Vì sao đúng / vì sao các lựa chọn khác sai."
sources = ["vue~3/api/reactivity-core"]
```

**fill** — mỗi `{{blank}}` trong `prompt` ứng với một phần tử của `blanks` (danh sách các đáp án chấp nhận). Khi chấm, đáp án được bỏ khoảng trắng, chuyển chữ thường, bỏ `;` cuối và dấu nháy bao quanh — nên đáp án phải là **một từ/biểu thức ngắn, không mơ hồ**.
```toml
prompt = '''
```js
const count = {{blank}}(0)
```
'''
blanks = [["ref"]]
```

**essay** — chấm theo nhóm từ khoá (khớp chuỗi con, không phân biệt hoa thường); mỗi nhóm là các cách diễn đạt tương đương, phần tử đầu là tên hiển thị.
`model_answer` **phải** khớp ≥ `min_keywords` nhóm (viết từ khoá liền mạch, đừng chèn `**` vào giữa cụm từ khoá).
```toml
keywords = [["ssr", "server-side rendering", "render phía server"], ["hydration", "hydrate"], ["seo"]]
min_keywords = 2
model_answer = '''Đáp án mẫu Markdown…'''
```

**code** — bài tập chấm bằng unit test.
```toml
type = "code"
lang = "javascript"              # javascript | python | rust | php   (KHÔNG dùng go)
title = "Tên bài"
prompt = '''Đề bài: chữ ký hàm, quy tắc, ví dụ input/output, ràng buộc.'''
starter = '''khung code BIÊN DỊCH/CHẠY ĐƯỢC nhưng sai logic (vd. trả giá trị mặc định)'''
solution = '''lời giải chuẩn'''
tests = '''bộ test (>= 4 test, có case biên)'''
hints = ["gợi ý 1", "gợi ý 2"]
explanation = "Giải thích ngắn / liên hệ thực tế."
```
Yêu cầu: lời giải **pass 100%**, starter **không** pass hết, starter phải chạy/biên dịch được. Đề bài phải mô tả đủ để người học viết được mà không cần đọc test.

## Cú pháp test theo ngôn ngữ

### JavaScript (engine Boa — ES2023, chạy trong sandbox Rust)
Có: `test/it`, `describe`, `expect(x).toBe / toEqual / toStrictEqual / toBeTruthy / toBeFalsy / toBeNull / toBeUndefined / toBeDefined / toContain / toHaveLength / toMatch / toThrow / toBeGreaterThan / toBeLessThan / toBeCloseTo / toBeInstanceOf / toHaveProperty / toHaveBeenCalled / toHaveBeenCalledTimes / toHaveBeenCalledWith`, `.not`, `jest.fn()` (`.mock.calls`, `mockReturnValue`, `mockImplementation`), test `async` (dùng `const v = await p; expect(v)…`; kiểm tra reject bằng `try { await p } catch (e) { expect(e.message).toBe(…) }` — **không có** `.resolves/.rejects`), fake timers (`setTimeout/setInterval` giả, `jest.advanceTimersByTime(ms)`, `jest.runAllTimers()`, `Date.now()` theo đồng hồ giả), `btoa/atob`, `console.log`.
React hooks tối giản: `useState, useReducer, useEffect, useRef, useMemo, useCallback`, `renderHook`, `act`.
**Không có**: DOM, `fetch`, `URL`, `URLSearchParams`, `TextEncoder`, `structuredClone`, `require/import`, Node API, cú pháp TypeScript. Tự cài đặt phần cần thiết hoặc mô phỏng bằng object.
Lưu ý timers: đừng `await` promise phụ thuộc `setTimeout` trước khi gọi `jest.advanceTimersByTime`.
```js
test('cộng', () => { expect(add(1, 2)).toBe(3); });
```

### Python 3.14 (`python3 -I`, chỉ thư viện chuẩn — có `sqlite3`, `json`, `re`, `asyncio`, `dataclasses`, `hashlib`…)
```python
@test("mô tả")
def _():
    expect(add(1, 2)).to_equal(3)
    expect([1, 2]).to_contain(2)
    expect(lambda: parse("x")).to_raise(ValueError, match="invalid")
    expect(x).not_.to_be_none()

@test("async")
async def _():
    expect(await fetch_all()).to_have_length(3)
```
Matcher: `to_be, to_equal, to_be_true, to_be_false, to_be_none, to_contain, to_have_length, to_be_instance_of, to_be_close_to, to_raise(exc, match=...)`, phủ định `.not_`. Có thể dùng `assert` thường.
Bài SQL: dùng `sqlite3.connect(":memory:")` trong code/test.

### Rust (rustc 2021, chỉ `std`, không crate ngoài)
Code học viên không được định nghĩa `fn main`. Test viết bằng macro:
```rust
bovabon_tests! {
    "cộng hai số" => { assert_eq!(add(1, 2), 3); },
    "tràn số trả None" => { assert_eq!(checked(i32::MAX), None); },
}
```
Mỗi test là một khối chạy riêng (panic = fail). Có thể khai báo `use std::collections::HashMap;` trong code. Starter thường dùng `todo!()` hoặc trả giá trị sai (vẫn phải biên dịch được — `todo!()` hợp lệ).

### PHP 8.5 (không framework, không namespace, không `declare(strict_types)`)
```php
test('cộng', function () {
    expect(add(1, 2))->toBe(3);
    expect(fn () => divide(1, 0))->toThrow(DivisionByZeroError::class);
    expect($arr)->toHaveCount(2)->toContain('a');
    expect($x)->not->toBeNull();
});
```
Matcher: `toBe (===), toEqual (==), toBeTrue, toBeFalse, toBeNull, toBeGreaterThan, toBeLessThan, toBeInstanceOf, toHaveCount, toHaveKey, toMatch(regex), toContain, toThrow(class?, message?)`, phủ định `->not->`. Code/test có thể mở đầu bằng `<?php`.
Với bài Laravel: mô phỏng khái niệm (service container, middleware pipeline, validation rules, Collection…) bằng PHP thuần.

## Hoàn tất
Khi `check` báo `✅`, kết thúc với một tóm tắt ngắn: số module, số câu theo dạng, danh sách bài code.
