//! Chạy code học viên + bộ unit test trong Boa (JS engine thuần Rust), sandbox:
//! không có file system / network, giới hạn vòng lặp, đệ quy và thời gian.

use boa_engine::{Context, Source};
use serde::{Deserialize, Serialize};
use std::sync::mpsc;
use std::time::{Duration, Instant};

const HARNESS: &str = include_str!("harness.js");
pub const MAX_CODE_LEN: usize = 50_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TestResult {
    pub name: String,
    pub passed: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct RunReport {
    pub passed: usize,
    pub total: usize,
    pub all_passed: bool,
    pub results: Vec<TestResult>,
    pub logs: Vec<String>,
    /// lỗi biên dịch / runtime ngoài test
    pub error: Option<String>,
    pub duration_ms: u128,
}

#[derive(Deserialize)]
struct RawReport {
    results: Vec<TestResult>,
    logs: Vec<String>,
    pending: i64,
}

fn run_inner(code: &str, tests: &str) -> RunReport {
    let start = Instant::now();
    let mut rep = RunReport::default();
    let mut ctx = Context::default();
    {
        let limits = ctx.runtime_limits_mut();
        limits.set_loop_iteration_limit(20_000_000);
        limits.set_recursion_limit(2_000);
    }
    if let Err(e) = ctx.eval(Source::from_bytes(HARNESS)) {
        rep.error = Some(format!("Harness lỗi: {e}"));
        return rep;
    }
    // Code học viên chạy ở global scope để test truy cập được hàm/biến đã khai báo.
    if let Err(e) = ctx.eval(Source::from_bytes(code)) {
        rep.error = Some(format!("Lỗi trong code của bạn: {e}"));
        collect(&mut ctx, &mut rep);
        rep.duration_ms = start.elapsed().as_millis();
        return rep;
    }
    if let Err(e) = ctx.eval(Source::from_bytes(tests)) {
        rep.error = Some(format!("Lỗi khi chạy bộ test: {e}"));
    }
    if let Err(e) = ctx.eval(Source::from_bytes("__runAll()")) {
        rep.error.get_or_insert(format!("Lỗi khi chạy test: {e}"));
    }
    let _ = ctx.run_jobs();
    collect(&mut ctx, &mut rep);
    rep.duration_ms = start.elapsed().as_millis();
    rep
}

fn collect(ctx: &mut Context, rep: &mut RunReport) {
    let raw = ctx
        .eval(Source::from_bytes("__report()"))
        .ok()
        .and_then(|v| v.to_string(ctx).ok())
        .map(|s| s.to_std_string_escaped());
    if let Some(Ok(r)) = raw.map(|s| serde_json::from_str::<RawReport>(&s)) {
        rep.logs = r.logs;
        rep.results = r.results;
        if r.pending > 0 {
            rep.results.push(TestResult {
                name: "(async)".into(),
                passed: false,
                error: Some(format!("{} test bất đồng bộ chưa hoàn tất (Promise không resolve)", r.pending)),
            });
        }
    }
    rep.total = rep.results.len();
    rep.passed = rep.results.iter().filter(|r| r.passed).count();
    rep.all_passed = rep.error.is_none() && rep.total > 0 && rep.passed == rep.total;
}

/// Chạy đồng bộ trên thread riêng (stack lớn) với timeout.
pub fn run(code: &str, tests: &str, timeout: Duration) -> RunReport {
    if code.len() > MAX_CODE_LEN {
        return RunReport { error: Some("Code quá dài (tối đa 50KB)".into()), ..Default::default() };
    }
    let (tx, rx) = mpsc::channel();
    let code = code.to_string();
    let tests = tests.to_string();
    let spawned = std::thread::Builder::new()
        .name("boa-runner".into())
        .stack_size(64 * 1024 * 1024)
        .spawn(move || {
            let _ = tx.send(run_inner(&code, &tests));
        });
    if spawned.is_err() {
        return RunReport { error: Some("Không tạo được luồng chạy test".into()), ..Default::default() };
    }
    match rx.recv_timeout(timeout) {
        Ok(r) => r,
        Err(_) => RunReport {
            error: Some(format!(
                "Quá thời gian ({}s) — có thể code bị lặp vô hạn hoặc quá chậm",
                timeout.as_secs()
            )),
            ..Default::default()
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn passes_and_fails() {
        let r = run(
            "function add(a,b){return a+b}",
            "test('ok',()=>expect(add(1,2)).toBe(3)); test('bad',()=>expect(add(1,1)).toBe(3));",
            Duration::from_secs(5),
        );
        assert_eq!(r.total, 2);
        assert_eq!(r.passed, 1);
        assert!(!r.all_passed);
    }

    #[test]
    fn syntax_error_reported() {
        let r = run("function (", "test('x',()=>{})", Duration::from_secs(5));
        assert!(r.error.is_some());
    }

    #[test]
    fn infinite_loop_is_stopped() {
        let r = run("while(true){}", "test('x',()=>{})", Duration::from_secs(10));
        assert!(r.error.is_some());
    }

    #[test]
    fn async_and_hooks_work() {
        let r = run(
            "function useCounter(){const [c,setC]=useState(0);return {c,inc:()=>setC(x=>x+1)}}",
            "test('hook',()=>{const {result}=renderHook(()=>useCounter());act(()=>result.current.inc());expect(result.current.c).toBe(1)});\
             test('async', async ()=>{const v = await Promise.resolve(5); expect(v).toBe(5)});",
            Duration::from_secs(5),
        );
        assert!(r.all_passed, "{r:?}");
    }
}

// ======================================================================
// Runner đa ngôn ngữ: Python (python3) và Go (go run) chạy trong process
// con, thư mục tạm riêng, có timeout và bị kill nếu quá giờ.
// ======================================================================

const PY_HARNESS: &str = include_str!("harness.py");
const GO_HARNESS: &str = include_str!("harness.go");
const RS_HARNESS: &str = include_str!("harness.rs");
const PHP_HARNESS: &str = include_str!("harness.php");
const MARK: &str = "@@BOVABON@@";

/// Ngôn ngữ chạy được: "javascript" (mặc định), "python", "go".
pub fn run_lang(lang: &str, code: &str, tests: &str, timeout: Duration) -> RunReport {
    match lang {
        "python" => run_python(code, tests, timeout),
        "go" => run_go(code, tests, timeout),
        "rust" => run_rust(code, tests, timeout),
        "php" => run_php(code, tests, timeout),
        _ => run(code, tests, timeout),
    }
}

fn find_tool(env: &str, candidates: &[&str]) -> Option<std::path::PathBuf> {
    if let Ok(p) = std::env::var(env) {
        return Some(p.into());
    }
    for c in candidates {
        let p = std::path::Path::new(c);
        if p.is_absolute() {
            if p.exists() {
                return Some(p.to_path_buf());
            }
        } else if let Ok(path) = std::env::var("PATH") {
            for dir in std::env::split_paths(&path) {
                let full = dir.join(c);
                if full.exists() {
                    return Some(full);
                }
            }
        }
    }
    None
}

fn temp_dir(tag: &str) -> std::io::Result<std::path::PathBuf> {
    use std::sync::atomic::{AtomicU64, Ordering};
    static N: AtomicU64 = AtomicU64::new(0);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dir = std::env::temp_dir().join(format!(
        "bovabon-{tag}-{}-{nanos}-{}",
        std::process::id(),
        N.fetch_add(1, Ordering::Relaxed)
    ));
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Chạy process với stdin, gom stdout/stderr, kill khi quá timeout.
fn exec(
    mut cmd: std::process::Command,
    stdin: Option<String>,
    timeout: Duration,
) -> Result<(bool, String, String), String> {
    use std::io::{Read, Write};
    use std::process::Stdio;
    cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| format!("Không chạy được trình thông dịch/biên dịch: {e}"))?;
    if let Some(mut si) = child.stdin.take() {
        let data = stdin.unwrap_or_default();
        std::thread::spawn(move || {
            let _ = si.write_all(data.as_bytes());
        });
    }
    let mut so = child.stdout.take().unwrap();
    let mut se = child.stderr.take().unwrap();
    let ho = std::thread::spawn(move || {
        let mut s = String::new();
        let _ = so.read_to_string(&mut s);
        s
    });
    let he = std::thread::spawn(move || {
        let mut s = String::new();
        let _ = se.read_to_string(&mut s);
        s
    });
    let start = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(st)) => break st,
            Ok(None) if start.elapsed() > timeout => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!(
                    "Quá thời gian ({}s) — có thể code bị lặp vô hạn hoặc quá chậm",
                    timeout.as_secs()
                ));
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(10)),
            Err(e) => return Err(e.to_string()),
        }
    };
    Ok((status.success(), ho.join().unwrap_or_default(), he.join().unwrap_or_default()))
}

fn parse_marked(stdout: &str, rep: &mut RunReport) -> bool {
    #[derive(Deserialize)]
    struct Raw {
        results: Vec<TestResult>,
        #[serde(default)]
        logs: Vec<String>,
        #[serde(default)]
        error: Option<String>,
    }
    let Some(pos) = stdout.rfind(MARK) else { return false };
    let before = stdout[..pos].trim_end();
    let Ok(raw) = serde_json::from_str::<Raw>(stdout[pos + MARK.len()..].trim()) else { return false };
    rep.results = raw.results;
    rep.logs = raw.logs;
    if !before.is_empty() {
        let mut l: Vec<String> = before.lines().map(String::from).collect();
        l.extend(std::mem::take(&mut rep.logs));
        rep.logs = l.into_iter().take(200).collect();
    }
    if raw.error.is_some() {
        rep.error = raw.error;
    }
    true
}

fn finalize(rep: &mut RunReport, start: Instant) {
    rep.total = rep.results.len();
    rep.passed = rep.results.iter().filter(|r| r.passed).count();
    rep.all_passed = rep.error.is_none() && rep.total > 0 && rep.passed == rep.total;
    rep.duration_ms = start.elapsed().as_millis();
}

fn run_python(code: &str, tests: &str, timeout: Duration) -> RunReport {
    let start = Instant::now();
    let mut rep = RunReport::default();
    if code.len() > MAX_CODE_LEN {
        rep.error = Some("Code quá dài (tối đa 50KB)".into());
        return rep;
    }
    let Some(py) = find_tool("BOVABON_PYTHON", &["python3", "/opt/homebrew/bin/python3", "/usr/bin/python3"]) else {
        rep.error = Some("Máy chủ chưa cài Python 3 (đặt biến BOVABON_PYTHON nếu cần)".into());
        return rep;
    };
    let Ok(dir) = temp_dir("py") else {
        rep.error = Some("Không tạo được thư mục tạm".into());
        return rep;
    };
    let mut cmd = std::process::Command::new(py);
    cmd.arg("-I").arg("-X").arg("utf8").arg("-c").arg(PY_HARNESS).current_dir(&dir);
    cmd.env_clear().env("PYTHONIOENCODING", "utf-8").env("HOME", &dir);
    let payload = serde_json::json!({ "code": code, "tests": tests }).to_string();
    match exec(cmd, Some(payload), timeout) {
        Ok((_, out, err)) => {
            if !parse_marked(&out, &mut rep) {
                rep.error = Some(format!("Python dừng bất thường:\n{}", tail(&err, 1500)));
            }
        }
        Err(e) => rep.error = Some(e),
    }
    let _ = std::fs::remove_dir_all(&dir);
    finalize(&mut rep, start);
    rep
}

fn run_go(code: &str, tests: &str, timeout: Duration) -> RunReport {
    let start = Instant::now();
    let mut rep = RunReport::default();
    if code.len() > MAX_CODE_LEN {
        rep.error = Some("Code quá dài (tối đa 50KB)".into());
        return rep;
    }
    let Some(go) = find_tool("BOVABON_GO", &["go", "/opt/homebrew/bin/go", "/usr/local/go/bin/go"]) else {
        rep.error = Some("Máy chủ chưa cài Go (https://go.dev/dl) — hoặc đặt biến BOVABON_GO".into());
        return rep;
    };
    let Ok(dir) = temp_dir("go") else {
        rep.error = Some("Không tạo được thư mục tạm".into());
        return rep;
    };
    let w = |n: &str, c: &str| std::fs::write(dir.join(n), c);
    let ok = w("go.mod", "module bovabon\n\ngo 1.21\n").is_ok()
        && w("zz_harness.go", GO_HARNESS).is_ok()
        && w("solution.go", code).is_ok()
        && w("zz_tests.go", tests).is_ok();
    if !ok {
        rep.error = Some("Không ghi được file tạm".into());
        return rep;
    }
    let mut cmd = std::process::Command::new(go);
    cmd.arg("run").arg(".").current_dir(&dir);
    cmd.env("GOTOOLCHAIN", "local").env("GOFLAGS", "-mod=mod").env("GO111MODULE", "on");
    if std::env::var("GOCACHE").is_err() && std::env::var("HOME").is_err() {
        cmd.env("GOCACHE", std::env::temp_dir().join("bovabon-gocache"));
    }
    match exec(cmd, None, timeout) {
        Ok((_, out, err)) => {
            if !parse_marked(&out, &mut rep) {
                let msg = err.replace(&format!("{}/", dir.display()), "").replace("./", "");
                let label = if msg.contains("panic") { "Chương trình panic" } else { "Lỗi biên dịch" };
                rep.error = Some(format!("{label}:\n{}", tail(&msg, 2000)));
            }
        }
        Err(e) => rep.error = Some(e),
    }
    let _ = std::fs::remove_dir_all(&dir);
    finalize(&mut rep, start);
    rep
}

fn too_long(rep: &mut RunReport, code: &str) -> bool {
    if code.len() > MAX_CODE_LEN {
        rep.error = Some("Code quá dài (tối đa 50KB)".into());
        return true;
    }
    false
}

/// Rust: ghép harness + code + test vào một file, biên dịch bằng rustc rồi chạy binary.
fn run_rust(code: &str, tests: &str, timeout: Duration) -> RunReport {
    let start = Instant::now();
    let mut rep = RunReport::default();
    if too_long(&mut rep, code) {
        return rep;
    }
    let home_rustc = std::env::var("HOME").map(|h| format!("{h}/.cargo/bin/rustc")).unwrap_or_default();
    let Some(rustc) = find_tool("BOVABON_RUSTC", &["rustc", &home_rustc, "/opt/homebrew/bin/rustc"]) else {
        rep.error = Some("Máy chủ chưa cài Rust (https://rustup.rs) — hoặc đặt biến BOVABON_RUSTC".into());
        return rep;
    };
    let Ok(dir) = temp_dir("rs") else {
        rep.error = Some("Không tạo được thư mục tạm".into());
        return rep;
    };
    let src = format!("{RS_HARNESS}\n// ---- code học viên ----\n{code}\n// ---- bộ test ----\n{tests}\n");
    let harness_lines = RS_HARNESS.lines().count() + 2;
    if std::fs::write(dir.join("main.rs"), &src).is_err() {
        rep.error = Some("Không ghi được file tạm".into());
        return rep;
    }
    let mut cmd = std::process::Command::new(&rustc);
    cmd.args(["--edition", "2021", "-C", "opt-level=1", "-C", "debuginfo=0", "--error-format=short", "-o", "prog", "main.rs"])
        .current_dir(&dir);
    match exec(cmd, None, timeout) {
        Ok((true, _, _)) => {
            let left = timeout.saturating_sub(start.elapsed()).max(Duration::from_secs(2));
            match exec(std::process::Command::new(dir.join("prog")), None, left) {
                Ok((_, out, err)) => {
                    if !parse_marked(&out, &mut rep) {
                        rep.error = Some(format!("Chương trình dừng bất thường:\n{}", tail(&err, 1500)));
                    }
                }
                Err(e) => rep.error = Some(e),
            }
        }
        Ok((false, _, err)) => {
            // Đổi số dòng về vị trí trong code học viên cho dễ đọc.
            let msg: Vec<String> = err
                .lines()
                .filter(|l| !l.starts_with("error: aborting") && !l.contains("warning emitted") && !l.contains("warnings emitted"))
                .map(|l| {
                    if let Some(rest) = l.strip_prefix("main.rs:") {
                        let mut it = rest.splitn(2, ':');
                        if let (Some(n), Some(tail)) = (it.next().and_then(|n| n.parse::<usize>().ok()), it.next()) {
                            return if n > harness_lines { format!("dòng {}:{tail}", n - harness_lines) } else { format!("harness:{tail}") };
                        }
                    }
                    l.to_string()
                })
                .collect();
            rep.error = Some(format!("Lỗi biên dịch:\n{}", tail(&msg.join("\n"), 2500)));
        }
        Err(e) => rep.error = Some(e),
    }
    let _ = std::fs::remove_dir_all(&dir);
    finalize(&mut rep, start);
    rep
}

fn strip_php_tag(s: &str) -> &str {
    let t = s.trim_start();
    let t = t.strip_prefix("<?php").unwrap_or(t);
    let t = t.trim_end();
    t.strip_suffix("?>").unwrap_or(t)
}

/// PHP 8: harness + code + test trong một file, chạy bằng `php`.
fn run_php(code: &str, tests: &str, timeout: Duration) -> RunReport {
    let start = Instant::now();
    let mut rep = RunReport::default();
    if too_long(&mut rep, code) {
        return rep;
    }
    let Some(php) = find_tool("BOVABON_PHP", &["php", "/opt/homebrew/bin/php", "/usr/bin/php", "/usr/local/bin/php"]) else {
        rep.error = Some("Máy chủ chưa cài PHP 8 — hoặc đặt biến BOVABON_PHP".into());
        return rep;
    };
    let Ok(dir) = temp_dir("php") else {
        rep.error = Some("Không tạo được thư mục tạm".into());
        return rep;
    };
    let src = format!(
        "{}\n// ---- code học viên ----\n{}\n// ---- bộ test ----\n{}\n__bovabon_run();\n",
        PHP_HARNESS.trim_end(),
        strip_php_tag(code),
        strip_php_tag(tests)
    );
    if std::fs::write(dir.join("main.php"), &src).is_err() {
        rep.error = Some("Không ghi được file tạm".into());
        return rep;
    }
    let mut cmd = std::process::Command::new(php);
    cmd.args(["-d", "display_errors=stderr", "-d", "log_errors=0", "-d", "memory_limit=128M", "main.php"]).current_dir(&dir);
    match exec(cmd, None, timeout) {
        Ok((_, out, err)) => {
            if !parse_marked(&out, &mut rep) {
                let msg = format!("{err}\n{out}").replace(&format!("{}/", dir.display()), "");
                let label = if msg.contains("Parse error") { "Lỗi cú pháp" } else { "PHP dừng bất thường" };
                rep.error = Some(format!("{label}:\n{}", tail(msg.trim(), 1500)));
            }
        }
        Err(e) => rep.error = Some(e),
    }
    let _ = std::fs::remove_dir_all(&dir);
    finalize(&mut rep, start);
    rep
}

fn tail(s: &str, n: usize) -> String {
    let t = s.trim();
    if t.len() <= n {
        return t.to_string();
    }
    let mut i = t.len() - n;
    while !t.is_char_boundary(i) {
        i += 1;
    }
    format!("…{}", &t[i..])
}

#[cfg(test)]
mod lang_tests {
    use super::*;

    #[test]
    fn python_runner() {
        let r = run_lang(
            "python",
            "def add(a, b):\n    print('hi')\n    return a + b\n",
            "@test('ok')\ndef _():\n    expect(add(1, 2)).to_be(3)\n\n@test('bad')\ndef _():\n    assert add(1, 1) == 3\n",
            Duration::from_secs(10),
        );
        assert_eq!((r.passed, r.total), (1, 2), "{r:?}");
        assert_eq!(r.logs.first().map(String::as_str), Some("hi"));
    }

    #[test]
    fn rust_runner() {
        let r = run_lang(
            "rust",
            "fn add(a: i32, b: i32) -> i32 { println!(\"log\"); a + b }",
            "bovabon_tests! {\n  \"ok\" => { assert_eq!(add(1, 2), 3); },\n  \"bad\" => { assert_eq!(add(1, 1), 3, \"cộng sai\"); },\n}",
            Duration::from_secs(60),
        );
        assert_eq!((r.passed, r.total), (1, 2), "{r:?}");
        assert!(r.results[1].error.as_deref().unwrap_or("").contains("cộng sai"), "{r:?}");
        let c = run_lang("rust", "fn add(a: i32) -> i32 { x }", "bovabon_tests! { \"x\" => { add(1); }, }", Duration::from_secs(60));
        assert!(c.error.as_deref().unwrap_or("").contains("Lỗi biên dịch"), "{c:?}");
        assert!(c.error.as_deref().unwrap_or("").contains("dòng 1"), "{c:?}");
    }

    #[test]
    fn php_runner() {
        if find_tool("BOVABON_PHP", &["php", "/opt/homebrew/bin/php", "/usr/bin/php"]).is_none() {
            return;
        }
        let r = run_lang(
            "php",
            "<?php\nfunction add(int $a, int $b): int { echo \"hi\\n\"; return $a + $b; }\nfunction boom() { throw new InvalidArgumentException('xấu'); }",
            "test('ok', function () { expect(add(1, 2))->toBe(3); });\ntest('bad', function () { expect(add(1, 1))->toBe(3); });\ntest('throw', function () { expect(fn () => boom())->toThrow(InvalidArgumentException::class, 'xấu'); });\ntest('not', function () { expect(null)->not->toBe(1); });",
            Duration::from_secs(20),
        );
        assert_eq!((r.passed, r.total), (3, 4), "{r:?}");
        let c = run_lang("php", "<?php function f( {", "test('x', function () {});", Duration::from_secs(20));
        assert!(c.error.as_deref().unwrap_or("").contains("Lỗi cú pháp"), "{c:?}");
    }

    #[test]
    fn go_runner() {
        if find_tool("BOVABON_GO", &["go", "/opt/homebrew/bin/go", "/usr/local/go/bin/go"]).is_none() {
            return;
        }
        let r = run_lang(
            "go",
            "package main\n\nfunc Add(a, b int) int { return a + b }\n",
            "package main\n\nvar _ = Test(\"ok\", func(t *T) { if Add(1, 2) != 3 { t.Errorf(\"sai\") } })\nvar _ = Test(\"bad\", func(t *T) { if Add(1, 1) != 3 { t.Errorf(\"got %d\", Add(1, 1)) } })\n",
            Duration::from_secs(60),
        );
        assert_eq!((r.passed, r.total), (1, 2), "{r:?}");
        let c = run_lang("go", "package main\nfunc Add(a int) int { return x }\n", "package main\n", Duration::from_secs(60));
        assert!(c.error.as_deref().unwrap_or("").contains("Lỗi biên dịch"), "{c:?}");
    }
}
