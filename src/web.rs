//! HTTP API + phục vụ giao diện SPA (nhúng sẵn trong binary).

use crate::bank::{Bank, PublicQuestion, QType, md};
use crate::{grade, runner};
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::{StatusCode, header},
    response::{Html, IntoResponse, Response},
    routing::{get, post},
};
use serde::Deserialize;
use serde_json::{Value, json};
use std::sync::Arc;
use std::time::Duration;

const INDEX: &str = include_str!("../static/index.html");
const APP_JS: &str = include_str!("../static/app.js");
const I18N_JS: &str = include_str!("../static/i18n.js");
const APP_CSS: &str = include_str!("../static/app.css");
const FAVICON: &str = include_str!("../static/favicon.svg");
const ICONS: &str = include_str!("../static/icons.svg");
const SOURCE_SANS: &[u8] = include_bytes!("../assets/fonts/SourceSans3VF-Upright.woff2");

pub type AppState = Arc<Bank>;

/// `?lang=en` → nội dung đã dịch (nếu có), mặc định tiếng Việt.
#[derive(Deserialize, Default)]
struct LangQ {
    lang: Option<String>,
}

pub fn router(bank: Arc<Bank>) -> Router {
    Router::new()
        .route("/", get(|| async { Html(INDEX) }))
        .route("/app.js", get(|| async { asset("text/javascript; charset=utf-8", APP_JS) }))
        .route("/i18n.js", get(|| async { asset("text/javascript; charset=utf-8", I18N_JS) }))
        .route("/app.css", get(|| async { asset("text/css; charset=utf-8", APP_CSS) }))
        .route("/favicon.svg", get(|| async { asset("image/svg+xml", FAVICON) }))
        .route("/icons.svg", get(|| async { asset("image/svg+xml", ICONS) }))
        .route("/fonts/SourceSans3VF-Upright.woff2", get(|| async { font_asset() }))
        .route("/api/health", get(|| async { Json(json!({"ok": true})) }))
        .route("/api/catalog", get(catalog))
        .route("/api/questions", get(list_questions))
        .route("/api/questions/{id}", get(get_question))
        .route("/api/questions/{id}/check", post(check))
        .route("/api/questions/{id}/run", post(run_code))
        .route("/api/questions/{id}/hint/{n}", get(hint))
        .route("/api/questions/{id}/solution", get(solution))
        .route("/api/exam", get(exam))
        .with_state(bank)
}

fn asset(ct: &'static str, body: &'static str) -> Response {
    ([(header::CONTENT_TYPE, ct), (header::CACHE_CONTROL, "no-cache")], body).into_response()
}

fn font_asset() -> Response {
    let mut response = Response::new(axum::body::Body::from(SOURCE_SANS));
    response.headers_mut().insert(header::CONTENT_TYPE, header::HeaderValue::from_static("font/woff2"));
    response.headers_mut().insert(header::CACHE_CONTROL, header::HeaderValue::from_static("public, max-age=31536000, immutable"));
    response
}

fn not_found(id: &str) -> Response {
    (StatusCode::NOT_FOUND, Json(json!({"error": format!("Không tìm thấy câu hỏi {id}")}))).into_response()
}

async fn catalog(State(b0): State<AppState>, Query(l): Query<LangQ>) -> Json<Value> {
    let b = b0.localized(l.lang.as_deref());
    let tracks = b.category_infos();
    let mut langs: Vec<&str> = std::iter::once("vi").chain(b0.locales.keys().map(|k| k.as_str())).collect();
    langs.dedup();
    let mut by_type = std::collections::HashMap::new();
    for q in b.all_questions() {
        *by_type.entry(q.qtype).or_insert(0usize) += 1;
    }
    Json(json!({
        "app": "Bovabon Edu",
        "version": env!("CARGO_PKG_VERSION"),
        "tracks": tracks,
        "total": b.by_id.len(),
        "by_type": by_type,
        "langs": langs,
    }))
}

#[derive(Deserialize)]
struct ListQ {
    track: Option<String>,
    module: Option<String>,
    #[serde(rename = "type")]
    qtype: Option<String>,
    ids: Option<String>,
    lang: Option<String>,
}

fn parse_types(s: &str) -> Vec<QType> {
    s.split(',')
        .filter_map(|t| serde_json::from_value::<QType>(Value::String(t.trim().to_string())).ok())
        .collect()
}

async fn list_questions(State(b0): State<AppState>, Query(q): Query<ListQ>) -> Json<Vec<PublicQuestion>> {
    let b = b0.localized(q.lang.as_deref());
    let types = q.qtype.as_deref().map(parse_types);
    if let Some(ids) = q.ids {
        let out = ids
            .split(',')
            .filter_map(|id| b.by_id.get(id.trim()))
            .map(|x| x.public())
            .collect();
        return Json(out);
    }
    let out = b
        .all_questions()
        .filter(|x| q.track.as_ref().is_none_or(|t| t == "all" || &x.category == t || &x.track == t))
        .filter(|x| q.module.as_ref().is_none_or(|m| &x.module == m))
        .filter(|x| types.as_ref().is_none_or(|ts| ts.is_empty() || ts.contains(&x.qtype)))
        .map(|x| x.public())
        .collect();
    Json(out)
}

async fn get_question(State(b0): State<AppState>, Path(id): Path<String>, Query(l): Query<LangQ>) -> Response {
    let b = b0.localized(l.lang.as_deref());
    match b.by_id.get(&id) {
        Some(q) => Json(q.public()).into_response(),
        None => not_found(&id),
    }
}

#[derive(Deserialize)]
struct CheckBody {
    answer: Value,
}

async fn check(State(b0): State<AppState>, Path(id): Path<String>, Query(l): Query<LangQ>, Json(body): Json<CheckBody>) -> Response {
    let b = b0.localized(l.lang.as_deref());
    let Some(q) = b.by_id.get(&id) else { return not_found(&id) };
    if q.qtype == QType::Code {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Bài code dùng /run"}))).into_response();
    }
    Json(grade::check(q, &body.answer)).into_response()
}

#[derive(Deserialize)]
struct RunBody {
    code: String,
}

async fn run_code(State(b): State<AppState>, Path(id): Path<String>, Json(body): Json<RunBody>) -> Response {
    let Some(q) = b.by_id.get(&id) else { return not_found(&id) };
    if q.qtype != QType::Code {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Không phải bài code"}))).into_response();
    }
    let tests = q.tests.clone();
    let lang = q.lang.clone();
    let secs = if matches!(lang.as_str(), "go" | "rust") { 60 } else { 10 };
    let rep = tokio::task::spawn_blocking(move || runner::run_lang(&lang, &body.code, &tests, Duration::from_secs(secs)))
        .await
        .unwrap_or_default();
    Json(rep).into_response()
}

async fn hint(State(b0): State<AppState>, Path((id, n)): Path<(String, usize)>, Query(l): Query<LangQ>) -> Response {
    let b = b0.localized(l.lang.as_deref());
    let Some(q) = b.by_id.get(&id) else { return not_found(&id) };
    match q.hints.get(n) {
        Some(h) => Json(json!({"index": n, "html": md(h), "total": q.hints.len()})).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "Hết gợi ý"}))).into_response(),
    }
}

async fn solution(State(b0): State<AppState>, Path(id): Path<String>, Query(l): Query<LangQ>) -> Response {
    let b = b0.localized(l.lang.as_deref());
    let Some(q) = b.by_id.get(&id) else { return not_found(&id) };
    Json(json!({
        "solution": q.solution,
        "explanation_html": md(&q.explanation),
        "model_answer_html": md(&q.model_answer),
    }))
    .into_response()
}

#[derive(Deserialize)]
struct ExamQ {
    track: Option<String>,
    count: Option<usize>,
    types: Option<String>,
    seed: Option<u64>,
    lang: Option<String>,
}

/// Xáo trộn Fisher–Yates với PRNG xorshift (không cần crate rand).
fn shuffle<T>(v: &mut [T], mut seed: u64) {
    if seed == 0 {
        seed = 0x9E37_79B9_7F4A_7C15;
    }
    for i in (1..v.len()).rev() {
        seed ^= seed << 13;
        seed ^= seed >> 7;
        seed ^= seed << 17;
        v.swap(i, (seed % (i as u64 + 1)) as usize);
    }
}

async fn exam(State(b0): State<AppState>, Query(q): Query<ExamQ>) -> Json<Value> {
    let b = b0.localized(q.lang.as_deref());
    let types = q
        .types
        .as_deref()
        .map(parse_types)
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| vec![QType::Single, QType::Multiple, QType::Fill]);
    let mut pool: Vec<PublicQuestion> = b
        .all_questions()
        .filter(|x| q.track.as_ref().is_none_or(|t| t == "all" || t.split(',').any(|s| s == x.category || s == x.track)))
        .filter(|x| types.contains(&x.qtype))
        .map(|x| x.public())
        .collect();
    let seed = q.seed.unwrap_or_else(|| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(1)
    });
    shuffle(&mut pool, seed);
    pool.truncate(q.count.unwrap_or(20).clamp(1, 100));
    Json(json!({"seed": seed, "questions": pool}))
}
