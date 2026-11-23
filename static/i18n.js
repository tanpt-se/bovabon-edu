// Đa ngôn ngữ giao diện: tiếng Việt (gốc) / tiếng Anh.
//
// - Khoá từ điển = đúng chuỗi tiếng Việt trong giao diện (đã trim), giá trị = bản tiếng Anh.
// - Chuỗi tĩnh: chỉ cần thêm vào EN, app tự dịch mọi text node / aria-label / title / placeholder
//   khớp nguyên văn (MutationObserver), không cần sửa app.js.
// - Chuỗi có biến: trong app.js dùng t('Đã lưu: bật {n}/{m} danh mục', { n, m }) và thêm khoá có {biến} vào EN.
// - Nội dung bài học/câu hỏi KHÔNG dịch ở đây: server trả bản dịch qua ?lang=en (data/i18n/en/*.toml).
(function () {
  'use strict';
  const KEY = 'bovabon.lang';
  const LANGS = ['vi', 'en'];

  const EN = {
    // index.html — khung app
    'Bỏ qua điều hướng, tới nội dung': 'Skip to content',
    'Đóng menu': 'Close menu',
    'Mở menu': 'Open menu',
    'Tổng quan': 'Overview',
    'Danh mục': 'Categories',
    'Luyện tập': 'Practice',
    'Thi thử': 'Mock exam',
    'Ôn câu sai': 'Review mistakes',
    'Kho câu hỏi': 'Question bank',
    'Cá nhân': 'Personal',
    'Tiến độ': 'Progress',
    'Cài đặt': 'Settings',
    'Đổi tông nền': 'Toggle theme',
    'Chuyển sang giấy sáng': 'Switch to light paper',
    'Chuyển sang giấy tối': 'Switch to dark paper',
    'Không cần đăng nhập; tiến độ lưu trên trình duyệt này.': 'No sign-in needed; progress is saved in this browser.',
    'Đang tải kho dữ liệu…': 'Loading the question bank…',
    'Khu vực học': 'Learning area',
    '💻 Lập trình': '💻 Programming',
    '🌏 Tiếng Anh': '🌏 English',
    'Lập trình': 'Programming',
    'Tiếng Anh': 'English',
    'Ngôn ngữ': 'Language',
    // Trang module — tab tài liệu gốc
    'Bài học tóm tắt': 'Lesson summary',
    'Tài liệu gốc': 'Original docs',
    'Chọn một trang tài liệu để đọc ngay tại đây.': 'Pick a documentation page to read it right here.',
    'Đang tải tài liệu…': 'Loading documentation…',
    'Không tải được tài liệu (cần kết nối mạng).': 'Could not load the documentation (an internet connection is required).',
    'Mở trên DevDocs': 'Open on DevDocs',
    'Nội dung từ DevDocs, thuộc giấy phép của từng bộ tài liệu gốc.': 'Content from DevDocs, under the license of each original documentation set.',
    'Đọc thêm trên DevDocs': 'Read more on DevDocs',
    'Tài liệu tham khảo DevDocs': 'DevDocs references',
    'Tài liệu gốc trên DevDocs': 'Original docs on DevDocs',
    'tổng quan': 'overview',
    // Bố cục mới (trang chủ, danh mục)
    'Học tiếp': 'Continue learning',
    'Bắt đầu': 'Start here',
    'Vào học': 'Start learning',
    'Ngày học liên tiếp': 'Day streak',
    'Câu cần ôn lại': 'To review',
    'Đề tính giờ, chấm khi nộp bài': 'Timed, graded when you submit',
    'Chọn một danh mục để học bài, làm câu hỏi và bài code theo chủ đề.': 'Pick a category to read lessons, answer questions and solve coding exercises by topic.',
    'câu hoàn thành': 'questions done',
    // Chung
    'Khác': 'Other',
    'Huỷ': 'Cancel',
    'Tiếp tục': 'Continue',
    'Xác nhận thao tác': 'Confirm action',
    'Xác nhận': 'Confirm',
    'Lỗi': 'Error',
    'Lỗi {s}': 'Error {s}',
    'Lỗi: {e}': 'Error: {e}',
    'Lỗi hiển thị: {e}': 'Display error: {e}',
    'Không tải được dữ liệu: {e}': 'Could not load data: {e}',
    'Không tìm thấy': 'Not found',
    'Không tìm thấy trang.': 'Page not found.',
    'Về trang chủ': 'Back to home',
    'Độ khó {d} trên 3': 'Difficulty {d} of 3',
    'Trắc nghiệm': 'Single choice',
    'Nhiều đáp án': 'Multiple choice',
    'Điền khuyết': 'Fill in the blank',
    'Tự luận': 'Short answer',
    'Bài tập code': 'Coding exercise',
    'go run (toolchain cục bộ)': 'go run (local toolchain)',
    'rustc (toolchain cục bộ)': 'rustc (local toolchain)',
    'PHP CLI cục bộ': 'local PHP CLI',
    'Lộ trình CEFR': 'CEFR path',
    'Tiếng Anh cho IT': 'English for IT',
    'Từ vựng & cụm từ': 'Vocabulary & phrases',
    'Luyện thi IELTS 6.5': 'IELTS 6.5 prep',
    'Kiến trúc & Lead': 'Architecture & leadership',
    'Ô trống {n}': 'Blank {n}',
    'Ngoại ngữ': 'Languages',
    'Dễ': 'Easy',
    'Trung bình': 'Medium',
    'Khó': 'Hard',
    // Thanh trên cùng
    '/ {n} câu hoàn thành': '/ {n} questions done',
    '{n} ngày học liên tiếp': '{n}-day streak',
    'Đồng bộ: {email}': 'Sync: {email}',
    'Đang đồng bộ…': 'Syncing…',
    'Lỗi đồng bộ': 'Sync error',
    'Đã đồng bộ': 'Synced',
    // Trang chủ
    'Lộ trình học': 'Learning paths',
    'Học theo chủ đề với trắc nghiệm, điền từ và tự luận ngắn; không có bài code.': 'Study by topic with multiple choice, fill-in-the-blank and short answers; no coding exercises.',
    'Chọn một dòng để xem bài học, câu hỏi và bài code theo chủ đề.': 'Pick a row to see its lessons, questions and coding exercises.',
    'Quy mô kho học': 'Library size',
    'danh mục': 'categories',
    'câu hỏi': 'questions',
    '{m} mục con, {q} câu': '{m} topics, {q} questions',
    ', {c} bài code': ', {c} coding exercises',
    '{p}% hoàn thành': '{p}% done',
    '{n} danh mục': '{n} categories',
    'Luyện tập nhanh': 'Quick practice',
    '10 câu ngẫu nhiên': '10 random questions',
    'Trộn câu hỏi từ mọi danh mục': 'A mix from every category',
    'Điền từ': 'Fill in the blank',
    'Luyện các câu điền vào chỗ trống': 'Practise gap-fill questions',
    '{n} bài code có unit test': '{n} exercises with unit tests',
    '{n} câu cần xem lại': '{n} questions to revisit',
    'Trả lời theo ý chính và đáp án mẫu': 'Answer by key points, compare with a model answer',
    'Ghi chú tiến độ': 'Progress notes',
    'Ghi chú': 'Notes',
    'Tiến độ học được lưu cục bộ trên trình duyệt này.': 'Your progress is stored locally in this browser.',
    'Lộ trình đã bắt đầu': 'Paths started',
    'Câu đã hoàn thành': 'Questions done',
    'Bài code đã qua': 'Exercises passed',
    'Chuỗi ngày học': 'Study streak',
    '{n} ngày': '{n} days',
    'Tiếp tục: {t}…': 'Continue: {t}…',
    'Bắt đầu với {t}': 'Start with {t}',
    'Mở bài thi thử': 'Open a mock exam',
    // Trang danh mục / module
    'Luyện toàn bộ ({n})': 'Practise all ({n})',
    'Ôn phỏng vấn ({n} câu tự luận)': 'Interview prep ({n} short answers)',
    'Bài code ({n})': 'Coding exercises ({n})',
    '{d}/{t} câu hoàn thành': '{d}/{t} questions done',
    'Mục con ({n})': 'Topics ({n})',
    'Luyện tập module ({n})': 'Practise this module ({n})',
    '{d}/{t} hoàn thành': '{d}/{t} done',
    'Nội dung module': 'Module content',
    'Câu hỏi ({n})': 'Questions ({n})',
    'Chưa có bài học.': 'No lesson yet.',
    'Luyện theo dạng bài': 'Practise by question type',
    'Bảng {i}: {t}. Cuộn ngang để xem đủ cột.': 'Table {i}: {t}. Scroll sideways to see every column.',
    'Cuộn ngang để xem đủ cột.': 'Scroll sideways to see every column.',
    'Không có câu hỏi nào.': 'No questions.',
    'Đã đánh dấu': 'Bookmarked',
    // Luyện tập
    'Luyện {types}': 'Practise: {types}',
    'Ngẫu nhiên {n} câu': '{n} random questions',
    'Bộ câu hỏi tuỳ chọn': 'Custom set',
    'Không có câu hỏi phù hợp.': 'No matching questions.',
    'Tiến trình': 'Progress',
    'Phím tắt: nhấn {a} đến {b} để chọn, {enter} để kiểm tra hoặc sang câu tiếp, dùng {l} và {r} để chuyển câu.': 'Shortcuts: press {a} to {b} to choose, {enter} to check or move on, {l} and {r} to switch questions.',
    'câu đúng': 'correct',
    'Hoàn thành phiên luyện tập': 'Practice session complete',
    'Bạn đã làm {d}/{n} câu trong phiên này.': 'You answered {d}/{n} questions in this session.',
    'Làm lại từ đầu': 'Start over',
    'Ôn các câu sai': 'Review mistakes',
    'Câu {i}/{n}': 'Question {i}/{n}',
    'Đánh dấu để ôn lại': 'Bookmark for review',
    'Đánh dấu': 'Bookmark',
    'Đã đánh dấu câu hỏi': 'Question bookmarked',
    'Đã bỏ đánh dấu': 'Bookmark removed',
    'Chọn một đáp án': 'Choose one answer',
    'Chọn các đáp án phù hợp': 'Choose all that apply',
    'Chọn các lựa chọn phù hợp.': 'Choose all that apply.',
    'Viết câu trả lời của bạn… (chấm theo các ý chính)': 'Write your answer… (graded by key points)',
    'Trước': 'Previous',
    'Kiểm tra': 'Check',
    'Kết thúc': 'Finish',
    'Câu tiếp': 'Next',
    'Bỏ qua': 'Skip',
    'Hoàn thành': 'Done',
    'Bạn chưa trả lời': 'You have not answered yet',
    'Đã chấm': 'Checked',
    'Làm lại': 'Try again',
    'Chính xác': 'Correct',
    'Đúng một phần ({p}%)': 'Partly correct ({p}%)',
    'Chưa đúng': 'Not quite',
    'Ý chính đã nêu:': 'Key points covered:',
    'chưa có': 'none yet',
    'Ý còn thiếu:': 'Missing points:',
    'Đáp án mẫu': 'Model answer',
    // Bài code
    'Bộ unit test có sẵn': 'Provided unit tests',
    'Xem mã nguồn test ({l})': 'View test source ({l})',
    'Code của bạn': 'Your code',
    'Khôi phục code khởi đầu': 'Restore starter code',
    'Đặt lại': 'Reset',
    'Trình soạn code': 'Code editor',
    'Chạy test': 'Run tests',
    'Gợi ý': 'Hint',
    'Lời giải': 'Solution',
    'Bài tiếp': 'Next exercise',
    'Đang chạy test trên server…': 'Running tests on the server…',
    ' (Go cần biên dịch, có thể mất vài giây)': ' (Go needs to compile, this can take a few seconds)',
    'Đang chạy kiểm thử.': 'Running tests.',
    'Kiểm thử gặp lỗi: {e}. Xem chi tiết bên dưới.': 'Tests failed with an error: {e}. See details below.',
    'Đã chạy {n} kiểm thử; tất cả đều đạt.': 'Ran {n} tests; all passed.',
    'Đã chạy {n} kiểm thử; {p} đạt, {f} chưa đạt.': 'Ran {n} tests; {p} passed, {f} failed.',
    'Tất cả bài kiểm thử đều đạt.': 'All tests passed.',
    'Không thể chạy kiểm thử: {e}': 'Could not run the tests: {e}',
    'Code hiện tại sẽ được thay bằng code khởi đầu.': 'Your current code will be replaced with the starter code.',
    'Khôi phục': 'Restore',
    'Đã hết gợi ý': 'No more hints',
    'Bài này không có gợi ý': 'This exercise has no hints',
    'Gợi ý {i}/{n}': 'Hint {i}/{n}',
    'Bạn chưa chạy thử bài này lần nào.': 'You have not run this exercise yet.',
    'Xem lời giải trước khi thử?': 'View the solution before trying?',
    'Xem lời giải': 'View solution',
    'Lời giải tham khảo': 'Reference solution',
    'Chép vào editor': 'Copy into editor',
    'Đã chạy {n} lần, tốt nhất {p}%': 'Run {n} times, best {p}%',
    'ĐÃ ĐẠT': 'PASSED',
    '{p}/{n} bài kiểm thử đạt': '{p}/{n} tests passed',
    // Code Lab
    'Chọn bài để viết lời giải và chạy bộ unit test có sẵn.': 'Pick an exercise, write a solution and run the provided unit tests.',
    'Tiến độ bài code': 'Coding progress',
    'bài đã đạt': 'passed',
    'bài đã đạt trong {t}': 'passed in {t}',
    'Môi trường chạy unit test': 'Test environment',
    '<b>JavaScript</b> chạy trong sandbox Boa với bộ test theo cú pháp Jest; <b>Python</b> chạy qua <code>python3 -I</code>; <b>Go</b> chạy bằng <code>go run</code>; <b>Rust</b> chạy bằng <code>rustc</code>; <b>PHP</b> chạy bằng <code>php</code>. Mỗi bài có bộ test riêng hiển thị trong phần làm bài.': '<b>JavaScript</b> runs in a Boa sandbox with Jest-style tests; <b>Python</b> runs with <code>python3 -I</code>; <b>Go</b> with <code>go run</code>; <b>Rust</b> with <code>rustc</code>; <b>PHP</b> with <code>php</code>. Each exercise shows its own tests on the exercise page.',
    'Lọc theo lộ trình': 'Filter by path',
    'Tất cả lộ trình': 'All paths',
    '{n} bài code trong {t}': '{n} exercises in {t}',
    '{n} bài code trong toàn bộ kho': '{n} exercises in the whole library',
    'Đã đạt': 'Passed',
    'Đã thử, {p}%': 'Tried, {p}%',
    'Chưa làm': 'Not started',
    'Lộ trình này chưa có bài code.': 'This path has no coding exercises yet.',
    // Thi thử
    'Đề ngẫu nhiên, tính giờ, chỉ chấm khi nộp bài, mô phỏng bài kiểm tra thật.': 'Random questions, timed, graded only when you submit, like a real test.',
    'Bạn có một bài thi đang làm dở': 'You have an unfinished exam',
    'Tiếp tục làm': 'Resume',
    'Huỷ bài đó': 'Discard it',
    'Tạo đề thi': 'New exam',
    'Lộ trình': 'Path',
    'Tất cả lộ trình {a} đang bật': 'All enabled {a} paths',
    'Tất cả lộ trình {a}': 'All {a} paths',
    'Số câu': 'Questions',
    'Thời gian (phút)': 'Time (minutes)',
    'Dạng câu hỏi': 'Question types',
    'Bắt đầu làm bài': 'Start exam',
    'Lịch sử thi': 'Exam history',
    'Ngày': 'Date',
    'Điểm': 'Score',
    'Thời gian': 'Time',
    '{n} phút': '{n} min',
    'Chưa có bài thi nào.': 'No exams yet.',
    'Chọn ít nhất 1 dạng câu hỏi': 'Choose at least one question type',
    'Không đủ câu hỏi': 'Not enough questions',
    'Đang làm bài': 'In progress',
    '{a}/{n} câu đã trả lời': '{a}/{n} answered',
    'Nộp bài': 'Submit',
    'Còn {n} câu chưa trả lời.': '{n} questions are still unanswered.',
    'Nộp bài thi?': 'Submit the exam?',
    'Hết giờ! Tự động nộp bài': 'Time is up, submitting automatically',
    'Đang chấm bài…': 'Grading…',
    'Kết quả': 'Results',
    '/ 10 điểm': '/ 10 points',
    'Kết quả xuất sắc': 'Excellent result',
    'Kết quả khá tốt': 'Good result',
    'Cần ôn thêm': 'Needs more review',
    '{c}/{n} câu đúng hoàn toàn, làm trong {m} phút {s} giây': '{c}/{n} fully correct, finished in {m} min {s} s',
    'Thi đề mới': 'New exam',
    'Ôn lại câu sai': 'Review mistakes',
    'Xem lại bài làm': 'Review your answers',
    // Ôn tập, kho câu hỏi
    'Ôn tập': 'Review',
    'Học lại những câu chưa đúng và câu bạn đã đánh dấu.': 'Revisit questions you missed and the ones you bookmarked.',
    'Câu làm sai / chưa trọn vẹn': 'Wrong or partly correct',
    'Ôn tất cả': 'Review all',
    'Không có câu sai nào.': 'No mistakes.',
    'Dùng nút Đánh dấu trên câu hỏi để lưu mục ôn tập.': 'Use the Bookmark button on a question to save it for review.',
    '{n} câu hỏi': '{n} questions',
    ' (đang bật {a}/{b} lộ trình, <a href="#/settings">cài đặt</a>)': ' ({a}/{b} paths enabled, <a href="#/settings">settings</a>)',
    '; các bài code có bộ unit test để chấm tự động.': '; coding exercises are graded automatically by unit tests.',
    'Tìm trong kho câu hỏi': 'Search the question bank',
    'Tìm theo nội dung, tag…': 'Search by content or tag…',
    'Mọi lộ trình': 'All paths',
    'Lọc theo dạng câu hỏi': 'Filter by question type',
    'Mọi dạng': 'All types',
    'Lọc theo độ khó': 'Filter by difficulty',
    'Mọi độ khó': 'All difficulties',
    'Lọc theo trạng thái': 'Filter by status',
    'Mọi trạng thái': 'All statuses',
    'Đã đúng': 'Correct',
    'Sai / một phần': 'Wrong or partial',
    'Luyện các câu đang lọc': 'Practise filtered questions',
    // Tiến độ
    'Tiến độ học tập': 'Learning progress',
    'Bovabon Edu không cần đăng nhập: tiến độ được lưu trên trình duyệt này. Hãy xuất file để sao lưu hoặc chuyển sang máy khác.': 'Bovabon Edu needs no sign-in: progress is stored in this browser. Export a file to back it up or move it to another device.',
    'Hoạt động 90 ngày': 'Last 90 days',
    '{d}: {n} lượt': '{d}: {n} answers',
    'Chuỗi hiện tại: {n} ngày': 'Current streak: {n} days',
    'Theo dạng bài': 'By question type',
    'Sao lưu dữ liệu': 'Backup',
    'Xuất tiến độ (.json)': 'Export progress (.json)',
    'Nhập tiến độ': 'Import progress',
    'Xoá toàn bộ tiến độ': 'Delete all progress',
    'File không hợp lệ': 'Invalid file',
    'Đã nhập tiến độ': 'Progress imported',
    'Toàn bộ tiến độ lưu trên trình duyệt này sẽ bị xoá và không thể khôi phục.': 'All progress stored in this browser will be deleted. This cannot be undone.',
    'Xoá toàn bộ tiến độ?': 'Delete all progress?',
    'Xoá tiến độ': 'Delete progress',
    'Đã xoá tiến độ': 'Progress deleted',
    // Cài đặt
    'Nội dung học': 'Study content',
    'Chọn nội dung bạn muốn học. Lộ trình bị tắt sẽ ẩn khỏi menu, trang chủ, Code Lab, kho câu hỏi, thi thử, ôn tập và thống kê; tiến độ cũ vẫn được giữ. Cài đặt lưu trên trình duyệt này.': 'Choose what you want to study. Disabled paths are hidden from the menu, home, Code Lab, question bank, exams, review and stats; your progress is kept. Settings are stored in this browser.',
    'Chọn tất cả': 'Select all',
    'Bật cả nhóm': 'Enable whole group',
    '{q} câu, {c} bài code, {m} module': '{q} questions, {c} coding exercises, {m} modules',
    'Lưu cài đặt': 'Save settings',
    'Huỷ thay đổi': 'Discard changes',
    'Chọn {a}/{b} lộ trình, {q} câu hỏi': '{a}/{b} paths selected, {q} questions',
    '{n} thay đổi chưa lưu': '{n} unsaved changes',
    'Đã lưu': 'Saved',
    'Cần bật ít nhất 1 lộ trình': 'Keep at least one path enabled',
    'Đã lưu: bật {a}/{b} lộ trình': 'Saved: {a}/{b} paths enabled',
    'Các thay đổi bật/tắt lộ trình chưa được lưu sẽ bị bỏ.': 'Unsaved changes to your paths will be lost.',
    'Rời trang mà không lưu?': 'Leave without saving?',
    'Bỏ thay đổi': 'Discard changes',
    // Đồng bộ
    'Đồng bộ': 'Sync',
    'Tuỳ chọn': 'Optional',
    'chưa đồng bộ': 'never synced',
    'vừa xong': 'just now',
    '{n} phút trước': '{n} min ago',
    '{n} giờ trước': '{n} h ago',
    'Không kết nối được máy chủ đồng bộ (đang offline?)': 'Could not reach the sync server (offline?)',
    'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.': 'Your session has expired. Please sign in again.',
    'Nhập mã OTP hiện tại để tạo bộ mã dự phòng mới. Bộ mã cũ sẽ hết hiệu lực.': 'Enter your current OTP code to create new backup codes. The old codes will stop working.',
    'Mã OTP hiện tại': 'Current OTP code',
    'Mã OTP cần có 6 chữ số.': 'The OTP code must have 6 digits.',
    'Đang xác nhận…': 'Confirming…',
    'Tạo mã mới': 'Create new codes',
    'Đã đăng nhập <b>{email}</b>. Tiến độ học, câu đánh dấu, lịch sử thi và lựa chọn lộ trình được đồng bộ giữa các máy.': 'Signed in as <b>{email}</b>. Progress, bookmarks, exam history and path selection are synced across devices.',
    'Lần đồng bộ gần nhất: {t}': 'Last synced: {t}',
    'Đồng bộ ngay': 'Sync now',
    'Tạo lại mã dự phòng': 'New backup codes',
    'Đăng xuất': 'Sign out',
    'Dữ liệu vẫn giữ trên máy này và trên đám mây; máy này sẽ ngừng đồng bộ.': 'Your data stays on this device and in the cloud; this device will stop syncing.',
    'Đăng xuất đồng bộ?': 'Sign out of sync?',
    'Đã đăng xuất đồng bộ': 'Signed out of sync',
    'Bạn có thể học mà không cần tài khoản. Mọi thứ lưu trên máy này. Muốn tiếp tục trên máy khác hoặc giữ an toàn tiến độ, hãy bật đồng bộ bằng <b>email và mã OTP</b> từ ứng dụng xác thực (Google Authenticator, 1Password, Authy). Không cần mật khẩu.': 'You can study without an account; everything is saved on this device. To continue on another device or keep your progress safe, turn on sync with <b>an email and an OTP code</b> from an authenticator app (Google Authenticator, 1Password, Authy). No password needed.',
    'Tạo tài khoản đồng bộ': 'Create sync account',
    'Đăng nhập': 'Sign in',
    'Mã OTP 6 số (hoặc mã dự phòng)': '6-digit OTP code (or a backup code)',
    'Đang đăng nhập…': 'Signing in…',
    'Đăng nhập & đồng bộ': 'Sign in & sync',
    'Dữ liệu trên máy này sẽ được <b>gộp</b> với dữ liệu đã lưu trên đám mây (không mất tiến độ ở bên nào).': 'Data on this device will be <b>merged</b> with the data in the cloud (no progress is lost on either side).',
    'Đã bật đồng bộ': 'Sync is on',
    'Bước 1/3: Email chỉ dùng làm tên tài khoản, không gửi thư. Hãy dùng email của bạn để dễ nhớ.': 'Step 1/3: the email is only your account name; no mail is sent. Use your own email so it is easy to remember.',
    'Đang tạo…': 'Creating…',
    'Bước 2/3: Mở ứng dụng xác thực, chọn <b>thêm tài khoản rồi quét mã QR</b> (hoặc nhập khoá thủ công), sau đó nhập mã 6 số đang hiển thị.': 'Step 2/3: open your authenticator app, choose <b>add account and scan the QR code</b> (or enter the key manually), then type the 6-digit code it shows.',
    'Mã QR để thêm tài khoản Bovabon Edu vào app authenticator': 'QR code to add your Bovabon Edu account to an authenticator app',
    'Tài khoản': 'Account',
    'Khoá nhập thủ công': 'Manual entry key',
    'Mã 6 số': '6-digit code',
    'Đồng bộ đã bật': 'Sync is on',
    'Bước 3/3: Lưu <b>mã dự phòng</b> ở nơi an toàn, chẳng hạn trong trình quản lý mật khẩu. Mỗi mã dùng một lần khi bạn mất điện thoại. Mã chỉ hiển thị lần này.': 'Step 3/3: store these <b>backup codes</b> somewhere safe, such as a password manager. Each code works once if you lose your phone. They are shown only this time.',
    'Sao chép': 'Copy',
    'Tải file .txt': 'Download .txt',
    'Tôi đã lưu': 'I have saved them',
    'Bovabon Edu: mã dự phòng cho {email} (mỗi mã dùng 1 lần)': 'Bovabon Edu backup codes for {email} (each code works once)',
    'Đã sao chép': 'Copied',
    'Không sao chép được, hãy chọn và sao chép thủ công': 'Could not copy; select and copy the codes manually',
  };

  let lang = 'vi';
  try {
    const saved = localStorage.getItem(KEY);
    lang = LANGS.includes(saved) ? saved : ((navigator.language || '').toLowerCase().startsWith('vi') ? 'vi' : 'en');
  } catch (e) {}
  const dict = lang === 'en' ? EN : null;
  const has = (k) => dict && Object.prototype.hasOwnProperty.call(dict, k);
  const fill = (s, vars) => (vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s);

  /** Dịch một chuỗi giao diện (khoá = chuỗi tiếng Việt), có thể kèm biến {tên}. */
  function t(s, vars) { return fill(has(s) ? dict[s] : s, vars); }

  // --- Dịch DOM tự động (chỉ khi lang ≠ vi) ---
  const SKIP = 'script, style, code, pre, textarea, [contenteditable], [data-no-i18n], .lesson, .q-prompt, .prompt, .options, .doc-frame';
  const ATTRS = ['aria-label', 'title', 'placeholder'];
  function trText(str) {
    const k = str.trim();
    if (!k || !has(k) || dict[k] === k) return null; // bản dịch trùng gốc: không ghi lại (tránh vòng lặp observer)
    return str.replace(k, dict[k]);
  }
  function translate(root) {
    if (!dict || !root) return;
    if (root.nodeType === 3) {
      const p = root.parentElement;
      if (p && !p.closest(SKIP)) { const x = trText(root.nodeValue); if (x !== null) root.nodeValue = x; }
      return;
    }
    if (root.nodeType !== 1 || root.closest(SKIP)) return;
    const els = [root, ...root.querySelectorAll('[aria-label],[title],[placeholder]')];
    for (const el of els) {
      if (el.closest(SKIP)) continue;
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (v) { const x = trText(v); if (x !== null) el.setAttribute(a, x); }
      }
    }
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) { const x = trText(n.nodeValue); if (x !== null) n.nodeValue = x; }
  }
  if (dict) {
    const start = () => {
      translate(document.body);
      document.title = t(document.title);
      new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === 'childList') m.addedNodes.forEach(translate);
          else if (m.type === 'characterData') translate(m.target);
          else if (m.type === 'attributes') translate(m.target);
        }
      }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  }
  document.documentElement.lang = lang;

  window.I18N = {
    lang,
    langs: LANGS,
    t,
    dict: EN,
    /** Đổi ngôn ngữ: lưu lại rồi tải lại trang (nạp lại dữ liệu đã dịch từ server). */
    set(l) {
      if (!LANGS.includes(l) || l === lang) return;
      try { localStorage.setItem(KEY, l); } catch (e) {}
      location.reload();
    },
  };
})();
