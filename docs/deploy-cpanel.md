# Deploy ke cPanel (Webnesia)

Panduan memasang Booking Vendor di shared hosting cPanel. Ditulis untuk paket
Webnesia: PHP 8.3 (bisa sampai 8.5), MySQL, akses Terminal.

Target: **https://vendotkit.my.id**

---

## 1. Bentuk akhir di server

Shared hosting menetapkan `public_html` sebagai document root dan itu **tidak
bisa diubah**. Karena Laravel menaruh `public/` di dalam folder proyek, aplikasi
dipasang di luar `public_html` lalu `public_html` diisi dua berkas pengarah:

```
/home/USERNAME/
├── bookingvendor/            ← seluruh proyek Laravel (di luar web root)
│   ├── app/  config/  database/  vendor/  .env
│   └── public/               ← aset & index.php asli
└── public_html/              ← document root yang dilihat pengunjung
    ├── index.php             ← mengarah ke ../bookingvendor/public
    ├── .htaccess             ← meneruskan /api & /auth ke Laravel
    ├── build/                ← hasil `npm run build` (frontend)
    ├── assets/               ← aset Vite
    └── index.html            ← SPA
```

Alasannya: menaruh `.env`, `vendor/`, dan `database/` di dalam `public_html`
berarti berkas berisi kredensial bisa diunduh siapa pun. Pemisahan ini bukan
preferensi gaya — ini yang membedakan aman dan tidak.

---

## 2. Prasyarat di cPanel

| Kebutuhan | Di mana |
|---|---|
| PHP **8.3** atau lebih baru | *MultiPHP Manager* |
| Ekstensi `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath`, `fileinfo` | *Select PHP Version → Extensions* |
| MySQL database + user | *MySQL Databases* |
| Terminal | menu *Terminal* (sudah termasuk di paket Anda) |
| Composer | `composer --version` di Terminal, atau *Composer* di cPanel |

Pastikan juga **`proc_open` dan `proc_close` tidak dinonaktifkan** — Composer
memerlukannya.

---

## 3. Unggah aplikasi

Dari komputer lokal, di folder proyek:

```bash
# 1. Build frontend
cd frontend
npm ci
npm run build

# 2. Siapkan arsip backend tanpa file yang tidak perlu di server
cd ../backend
tar --exclude='.git' --exclude='node_modules' --exclude='storage/logs/*' \
    --exclude='storage/framework/cache/*' --exclude='storage/framework/sessions/*' \
    --exclude='storage/framework/views/*' \
    -czf ~/bookingvendor-backend.tar.gz .

# 3. Siapkan arsip frontend hasil build
cd ../frontend/dist
tar -czf ~/bookingvendor-frontend.tar.gz .
```

Unggah kedua arsip lewat *File Manager → Upload* ke `/home/USERNAME/`,
lalu ekstrak di Terminal:

```bash
cd ~
mkdir -p bookingvendor
tar -xzf bookingvendor-backend.tar.gz -C bookingvendor

# Frontend masuk ke public_html
rm -rf ~/public_html/*          # hati-hati: pastikan kosong/tidak terpakai
tar -xzf bookingvendor-frontend.tar.gz -C ~/public_html
```

### Bila `vendor/` tidak ikut terunggah

`vendor/` berukuran ~97 MB. Kalau paket unggah dibatasi, jalankan Composer
langsung di server (lebih disarankan karena sesuai versi PHP server):

```bash
cd ~/bookingvendor
composer install --no-dev --optimize-autoloader
```

---

## 4. `public_html/index.php`

Berkas ini menggantikan `public/index.php` bawaan dan mengarahkan ke folder
aplikasi. Buat lewat *File Manager → New File*.

```php
<?php

/**
 * Titik masuk tunggal.
 *
 * Aplikasi Laravel berada di luar public_html (../bookingvendor) agar .env,
 * vendor/, dan database/ tidak dapat diakses lewat browser. Berkas ini hanya
 * meneruskan permintaan ke public/index.php milik Laravel.
 */

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Path aplikasi: satu tingkat di atas public_html.
$appPath = dirname(__DIR__).'/bookingvendor';

if (file_exists($maintenance = $appPath.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $appPath.'/vendor/autoload.php';

/** @var Application $app */
$app = require_once $appPath.'/bootstrap/app.php';

$app->handleRequest(Request::capture());
```

> Bila Laravel 12 Anda memakai `$app->handleRequest()`, itu sudah benar. Versi
> lama memakai `$kernel->handle()` — jangan dicampur.

---

## 5. `public_html/.htaccess`

Satu berkas ini menangani tiga hal: meneruskan `/api` dan `/auth` ke Laravel,
menyajikan aset statis, dan mengarahkan semua route lain ke SPA (React Router).

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /

    # --- 1. Endpoint Laravel ---------------------------------------------
    # /api/* dan /auth/* ditangani PHP, bukan SPA.
    RewriteRule ^(api|auth)(/.*)?$ index.php [L,QSA]

    # --- 2. Aset statis ---------------------------------------------------
    # Berkas yang benar-benar ada di disk dilayani langsung.
    RewriteCond %{REQUEST_FILENAME} -f [OR]
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule ^ - [L]

    # --- 3. SPA -----------------------------------------------------------
    # Route lain diserahkan ke React Router (mis. /dashboard, /jadwal/:slug).
    RewriteRule ^ index.html [L]
</IfModule>

# Jangan tampilkan isi folder.
Options -Indexes

<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json
</IfModule>

<IfModule mod_expires.c>
    ExpiresActive On
    # Aset Vite punya hash di nama berkas, aman di-cache lama.
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 month"
</IfModule>
```

**Kenapa `RewriteRule ^(api|auth)` ditaruh paling atas:** tanpa itu, aturan SPA
di bawahnya akan menangkap `/api/me` dan mengembalikan `index.html`, sehingga
frontend menerima HTML alih-alih JSON — gejalanya "JSON parse error" yang
membingungkan.

---

## 6. Konfigurasi `.env` produksi

```bash
cd ~/bookingvendor
cp .env.example .env
nano .env
```

Nilai yang **wajib** berbeda dari pengembangan:

```dotenv
APP_NAME="Booking Vendor"
APP_ENV=production
APP_KEY=                      # diisi oleh `php artisan key:generate`
APP_DEBUG=false               # WAJIB false — jika true, stack trace & .env bocor
APP_URL=https://vendotkit.my.id

FRONTEND_URL=https://vendotkit.my.id
LOG_CHANNEL=daily

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=USERNAME_bookingvendor
DB_USERNAME=USERNAME_bvuser
DB_PASSWORD=...

SESSION_DRIVER=database
SESSION_DOMAIN=vendotkit.my.id
SESSION_SECURE_COOKIE=true    # cookie hanya dikirim lewat HTTPS
SESSION_LIFETIME=120

SANCTUM_STATEFUL_DOMAINS=vendotkit.my.id

DUITKU_MERCHANT_CODE=...
DUITKU_API_KEY=...
DUITKU_SANDBOX=false          # WAJIB false di produksi
DUITKU_CALLBACK_URL=https://vendotkit.my.id/api/webhooks/duitku
DUITKU_RETURN_URL=https://vendotkit.my.id/subscription/success
DUITKU_METHODS=SP,NQ
DUITKU_EXPIRY_MINUTES=1440
```

> `SESSION_SECURE_COOKIE=true` membuat login gagal total bila situs diakses lewat
> HTTP. Pastikan SSL aktif lebih dulu (*SSL/TLS Status → Run AutoSSL*).

---

## 7. Migrasi & seed

```bash
cd ~/bookingvendor

php artisan key:generate
php artisan migrate --force
php artisan db:seed --class=PlanSeeder --force

# Cache konfigurasi & route: WAJIB di produksi, dan WAJIB diulang
# setiap kali .env atau routes berubah.
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Setelah `config:cache`, `.env` **tidak lagi dibaca** — semua nilai dibekukan.
Kalau mengubah `.env`, jalankan `php artisan config:cache` lagi. Ini penyebab
paling umum dari "sudah saya ubah .env tapi tidak berpengaruh".

### Izin folder

```bash
chmod -R 775 ~/bookingvendor/storage ~/bookingvendor/bootstrap/cache
```

---

## 8. Cron (scheduler)

Laravel butuh scheduler untuk membersihkan transaksi kedaluwarsa. Di cPanel:
*Cron Jobs → Add New Cron Job*.

```cron
* * * * * /usr/local/bin/php /home/USERNAME/bookingvendor/artisan schedule:run >> /dev/null 2>&1
```

Sesuaikan path `php` dengan hasil `which php`. Sebagian paket shared hosting
membatasi cron **minimal 5 menit**; itu tidak masalah karena transaksi
kedaluwarsa hanya dirapikan, bukan diakhiri tepat waktu (masa berlaku 24 jam
dipilih justru untuk alasan ini).

Tidak ada queue worker yang perlu dijalankan — aplikasi ini tidak memakai job
antrean.

---

## 9. Masuk dengan Google (OAuth)

Login satu-satunya di produksi adalah Google. Tanpa langkah ini, tombol
"Masuk dengan Google" selalu berakhir `oauth_failed`.

### 9.1 Buat OAuth client

1. Buka [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   → *Create Credentials* → *OAuth client ID*.
2. Jenis aplikasi: **Web application**.
3. Isi **Authorized redirect URIs** dengan path callback Laravel:

   ```
   https://vendotkit.my.id/auth/google/callback
   ```

   Harus **persis** sama dengan `GOOGLE_REDIRECT_URI` — beda satu karakter
   (garis miring di akhir, `http` vs `https`, `www`) menghasilkan
   `redirect_uri_mismatch`.
4. *Authorized JavaScript origins* **tidak diperlukan** — aplikasi ini memakai
   redirect flow server-side, bukan Google Sign-In di browser.
5. Salin *Client ID* dan *Client secret*.

### 9.2 Isi `.env`

```dotenv
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
GOOGLE_REDIRECT_URI="https://vendotkit.my.id/auth/google/callback"
```

> Perhatikan: `GOOGLE_REDIRECT_URI` **tidak boleh** dibiarkan memakai
> `${APP_URL}/...` bila `APP_URL` diawali `http://`. Nilai itu yang dikirim ke
> Google, jadi skemanya harus `https` dan hostnya harus domain final.

Lalu muat ulang konfigurasi:

```bash
cd ~/bookingvendor
php artisan config:cache
```

### 9.3 Akun harus sudah terdaftar

Tidak ada registrasi publik. `UserAccessResolver` mencocokkan akun Google
dengan baris `users` lewat `google_id`, lalu lewat **email** bila `google_id`
masih kosong. Jadi:

- email Google kamu harus sama dengan `users.email` di database;
- bila belum ada, buat lewat Terminal:

```bash
php artisan tinker --execute="
App\Models\User::create([
  'name' => 'Nama Kamu',
  'email' => 'email-kamu@gmail.com',
  'role' => 'admin',
  'is_active' => true,
]);
"
```

Akun admin akan diarahkan ke `/admin`, vendor ke `/dashboard`.

### 9.4 Yang sering gagal

| Gejala | Penyebab | Solusi |
|---|---|---|
| `redirect_uri_mismatch` | URI di Console ≠ `GOOGLE_REDIRECT_URI` | Samakan persis, termasuk skema & tanpa garis miring akhir |
| `oauth_failed` | Client ID/secret kosong atau salah | Isi `.env`, lalu `config:cache` |
| `account_not_registered` | Email Google tidak ada di `users` | Buat user (lihat 9.3) |
| `account_inactive` | `is_active = false` | Set `is_active = true` |
| Login sukses lalu balik ke `/login` | Cookie sesi tidak tersimpan | `SESSION_SECURE_COOKIE` harus sesuai skema situs; `SESSION_DOMAIN` harus domain final tanpa `https://` |

---

## 10. Duitku

1. Masuk dashboard Duitku → *Pengaturan → Callback URL*:
   `https://vendotkit.my.id/api/webhooks/duitku`
2. *Return URL*: `https://vendotkit.my.id/subscription/success`
3. Pastikan DNS `vendotkit.my.id` **A record** → `103.138.189.51`
   (IP hosting, bukan IP VPS). TTL 300.
4. Bila memakai Cloudflare, matikan proxy (mode *DNS only*) sampai callback
   terverifikasi — proxy dapat memblokir POST dari server Duitku.

Callback **tidak bisa** diuji dari localhost. Untuk menguji sebelum DNS aktif,
pakai tunnel sementara (mis. `cloudflared tunnel --url http://localhost`) dan
set `DUITKU_CALLBACK_URL` ke URL tunnel.

---

## 11. Daftar periksa setelah deploy

```bash
# 1. Halaman utama & SPA
curl -sI https://vendotkit.my.id/ | head -3

# 2. API merespons JSON, bukan HTML
curl -s https://vendotkit.my.id/api/me | head -c 120
#    Harus: {"message":"Silakan masuk terlebih dahulu.","code":"unauthenticated"}

# 3. Route publik SPA bisa di-refresh tanpa 404
curl -sI https://vendotkit.my.id/dashboard | head -1

# 4. Webhook hidup (signature salah → 401, bukan 404/500)
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H 'Content-Type: application/json' -d '{}' \
  https://vendotkit.my.id/api/webhooks/duitku
#    Harus: 400 (payload tidak lengkap), bukan 404
```

Uji terakhir yang paling penting: **lakukan satu transaksi QRIS sandbox** dari
awal sampai langganan aktif, lalu periksa `storage/logs/laravel.log` bila status
tidak berubah.

---

## 12. Masalah yang sering muncul

| Gejala | Penyebab | Solusi |
|---|---|---|
| Halaman putih / 500 | `APP_KEY` kosong | `php artisan key:generate` |
| 500 dan log kosong | Izin `storage/` salah | `chmod -R 775 storage bootstrap/cache` |
| `/api/me` mengembalikan HTML | `.htaccess` tidak meneruskan `/api` | Cek urutan aturan rewrite |
| Refresh di `/dashboard` → 404 | Aturan SPA hilang | Tambahkan `RewriteRule ^ index.html [L]` |
| Login berhasil lalu langsung logout | `SESSION_DOMAIN` salah | Harus `vendotkit.my.id` tanpa `https://` |
| Login gagal, cookie tidak tersimpan | `SESSION_SECURE_COOKIE=true` tapi situs diakses via HTTP | Aktifkan SSL |
| Ubah `.env` tidak berpengaruh | Config ter-cache | `php artisan config:cache` |
| Webhook 404 | `DUITKU_CALLBACK_URL` salah path | Harus berakhir `/api/webhooks/duitku` |
| Langganan tidak aktif setelah bayar | Callback tidak sampai, atau `DUITKU_SANDBOX` tidak sesuai kunci | Cek log, cocokkan mode dengan kunci |
| `npm run build` gagal di server | Node tidak tersedia di cPanel | Build di lokal, unggah `dist/` |

---

## 13. Memperbarui aplikasi

```bash
cd ~/bookingvendor
git pull                     # atau unggah ulang berkas yang berubah
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache && php artisan route:cache && php artisan view:cache
```

Untuk frontend: build di lokal, lalu unggah ulang isi `dist/` ke `public_html`
(tanpa menghapus `index.php` dan `.htaccess`).
