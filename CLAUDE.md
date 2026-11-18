# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Bovabon Edu is a no-login LMS for reviewing programming topics (Frontend, Backend, English), written in Rust (axum + Boa). One binary embeds the UI, the question bank and the graders. All user-facing content and docs are in **Vietnamese** (code/examples in English); keep that convention.

## Commands

`cargo` lives in `~/.cargo/bin` (may not be on PATH in non-login shells).

```bash
cargo run --release                         # server on http://127.0.0.1:8080 (PORT, HOST env vars)
cargo test --release                        # unit tests + full bank verification (tests/bank.rs)
cargo test --release rust_runner            # single test by name (runner tests live in src/runner.rs)
./target/release/bovabon_edu check                     # verify the whole embedded bank (no cargo needed)
./target/release/bovabon_edu check data/vue.toml       # verify one data file, even if not yet embedded
./scripts/bundle-macos.sh [--dmg]           # macOS app → dist/Bovabon Edu.app (+ dist/BovabonEdu.dmg)
./scripts/devdocs-index.sh <slug>           # download a DevDocs index into .devdocs/ (needed to validate `sources`)
./scripts/codex-run.sh -j 4 <job> ...       # run Codex CLI content jobs from scripts/codex-jobs/<job>.txt
```

Before re-bundling, quit the running app: `osascript -e 'quit app "Bovabon Edu"'`.

## Architecture

- **Data bank** — `data/*.toml`, one file per track (`id`, `group`, `docs`, `[[modules]]` with `lesson`/`sources`, `[[questions]]`). Files are compiled in via `include_str!` in the `EMBEDDED` list in `src/bank.rs`; **a new data file does nothing until added there** (order in `EMBEDDED` = display order; the UI groups tracks by `group` in first-appearance order). `BOVABON_DATA_DIR` overrides the embedded bank at runtime. Question ids must be unique across the whole bank and must stay stable (browser progress is keyed by id).
- **Question types** — `single | multiple | fill | essay | code`. Grading in `src/grade.rs`: fill answers are normalized (whitespace removed, lowercased, trailing `;` and surrounding quotes stripped); essays are graded by keyword groups (case-insensitive substring) against `min_keywords`. `Question::public()` must never expose `answer`/`solution`.
- **Code runners** — `src/runner.rs` dispatches by `lang`:
  - `javascript`: in-process Boa sandbox with `src/harness.js` (Jest-like `expect`, `jest.fn`, fake timers, minimal React hooks/`renderHook`, btoa/atob). No DOM, `fetch`, `URL`, `.resolves/.rejects`.
  - `python` (`python3 -I` + `src/harness.py`), `go` (`go run` + `src/harness.go`), `rust` (`rustc` + `src/harness.rs`, tests via `bovabon_tests!` macro, student code must not define `main`), `php` (`php` + `src/harness.php`, Pest-like `expect()->toBe()`).
  - External runners print results as JSON after the `@@BOVABON@@` marker. Binaries are resolved from `BOVABON_PYTHON/GO/RUSTC/PHP` or PATH. Timeouts are set in `src/web.rs` (60s for go/rust, 10s otherwise). These runners execute untrusted code on the host without OS sandboxing.
- **Verification** — `src/verify.rs` is shared by `tests/bank.rs` and the `check` CLI (`src/main.rs`). It enforces: all 5 types per track, every module has questions and a lesson ≥ 200 chars, reference answers grade correct and empty answers grade wrong, code solutions pass 100% (≥ 3 tests) while starters compile but fail, and every `sources`/`docs` path exists in `.devdocs/<slug>.json` (skipped if `.devdocs/` is absent; it is gitignored).
- **Web** — `src/web.rs` serves the embedded SPA (`static/index.html`, `app.js`, `app.css`) and the JSON API (`/api/catalog`, `/api/questions[/{id}[/check|/run|/hint/{n}|/solution]]`, `/api/exam`). `src/lib.rs::build_app()` builds the router (with gzip) and is reused by both binaries.
- **Frontend** — `static/app.js` is a single vanilla-JS hash-routed SPA; progress/bookmarks/exam history live in `localStorage`. Language labels/chips per `lang` are in the `LANG` map (+ `.chip.lang-*` in `app.css`).
- **Desktop app** — `src/bin/desktop.rs` (feature `desktop`, bin `bovabon-desktop`): tao/wry/muda window running the same server on a random `127.0.0.1` port; external links open via `open`, downloads go to `~/Downloads`. The server bin `bovabon_edu` does not pull GUI deps.

## Content authoring

`AGENTS.md` is the authoritative content guide (TOML schema, per-language test syntax, scale per track, rules for extending an existing track). Content must be original: link to DevDocs paths (`<slug>/<path>`), never copy doc text. After any data change, run `bovabon_edu check <file>` until it prints `✅ Hợp lệ`, then `cargo test --release`. Codex job briefs live in `scripts/codex-jobs/`; `.codex-logs/baseline/` holds pre-edit copies of data files for diffing.
