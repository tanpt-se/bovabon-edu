//! Tự nhúng toàn bộ kho dữ liệu vào binary:
//! - `data/*.toml` (trừ `categories.toml`, nhúng riêng) → `EMBEDDED`
//! - `data/i18n/<lang>/*.toml` (bản dịch) → `EMBEDDED_I18N` với tên `i18n/<lang>/<file>`
//! Thêm file mới vào `data/` là đủ, không cần sửa code.

use std::{env, fs, path::Path};

fn toml_files(dir: &Path) -> Vec<std::path::PathBuf> {
    let mut v: Vec<_> = fs::read_dir(dir)
        .map(|rd| rd.filter_map(|e| e.ok()).map(|e| e.path()).collect())
        .unwrap_or_default();
    v.retain(|p| p.is_file() && p.extension().is_some_and(|x| x == "toml"));
    v.sort();
    v
}

fn main() {
    let root = env::var("CARGO_MANIFEST_DIR").unwrap();
    let data = Path::new(&root).join("data");
    println!("cargo:rerun-if-changed=data");
    println!("cargo:rerun-if-changed=build.rs");

    let mut out = String::from("/// Các file lộ trình `data/*.toml` (sinh tự động bởi build.rs).\npub const EMBEDDED: &[(&str, &str)] = &[\n");
    for p in toml_files(&data) {
        let name = p.file_name().unwrap().to_string_lossy().to_string();
        if name == "categories.toml" {
            continue;
        }
        out += &format!("    ({name:?}, include_str!({:?})),\n", p.display().to_string());
    }
    out += "];\n\n/// Bản dịch `data/i18n/<lang>/*.toml` (sinh tự động bởi build.rs).\npub const EMBEDDED_I18N: &[(&str, &str)] = &[\n";
    let i18n = data.join("i18n");
    let mut langs: Vec<_> = fs::read_dir(&i18n)
        .map(|rd| rd.filter_map(|e| e.ok()).map(|e| e.path()).filter(|p| p.is_dir()).collect())
        .unwrap_or_default();
    langs.sort();
    for l in langs {
        let lang = l.file_name().unwrap().to_string_lossy().to_string();
        for p in toml_files(&l) {
            let name = format!("i18n/{lang}/{}", p.file_name().unwrap().to_string_lossy());
            out += &format!("    ({name:?}, include_str!({:?})),\n", p.display().to_string());
        }
    }
    out += "];\n";
    fs::write(Path::new(&env::var("OUT_DIR").unwrap()).join("embedded_data.rs"), out).unwrap();
}
