// Bovabon Edu — mini test harness cho Rust (được ghép TRƯỚC code học viên và bộ test).
// Bộ test viết bằng macro:
//
//     bovabon_tests! {
//         "cộng hai số" => { assert_eq!(add(1, 2), 3); },
//         "số âm" => { assert_eq!(add(-1, 1), 0); },
//     }
//
// Mỗi test chạy trong catch_unwind; thông điệp panic (assert!, assert_eq!, unwrap…) là lỗi của test.
#![allow(dead_code, unused_imports, unused_variables, unused_mut, non_snake_case)]

use std::sync::{Mutex, OnceLock};

fn __bovabon_last_panic() -> &'static Mutex<Option<String>> {
    static P: OnceLock<Mutex<Option<String>>> = OnceLock::new();
    P.get_or_init(|| Mutex::new(None))
}

fn __bovabon_json(s: &str) -> String {
    let mut o = String::with_capacity(s.len() + 2);
    o.push('"');
    for c in s.chars() {
        match c {
            '"' => o.push_str("\\\""),
            '\\' => o.push_str("\\\\"),
            '\n' => o.push_str("\\n"),
            '\r' => o.push_str("\\r"),
            '\t' => o.push_str("\\t"),
            c if (c as u32) < 0x20 => o.push_str(&format!("\\u{:04x}", c as u32)),
            c => o.push(c),
        }
    }
    o.push('"');
    o
}

pub fn __bovabon_run(tests: Vec<(&'static str, fn())>) {
    std::panic::set_hook(Box::new(|info| {
        let msg = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "panic".to_string()
        };
        let loc = info.location().map(|l| format!(" (dòng {})", l.line())).unwrap_or_default();
        *__bovabon_last_panic().lock().unwrap() = Some(format!("{msg}{loc}"));
    }));
    let mut parts = Vec::new();
    for (name, f) in tests {
        *__bovabon_last_panic().lock().unwrap() = None;
        let ok = std::panic::catch_unwind(f).is_ok();
        let err = if ok {
            "null".to_string()
        } else {
            __bovabon_json(&__bovabon_last_panic().lock().unwrap().clone().unwrap_or_else(|| "panic".into()))
        };
        parts.push(format!("{{\"name\":{},\"passed\":{},\"error\":{}}}", __bovabon_json(name), ok, err));
    }
    println!("\n@@BOVABON@@{{\"results\":[{}],\"logs\":[]}}", parts.join(","));
}

#[macro_export]
macro_rules! bovabon_tests {
    ($($name:literal => $body:block),* $(,)?) => {
        fn main() {
            let tests: Vec<(&'static str, fn())> = vec![$(($name, || $body)),*];
            __bovabon_run(tests);
        }
    };
}
