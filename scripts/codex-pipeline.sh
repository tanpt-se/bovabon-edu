#!/usr/bin/env bash
# Chạy toàn bộ việc soạn nội dung + giao diện bằng Codex theo đợt (log: .codex-logs/).
#   Làn giao diện (tuần tự):  ui-redesign → ui-i18n
#   Đợt 1 (song song):        cefr-a1..c2 + devdocs-<lộ trình>
#   Đợt 2 (sau đợt 1):        en-<file> — dịch nội dung sang tiếng Anh (cả phần mới soạn ở đợt 1)
set -uo pipefail
cd "$(dirname "$0")/.."
jobs_of() { for f in scripts/codex-jobs/$1*.txt; do basename "$f" .txt; done; }
echo "=== Làn giao diện + đợt 1: $(date +%T) ==="
./scripts/codex-run.sh -j 1 ui-redesign ui-i18n > .codex-logs/_lane-ui.txt 2>&1 &
ui=$!
./scripts/codex-run.sh -j 3 $(jobs_of cefr-) $(jobs_of devdocs-)
wait "$ui"; cat .codex-logs/_lane-ui.txt
echo "=== Đợt 2 (dịch nội dung): $(date +%T) ==="
./scripts/codex-run.sh -j 4 $(jobs_of en-)
echo "=== Xong: $(date +%T) ==="
