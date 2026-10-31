#!/usr/bin/env bash
#
# Pasang VendorKit di cPanel lewat Terminal, source dari GitHub.
#
# Pemakaian (di Terminal cPanel):
#   bash <(curl -fsSL https://raw.githubusercontent.com/ardika08/bookingvendor/main/deploy/cpanel-deploy.sh)
#
# Atau setelah clone manual:
#   cd ~/bookingvendor && bash deploy/cpanel-deploy.sh
#
# YANG DILAKUKAN
#   1. clone / update repo dari GitHub
#   2. composer install --no-dev
#   3. siapkan .env (APP_KEY, domain, sesi, MySQL)
#   4. migrasi + seed plan
#   5. bangun frontend (atau pakai dist yang di-commit)
#   6. pasang public_html/index.php + .htaccess
#   7. cache config/route/view
#   8. verifikasi
#
# TIDAK melakukan: mengisi kredensial Google/Duitku (rahasia, isi manual).
#
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/ardika08/bookingvendor.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="$HOME/bookingvendor"
PUBLIC_DIR="$HOME/public_html"

say()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32mOK\033[0m %s\n' "$*"; }
warn() { printf '    \033[33m!\033[0m  %s\n' "$*"; }
die()  { printf '\n\033[31mGAGAL:\033[0m %s\n' "$*" >&2; exit 1; }

# --- 0. Deteksi lingkungan -------------------------------------------------
say "Memeriksa lingkungan"
PHP_BIN="$(command -v php || true)"
[[ -n "$PHP_BIN" ]] || die "php tidak ditemukan di PATH."
PHP_VER="$($PHP_BIN -r 'echo PHP_VERSION;')"
echo "    PHP    : $PHP_VER ($PHP_BIN)"
echo "    HOME   : $HOME"

# Laravel 12 butuh PHP >= 8.2.
$PHP_BIN -r 'exit(version_compare(PHP_VERSION, "8.2.0", ">=") ? 0 : 1);' \
  || die "PHP $PHP_VER terlalu lama. Minimal 8.2. Ubah di MultiPHP Manager."

for ext in pdo_mysql mbstring openssl tokenizer xml ctype json bcmath fileinfo; do
  $PHP_BIN -m | grep -qix "$ext" || die "Ekstensi PHP '$ext' belum aktif. Aktifkan di Select PHP Version -> Extensions."
done
ok "semua ekstensi wajib aktif"

# proc_open dibutuhkan Composer.
$PHP_BIN -r 'exit(function_exists("proc_open") ? 0 : 1);' \
  || die "proc_open dinonaktifkan. Composer membutuhkannya; minta hosting mengaktifkan."

# --- 1. Domain -------------------------------------------------------------
say "Menentukan domain"
if [[ -z "${DOMAIN:-}" ]]; then
  # Coba tebak dari folder public_html milik domain utama.
  DOMAIN="$(basename "$HOME" | tr '_' '.' )"
  warn "DOMAIN belum diisi; menebak dari nama home: $DOMAIN"
  echo "    Bila salah, jalankan ulang dengan: DOMAIN=domainkamu.com bash deploy/cpanel-deploy.sh"
fi
echo "    Domain : $DOMAIN"

# --- 2. Source dari GitHub -------------------------------------------------
say "Mengambil source dari GitHub"
if [[ -d "$APP_DIR/.git" ]]; then
  cd "$APP_DIR"
  git fetch origin "$BRANCH" --quiet
  git reset --hard "origin/$BRANCH" --quiet
  ok "repo diperbarui ke origin/$BRANCH"
else
  command -v git >/dev/null || die "git tidak tersedia di Terminal cPanel."
  rm -rf "$APP_DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR" --quiet
  ok "repo di-clone ke $APP_DIR"
fi
cd "$APP_DIR"
echo "    commit : $(git log --oneline -1)"

# --- 3. Composer -----------------------------------------------------------
say "Memasang dependensi PHP"
if command -v composer >/dev/null; then
  COMPOSER="composer"
elif [[ -f "$HOME/composer.phar" ]]; then
  COMPOSER="$PHP_BIN $HOME/composer.phar"
else
  echo "    composer tidak ada, mengunduh composer.phar..."
  $PHP_BIN -r "copy('https://getcomposer.org/installer','/tmp/ci.php');" \
    || die "Gagal mengunduh Composer. Cek koneksi keluar."
  $PHP_BIN /tmp/ci.php --install-dir="$HOME" --filename=composer.phar --quiet
  COMPOSER="$PHP_BIN $HOME/composer.phar"
fi
cd "$APP_DIR/backend"
$COMPOSER install --no-dev --optimize-autoloader --no-interaction --quiet
ok "vendor/ siap"

# --- 4. .env ---------------------------------------------------------------
say "Menyiapkan .env"
ENV_FILE="$APP_DIR/backend/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cp "$APP_DIR/backend/.env.example" "$ENV_FILE"
  warn ".env dibuat baru dari .env.example"
fi

# Nilai yang bergantung pada domain. sed dipakai agar aman diulang.
set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    # Ganti baris; nilai dibungkus kutip bila mengandung karakter khusus.
    $PHP_BIN -r '
      $f = $argv[1]; $k = $argv[2]; $v = $argv[3];
      $lines = file($f, FILE_IGNORE_NEW_LINES);
      $found = false;
      foreach ($lines as $i => $l) {
        if (str_starts_with($l, $k."=")) { $lines[$i] = $k."=".$v; $found = true; }
      }
      if (!$found) { $lines[] = $k."=".$v; }
      file_put_contents($f, implode("\n", $lines)."\n");
    ' "$ENV_FILE" "$key" "$value"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

set_env APP_ENV production
set_env APP_DEBUG false
set_env APP_URL "https://${DOMAIN}"
set_env FRONTEND_URL "https://${DOMAIN}"
set_env SESSION_DOMAIN "$DOMAIN"
set_env SESSION_SECURE_COOKIE true
set_env SANCTUM_STATEFUL_DOMAINS "$DOMAIN"
set_env LOG_CHANNEL daily
ok "APP_URL/FRONTEND_URL/SESSION -> https://${DOMAIN}"

if ! grep -q '^APP_KEY=base64:' "$ENV_FILE"; then
  $PHP_BIN artisan key:generate --force --quiet
  ok "APP_KEY dibuat"
else
  ok "APP_KEY sudah ada"
fi

# --- 5. Database -----------------------------------------------------------
say "Memeriksa koneksi database"
DB_STATUS="$($PHP_BIN artisan db:show --json 2>/dev/null | head -c 200 || true)"
if [[ -z "$DB_STATUS" ]]; then
  warn "Database belum bisa dihubungi."
  warn "Isi dulu di $ENV_FILE :"
  warn "  DB_CONNECTION=mysql DB_HOST=127.0.0.1 DB_PORT=3306"
  warn "  DB_DATABASE=USERNAME_bookingvendor DB_USERNAME=USERNAME_bvuser DB_PASSWORD=..."
  warn "Lalu jalankan ulang skrip ini."
  exit 1
fi
ok "database terhubung"

say "Menjalankan migrasi"
$PHP_BIN artisan migrate --force --quiet
ok "skema diperbarui"

# PlanSeeder wajib: tanpa paket langganan, halaman upgrade kosong.
$PHP_BIN artisan db:seed --class=PlanSeeder --force --quiet
ok "paket langganan tersedia"

# --- 6. Frontend -----------------------------------------------------------
say "Menyiapkan frontend"
# `frontend-dist/` di-commit khusus untuk deploy, karena shared hosting cPanel
# umumnya tidak punya node/npm. `frontend/dist` sendiri ada di .gitignore.
if [[ -d "$APP_DIR/frontend-dist" && -f "$APP_DIR/frontend-dist/index.html" ]]; then
  DIST_DIR="$APP_DIR/frontend-dist"
  ok "memakai frontend-dist/ dari repo"
elif [[ -d "$APP_DIR/frontend/dist" && -f "$APP_DIR/frontend/dist/index.html" ]]; then
  DIST_DIR="$APP_DIR/frontend/dist"
  ok "memakai frontend/dist"
elif command -v npm >/dev/null; then
  cd "$APP_DIR/frontend"
  npm ci --silent && npm run build
  DIST_DIR="$APP_DIR/frontend/dist"
  ok "frontend dibangun di server"
else
  die "Hasil build frontend tidak ditemukan dan npm tidak tersedia. Jalankan deploy/build-frontend-dist.sh di lokal lalu commit."
fi

# --- 7. public_html --------------------------------------------------------
say "Memasang public_html"
mkdir -p "$PUBLIC_DIR"
# Simpan berkas milik hosting bila ada (mis. .well-known untuk SSL).
find "$PUBLIC_DIR" -mindepth 1 -maxdepth 1 \
  ! -name '.well-known' ! -name '.htaccess' ! -name 'index.php' \
  -exec rm -rf {} + 2>/dev/null || true

cp -R "$DIST_DIR/." "$PUBLIC_DIR/"
cp "$APP_DIR/deploy/cpanel/index.php" "$PUBLIC_DIR/index.php"
cp "$APP_DIR/deploy/cpanel/.htaccess" "$PUBLIC_DIR/.htaccess"
ok "SPA + index.php + .htaccess terpasang"

# --- 8. Izin & cache -------------------------------------------------------
say "Menyiapkan izin dan cache"
chmod -R 775 "$APP_DIR/backend/storage" "$APP_DIR/backend/bootstrap/cache" 2>/dev/null || true
cd "$APP_DIR/backend"
$PHP_BIN artisan config:clear --quiet
$PHP_BIN artisan config:cache --quiet
$PHP_BIN artisan route:cache --quiet
$PHP_BIN artisan view:cache --quiet
ok "config, route, dan view ter-cache"

# --- 9. Verifikasi ---------------------------------------------------------
say "Verifikasi"
FAIL=0
check() {
  local label="$1" url="$2" expect="$3"
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$url" || echo 000)"
  if [[ "$code" == "$expect" ]]; then
    printf '    \033[32mOK\033[0m   %-34s %s\n' "$label" "$code"
  else
    printf '    \033[31mFAIL\033[0m %-34s %s (harap %s)\n' "$label" "$code" "$expect"
    FAIL=1
  fi
}

check "Halaman utama"        "https://${DOMAIN}/"                  200
check "Halaman masuk"        "https://${DOMAIN}/login"             200
check "API menolak anonim"   "https://${DOMAIN}/api/me"            401
check "OAuth redirect"       "https://${DOMAIN}/auth/google/redirect" 302
check "SPA route dalam"      "https://${DOMAIN}/dashboard"         200

# API harus JSON, bukan HTML. Ini gejala .htaccess salah urutan.
CT="$(curl -s -o /dev/null -w '%{content_type}' --max-time 20 "https://${DOMAIN}/api/me" || true)"
if [[ "$CT" == application/json* ]]; then
  printf '    \033[32mOK\033[0m   %-34s %s\n' "API mengembalikan JSON" "$CT"
else
  printf '    \033[31mFAIL\033[0m %-34s %s\n' "API mengembalikan JSON" "$CT (aturan .htaccess salah urutan?)"
  FAIL=1
fi

cat <<EOF

────────────────────────────────────────────────────────────
Selesai. Commit: $(git -C "$APP_DIR" log --oneline -1)

LANGKAH MANUAL YANG TERSISA (rahasia, tidak bisa diotomatiskan):

1. Aktifkan SSL di cPanel -> SSL/TLS Status -> Run AutoSSL
   Situs HARUS https sebelum login dipakai; SESSION_SECURE_COOKIE=true.

2. Isi kredensial Google di $ENV_FILE
     GOOGLE_CLIENT_ID=...
     GOOGLE_CLIENT_SECRET=...
     GOOGLE_REDIRECT_URI="https://${DOMAIN}/auth/google/callback"

3. Daftarkan redirect URI itu di Google Cloud Console
   (Credentials -> OAuth client -> Authorized redirect URIs).

4. Setelah mengubah .env, WAJIB:
     cd $APP_DIR/backend && $PHP_BIN artisan config:cache

5. Buat akun admin dengan email Google kamu:
     cd $APP_DIR/backend && $PHP_BIN artisan tinker --execute="
     App\\Models\\User::create(['name'=>'Nama','email'=>'email@gmail.com','role'=>'admin','is_active'=>true]);"

6. Cron scheduler (cPanel -> Cron Jobs), tiap 5 menit:
     */5 * * * * $PHP_BIN $APP_DIR/backend/artisan schedule:run >> /dev/null 2>&1

$( [[ $FAIL -eq 0 ]] && echo "Semua pemeriksaan lolos." || echo "ADA PEMERIKSAAN GAGAL — baca bagian 12 docs/deploy-cpanel.md." )
────────────────────────────────────────────────────────────
EOF

exit $FAIL
