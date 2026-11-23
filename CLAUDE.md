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
./scripts/codex-run.sh -j 4 <job> ...       # run Codex CLI jobs from scripts/codex-jobs/<job>.txt (ui-* jobs get a code-editing preamble)
./scripts/codex-pipeline.sh                 # all jobs in phases: ui-redesign→ui-i18n | cefr-* + devdocs-* | then en-* translations
./scripts/codex-handoff.sh [-j 3] [-r 8] [lane…]  # current handoff (docs/codex-handoff.md): loops lvl-*/system-design/ielts-* jobs until quotas met, then build + en-* + test
python3 scripts/bank-stats.py [--check] [--i18n] [file]  # per-track quotas: level:* tags (dev), band:* tags (english-ielts-*), missing EN translations
```

Before re-bundling, quit the running app: `osascript -e 'quit app "Bovabon Edu"'`.

## Architecture

- **Data bank** — `data/*.toml`, one file per track (`id`, `group`, `area` = `dev` (default) | `english`, `docs`, `[[modules]]` with `lesson`/`sources`, `[[questions]]`). `build.rs` embeds every `data/*.toml` automatically (generated `EMBEDDED` / `EMBEDDED_I18N` in `OUT_DIR/embedded_data.rs`), so a new data file only needs to exist — but a broken data file breaks `Bank::load` for the whole app. Display order/grouping comes from `data/categories.toml`. `BOVABON_DATA_DIR` overrides the embedded bank at runtime. Question ids must be unique across the whole bank and must stay stable (browser progress is keyed by id).
- **Categories** — `data/categories.toml` (embedded separately as `EMBEDDED_CATEGORIES`) groups modules from any tracks into learner-facing categories (e.g. "Python" = Flask + FastAPI + Django modules). The public API presents categories as "tracks": `/api/catalog` `tracks` = `Bank::category_infos()`, and `PublicQuestion.track` / the `track` filters of `/api/questions` and `/api/exam` use the category id. Tracks remain the unit for authoring and verification. Each module belongs to exactly one category of the same `area`; uncategorized modules fall back to a category with the track's id (tests/bank.rs fails on them).
- **i18n** — UI: `static/i18n.js` (`EN` dictionary keyed by the exact Vietnamese string; a MutationObserver translates matching text nodes/aria-label/title/placeholder; strings with variables use `tr('… {n}', {n})` in app.js — never name it `t`, which is a common local for "track"); attributes on skipped elements such as `textarea` or `.options` are not auto-translated, so wrap them in `tr()` too; an `EN` value must never equal its key, or the observer loops forever). Language is `localStorage['bovabon.lang']`; switching reloads the page. Content: overlay files `data/i18n/<lang>/<track-file>.toml` (`[modules.<id>]`, `[questions.<id>]`, `[categories.<id>]`, text fields only; options/blanks/hints must keep their counts). `Bank.locales` holds a fully built bank per language; every API takes `?lang=en` (`Bank::localized`), untranslated items fall back to Vietnamese, and essays are graded with the translated keywords. `verify_locales` re-grades reference answers in each locale.
- **DevDocs reader** — the module page's "Tài liệu gốc" tab fetches `https://documents.devdocs.io/<slug>/<path>.html` at view time (CORS allowed) into a sandboxed `srcdoc` iframe; nothing from DevDocs is stored in the repo.
- **Question types** — `single | multiple | fill | essay | code`. Grading in `src/grade.rs`: fill answers are normalized (whitespace removed, lowercased, trailing `;` and surrounding quotes stripped); essays are graded by keyword groups (case-insensitive substring) against `min_keywords`. `Question::public()` must never expose `answer`/`solution`.
- **Code runners** — `src/runner.rs` dispatches by `lang`:
  - `javascript`: in-process Boa sandbox with `src/harness.js` (Jest-like `expect`, `jest.fn`, fake timers, minimal React hooks/`renderHook`, btoa/atob). No DOM, `fetch`, `URL`, `.resolves/.rejects`.
  - `python` (`python3 -I` + `src/harness.py`), `go` (`go run` + `src/harness.go`), `rust` (`rustc` + `src/harness.rs`, tests via `bovabon_tests!` macro, student code must not define `main`), `php` (`php` + `src/harness.php`, Pest-like `expect()->toBe()`).
  - External runners print results as JSON after the `@@BOVABON@@` marker. Binaries are resolved from `BOVABON_PYTHON/GO/RUSTC/PHP` or PATH. Timeouts are set in `src/web.rs` (60s for go/rust, 10s otherwise). These runners execute untrusted code on the host without OS sandboxing.
- **Verification** — `src/verify.rs` is shared by `tests/bank.rs` and the `check` CLI (`src/main.rs`). It enforces: all 5 types per `dev` track (`english` tracks need single/multiple/fill and must have no `code` questions; the UI shows them in a separate "Tiếng Anh" area without Code Lab), every module has questions and a lesson ≥ 200 chars, reference answers grade correct and empty answers grade wrong, code solutions pass 100% (≥ 4 tests) while starters compile but fail, and every `sources`/`docs` path exists in `.devdocs/<slug>.json` (skipped if `.devdocs/` is absent; it is gitignored).
- **Web** — `src/web.rs` serves the embedded SPA (`static/index.html`, `app.js`, `app.css`) and the JSON API (`/api/catalog`, `/api/questions[/{id}[/check|/run|/hint/{n}|/solution]]`, `/api/exam`). `src/lib.rs::build_app()` builds the router (with gzip) and is reused by both binaries.
- **Frontend** — `static/app.js` is a single vanilla-JS hash-routed SPA; progress/bookmarks/exam history live in `localStorage`. Language labels/chips per `lang` are in the `LANG` map (+ `.chip.lang-*` in `app.css`).
- **Desktop app** — `src/bin/desktop.rs` (feature `desktop`, bin `bovabon-desktop`): tao/wry/muda window running the same server on a random `127.0.0.1` port; external links open via `open`, downloads go to `~/Downloads`. The server bin `bovabon_edu` does not pull GUI deps.

- **Cloud sync (optional)** — `cloud/` is a Cloudflare Worker + D1 (`wrangler.jsonc`, `migrations/`, `src/index.js`): email + TOTP auth (no password, no email sending), AES-GCM-encrypted TOTP secrets (`ENC_KEY` secret), hashed session tokens, versioned `PUT /state` (409 on conflict). The client side is the `Sync` object + `mergeProgress()` in `static/app.js`; `Store.save()` and `Prefs.setDisabled()` schedule a sync. The app must keep working fully offline when not signed in. Test with `cd cloud && npm run dev` + `python3 test/e2e.py`; e2e against production creates `e2e-*@example.test` accounts — delete them afterwards.

## Content authoring

`AGENTS.md` is the authoritative content guide (TOML schema, per-language test syntax, scale per track, rules for extending an existing track). Content must be original: link to DevDocs paths (`<slug>/<path>`), never copy doc text. After any data change, run `bovabon_edu check <file>` until it prints `✅ Hợp lệ`, then `cargo test --release`. Codex job briefs live in `scripts/codex-jobs/`; `.codex-logs/baseline/` holds pre-edit copies of data files for diffing.
