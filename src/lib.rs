//! Bovabon Edu — LMS ôn tập Frontend & Backend (không cần đăng nhập).
pub mod bank;
pub mod grade;
pub mod runner;
pub mod verify;
pub mod web;

use std::sync::Arc;

/// Nạp kho dữ liệu và dựng router HTTP hoàn chỉnh (API + giao diện, có nén gzip).
/// Trả về (router, số câu hỏi, số lộ trình).
pub fn build_app() -> Result<(axum::Router, usize, usize), String> {
    let bank = Arc::new(bank::Bank::load()?);
    let (q, t) = (bank.by_id.len(), bank.tracks.len());
    let app = web::router(bank).layer(tower_http::compression::CompressionLayer::new());
    Ok((app, q, t))
}
