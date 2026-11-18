//! Kho dữ liệu chuẩn: tracks → modules → questions.
//! Dữ liệu mặc định được nhúng vào binary (thư mục `data/`, định dạng TOML), có thể
//! override bằng biến môi trường `BOVABON_DATA_DIR` trỏ tới thư mục chứa *.toml / *.json.

use pulldown_cmark::{Options, Parser, html};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const EMBEDDED: &[(&str, &str)] = &[
    ("react.toml", include_str!("../data/react.toml")),
    ("react-native.toml", include_str!("../data/react-native.toml")),
    ("frontend.toml", include_str!("../data/frontend.toml")),
    ("typescript.toml", include_str!("../data/typescript.toml")),
    ("vue.toml", include_str!("../data/vue.toml")),
    ("nextjs.toml", include_str!("../data/nextjs.toml")),
    ("testing.toml", include_str!("../data/testing.toml")),
    ("frontend-tooling.toml", include_str!("../data/frontend-tooling.toml")),
    ("nodejs.toml", include_str!("../data/nodejs.toml")),
    ("go.toml", include_str!("../data/go.toml")),
    ("python-backend.toml", include_str!("../data/python-backend.toml")),
    ("web-api.toml", include_str!("../data/web-api.toml")),
    ("django.toml", include_str!("../data/django.toml")),
    ("rust.toml", include_str!("../data/rust.toml")),
    ("php-laravel.toml", include_str!("../data/php-laravel.toml")),
    ("databases.toml", include_str!("../data/databases.toml")),
    ("devops.toml", include_str!("../data/devops.toml")),
    ("english.toml", include_str!("../data/english.toml")),
    ("english-grammar.toml", include_str!("../data/english-grammar.toml")),
    ("english-vocab.toml", include_str!("../data/english-vocab.toml")),
];

#[derive(Debug, Clone, Deserialize)]
pub struct TrackFile {
    pub id: String,
    pub title: String,
    pub icon: String,
    pub color: String,
    pub description: String,
    /// "Frontend" | "Backend"
    #[serde(default = "default_group")]
    pub group: String,
    /// Các bộ tài liệu DevDocs liên quan (slug, vd. "react", "go", "fastapi")
    #[serde(default)]
    pub docs: Vec<String>,
    pub modules: Vec<Module>,
    pub questions: Vec<Question>,
}

fn default_group() -> String {
    "Frontend".into()
}

fn default_lang() -> String {
    "javascript".into()
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Module {
    pub id: String,
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub lesson: String,
    /// Đường dẫn DevDocs tham khảo (vd. "react/reference/react/usetransition")
    #[serde(default)]
    pub sources: Vec<String>,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum QType {
    Single,
    Multiple,
    Fill,
    Essay,
    Code,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Question {
    pub id: String,
    pub module: String,
    #[serde(rename = "type")]
    pub qtype: QType,
    #[serde(default = "one")]
    pub difficulty: u8,
    #[serde(default)]
    pub title: String,
    pub prompt: String,
    #[serde(default)]
    pub options: Vec<String>,
    /// single/multiple: chỉ số đáp án đúng
    #[serde(default)]
    pub answer: Vec<usize>,
    /// fill: mỗi ô trống một danh sách đáp án chấp nhận
    #[serde(default)]
    pub blanks: Vec<Vec<String>>,
    /// fill: các ô có thể điền đổi chỗ nhưng không được trùng nhau
    #[serde(default)]
    pub unique_blanks: bool,
    /// essay: các nhóm từ khoá (mỗi nhóm khớp 1 từ là đạt)
    #[serde(default)]
    pub keywords: Vec<Vec<String>>,
    /// essay: số nhóm tối thiểu cần khớp (mặc định = tất cả)
    #[serde(default)]
    pub min_keywords: Option<usize>,
    /// essay: đáp án mẫu
    #[serde(default)]
    pub model_answer: String,
    #[serde(default)]
    pub explanation: String,
    #[serde(default)]
    pub starter: String,
    #[serde(default)]
    pub tests: String,
    #[serde(default)]
    pub solution: String,
    #[serde(default)]
    pub hints: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    /// code: ngôn ngữ chạy test — javascript | python | go
    #[serde(default = "default_lang")]
    pub lang: String,
    /// Đường dẫn DevDocs tham khảo
    #[serde(default)]
    pub sources: Vec<String>,
    #[serde(skip)]
    pub track: String,
}

fn one() -> u8 {
    1
}

pub const BLANK: &str = "{{blank}}";

pub fn md(src: &str) -> String {
    let mut out = String::new();
    let mut opts = Options::empty();
    opts.insert(Options::ENABLE_TABLES);
    opts.insert(Options::ENABLE_STRIKETHROUGH);
    html::push_html(&mut out, Parser::new_ext(src, opts));
    out
}

/// Markdown cho 1 dòng (options) — bỏ thẻ <p> bao ngoài.
pub fn md_inline(src: &str) -> String {
    let h = md(src);
    let t = h.trim();
    if t.starts_with("<p>") && t.ends_with("</p>") && t.matches("<p>").count() == 1 {
        t[3..t.len() - 4].to_string()
    } else {
        t.to_string()
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct TrackInfo {
    pub id: String,
    pub title: String,
    pub icon: String,
    pub color: String,
    pub description: String,
    pub group: String,
    pub docs: Vec<String>,
    pub modules: Vec<ModuleInfo>,
    pub counts: HashMap<QType, usize>,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct ModuleInfo {
    pub id: String,
    pub title: String,
    pub description: String,
    pub lesson_html: String,
    pub sources: Vec<String>,
    pub question_ids: Vec<String>,
    pub counts: HashMap<QType, usize>,
}

/// Câu hỏi gửi cho client — KHÔNG chứa đáp án / lời giải.
#[derive(Debug, Clone, Serialize)]
pub struct PublicQuestion {
    pub id: String,
    pub track: String,
    pub module: String,
    #[serde(rename = "type")]
    pub qtype: QType,
    pub difficulty: u8,
    pub title: String,
    pub prompt_html: String,
    pub options_html: Vec<String>,
    pub blank_count: usize,
    pub starter: String,
    pub tests: String,
    pub hint_count: usize,
    pub tags: Vec<String>,
    pub lang: String,
    pub sources: Vec<String>,
}

pub struct Bank {
    pub tracks: Vec<TrackFile>,
    pub by_id: HashMap<String, Question>,
}

impl Bank {
    pub fn load() -> Result<Bank, String> {
        let mut files: Vec<(String, String)> = Vec::new();
        if let Ok(dir) = std::env::var("BOVABON_DATA_DIR") {
            let mut entries: Vec<_> = std::fs::read_dir(&dir)
                .map_err(|e| format!("Không đọc được {dir}: {e}"))?
                .filter_map(|e| e.ok())
                .filter(|e| e.path().extension().is_some_and(|x| x == "json" || x == "toml"))
                .collect();
            entries.sort_by_key(|e| e.path());
            for e in entries {
                let txt = std::fs::read_to_string(e.path()).map_err(|er| er.to_string())?;
                files.push((e.file_name().to_string_lossy().to_string(), txt));
            }
        } else {
            for (n, t) in EMBEDDED {
                files.push((n.to_string(), t.to_string()));
            }
        }
        Self::from_sources(&files)
    }

    pub fn from_sources(files: &[(String, String)]) -> Result<Bank, String> {
        let mut tracks = Vec::new();
        let mut by_id = HashMap::new();
        for (name, txt) in files {
            let mut t: TrackFile = if name.ends_with(".toml") {
                toml::from_str(txt).map_err(|e| format!("{name}: TOML lỗi: {e}"))?
            } else {
                serde_json::from_str(txt).map_err(|e| format!("{name}: JSON lỗi: {e}"))?
            };
            for q in t.questions.iter_mut() {
                q.track = t.id.clone();
                if by_id.insert(q.id.clone(), q.clone()).is_some() {
                    return Err(format!("{name}: trùng id câu hỏi {}", q.id));
                }
            }
            tracks.push(t);
        }
        let bank = Bank { tracks, by_id };
        bank.validate()?;
        Ok(bank)
    }

    /// Kiểm tra tính nhất quán của kho dữ liệu.
    pub fn validate(&self) -> Result<(), String> {
        let mut errs = Vec::new();
        for t in &self.tracks {
            for q in &t.questions {
                let ctx = format!("[{}/{}]", t.id, q.id);
                if !t.modules.iter().any(|m| m.id == q.module) {
                    errs.push(format!("{ctx} module '{}' không tồn tại", q.module));
                }
                if q.sources.iter().chain(t.modules.iter().flat_map(|m| m.sources.iter())).any(|s| s.contains("://") || s.starts_with('/')) {
                    errs.push(format!("{ctx} sources phải là đường dẫn DevDocs tương đối (vd. react/reference/react/use)"));
                }
                if q.prompt.trim().is_empty() {
                    errs.push(format!("{ctx} prompt rỗng"));
                }
                match q.qtype {
                    QType::Single | QType::Multiple => {
                        if q.options.len() < 2 {
                            errs.push(format!("{ctx} cần >= 2 lựa chọn"));
                        }
                        if q.answer.is_empty() || q.answer.iter().any(|&a| a >= q.options.len()) {
                            errs.push(format!("{ctx} answer không hợp lệ"));
                        }
                        if q.qtype == QType::Single && q.answer.len() != 1 {
                            errs.push(format!("{ctx} single phải có đúng 1 đáp án"));
                        }
                    }
                    QType::Fill => {
                        let n = q.prompt.matches(BLANK).count();
                        if n == 0 || n != q.blanks.len() || q.blanks.iter().any(|b| b.is_empty()) {
                            errs.push(format!(
                                "{ctx} số ô trống ({n}) không khớp blanks ({})",
                                q.blanks.len()
                            ));
                        }
                    }
                    QType::Essay => {
                        if q.keywords.is_empty() || q.model_answer.trim().is_empty() {
                            errs.push(format!("{ctx} essay cần keywords và model_answer"));
                        }
                    }
                    QType::Code => {
                        if q.tests.trim().is_empty() || q.solution.trim().is_empty() {
                            errs.push(format!("{ctx} code cần tests và solution"));
                        }
                        if q.title.trim().is_empty() {
                            errs.push(format!("{ctx} code cần title"));
                        }
                        if !["javascript", "python", "go", "rust", "php"].contains(&q.lang.as_str()) {
                            errs.push(format!("{ctx} lang '{}' không hỗ trợ", q.lang));
                        }
                    }
                }
            }
        }
        if errs.is_empty() { Ok(()) } else { Err(errs.join("\n")) }
    }

    pub fn track_infos(&self) -> Vec<TrackInfo> {
        self.tracks
            .iter()
            .map(|t| {
                let mut counts = HashMap::new();
                for q in &t.questions {
                    *counts.entry(q.qtype).or_insert(0) += 1;
                }
                TrackInfo {
                    id: t.id.clone(),
                    title: t.title.clone(),
                    icon: t.icon.clone(),
                    color: t.color.clone(),
                    description: t.description.clone(),
                    group: t.group.clone(),
                    docs: t.docs.clone(),
                    total: t.questions.len(),
                    counts,
                    modules: t
                        .modules
                        .iter()
                        .map(|m| {
                            let qs: Vec<&Question> =
                                t.questions.iter().filter(|q| q.module == m.id).collect();
                            let mut c = HashMap::new();
                            for q in &qs {
                                *c.entry(q.qtype).or_insert(0) += 1;
                            }
                            ModuleInfo {
                                id: m.id.clone(),
                                title: m.title.clone(),
                                description: m.description.clone(),
                                lesson_html: md(&m.lesson),
                                sources: m.sources.clone(),
                                question_ids: qs.iter().map(|q| q.id.clone()).collect(),
                                counts: c,
                            }
                        })
                        .collect(),
                }
            })
            .collect()
    }

    pub fn all_questions(&self) -> impl Iterator<Item = &Question> {
        self.tracks.iter().flat_map(|t| t.questions.iter())
    }
}

impl Question {
    pub fn public(&self) -> PublicQuestion {
        let mut prompt_html = md(&self.prompt);
        let mut i = 0;
        while let Some(pos) = prompt_html.find(BLANK) {
            let input = format!(
                "<input class=\"blank\" data-i=\"{i}\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Ô trống {}\">",
                i + 1
            );
            prompt_html.replace_range(pos..pos + BLANK.len(), &input);
            i += 1;
        }
        PublicQuestion {
            id: self.id.clone(),
            track: self.track.clone(),
            module: self.module.clone(),
            qtype: self.qtype,
            difficulty: self.difficulty,
            title: self.title.clone(),
            prompt_html,
            options_html: self.options.iter().map(|o| md_inline(o)).collect(),
            blank_count: self.blanks.len(),
            starter: self.starter.clone(),
            tests: self.tests.clone(),
            hint_count: self.hints.len(),
            tags: self.tags.clone(),
            lang: self.lang.clone(),
            sources: self.sources.clone(),
        }
    }
}
