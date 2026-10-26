#!/usr/bin/env bash
#
# Membuat paket deploy untuk cPanel.
#
# Hasil:
#   dist-deploy/bookingvendor-backend.tar.gz   → ekstrak ke ~/bookingvendor
#   dist-deploy/bookingvendor-frontend.tar.gz  → ekstrak ke ~/public_html
#   dist-deploy/PANDUAN.md                     → langkah pemasangan
#
# Pemakaian:
#   ./deploy/build-cpanel.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/dist-deploy"

echo "==> Menyiapkan folder keluaran"
rm -rf "$OUT"
mkdir -p "$OUT"

# ---------------------------------------------------------------------------
# Frontend
# ---------------------------------------------------------------------------
echo "==> Build frontend"
cd "$ROOT/frontend"

if [ ! -d node_modules ]; then
    npm ci
fi

npm run build

if [ ! -f dist/index.html ]; then
    echo "GAGAL: dist/index.html tidak ditemukan — build tidak menghasilkan apa pun." >&2
    exit 1
fi

echo "==> Mengemas frontend"
tar -czf "$OUT/bookingvendor-frontend.tar.gz" -C dist .

# ---------------------------------------------------------------------------
# Backend
# ---------------------------------------------------------------------------
echo "==> Mengemas backend"
cd "$ROOT/backend"

# `vendor/` sengaja TIDAK disertakan: 97 MB dan sebaiknya dipasang di server
# dengan `composer install --no-dev` agar sesuai versi PHP hosting.
tar \
    --exclude='./.git' \
    --exclude='./node_modules' \
    --exclude='./vendor' \
    --exclude='./.env' \
    --exclude='./database/*.sqlite' \
    --exclude='./storage/logs/*.log' \
    --exclude='./storage/framework/cache/data/*' \
    --exclude='./storage/framework/sessions/*' \
    --exclude='./storage/framework/views/*' \
    --exclude='./tests' \
    --exclude='./phpunit.xml' \
    -czf "$OUT/bookingvendor-backend.tar.gz" .

# ---------------------------------------------------------------------------
# Berkas pendamping
# ---------------------------------------------------------------------------
cp "$ROOT/deploy/cpanel/index.php" "$OUT/index.php"
cp "$ROOT/deploy/cpanel/.htaccess" "$OUT/htaccess.txt"
cp "$ROOT/docs/deploy-cpanel.md" "$OUT/PANDUAN.md"

echo
echo "==> Selesai"
ls -lh "$OUT"
echo
echo "Langkah berikutnya: baca $OUT/PANDUAN.md"
