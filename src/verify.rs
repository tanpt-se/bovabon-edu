//! Kiểm định chất lượng kho câu hỏi — dùng chung cho `cargo test` và lệnh `bovabon_edu check`.
//!
//! - mỗi lộ trình có đủ 5 dạng câu hỏi, module nào cũng có câu hỏi, id câu hỏi có tiền tố chung
//! - bài code: lời giải PASS 100% (>= 3 test), code khởi đầu KHÔNG pass
//! - trắc nghiệm / điền / tự luận: đáp án chuẩn được chấm đúng, đáp án rỗng bị chấm sai
//! - giao diện công khai không lộ đáp án; số ô trống khớp
//! - (tuỳ chọn) đường dẫn `sources` tồn tại trong chỉ mục DevDocs đã tải về thư mục `.devdocs/`

use crate::bank::{Bank, QType, Question, TrackFile, valid_devdocs_path};
use crate::{grade, runner};
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::time::Duration;

pub struct Options {
    /// Thư mục chứa `<slug>.json` (chỉ mục DevDocs). Bỏ qua nếu không tồn tại.
    pub devdocs_dir: Option<std::path::PathBuf>,
    /// Số luồng chạy bài code song song.
    pub jobs: usize,
}

impl Default for Options {
    fn default() -> Self {
        Options { devdocs_dir: Some(".devdocs".into()), jobs: 4 }
    }
}

pub fn verify_tracks(tracks: &[&TrackFile], opts: &Options) -> Vec<String> {
    let mut errs = Vec::new();
    let mut code_qs: Vec<&Question> = Vec::new();
    for t in tracks {
        let ctx = format!("[{}]", t.id);
        // Lập trình: đủ 5 dạng. Tiếng Anh: trắc nghiệm + điền (tự luận tuỳ chọn), không có bài code.
        let required: &[QType] = match t.area.as_str() {
            "dev" => &[QType::Single, QType::Multiple, QType::Fill, QType::Essay, QType::Code],
            "english" => &[QType::Single, QType::Multiple, QType::Fill],
            other => {
                errs.push(format!("{ctx} area không hợp lệ: {other:?} (dev | english)"));
                &[]
            }
        };
        for ty in required {
            if !t.questions.iter().any(|q| q.qtype == *ty) {
                errs.push(format!("{ctx} thiếu dạng câu hỏi {ty:?}"));
            }
        }
        if t.area == "english" {
            for q in t.questions.iter().filter(|q| q.qtype == QType::Code) {
                errs.push(format!("{ctx} {} là bài code — khu Tiếng Anh không có bài code", q.id));
            }
        }
        for m in &t.modules {
            if !t.questions.iter().any(|q| q.module == m.id) {
                errs.push(format!("{ctx} module {} chưa có câu hỏi", m.id));
            }
            if !lesson_is_valid(&m.lesson) {
                errs.push(format!("{ctx} module {} cần bài học (lesson) >= 200 ký tự", m.id));
            }
        }
        let mut seen_mod = HashSet::new();
        for m in &t.modules {
            if !seen_mod.insert(&m.id) {
                errs.push(format!("{ctx} trùng id module {}", m.id));
            }
        }
        for q in &t.questions {
            check_question(q, &mut errs);
            if q.qtype == QType::Code {
                code_qs.push(q);
            }
        }
        if let Some(dir) = &opts.devdocs_dir {
            check_sources(t, dir, &mut errs);
        }
    }
    errs.extend(check_code(&code_qs, opts.jobs.max(1)));
    errs
}

fn check_question(q: &Question, errs: &mut Vec<String>) {
    let ctx = format!("[{}/{}]", q.track, q.id);
    if q.explanation.trim().is_empty() && q.qtype != QType::Essay {
        errs.push(format!("{ctx} thiếu explanation"));
    }
    if !(1..=3).contains(&q.difficulty) {
        errs.push(format!("{ctx} difficulty phải là 1, 2 hoặc 3"));
    }
    if matches!(q.qtype, QType::Single | QType::Multiple) {
        let uniq: HashSet<_> = q.options.iter().map(|o| o.trim().to_lowercase()).collect();
        if uniq.len() != q.options.len() {
            errs.push(format!("{ctx} có lựa chọn trùng nhau"));
        }
        if q.qtype == QType::Multiple && q.answer.len() < 2 {
            errs.push(format!("{ctx} multiple nên có >= 2 đáp án đúng (nếu chỉ 1, dùng type = \"single\")"));
        }
    }
    let ans = match q.qtype {
        QType::Single | QType::Multiple => Some(json!(q.answer)),
        QType::Fill => Some(json!(q.blanks.iter().map(|x| x.first().cloned().unwrap_or_default()).collect::<Vec<_>>())),
        QType::Essay => Some(json!(q.model_answer)),
        QType::Code => None,
    };
    if let Some(ans) = ans {
        let r = grade::check(q, &ans);
        if !r.correct {
            errs.push(format!(
                "{ctx} đáp án chuẩn bị chấm sai (essay: model_answer chỉ khớp {:?}, thiếu {:?})",
                r.matched_keywords, r.missing_keywords
            ));
        }
        if q.qtype != QType::Essay && grade::check(q, &json!([])).correct {
            errs.push(format!("{ctx} đáp án rỗng lại được chấm đúng"));
        }
        if q.qtype == QType::Essay && grade::check(q, &json!("")).correct {
            errs.push(format!("{ctx} bài tự luận rỗng lại được chấm đúng"));
        }
    }
    let p = serde_json::to_string(&q.public()).unwrap_or_default();
    if p.contains("\"solution\"") || p.contains("\"answer\"") {
        errs.push(format!("{ctx} giao diện công khai lộ đáp án"));
    }
    if q.qtype == QType::Fill && p.matches("class=\\\"blank\\\"").count() != q.blanks.len() {
        errs.push(format!("{ctx} số ô trống hiển thị không khớp blanks"));
    }
}

fn check_code(qs: &[&Question], jobs: usize) -> Vec<String> {
    let queue = std::sync::Mutex::new(qs.iter().copied().collect::<Vec<_>>());
    let out = std::sync::Mutex::new(Vec::new());
    std::thread::scope(|s| {
        for _ in 0..jobs {
            s.spawn(|| loop {
                let Some(q) = queue.lock().unwrap().pop() else { break };
                let ctx = format!("[{}/{}]", q.track, q.id);
                let mut local = Vec::new();
                let r = runner::run_lang(&q.lang, &q.solution, &q.tests, Duration::from_secs(120));
                if !r.all_passed {
                    let fails: Vec<String> = r
                        .results
                        .iter()
                        .filter(|x| !x.passed)
                        .map(|x| format!("  ✗ {}: {}", x.name, x.error.clone().unwrap_or_default()))
                        .collect();
                    local.push(format!(
                        "{ctx} lời giải chỉ pass {}/{}{}\n{}",
                        r.passed,
                        r.total,
                        r.error.map(|e| format!("\n  lỗi: {e}")).unwrap_or_default(),
                        fails.join("\n")
                    ));
                }
                if r.total < 4 {
                    local.push(format!("{ctx} cần >= 4 test, hiện có {}", r.total));
                }
                if q.starter.trim().is_empty() {
                    local.push(format!("{ctx} thiếu starter"));
                } else {
                    let st = runner::run_lang(&q.lang, &q.starter, &q.tests, Duration::from_secs(120));
                    if st.all_passed {
                        local.push(format!("{ctx} code khởi đầu (starter) không được pass hết test"));
                    }
                    if st.error.as_deref().is_some_and(|e| e.starts_with("Lỗi biên dịch") || e.starts_with("Lỗi cú pháp")) {
                        local.push(format!("{ctx} starter phải biên dịch được (chỉ sai logic): {}", st.error.unwrap_or_default()));
                    }
                }
                if q.hints.is_empty() {
                    local.push(format!("{ctx} nên có ít nhất 1 gợi ý (hints)"));
                }
                out.lock().unwrap().extend(local);
            });
        }
    });
    let mut v = out.into_inner().unwrap();
    v.sort();
    v
}

fn check_sources(t: &TrackFile, dir: &Path, errs: &mut Vec<String>) {
    if !dir.is_dir() {
        return;
    }
    let canonical_dir = dir.canonicalize().ok();
    let mut cache: HashMap<String, Option<HashSet<String>>> = HashMap::new();
    let mut paths: Vec<(String, &str)> = Vec::new();
    for d in &t.docs {
        paths.push((format!("[{}] docs", t.id), d.as_str()));
    }
    for m in &t.modules {
        for s in &m.sources {
            paths.push((format!("[{}/{}] sources", t.id, m.id), s.as_str()));
        }
    }
    for q in &t.questions {
        for s in &q.sources {
            paths.push((format!("[{}/{}] sources", t.id, q.id), s.as_str()));
        }
    }
    for (ctx, p) in paths {
        if !valid_devdocs_path(p) {
            errs.push(format!("{ctx}: '{p}' không phải đường dẫn DevDocs tương đối hợp lệ"));
            continue;
        }
        let (slug, rest) = p.split_once('/').unwrap_or((p, ""));
        let idx = cache.entry(slug.to_string()).or_insert_with(|| {
            let root = canonical_dir.as_ref()?;
            let path = root.join(format!("{slug}.json")).canonicalize().ok()?;
            if !path.starts_with(root) {
                return None;
            }
            let txt = std::fs::read_to_string(path).ok()?;
            let v: serde_json::Value = serde_json::from_str(&txt).ok()?;
            Some(
                v["entries"]
                    .as_array()?
                    .iter()
                    .filter_map(|e| e["path"].as_str())
                    .map(|s| s.split('#').next().unwrap_or("").to_string())
                    .collect(),
            )
        });
        match idx {
            None => errs.push(format!("{ctx}: chưa có chỉ mục DevDocs cho slug '{slug}' trong {} (chạy scripts/devdocs-index.sh {slug})", dir.display())),
            Some(set) => {
                let base = rest.split('#').next().unwrap_or("");
                if !base.is_empty() && !set.contains(base) {
                    errs.push(format!("{ctx}: '{p}' không có trong DevDocs"));
                }
            }
        }
    }
}

/// Lệnh `check`: nạp kho nhúng sẵn + các file chỉ định (file trùng tên sẽ thay thế),
/// kiểm tra toàn kho (trùng id…) rồi kiểm định chi tiết các lộ trình trong file chỉ định.
pub fn check_files(files: &[String], opts: &Options) -> Result<(usize, usize), String> {
    let mut sources: Vec<(String, String)> = std::iter::once((
        crate::bank::CATEGORIES_FILE.to_string(),
        crate::bank::EMBEDDED_CATEGORIES.to_string(),
    ))
    .chain(crate::bank::EMBEDDED.iter().chain(crate::bank::EMBEDDED_I18N.iter()).map(|(n, t)| (n.to_string(), t.to_string())))
    .collect();
    let mut targets = Vec::new();
    for f in files {
        let name = source_name(f);
        let txt = std::fs::read_to_string(f).map_err(|e| format!("Không đọc được {f}: {e}"))?;
        sources.retain(|(n, _)| n != &name);
        sources.push((name.clone(), txt));
        targets.push(name);
    }
    let bank = Bank::from_sources(&sources)?;
    let ids: HashSet<String> = if targets.is_empty() {
        bank.tracks.iter().map(|t| t.id.clone()).collect()
    } else {
        // id lộ trình của các file chỉ định
        sources
            .iter()
            .filter(|(n, _)| targets.contains(n) && n != crate::bank::CATEGORIES_FILE && !n.starts_with("i18n/"))
            .filter_map(|(n, t)| {
                if n.ends_with(".toml") {
                    toml::from_str::<TrackFile>(t).ok().map(|x| x.id)
                } else {
                    serde_json::from_str::<TrackFile>(t).ok().map(|x| x.id)
                }
            })
            .collect()
    };
    let tracks: Vec<&TrackFile> = bank.tracks.iter().filter(|t| ids.contains(&t.id)).collect();
    let nq = tracks.iter().map(|t| t.questions.len()).sum();
    let mut errs = verify_tracks(&tracks, opts);
    if targets.is_empty() || targets.iter().any(|n| n.starts_with("i18n/")) {
        errs.extend(verify_locales(&bank));
    }
    if errs.is_empty() { Ok((tracks.len(), nq)) } else { Err(errs.join("\n")) }
}

/// Kiểm định bản dịch: đáp án chuẩn vẫn chấm đúng, đáp án rỗng vẫn sai, số ô trống khớp…
pub fn verify_locales(bank: &Bank) -> Vec<String> {
    let mut errs = Vec::new();
    for (lang, lb) in &bank.locales {
        for t in &lb.tracks {
            for m in &t.modules {
                if !lesson_is_valid(&m.lesson) {
                    errs.push(format!("[i18n/{lang}][{}] module {} cần bài học (lesson) >= 200 ký tự", t.id, m.id));
                }
            }
            for q in t.questions.iter().filter(|q| q.qtype != QType::Code) {
                let mut e = Vec::new();
                check_question(q, &mut e);
                errs.extend(e.into_iter().map(|x| format!("[i18n/{lang}] {x}")));
            }
        }
    }
    errs
}

fn lesson_is_valid(lesson: &str) -> bool {
    lesson.trim().chars().count() >= 200
}

fn source_name(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    let parts: Vec<&str> = normalized.split('/').filter(|p| !p.is_empty()).collect();
    let filename = parts.last().copied().unwrap_or(path);
    match parts.iter().rposition(|p| *p == "i18n") {
        Some(i) if i + 2 < parts.len() => format!("i18n/{}/{filename}", parts[i + 1]),
        _ => filename.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::{Options, check_sources, source_name, verify_tracks};
    use crate::bank::TrackFile;
    use serde_json::json;

    #[test]
    fn i18n_paths_accept_windows_separators() {
        assert_eq!(source_name(r"data\i18n\en\track.toml"), "i18n/en/track.toml");
    }

    #[test]
    fn lesson_length_counts_unicode_characters() {
        let track: TrackFile = serde_json::from_value(json!({
            "id": "unicode-test",
            "title": "Test",
            "icon": "",
            "color": "",
            "description": "",
            "modules": [{"id": "m1", "title": "M", "description": "D", "lesson": "é".repeat(100)}],
            "questions": []
        })).unwrap();
        let errs = verify_tracks(&[&track], &Options { devdocs_dir: None, jobs: 1 });
        assert!(errs.iter().any(|e| e.contains("lesson")));
    }

    #[cfg(unix)]
    #[test]
    fn devdocs_symlinks_cannot_escape_index_directory() {
        use std::os::unix::fs::symlink;

        let unique = format!("bovabon-verify-{}-{}", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        let base = std::env::temp_dir().join(unique);
        let root = base.join("indexes");
        let outside = base.join("outside.json");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(&outside, r#"{"entries":[{"path":"reference"}]}"#).unwrap();
        symlink(&outside, root.join("react.json")).unwrap();
        let track: TrackFile = serde_json::from_value(json!({
            "id": "t",
            "title": "T",
            "icon": "",
            "color": "",
            "description": "",
            "docs": ["react"],
            "modules": [],
            "questions": []
        })).unwrap();
        let mut errs = Vec::new();
        check_sources(&track, &root, &mut errs);
        assert!(errs.iter().any(|e| e.contains("chưa có chỉ mục DevDocs")));
        std::fs::remove_dir_all(base).unwrap();
    }
}
