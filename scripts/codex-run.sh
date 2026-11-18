#!/usr/bin/env bash
# Giao việc soạn nội dung cho Codex CLI, chạy song song.
#   ./scripts/codex-run.sh [-j 4] job1 job2 ...   (tên file trong scripts/codex-jobs/, bỏ .txt)
#   ./scripts/codex-run.sh            # chạy tất cả job
# Log: .codex-logs/<job>.log, tóm tắt cuối: .codex-logs/<job>.md
set -uo pipefail
cd "$(dirname "$0")/.."
JOBS=4
if [[ "${1:-}" == "-j" ]]; then JOBS="$2"; shift 2; fi
names=("$@")
if [[ ${#names[@]} -eq 0 ]]; then
  names=(); for f in scripts/codex-jobs/*.txt; do names+=("$(basename "$f" .txt)"); done
fi
mkdir -p .codex-logs
run_one() {
  local job="$1"
  local brief; brief="$(cat "scripts/codex-jobs/$job.txt")"
  local prompt
  if [[ "$job" == ui-* ]]; then
    # Job giao diện: sửa static/, được build lại binary
    prompt="Đọc CLAUDE.md (kiến trúc) trước. Sau đó thực hiện:

$brief

Nhớ: chỉ sửa đúng các file được liệt kê; không đụng data/, src/, cloud/."
  else
    prompt="Đọc kỹ AGENTS.md (quy tắc, định dạng, cú pháp test) và tham khảo một file mẫu như data/web-api.toml. Sau đó thực hiện:

$brief

Nhớ: chỉ tạo/sửa đúng file data được giao; tự chạy ./target/release/bovabon_edu check <file> và sửa tới khi ✅."
  fi
  echo "▶ $job bắt đầu $(date +%T)"
  codex exec -s workspace-write --skip-git-repo-check --color never -C . \
    -o ".codex-logs/$job.md" "$prompt" > ".codex-logs/$job.log" 2>&1
  local rc=$?
  echo "■ $job kết thúc $(date +%T) (exit $rc)"
}
export -f run_one
printf '%s\n' "${names[@]}" | xargs -P "$JOBS" -I{} bash -c 'run_one "$@"' _ {}
echo "== Kiểm định =="
for job in "${names[@]}"; do
  [[ "$job" == ui-* ]] && { node --check static/app.js && echo "✅ $job (app.js hợp lệ)" || echo "❌ $job: app.js lỗi cú pháp"; continue; }
  f=$(grep -o 'data/[a-z0-9/-]*\.toml' "scripts/codex-jobs/$job.txt" | head -1)
  if [[ -f "$f" ]]; then
    ./target/release/bovabon_edu check "$f" >/dev/null 2>"/tmp/bovabon-check-$job.txt" && echo "✅ $f" || echo "❌ $f ($(wc -l < /tmp/bovabon-check-$job.txt) dòng lỗi)"
  else
    echo "⚠️  $job: chưa có $f"
  fi
done
