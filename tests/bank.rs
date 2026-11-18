//! Kiểm định toàn bộ kho dữ liệu nhúng sẵn (logic chi tiết ở `bovabon_edu::verify`).

use bovabon_edu::bank::Bank;
use bovabon_edu::verify::{Options, verify_tracks};
use serde_json::json;

#[test]
fn embedded_bank_is_valid() {
    let b = Bank::load().expect("kho dữ liệu hợp lệ");
    assert!(b.tracks.len() >= 19, "thiếu lộ trình: {}", b.tracks.len());
    let tracks: Vec<_> = b.tracks.iter().collect();
    let errs = verify_tracks(&tracks, &Options { jobs: 6, ..Options::default() });
    assert!(errs.is_empty(), "\n{}", errs.join("\n"));
}

#[test]
fn every_module_has_a_category() {
    let b = Bank::load().expect("kho dữ liệu hợp lệ");
    let missing = bovabon_edu::bank::uncategorized_modules(&b.tracks, bovabon_edu::bank::EMBEDDED_CATEGORIES).unwrap();
    assert!(missing.is_empty(), "module chưa có trong data/categories.toml: {missing:?}");
}

#[test]
fn translations_are_valid() {
    let b = Bank::load().expect("kho dữ liệu hợp lệ");
    let errs = bovabon_edu::verify::verify_locales(&b);
    assert!(errs.is_empty(), "\n{}", errs.join("\n"));
}

#[test]
fn locale_overlay_rejects_unknown_top_level_keys() {
    let files = vec![("i18n/en/track.toml".to_string(), "[quesitons]\n".to_string())];
    let err = Bank::from_sources(&files).err().expect("unknown overlay field is rejected");
    assert!(err.contains("quesitons"), "{err}");
}

#[test]
fn versioned_devdocs_slugs_are_accepted() {
    let track = json!({
        "id": "track",
        "title": "Track",
        "icon": "",
        "color": "",
        "description": "",
        "docs": ["django~6.0"],
        "modules": [{"id": "module", "title": "Module", "description": "Description", "sources": ["vue~3/api/reactivity-core"]}],
        "questions": []
    });
    let files = vec![("track.json".to_string(), track.to_string())];
    assert!(Bank::from_sources(&files).is_ok());
}

#[test]
fn empty_translated_module_lesson_is_rejected() {
    let track = json!({
        "id": "track",
        "title": "Track",
        "icon": "",
        "color": "",
        "description": "",
        "modules": [{"id": "module", "title": "Module", "description": "Description", "lesson": "x".repeat(220)}],
        "questions": [{"id": "q1", "module": "module", "type": "single", "prompt": "Question", "options": ["A", "B"], "answer": [0]}]
    });
    let files = vec![
        ("track.json".to_string(), track.to_string()),
        ("i18n/en/track.toml".to_string(), "[modules.module]\nlesson = \"\"\n".to_string()),
    ];
    let bank = Bank::from_sources(&files).unwrap();
    let errs = bovabon_edu::verify::verify_locales(&bank);
    assert!(errs.iter().any(|e| e.contains("module module") && e.contains("lesson")), "{}", errs.join("\n"));
}

#[test]
fn traversal_in_docs_and_sources_is_rejected() {
    let track = json!({
        "id": "track",
        "title": "Track",
        "icon": "",
        "color": "",
        "description": "",
        "docs": ["../outside", "C:/outside"],
        "modules": [{"id": "module", "title": "Module", "description": "Description", "sources": ["react/../../outside"]}],
        "questions": [{"id": "q1", "module": "module", "type": "single", "prompt": "Question", "options": ["A", "B"], "answer": [0], "sources": ["../../outside"]}]
    });
    let files = vec![("track.json".to_string(), track.to_string())];
    let err = Bank::from_sources(&files).err().expect("unsafe docs and sources are rejected");
    assert!(err.contains("[track] docs"), "{err}");
    assert!(err.contains("[track/module] sources"), "{err}");
    assert!(err.contains("[track/q1] sources"), "{err}");
}

#[test]
fn duplicate_module_ids_across_tracks_are_rejected() {
    let track = |id: &str, question_id: &str| json!({
        "id": id,
        "title": id,
        "icon": "",
        "color": "",
        "description": "",
        "modules": [{"id": "shared-module", "title": "Module", "description": "Description"}],
        "questions": [{"id": question_id, "module": "shared-module", "type": "single", "prompt": "Question", "options": ["A", "B"], "answer": [0]}]
    });
    let files = vec![
        ("one.json".to_string(), track("one", "q1").to_string()),
        ("two.json".to_string(), track("two", "q2").to_string()),
    ];
    let err = Bank::from_sources(&files).err().expect("duplicate module IDs are rejected");
    assert!(err.contains("trùng id module shared-module"), "{err}");
}
