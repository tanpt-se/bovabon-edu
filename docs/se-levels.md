# Khung cấp độ câu hỏi SE: Junior → Lead

Tài liệu căn cứ cho mọi job soạn/mở rộng lộ trình `area = "dev"`. Mục tiêu: người học luyện hết một lộ trình thì **trả lời được câu hỏi phỏng vấn và xử lý tình huống thực tế ở đúng cấp mình đang nhắm**, từ Junior tới Tech Lead.

## 1. Gắn cấp độ cho câu hỏi

Mỗi câu hỏi có **đúng một** tag level trong `tags` và `difficulty` khớp level:

| Tag | `difficulty` | Người học ở cấp này cần… | Dạng câu điển hình |
|---|---|---|---|
| `level:junior` | 1 | Hiểu cú pháp, API lõi, đọc code ngắn, dự đoán output, sửa lỗi hiển nhiên. | single "đoạn code in ra gì", fill tên API, code nhỏ (hàm thuần) |
| `level:middle` | 2 | Dùng đúng công cụ trong tình huống thực tế: chọn API phù hợp, debug lỗi thường gặp, viết test, nắm pitfall, hiệu năng cơ bản. | single/multiple theo tình huống, debug, code có biên & lỗi, essay giải thích |
| `level:senior` | 3 | Hiểu bên trong (internals), đánh đổi (trade-off), hiệu năng/concurrency, bảo mật, thiết kế module, xử lý sự cố production, migration. | multiple "chọn các nhận định đúng", essay so sánh phương án, code thiết kế (cache, queue, retry…) |
| `level:lead` | 3 | Ra quyết định kiến trúc và quy trình cho cả team: system design, khả năng mở rộng, độ tin cậy, observability, chiến lược test/release, nợ kỹ thuật, review code, chuẩn hoá, mentoring, đánh giá rủi ro. | tình huống nhiều ràng buộc ("team 6 người, 2 tuần, traffic x10…"), chọn chiến lược, essay ADR/kế hoạch, code mô phỏng pattern hệ thống |

```toml
difficulty = 3
tags = ["level:senior", "concurrency"]   # có thể thêm tag chủ đề sau tag level
```

Quy tắc:
- Câu cũ đã được gắn tự động theo `difficulty` (1→junior, 2→middle, 3→senior). Khi rà, nếu thấy câu gắn **sai cấp** thì sửa cả tag lẫn `difficulty` (giữ nguyên id).
- `level:lead` không phải "câu khó hơn senior" mà là **câu về quyết định**: phạm vi team/hệ thống, có ràng buộc (thời gian, người, chi phí, rủi ro), không có đáp án "đúng tuyệt đối" — đáp án đúng là lựa chọn hợp lý nhất với ràng buộc đã nêu và phần giải thích phải nói vì sao các lựa chọn còn lại kém hơn **trong bối cảnh đó**.
- Không dồn level vào một module: mỗi module cũ nên có đủ junior → senior; câu lead nằm chủ yếu ở module `<id lộ trình>-lead`, có thể rải thêm vào module chuyên đề.

## 2. Chỉ tiêu mỗi lộ trình dev

Đo bằng `python3 scripts/bank-stats.py data/<file>.toml` (thêm `--check` để lấy exit code).

| Chỉ tiêu | Tối thiểu |
|---|---|
| Tổng câu | 120 |
| `level:junior` / `middle` / `senior` / `lead` | 30 / 40 / 30 / 18 |
| Bài `code` | 12, mỗi level ít nhất 1 bài |
| `essay` | 8 (ưu tiên câu phỏng vấn senior/lead) |
| Module `<id lộ trình>-lead` | bắt buộc (đã khai báo sẵn trong `data/categories.toml`) |

Lộ trình đã vượt tổng (react, react-native) vẫn phải đạt sàn từng level. Không cần vượt chỉ tiêu quá xa — ưu tiên chất lượng.

## 3. Module `<id>-lead` — "Góc nhìn Tech Lead"

- `title`: "Góc nhìn Tech Lead" (hoặc sát nghĩa theo lộ trình), `description` liệt kê chủ đề.
- `lesson` ≥ 1500 ký tự: khung ra quyết định (bảng so sánh phương án theo tiêu chí), checklist review, ví dụ ADR ngắn, anti-pattern ở quy mô team, số liệu tham khảo hợp lý (đánh dấu là ước lượng).
- `sources`: các trang DevDocs liên quan (nếu có trong mục lục).

## 4. Chủ đề gợi ý theo lộ trình

Senior = chiều sâu kỹ thuật; Lead = quyết định cấp hệ thống/team. Dùng làm danh sách kiểm tra độ phủ, không cần làm hết.

| Lộ trình | Senior | Lead |
|---|---|---|
| `frontend` (JS, CSS, TS cơ bản) | event loop & microtask, memory leak, rendering pipeline (layout/paint/composite), CSS containment, a11y nâng cao | performance budget & Core Web Vitals làm KPI, chiến lược browser support/polyfill, design system & token, quy chuẩn a11y cho team |
| `frontend-tooling` | module graph, tree-shaking, code splitting, source map, cache busting | chọn bundler/monorepo (Vite, turbo/nx), chiến lược CI cache, migration build tool, quản lý dependency & bảo mật supply chain |
| `typescript` | variance, conditional/mapped type, inference, declaration merging, strictness | lộ trình bật `strict` cho codebase lớn, chia package & project references, type cho API contract (codegen), quy ước type cho team |
| `react` | reconciliation, concurrent rendering, Suspense, memo hoá đúng chỗ, stale closure, React Compiler | kiến trúc state (server state vs client state), chia boundary & error handling, micro-frontend có nên không, migrate lên React 19, chiến lược test UI |
| `nextjs` | RSC vs client component, caching layers, revalidate, streaming, middleware edge | chọn rendering strategy theo trang (SSG/ISR/SSR/CSR), chi phí hạ tầng, multi-tenant, observability & rollout an toàn |
| `vue` | reactivity internals, `shallowRef`, watcher flush, SSR hydration mismatch | Pinia store design, chia module cho app lớn, migrate Vue 2→3, chuẩn component library |
| `angular` | change detection, signals vs zone, DI hierarchy, RxJS operator đúng chỗ | chuyển sang standalone/zoneless, nx workspace, chiến lược state (signals/NgRx), nâng version theo lộ trình |
| `react-native` | bridge vs JSI/New Architecture, list performance, re-render, native module | chiến lược release (OTA vs store), crash monitoring, chia codebase iOS/Android/web, quyết định native vs cross-platform |
| `testing` | test double đúng loại, flaky test, contract test, coverage có ý nghĩa | test pyramid/trophy cho team, quality gate trong CI, chiến lược E2E (chọn luồng, môi trường, dữ liệu), thời gian pipeline |
| `nodejs` | event loop phases, stream & backpressure, worker threads, memory profiling | thiết kế service (monolith vs microservice), graceful shutdown & health check, rate limit, versioning API, runbook sự cố |
| `python-backend` / `django` | GIL, async vs sync view, ORM N+1, transaction isolation, Celery | cấu trúc dự án lớn, chiến lược migration DB không downtime, scaling worker, quan sát hiệu năng |
| `php-laravel` | container & lifecycle, queue/job retry, Eloquent N+1, cache tags | tách module/domain, Octane có nên không, chiến lược queue & horizon, nâng version framework |
| `go` | goroutine leak, channel pattern, context cancel, race detector, escape analysis | thiết kế service Go cho team (layout, interface boundary), error handling convention, profiling production |
| `rust` | ownership nâng cao, lifetime, `Send/Sync`, async runtime, unsafe boundary | chọn Rust cho phần nào của hệ thống, chiến lược FFI, compile time & workspace, code review an toàn bộ nhớ |
| `databases` | index & query plan, isolation level, lock, deadlock, replication lag | schema evolution, sharding/partitioning, chọn SQL vs NoSQL, backup/restore & RPO/RTO, migration lớn |
| `devops` | container internals, Kubernetes scheduling/probes, IaC drift, secrets | chiến lược deploy (blue-green/canary), SLO/error budget, on-call & postmortem, chi phí cloud (FinOps) |
| `web-api` | HTTP caching, idempotency, CORS, auth (OAuth2/OIDC, JWT pitfall), pagination | thiết kế API công khai & versioning, rate limit/quota, deprecation policy, API gateway |

## 5. Lộ trình mới `system-design` (Kiến trúc & Lead)

File `data/system-design.toml`, `area = "dev"`, không có `docs`. Tập trung senior/lead (sàn: senior ≥ 40, lead ≥ 35 trong 120+ câu). Module (id cố định, đã khai báo trong `data/categories.toml`):

| id | Nội dung |
|---|---|
| `sd-fundamentals` | latency/throughput, ước lượng dung lượng (back-of-the-envelope), CAP/PACELC, consistency model |
| `sd-scaling-data` | replication, partitioning/sharding, consistent hashing, read/write split, hot key |
| `sd-caching` | cache-aside/write-through/write-back, TTL & invalidation, stampede, CDN |
| `sd-async-messaging` | queue vs log (Kafka-style), at-least-once, idempotent consumer, outbox, saga |
| `sd-reliability` | timeout, retry + backoff + jitter, circuit breaker, bulkhead, rate limiting (token/leaky bucket), graceful degradation |
| `sd-api-design` | REST vs gRPC vs GraphQL, pagination, versioning, idempotency key, webhook |
| `sd-observability` | log/metric/trace, SLI/SLO/error budget, alert tốt, incident response, postmortem không đổ lỗi |
| `sd-security` | authn/authz kiến trúc, secrets, threat modeling, least privilege, multi-tenant isolation |
| `sd-case-studies` | thiết kế URL shortener, news feed, chat, rate limiter, notification, file upload — dạng câu hỏi từng bước |
| `system-design-lead` | ADR, đánh giá trade-off, ước lượng & quản lý rủi ro, code review, nợ kỹ thuật, mentoring, giao tiếp với stakeholder |

Bài code (JavaScript hoặc Python): LRU cache, token bucket, retry với backoff (fake timers), consistent hashing ring, idempotency store, circuit breaker, outbox relay mô phỏng, phân trang cursor, debounce/aggregate metric.
