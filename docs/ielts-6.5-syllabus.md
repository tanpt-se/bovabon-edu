# Đề cương "Luyện thi IELTS 6.5" (Academic)

Tài liệu căn cứ cho các job soạn `data/english-ielts-*.toml`. Mục tiêu: người học (người Việt, thường là dân IT, đã xong khoảng B1) học hết khu này thì **nắm chắc kiến thức và chiến lược tương đương band 6.5**, tức B2 vững, bắt đầu chạm C1.

## 1. Đầu ra mong muốn (band 6.5)

| Kỹ năng | Đầu ra |
|---|---|
| Reading | Làm đúng khoảng 27–29/40 câu Academic. Đây là bảng quy đổi tham khảo, thay đổi theo từng đề. Nhận ra paraphrase, phân biệt FALSE và NOT GIVEN, tìm ý chính đoạn, hoàn thành 3 bài trong 60 phút. |
| Listening | Làm đúng khoảng 27–29/40 câu (cũng là tham khảo). Viết đúng chính tả, số, ngày tháng. Theo được signpost, không bị bẫy bởi thông tin bị sửa lại. |
| Writing | Task 1: có overview rõ, chọn và so sánh số liệu chính, ≥ 150 từ. Task 2: trả lời đủ mọi phần đề, lập trường rõ, mỗi đoạn một ý chính được phát triển. Từ nối đa dạng, không máy móc. Có từ vựng ít phổ biến, collocation đúng. Trộn câu đơn và câu phức, nhiều câu không lỗi. |
| Speaking | Trả lời mở rộng (lý do, ví dụ, so sánh) mà không ngắt quãng dài. Nói 1–2 phút ở Part 2 theo dàn ý. Diễn đạt lại khi thiếu từ. Phát âm rõ trọng âm từ và câu. |
| Nền tảng | Ngữ pháp và từ vựng ở mục 3, 4 dùng chính xác. Tránh được các lỗi hay gặp của người Việt ở mục 5. |

**Giới hạn của app (phải nói rõ trong bài học):** app chỉ có chữ, không có audio hay ghi âm.
- Listening và Speaking được luyện qua transcript, chiến lược, chính tả, mẫu câu và phân tích câu trả lời mẫu.
- Người học cần luyện thêm với audio thật và tự ghi âm. Bài học nên gợi ý cách tự luyện, nhưng không dẫn link tài liệu có bản quyền.
- Writing được chấm theo từ khoá. Chấm như vậy chỉ kiểm tra được các *thành phần bắt buộc*, không đánh giá được band. Vì vậy mọi câu essay phải có `model_answer` mẫu band 7 và phần `explanation` kèm checklist tự chấm theo 4 tiêu chí.

## 2. Định dạng bài thi (để bài học dạy đúng)

| Phần | Cấu trúc | Thời gian |
|---|---|---|
| Listening | 4 phần, 40 câu. Phần 1: hội thoại đời sống. Phần 2: độc thoại đời sống. Phần 3: thảo luận học thuật (2–4 người). Phần 4: bài giảng học thuật. | ~30 phút |
| Reading (Academic) | 3 bài đọc dài, 40 câu. Các dạng câu hỏi: TRUE/FALSE/NOT GIVEN, YES/NO/NOT GIVEN, matching headings, matching information, matching features, matching sentence endings, sentence/summary/note/table/flow-chart/diagram completion, multiple choice, short answer. | 60 phút |
| Writing | Task 1 (≥ 150 từ, ~20 phút): biểu đồ, bảng, quy trình, bản đồ. Task 2 (≥ 250 từ, ~40 phút): bài luận. Task 2 có trọng số gấp đôi Task 1. | 60 phút |
| Speaking | Part 1: hỏi đáp chủ đề quen thuộc (4–5 phút). Part 2: 1 phút chuẩn bị, nói 1–2 phút theo cue card. Part 3: thảo luận trừu tượng (4–5 phút). | 11–14 phút |

Tiêu chí chấm. Bài học tự diễn giải bằng lời của mình, không chép nguyên văn band descriptors:
- Writing: Task Achievement (Task 1) hoặc Task Response (Task 2), Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy.
- Speaking: Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation.

Bài học phải chỉ ra sự khác biệt giữa band 6 và band 7 ở từng tiêu chí. Band 6.5 nghĩa là ổn định ở band 6 và đạt band 7 ở một phần tiêu chí.

## 3. Lộ trình và module (id cố định, đã khai báo trong `data/categories.toml`)

Mọi file đều có các trường sau:
- `area = "english"`, `group = "Tiếng Anh"`, không khai báo `docs` hay `sources`.
- Mỗi câu có đúng 1 tag band và `difficulty` khớp với band:

| Tag | difficulty | Ý nghĩa |
|---|---|---|
| `band:5.5` | 1 | củng cố nền |
| `band:6.5` | 2 | đích chính |
| `band:7` | 3 | kéo lên |

- Có thể thêm tag dạng bài, ví dụ `tags = ["band:6.5", "tfng"]`.
- Chỉ tiêu đo bằng `python3 scripts/bank-stats.py`:
  - band 5.5 chiếm ≥ 20%, band 6.5 ≥ 45%, band 7 ≥ 20%;
  - mỗi module ≥ 10 câu và `lesson` ≥ 1500 ký tự.

### `english-ielts-grammar` — Ngữ pháp cho IELTS (≥ 120 câu, id `ig-001`…)
| Module | Trọng tâm |
|---|---|
| `ig-tense-control` | Thì trong Task 1 (quá khứ, dự báo tương lai, hiện tại hoàn thành), giữ nhất quán thì; thì trong Speaking Part 2 kể chuyện |
| `ig-complex-sentences` | Mệnh đề trạng ngữ (although, whereas, provided that, so that), câu ghép đúng dấu câu, tránh run-on/fragment |
| `ig-relative-participle` | Mệnh đề quan hệ xác định và không xác định, rút gọn bằng phân từ, cụm phân từ đầu câu |
| `ig-conditionals-hypothesis` | Câu điều kiện 0–3 và hỗn hợp, *unless / as long as*, giả định (*If governments were to…*) |
| `ig-passive-impersonal` | Bị động trong quy trình (Task 1 process), *It is believed / is thought that…*, *X is said to…* |
| `ig-nominalisation-noun-phrases` | Danh hoá, cụm danh từ dài, *the + so sánh hơn*, văn phong học thuật |
| `ig-comparison-data` | So sánh hơn/nhất, *twice as… as*, *the highest proportion*, *compared with*, *while*; mô tả số liệu chính xác |
| `ig-modals-hedging` | Mức chắc chắn (*may, might, is likely to, tend to*), đề xuất (*should, ought to, it is essential that…*) |
| `ig-accuracy-errors` | Mạo từ, số ít/nhiều, danh từ không đếm được (information, research, advice), hoà hợp chủ–vị, dấu phẩy |

### `english-ielts-vocab` — Từ vựng theo chủ đề IELTS (≥ 160 câu, id `iv-001`…)
| Module | Trọng tâm |
|---|---|
| `iv-paraphrase-word-formation` | Họ từ (economy/economic/economical), paraphrase bằng từ đồng nghĩa, đổi loại từ hoặc đổi cấu trúc; nhận ra paraphrase trong Reading/Listening |
| `iv-education` | Giáo dục, học tập suốt đời, học trực tuyến, thi cử |
| `iv-work-economy` | Việc làm, thất nghiệp, tự động hoá, thu nhập, tiêu dùng |
| `iv-technology-media` | Công nghệ, AI, mạng xã hội, quyền riêng tư, tin giả |
| `iv-environment-energy` | Biến đổi khí hậu, năng lượng tái tạo, rác thải, đa dạng sinh học |
| `iv-health-lifestyle` | Sức khoẻ, chế độ ăn, thể thao, y tế cộng đồng, già hoá dân số |
| `iv-society-urban` | Đô thị hoá, nhà ở, giao thông, tội phạm và pháp luật |
| `iv-globalisation-culture` | Toàn cầu hoá, du lịch, văn hoá, ngôn ngữ, di cư |
| `iv-government-science` | Chính sách công, thuế, ngân sách, nghiên cứu khoa học, khám phá không gian |
| `iv-academic-linking` | Từ nối học thuật theo chức năng (bổ sung, đối lập, nhân quả, ví dụ, kết luận), từ vựng học thuật chung (analyse, significant, factor…) |

Mỗi module chủ đề gồm:
- collocation (động từ + danh từ, tính từ + danh từ),
- cặp từ dễ nhầm,
- cụm dùng được cho Task 2 / Speaking Part 3,
- 1–2 essay viết câu hoặc đoạn có dùng từ của module.

### `english-ielts-reading` — Reading Academic (≥ 120 câu, id `ir-001`…)
| Module | Trọng tâm |
|---|---|
| `ir-strategy-paraphrase` | Skim/scan, đọc câu hỏi trước, phân bổ 20 phút/bài, nhận diện paraphrase |
| `ir-tfng-ynng` | TRUE/FALSE/NOT GIVEN và YES/NO/NOT GIVEN: so sánh từng phần nhận định, bẫy từ chỉ mức độ (all, some, only, always) |
| `ir-matching-headings` | Tìm ý chính đoạn, phân biệt ý chính và chi tiết |
| `ir-matching-information-features` | Matching information, features, sentence endings |
| `ir-completion` | Sentence/summary/note/table/flow-chart completion; giới hạn số từ; ngữ pháp hoá chỗ trống |
| `ir-mcq-short-answer` | Multiple choice một/nhiều đáp án, short answer; loại trừ phương án |
| `ir-full-passages` | 4–6 bài đọc dài (700–900 từ) luyện theo thời gian, mỗi bài nhiều dạng câu |

### `english-ielts-listening` — Listening qua transcript (≥ 80 câu, id `il-001`…)
| Module | Trọng tâm |
|---|---|
| `il-format-numbers-spelling` | Định dạng bài thi; số, ngày tháng, giờ, giá tiền, đánh vần tên, mã bưu chính; lỗi chính tả hay gặp |
| `il-section1-forms` | Phần 1: form/note completion (đặt phòng, đăng ký) |
| `il-section2-maps-plans` | Phần 2: map/plan labelling, từ chỉ hướng và vị trí |
| `il-section3-discussion` | Phần 3: theo dõi nhiều người nói, đồng ý/không đồng ý, MCQ/matching |
| `il-section4-lecture` | Phần 4: note completion bài giảng, từ vựng học thuật |
| `il-distractors-signposting` | Bẫy sửa thông tin (*Actually, sorry — it's…*), signpost (*Moving on to…, The main reason…*) |

### `english-ielts-writing-task1` — Writing Task 1 (≥ 80 câu, id `iw1-001`…)
| Module | Trọng tâm |
|---|---|
| `iw1-format-overview` | Cấu trúc 4 đoạn, paraphrase đề, viết overview (bắt buộc cho band ≥ 6), không nêu ý kiến cá nhân |
| `iw1-line-bar-trends` | Ngôn ngữ xu hướng: động từ/danh từ, trạng từ mức độ, *peak / bottom out / plateau*, chọn số liệu chính |
| `iw1-pie-table-proportions` | Tỉ lệ, phân số, *account for / make up*, nhóm dữ liệu khi có nhiều hạng mục |
| `iw1-process-diagram` | Quy trình (bị động, từ chỉ trình tự), chu trình tự nhiên và sản xuất |
| `iw1-maps-change` | So sánh bản đồ hai thời điểm, từ vựng xây dựng và biến đổi |
| `iw1-mixed-band-upgrade` | Biểu đồ kết hợp; nâng từ band 6 lên 7 (sửa bài mẫu band 5–6) |

Dữ liệu biểu đồ được mô tả bằng bảng Markdown hoặc mô tả chữ ngay trong `prompt`.

### `english-ielts-writing-task2` — Writing Task 2 (≥ 100 câu, id `iw2-001`…)
| Module | Trọng tâm |
|---|---|
| `iw2-task-analysis` | Nhận dạng dạng đề (opinion, discussion, advantages/disadvantages, problem–solution, two-part question), gạch chân yêu cầu, tránh lạc đề |
| `iw2-structure-thesis` | Mở bài: paraphrase đề và thesis rõ ràng; kết bài; lập dàn ý trong 5 phút |
| `iw2-idea-development` | Mô hình đoạn văn (topic sentence → giải thích → ví dụ → liên hệ lại), tránh liệt kê ý mà không phát triển |
| `iw2-cohesion-coherence` | Từ nối đúng chức năng, quy chiếu (this, such, these), chia đoạn, lỗi dùng từ nối máy móc |
| `iw2-opinion-discussion` | Dạng opinion và discussion; giữ lập trường nhất quán; nhượng bộ rồi phản biện |
| `iw2-advantages-problem-solution` | Dạng advantages/disadvantages, problem–solution, two-part question |
| `iw2-band-descriptors-editing` | Tự chấm theo 4 tiêu chí; sửa bài band 5.5 thành band 7; lỗi hay gặp |

### `english-ielts-speaking` — Speaking (≥ 80 câu, id `isp-001`…)
| Module | Trọng tâm |
|---|---|
| `isp-format-descriptors` | Định dạng bài thi, 4 tiêu chí, band 6 khác band 7 thế nào |
| `isp-part1` | Mở rộng câu trả lời (trả lời → lý do → ví dụ), chủ đề quen thuộc |
| `isp-part2-long-turn` | Ghi chú trong 1 phút, dàn ý theo cue card, kể chuyện bằng thì quá khứ |
| `isp-part3-discussion` | Trả lời trừu tượng: so sánh quá khứ và hiện tại, suy đoán tương lai, đánh giá |
| `isp-fluency-discourse` | Discourse marker tự nhiên, câu kéo thời gian, tự sửa lỗi, paraphrase khi thiếu từ |
| `isp-pronunciation-text` | Trọng âm từ (họ từ đổi trọng âm: *photograph → photography*), âm cuối, *-ed/-s*, trọng âm câu và ngữ điệu (luyện qua chữ) |

## 4. Kỹ thuật soạn câu hỏi trong app

| Dạng IELTS | Cách biểu diễn |
|---|---|
| TRUE/FALSE/NOT GIVEN | `fill` nhiều ô dùng chung 1 đoạn văn (150–300 từ) trong `prompt`. Mỗi nhận định 1 ô, `blanks` chấp nhận `["true", "t"]`, `["false", "f"]`, `["not given", "ng"]`. Hoặc dùng `single` với options `["TRUE", "FALSE", "NOT GIVEN"]`. |
| Matching headings | Đoạn văn đánh dấu A, B, C…, danh sách heading i–viii. `fill` mỗi đoạn 1 ô, đáp án là số La Mã (`["iv"]`). |
| Completion | `fill` với chỉ dẫn "NO MORE THAN TWO WORDS". Liệt kê đủ biến thể chấp nhận (số ít/nhiều nếu đề cho phép, có hoặc không có mạo từ). |
| MCQ | `single` / `multiple`. Phương án nhiễu lấy từ chính văn bản: đúng từ nhưng sai ý. |
| Listening | Transcript (đánh dấu người nói) trong `prompt` cùng form hoặc note có `{{blank}}`. Số và ngày: liệt kê biến thể (`["15 march", "march 15", "15th march"]`). Khoảng trắng bị bỏ khi chấm, nên đừng phụ thuộc khoảng trắng. |
| Writing | `single` chọn overview/thesis tốt nhất; `multiple` tìm câu có lỗi; `fill` từ xu hướng hoặc từ nối; `essay` viết mở bài, overview hoặc 1 đoạn thân bài. Từ khoá kiểm tra *thành phần bắt buộc*. Có `model_answer` band 7 và checklist tự chấm trong `explanation`. |
| Speaking | `single` chọn câu trả lời mở rộng tốt nhất; `fill` discourse marker; `single` trọng âm (ví dụ "Which syllable is stressed in *economic*?"); `essay` viết câu trả lời Part 1 hoặc Part 3 (3–5 câu) theo khung lý do và ví dụ. |

Yêu cầu chung:
- **Bài đọc, transcript, đề viết và đề nói đều tự soạn**:
  - Không chép từ sách Cambridge IELTS, trang IELTS chính thức hay bài mẫu trên mạng.
  - Nêu tên tổ chức, nhà nghiên cứu hay số liệu thì phải là hư cấu hợp lý hoặc kiến thức phổ thông. Đừng bịa số liệu nghiên cứu thật.
- Giải thích bằng tiếng Việt; trích đúng câu trong văn bản làm căn cứ ("Đoạn C, câu 2: *…*").
- Lựa chọn nhiễu dựa trên lỗi thật của người Việt và bẫy thật của IELTS.
- Độ dài và độ khó: band 5.5 dùng văn bản ngắn, từ vựng B1–B2. Band 6.5 là B2 học thuật. Band 7 có câu dài, hàm ý, paraphrase xa.
- `lesson` ≥ 1500 ký tự, gồm:
  - chiến lược theo bước,
  - bảng ngôn ngữ hoặc mẫu câu,
  - ví dụ phân tích (vì sao đáp án đúng),
  - lỗi hay gặp,
  - mẹo quản lý thời gian,
  - "Tự luyện ngoài app" nếu là Listening hoặc Speaking.

## 5. Lỗi hay gặp của người Việt (đưa vào phương án nhiễu và giải thích)

- **Mạo từ, số nhiều, danh từ không đếm được:** thiếu mạo từ hoặc *-s*; viết ~~informations~~, ~~researches~~.
- **Chủ ngữ và động từ:** ~~There have many~~; nhầm ~~people is~~.
- **Cấu trúc câu:** ~~Although…, but…~~; câu không có động từ chính (fragment); run-on bằng dấu phẩy.
- **Từ vựng dễ nhầm:** *rise* và *raise*, *affect* và *effect*, *economic* và *economical*, *lose* và *loose*.
- **Lỗi trong bài viết:** ~~In my opinion, I think~~; Task 1 nêu nguyên nhân hoặc ý kiến không có trong dữ liệu; thiếu overview; liệt kê mọi số liệu.
- **Lỗi trong Reading và Speaking:**
  - Reading: nhầm FALSE với NOT GIVEN khi văn bản không đề cập.
  - Speaking: trả lời 1 câu cụt; đọc thuộc lòng bài mẫu.
- **Phát âm:** bỏ âm cuối, sai trọng âm của họ từ, đọc *-ed* thành âm tiết riêng.

## 6. Thứ tự học gợi ý (ghi ở lesson đầu mỗi lộ trình)

1. Xong CEFR B1 (hoặc tự đánh giá tương đương).
2. Học song song **CEFR B2** và **Ngữ pháp IELTS** / **Từ vựng IELTS**.
3. Reading và Listening. Đây là hai kỹ năng tăng điểm nhanh nhất nhờ chiến lược.
4. Writing Task 1, rồi Task 2.
5. Speaking.
6. Thi thử theo danh mục (tính năng "Thi thử" của app) cho tới khi đạt ≥ 70% câu band 6.5.
