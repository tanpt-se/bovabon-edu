//! Kho dữ liệu chuẩn: tracks → modules → questions.
//! Dữ liệu mặc định được nhúng vào binary (thư mục `data/`, định dạng TOML), có thể
//! override bằng biến môi trường `BOVABON_DATA_DIR` trỏ tới thư mục chứa *.toml / *.json.

use pulldown_cmark::{Options, Parser, html};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Danh mục học (danh mục → mục con là các module), xem data/categories.toml.
pub const CATEGORIES_FILE: &str = "categories.toml";
pub const EMBEDDED_CATEGORIES: &str = include_str!("../data/categories.toml");

include!(concat!(env!("OUT_DIR"), "/embedded_data.rs"));

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
    /// Khu vực học: "dev" (lập trình, có Code Lab) | "english" (chỉ trắc nghiệm / điền / tự luận, không có bài code)
    #[serde(default = "default_area")]
    pub area: String,
    /// Các bộ tài liệu DevDocs liên quan (slug, vd. "react", "go", "fastapi")
    #[serde(default)]
    pub docs: Vec<String>,
    pub modules: Vec<Module>,
    pub questions: Vec<Question>,
}

fn default_group() -> String {
    "Frontend".into()
}

fn default_area() -> String {
    "dev".into()
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
    /// Danh mục chứa module của câu hỏi (gán khi nạp kho)
    #[serde(skip)]
    pub category: String,
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
    pub area: String,
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

#[derive(Debug, Clone, Deserialize)]
pub struct Category {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub color: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_group")]
    pub group: String,
    #[serde(default = "default_area")]
    pub area: String,
    /// id các module (mục con) theo thứ tự hiển thị
    pub modules: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct CategoriesFile {
    categories: Vec<Category>,
}

pub struct Bank {
    pub tracks: Vec<TrackFile>,
    pub by_id: HashMap<String, Question>,
    /// Danh mục hiển thị cho người học (mỗi module thuộc đúng 1 danh mục)
    pub categories: Vec<Category>,
    /// Bản dịch theo ngôn ngữ (vd. "en"), dựng từ data/i18n/<lang>/*.toml.
    /// Câu / module chưa dịch giữ nguyên tiếng Việt.
    pub locales: HashMap<String, Bank>,
}

/// Lớp phủ bản dịch: chỉ chứa phần chữ, id phải trùng với kho gốc.
#[derive(Debug, Default, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Overlay {
    #[serde(default)]
    pub categories: HashMap<String, TextTr>,
    #[serde(default)]
    pub modules: HashMap<String, ModuleTr>,
    #[serde(default)]
    pub questions: HashMap<String, QuestionTr>,
}

#[derive(Debug, Default, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TextTr {
    pub title: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Default, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ModuleTr {
    pub title: Option<String>,
    pub description: Option<String>,
    pub lesson: Option<String>,
}

#[derive(Debug, Default, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct QuestionTr {
    pub title: Option<String>,
    pub prompt: Option<String>,
    pub options: Option<Vec<String>>,
    pub blanks: Option<Vec<Vec<String>>>,
    pub keywords: Option<Vec<Vec<String>>>,
    pub model_answer: Option<String>,
    pub explanation: Option<String>,
    pub hints: Option<Vec<String>>,
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
            let i18n = std::path::Path::new(&dir).join("i18n");
            if let Ok(rd) = std::fs::read_dir(&i18n) {
                let mut langs: Vec<_> = rd.filter_map(|e| e.ok()).map(|e| e.path()).filter(|p| p.is_dir()).collect();
                langs.sort();
                for l in langs {
                    let lang = l.file_name().unwrap_or_default().to_string_lossy().to_string();
                    let mut fs: Vec<_> = std::fs::read_dir(&l)
                        .map_err(|e| e.to_string())?
                        .filter_map(|e| e.ok())
                        .map(|e| e.path())
                        .filter(|p| p.extension().is_some_and(|x| x == "toml"))
                        .collect();
                    fs.sort();
                    for f in fs {
                        let txt = std::fs::read_to_string(&f).map_err(|er| er.to_string())?;
                        files.push((format!("i18n/{lang}/{}", f.file_name().unwrap_or_default().to_string_lossy()), txt));
                    }
                }
            }
        } else {
            files.push((CATEGORIES_FILE.to_string(), EMBEDDED_CATEGORIES.to_string()));
            for (n, t) in EMBEDDED.iter().chain(EMBEDDED_I18N.iter()) {
                files.push((n.to_string(), t.to_string()));
            }
        }
        Self::from_sources(&files)
    }

    pub fn from_sources(files: &[(String, String)]) -> Result<Bank, String> {
        let mut tracks = Vec::new();
        let mut categories: Vec<Category> = Vec::new();
        let mut overlays: std::collections::BTreeMap<String, Overlay> = std::collections::BTreeMap::new();
        for (name, txt) in files {
            if let Some(rest) = name.strip_prefix("i18n/") {
                let lang = rest.split('/').next().unwrap_or_default().to_string();
                let o: Overlay = toml::from_str(txt).map_err(|e| format!("{name}: TOML lỗi: {e}"))?;
                merge_overlay(overlays.entry(lang).or_default(), o, name)?;
                continue;
            }
            if name == CATEGORIES_FILE {
                let f: CategoriesFile = toml::from_str(txt).map_err(|e| format!("{name}: TOML lỗi: {e}"))?;
                categories = f.categories;
                continue;
            }
            let mut t: TrackFile = if name.ends_with(".toml") {
                toml::from_str(txt).map_err(|e| format!("{name}: TOML lỗi: {e}"))?
            } else {
                serde_json::from_str(txt).map_err(|e| format!("{name}: JSON lỗi: {e}"))?
            };
            for q in t.questions.iter_mut() {
                q.track = t.id.clone();
            }
            tracks.push(t);
        }
        let mut bank = Self::assemble(tracks, categories.clone())?;
        for (lang, o) in overlays {
            let (lt, lc) = localize(&bank.tracks, &categories, &o).map_err(|e| format!("[i18n/{lang}] {e}"))?;
            let lb = Self::assemble(lt, lc).map_err(|e| format!("[i18n/{lang}] {e}"))?;
            bank.locales.insert(lang, lb);
        }
        Ok(bank)
    }

    fn assemble(mut tracks: Vec<TrackFile>, categories: Vec<Category>) -> Result<Bank, String> {
        let mut by_id = HashMap::new();
        let mut module_ids = std::collections::HashSet::new();
        for t in &tracks {
            for m in &t.modules {
                if !module_ids.insert(m.id.as_str()) {
                    return Err(format!("{}: trùng id module {}", t.id, m.id));
                }
            }
            for q in &t.questions {
                if by_id.insert(q.id.clone(), q.clone()).is_some() {
                    return Err(format!("{}: trùng id câu hỏi {}", t.id, q.id));
                }
            }
        }
        let categories = assign_categories(&tracks, categories)?;
        let module_cat: HashMap<&str, &str> = categories
            .iter()
            .flat_map(|c| c.modules.iter().map(move |m| (m.as_str(), c.id.as_str())))
            .collect();
        for t in tracks.iter_mut() {
            for q in t.questions.iter_mut() {
                q.category = module_cat.get(q.module.as_str()).unwrap_or(&t.id.as_str()).to_string();
            }
        }
        for q in by_id.values_mut() {
            q.category = module_cat.get(q.module.as_str()).copied().unwrap_or(q.track.as_str()).to_string();
        }
        let bank = Bank { tracks, by_id, categories, locales: HashMap::new() };
        bank.validate()?;
        Ok(bank)
    }

    /// Kho theo ngôn ngữ yêu cầu (không có bản dịch → kho gốc tiếng Việt).
    pub fn localized(&self, lang: Option<&str>) -> &Bank {
        lang.and_then(|l| self.locales.get(l)).unwrap_or(self)
    }

    /// Kiểm tra tính nhất quán của kho dữ liệu.
    pub fn validate(&self) -> Result<(), String> {
        let mut errs = Vec::new();
        for t in &self.tracks {
            for d in &t.docs {
                if !valid_devdocs_path(d) {
                    errs.push(format!("[{}] docs phải là slug DevDocs hợp lệ", t.id));
                }
            }
            for m in &t.modules {
                for s in &m.sources {
                    if !valid_devdocs_path(s) {
                        errs.push(format!("[{}/{}] sources phải là đường dẫn DevDocs tương đối", t.id, m.id));
                    }
                }
            }
            for q in &t.questions {
                let ctx = format!("[{}/{}]", t.id, q.id);
                if !t.modules.iter().any(|m| m.id == q.module) {
                    errs.push(format!("{ctx} module '{}' không tồn tại", q.module));
                }
                if q.sources.iter().any(|s| !valid_devdocs_path(s)) {
                    errs.push(format!("{ctx} sources phải là đường dẫn DevDocs tương đối"));
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

    /// Danh mục dưới dạng TrackInfo (API công khai: client coi danh mục là "lộ trình").
    pub fn category_infos(&self) -> Vec<TrackInfo> {
        let mut mods: HashMap<&str, (&TrackFile, &Module)> = HashMap::new();
        for t in &self.tracks {
            for m in &t.modules {
                mods.insert(m.id.as_str(), (t, m));
            }
        }
        self.categories
            .iter()
            .map(|c| {
                let mut counts = HashMap::new();
                let mut total = 0;
                let mut docs: Vec<String> = Vec::new();
                let modules: Vec<ModuleInfo> = c
                    .modules
                    .iter()
                    .filter_map(|mid| mods.get(mid.as_str()))
                    .map(|(t, m)| {
                        for d in &t.docs {
                            if !docs.contains(d) {
                                docs.push(d.clone());
                            }
                        }
                        let qs: Vec<&Question> = t.questions.iter().filter(|q| q.module == m.id).collect();
                        let mut cc = HashMap::new();
                        for q in &qs {
                            *cc.entry(q.qtype).or_insert(0) += 1;
                            *counts.entry(q.qtype).or_insert(0) += 1;
                        }
                        total += qs.len();
                        ModuleInfo {
                            id: m.id.clone(),
                            title: m.title.clone(),
                            description: m.description.clone(),
                            lesson_html: md(&m.lesson),
                            sources: m.sources.clone(),
                            question_ids: qs.iter().map(|q| q.id.clone()).collect(),
                            counts: cc,
                        }
                    })
                    .collect();
                TrackInfo {
                    id: c.id.clone(),
                    title: c.title.clone(),
                    icon: c.icon.clone(),
                    color: c.color.clone(),
                    description: c.description.clone(),
                    group: c.group.clone(),
                    area: c.area.clone(),
                    docs,
                    modules,
                    counts,
                    total,
                }
            })
            .collect()
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
                    area: t.area.clone(),
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

pub(crate) fn valid_devdocs_path(value: &str) -> bool {
    if value.is_empty() || value.starts_with('/') || value.contains('\\') || value.contains("://") {
        return false;
    }
    let (path, fragment) = value.split_once('#').unwrap_or((value, ""));
    if path.is_empty() || path.chars().any(|c| c.is_control()) || fragment.chars().any(|c| c.is_control()) {
        return false;
    }
    let mut parts = path.split('/');
    let Some(slug) = parts.next() else { return false };
    if slug.is_empty()
        || slug == "."
        || slug == ".."
        || !slug.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '~' | '.'))
    {
        return false;
    }
    parts.all(|part| {
        !part.is_empty()
            && part != "."
            && part != ".."
            // DevDocs có trang như css/selectors/:has, angular/api/core/@for ("://" đã bị chặn ở trên)
            && part.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '~' | '+' | '@' | ':'))
    })
}

#[cfg(test)]
mod tests {
    use super::valid_devdocs_path;

    #[test]
    fn versioned_devdocs_paths_are_valid() {
        assert!(valid_devdocs_path("vue~3/api/reactivity-core"));
        assert!(valid_devdocs_path("django~6.0"));
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
            track: if self.category.is_empty() { self.track.clone() } else { self.category.clone() },
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

/// Kiểm tra danh mục và xếp các module chưa có danh mục vào danh mục trùng id lộ trình
/// (hoặc một danh mục mới lấy theo lộ trình) để lộ trình mới vẫn hiển thị được.
fn assign_categories(tracks: &[TrackFile], mut cats: Vec<Category>) -> Result<Vec<Category>, String> {
    let mut errs = Vec::new();
    let mut owner: HashMap<String, (String, String)> = HashMap::new(); // module -> (track, area)
    for t in tracks {
        for m in &t.modules {
            owner.insert(m.id.clone(), (t.id.clone(), t.area.clone()));
        }
    }
    let mut seen: HashMap<String, String> = HashMap::new();
    let mut ids = std::collections::HashSet::new();
    for c in &cats {
        if !ids.insert(c.id.clone()) {
            errs.push(format!("[categories/{}] trùng id danh mục", c.id));
        }
        if !["dev", "english"].contains(&c.area.as_str()) {
            errs.push(format!("[categories/{}] area không hợp lệ: {:?}", c.id, c.area));
        }
        for m in &c.modules {
            if let Some(prev) = seen.insert(m.clone(), c.id.clone()) {
                errs.push(format!("[categories/{}] module '{m}' đã thuộc danh mục '{prev}'", c.id));
            }
            if let Some((tid, area)) = owner.get(m) {
                if area != &c.area {
                    errs.push(format!("[categories/{}] module '{m}' (lộ trình {tid}, area {area}) khác area danh mục ({})", c.id, c.area));
                }
            }
        }
    }
    // Chỉ giữ module đang có trong kho (cho phép kiểm định riêng lẻ / BOVABON_DATA_DIR thiếu file)
    for c in cats.iter_mut() {
        c.modules.retain(|m| owner.contains_key(m));
    }
    for t in tracks {
        for m in &t.modules {
            if seen.contains_key(&m.id) {
                continue;
            }
            let idx = match cats.iter().position(|c| c.id == t.id) {
                Some(i) => i,
                None => {
                    cats.push(Category {
                        id: t.id.clone(),
                        title: t.title.clone(),
                        icon: t.icon.clone(),
                        color: t.color.clone(),
                        description: t.description.clone(),
                        group: t.group.clone(),
                        area: t.area.clone(),
                        modules: Vec::new(),
                    });
                    cats.len() - 1
                }
            };
            cats[idx].modules.push(m.id.clone());
        }
    }
    cats.retain(|c| !c.modules.is_empty());
    if errs.is_empty() { Ok(cats) } else { Err(errs.join("\n")) }
}

/// Module chưa được xếp vào data/categories.toml (dùng trong kiểm định toàn kho).
pub fn uncategorized_modules(tracks: &[TrackFile], categories_toml: &str) -> Result<Vec<String>, String> {
    let f: CategoriesFile = toml::from_str(categories_toml).map_err(|e| format!("categories.toml: {e}"))?;
    let listed: std::collections::HashSet<&str> = f.categories.iter().flat_map(|c| c.modules.iter().map(|m| m.as_str())).collect();
    Ok(tracks
        .iter()
        .flat_map(|t| t.modules.iter().filter(|m| !listed.contains(m.id.as_str())).map(move |m| format!("{}/{}", t.id, m.id)))
        .collect())
}

fn merge_overlay(into: &mut Overlay, o: Overlay, name: &str) -> Result<(), String> {
    for (k, v) in o.categories {
        if into.categories.insert(k.clone(), v).is_some() {
            return Err(format!("{name}: danh mục '{k}' đã được dịch ở file khác"));
        }
    }
    for (k, v) in o.modules {
        if into.modules.insert(k.clone(), v).is_some() {
            return Err(format!("{name}: module '{k}' đã được dịch ở file khác"));
        }
    }
    for (k, v) in o.questions {
        if into.questions.insert(k.clone(), v).is_some() {
            return Err(format!("{name}: câu '{k}' đã được dịch ở file khác"));
        }
    }
    Ok(())
}

/// Áp bản dịch lên bản sao của kho gốc. Chỉ thay chữ; đáp án, test, id giữ nguyên.
fn localize(tracks: &[TrackFile], cats: &[Category], o: &Overlay) -> Result<(Vec<TrackFile>, Vec<Category>), String> {
    let mut errs = Vec::new();
    let mut tracks = tracks.to_vec();
    let mut cats = cats.to_vec();
    for (id, tr) in &o.categories {
        match cats.iter_mut().find(|c| &c.id == id) {
            Some(c) => {
                if let Some(x) = &tr.title { c.title = x.clone(); }
                if let Some(x) = &tr.description { c.description = x.clone(); }
            }
            None => {
                // danh mục dự phòng (trùng id lộ trình) cũng dịch được qua tên lộ trình
                if let Some(t) = tracks.iter_mut().find(|t| &t.id == id) {
                    if let Some(x) = &tr.title { t.title = x.clone(); }
                    if let Some(x) = &tr.description { t.description = x.clone(); }
                } else {
                    errs.push(format!("danh mục '{id}' không tồn tại"));
                }
            }
        }
    }
    let mut seen_m = std::collections::HashSet::new();
    let mut seen_q = std::collections::HashSet::new();
    for t in tracks.iter_mut() {
        for m in t.modules.iter_mut() {
            if let Some(tr) = o.modules.get(&m.id) {
                seen_m.insert(m.id.clone());
                if let Some(x) = &tr.title { m.title = x.clone(); }
                if let Some(x) = &tr.description { m.description = x.clone(); }
                if let Some(x) = &tr.lesson { m.lesson = x.clone(); }
            }
        }
        for q in t.questions.iter_mut() {
            let Some(tr) = o.questions.get(&q.id) else { continue };
            seen_q.insert(q.id.clone());
            let ctx = format!("[{}/{}]", t.id, q.id);
            if let Some(x) = &tr.title { q.title = x.clone(); }
            if let Some(x) = &tr.prompt { q.prompt = x.clone(); }
            if let Some(x) = &tr.explanation { q.explanation = x.clone(); }
            if let Some(x) = &tr.model_answer { q.model_answer = x.clone(); }
            if let Some(x) = &tr.hints { q.hints = x.clone(); }
            if let Some(x) = &tr.options {
                if x.len() != q.options.len() {
                    errs.push(format!("{ctx} options có {} mục, bản gốc có {}", x.len(), q.options.len()));
                }
                q.options = x.clone();
            }
            if let Some(x) = &tr.blanks {
                if x.len() != q.blanks.len() {
                    errs.push(format!("{ctx} blanks có {} ô, bản gốc có {}", x.len(), q.blanks.len()));
                }
                q.blanks = x.clone();
            }
            if let Some(x) = &tr.keywords {
                if x.is_empty() || x.iter().any(|g| g.is_empty()) {
                    errs.push(format!("{ctx} keywords rỗng"));
                }
                if let Some(mk) = q.min_keywords {
                    if mk > x.len() {
                        errs.push(format!("{ctx} keywords có {} nhóm < min_keywords {mk}", x.len()));
                    }
                }
                q.keywords = x.clone();
            }
        }
    }
    for k in o.modules.keys().filter(|k| !seen_m.contains(*k)) {
        errs.push(format!("module '{k}' không tồn tại"));
    }
    for k in o.questions.keys().filter(|k| !seen_q.contains(*k)) {
        errs.push(format!("câu hỏi '{k}' không tồn tại"));
    }
    if errs.is_empty() { Ok((tracks, cats)) } else { Err(errs.join("\n")) }
}
