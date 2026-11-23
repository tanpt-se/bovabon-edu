#!/usr/bin/env bash
# Pipeline bàn giao cho Codex (docs/codex-handoff.md): chạy lặp từng "làn" cho tới khi đạt chỉ tiêu.
#
#   ./scripts/codex-handoff.sh                      # mọi làn: fix-cefr-essays, lvl-*, system-design, ielts-*
#   ./scripts/codex-handoff.sh -j 3 -r 8 lvl-react ielts-reading   # chỉ vài làn
#   ./scripts/codex-handoff.sh --translate-only     # chỉ chạy bước dịch (en-*) cho các file đã đạt
#
#   -j N   số làn chạy song song (mặc định 3). Mỗi làn chỉ sửa 1 file nên không đụng nhau.
#   -r N   số lượt tối đa mỗi làn (mặc định 8, mỗi lượt ~30 câu).
#
# Mỗi làn: lặp { codex job → check } cho tới khi `scripts/bank-stats.py --check <file>` đạt
# (hoặc hết lượt / hết quota Codex). Sau khi các làn xong: build lại binary (bản dịch được kiểm
# định trên kho nhúng), chạy job dịch en-<file> cho các file đã đổi, rồi `cargo test`.
# Log: .codex-logs/<job>.log, .codex-logs/<job>.md, tổng hợp: .codex-logs/_handoff.txt
set -uo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.cargo/bin:$PATH"
# bank-stats cần Python ≥ 3.11 (tomllib); /usr/bin/python3 của macOS quá cũ.
export PY="${PYTHON:-/opt/homebrew/bin/python3}"
[[ -x "$PY" ]] || PY=python3
PAR=3
ROUNDS=8
TRANSLATE_ONLY=0
lanes=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -j) PAR="$2"; shift 2 ;;
    -r) ROUNDS="$2"; shift 2 ;;
    --translate-only) TRANSLATE_ONLY=1; shift ;;
    *) lanes+=("$1"); shift ;;
  esac
done
if [[ ${#lanes[@]} -eq 0 ]]; then
  lanes=(fix-cefr-essays)
  for f in scripts/codex-jobs/lvl-*.txt scripts/codex-jobs/system-design.txt scripts/codex-jobs/ielts-*.txt; do
    lanes+=("$(basename "$f" .txt)")
  done
fi
mkdir -p .codex-logs
LOG=.codex-logs/_handoff.txt
echo "=== Bắt đầu $(date '+%F %T') — làn: ${lanes[*]}" | tee -a "$LOG"

data_file_of() { grep -o 'data/[a-z0-9/-]*\.toml' "scripts/codex-jobs/$1.txt" | head -1; }
export -f data_file_of

run_lane() {
  local lane="$1" rounds="$2" f round
  f=$(data_file_of "$lane")
  for ((round = 1; round <= rounds; round++)); do
    if [[ "$lane" != fix-* && -f "$f" ]] && "$PY" scripts/bank-stats.py --check "$f" >/dev/null 2>&1 \
       && ./target/release/bovabon_edu check "$f" >/dev/null 2>&1; then
      echo "✅ $lane: đạt chỉ tiêu ($f)"
      return 0
    fi
    echo "▶ $lane: lượt $round/$rounds ($(date +%T))"
    ./scripts/codex-run.sh -j 1 "$lane" >/dev/null 2>&1
    if grep -qi 'usage limit' ".codex-logs/$lane.log" 2>/dev/null; then
      echo "⛔ $lane: Codex hết quota — dừng làn (chạy lại script sau giờ reset, làn sẽ làm tiếp từ chỗ dở)"
      return 2
    fi
    cp ".codex-logs/$lane.md" ".codex-logs/$lane.round$round.md" 2>/dev/null
    if [[ "$lane" == fix-* ]]; then
      ./target/release/bovabon_edu check "$f" >/dev/null 2>&1 && { echo "✅ $lane"; return 0; }
    fi
  done
  echo "⚠️  $lane: hết $rounds lượt, chưa đạt — xem: $PY scripts/bank-stats.py $f"
  return 1
}
export -f run_lane

if [[ $TRANSLATE_ONLY -eq 0 ]]; then
  printf '%s\n' "${lanes[@]}" | xargs -P "$PAR" -I{} bash -c 'run_lane "$1" "$2"' _ {} "$ROUNDS" | tee -a "$LOG"
fi

echo "=== Build lại binary để kiểm định bản dịch trên kho mới ($(date +%T))" | tee -a "$LOG"
if command -v cargo >/dev/null; then
  cargo build --release >/dev/null 2>&1 || { echo "❌ cargo build lỗi — dữ liệu nào đó hỏng, chạy: cargo build --release" | tee -a "$LOG"; exit 1; }
fi

en_jobs=()
for lane in "${lanes[@]}"; do
  [[ "$lane" == fix-* ]] && continue
  f=$(data_file_of "$lane"); base=$(basename "$f" .toml)
  [[ -f "$f" && -f "scripts/codex-jobs/en-$base.txt" ]] && en_jobs+=("en-$base")
done
if [[ ${#en_jobs[@]} -gt 0 ]]; then
  echo "=== Dịch EN: ${en_jobs[*]} ($(date +%T))" | tee -a "$LOG"
  ./scripts/codex-run.sh -j "$PAR" "${en_jobs[@]}" | tee -a "$LOG"
fi

echo "=== Kiểm tra toàn kho ($(date +%T))" | tee -a "$LOG"
if command -v cargo >/dev/null; then
  cargo build --release >/dev/null 2>&1 && cargo test --release 2>&1 | grep -E 'test result|FAILED|panicked' | tee -a "$LOG"
fi
"$PY" scripts/bank-stats.py | tee -a "$LOG"
echo "=== Xong $(date '+%F %T')" | tee -a "$LOG"
