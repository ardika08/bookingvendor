#!/usr/bin/env bash
#
# Menyalin hasil build frontend ke folder yang IKUT di-commit.
#
# KENAPA PERLU
# `frontend/dist` masuk .gitignore, sehingga tidak ada di repo. Shared hosting
# cPanel umumnya tidak menyediakan node/npm, jadi `npm run build` di server
# tidak bisa diandalkan. Tanpa langkah ini, deploy lewat `git clone` akan
# menghasilkan public_html kosong.
#
# Hasil build disalin ke `frontend-dist/` di akar repo (tidak di-ignore), lalu
# di-commit. Skrip deploy cPanel menyalin folder itu ke public_html.
#
# Pemakaian:
#   ./deploy/build-frontend-dist.sh          # build + salin
#   ./deploy/build-frontend-dist.sh --check  # hanya periksa apakah sudah usang
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/frontend/dist"
DST="$ROOT/frontend-dist"

CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

if [[ "$CHECK_ONLY" == "1" ]]; then
  [[ -f "$DST/index.html" ]] || { echo "frontend-dist/ belum ada. Jalankan tanpa --check."; exit 1; }
  NEWEST_SRC="$(find "$ROOT/frontend/src" -type f -newer "$DST/index.html" -print -quit 2>/dev/null || true)"
  if [[ -n "$NEWEST_SRC" ]]; then
    echo "USANG: $NEWEST_SRC lebih baru dari frontend-dist/index.html"
    exit 1
  fi
  echo "frontend-dist/ masih mutakhir."
  exit 0
fi

echo "==> Build frontend"
cd "$ROOT/frontend"
[[ -d node_modules ]] || npm ci
npm run build

[[ -f "$SRC/index.html" ]] || { echo "GAGAL: dist/index.html tidak ada." >&2; exit 1; }

echo "==> Menyalin ke frontend-dist/"
rm -rf "$DST"
mkdir -p "$DST"
cp -R "$SRC/." "$DST/"

echo "==> Selesai"
du -sh "$DST"
echo
echo "Jangan lupa commit frontend-dist/ agar ikut ter-deploy:"
echo "  git add frontend-dist && git commit -m 'build(frontend): perbarui hasil build untuk deploy'"
