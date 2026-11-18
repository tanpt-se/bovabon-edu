#!/usr/bin/env bash
# Tải chỉ mục DevDocs (danh sách trang) vào .devdocs/<slug>.json để lệnh `check` xác thực `sources`.
#   ./scripts/devdocs-index.sh react vue~3 nextjs
#   ./scripts/devdocs-index.sh --list | grep -i vue     # tra slug
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .devdocs
if [[ "${1:-}" == "--list" ]]; then
  curl -fsSL https://devdocs.io/docs.json | python3 -c 'import json,sys; [print(d["slug"], "-", d["name"], d.get("version","")) for d in json.load(sys.stdin)]'
  exit 0
fi
for slug in "$@"; do
  curl -fsSL -m 90 -o ".devdocs/$slug.json" "https://documents.devdocs.io/$slug/index.json" && echo "✓ $slug" || echo "✗ $slug"
done
