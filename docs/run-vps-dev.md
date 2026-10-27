# Menjalankan di VPS (mode dev, IP publik)

Catatan operasional untuk menjalankan Booking Vendor di VPS selama
pengembangan, sebelum domain final tersedia.

Target saat ini: `http://43.134.66.81:4173`

---

## 1. Arsitektur yang berjalan

```
Browser
  │  http://43.134.66.81:4173
  ▼
Vite dev server (:4173, host 0.0.0.0)
  ├── /              → SPA React (hot reload)
  ├── /api/*         → proxy → Laravel (:8082)
  └── /auth/*        → proxy → Laravel (:8082)

Laravel (:8082, php artisan serve)
  └── database/database.sqlite
```

Semua request mencapai backend lewat origin yang sama (`:4173`), sehingga
cookie sesi sah tanpa CORS. Ini juga alasan redirect auth memakai path
relatif — lihat `app/Support/FrontendRedirect.php`.

---

## 2. Menjalankan

```bash
# Backend
cd ~/projects/bookingvendor/backend
php artisan serve --host=0.0.0.0 --port=8082

# Frontend (terminal lain)
cd ~/projects/bookingvendor/frontend
npm run dev -- --host 0.0.0.0 --port 4173 --strictPort
```

Keduanya harus jalan. Bila hanya Vite yang hidup, `/api/*` akan gagal 502
karena proxy tidak menemukan target.

---

## 3. Masuk tanpa Google

Di `/login` ada dua tombol dev:

| Tombol | Akun yang dipakai | Mendarat di |
|---|---|---|
| **Masuk sebagai vendor uji** | vendor pertama yang punya profil usaha | `/dashboard` |
| **Masuk sebagai admin uji** | admin aktif pertama | `/admin/vendors` |

Tautan **"Panel admin"** di bawah kartu login juga memakai jalur admin yang
sama. Sebelumnya tautan itu hanya menulis `role=admin` ke localStorage tanpa
membuat sesi server, sehingga selalu memantul kembali ke `/login`.

Endpoint: `GET /auth/dev-login` (vendor) dan `?as=admin` (admin) — aktif hanya
bila `APP_ENV=local`.

### Pembatasan jaringan

Route ini membuat sesi **tanpa kredensial apa pun**. Karena VPS ini diakses
lewat IP publik, ada dua mode:

| `DEV_LOGIN_ALLOW_PUBLIC` | Perilaku |
|---|---|
| tidak diisi / `false` | hanya loopback & IP private (SSH tunnel) |
| `true` | IP publik diizinkan — siapa pun yang tahu URL bisa masuk |

Mode `true` dipakai sekarang agar praktis. **Matikan sebelum domain final
dipasang** dengan menghapus baris itu dari `.env`, lalu `php artisan config:cache`.

Alternatif yang lebih aman tanpa mengubah kode — SSH tunnel dari komputer
sendiri, lalu buka `http://localhost:4173`:

```bash
ssh -L 4173:127.0.0.1:4173 ubuntu@43.134.66.81
```

Dengan tunnel, `REMOTE_ADDR` menjadi `127.0.0.1` sehingga dev-login berfungsi
meski flag publik dimatikan.

---

## 4. Data

Database: `backend/database/database.sqlite`.

Seluruh data adalah **data contoh** (seed): nama klien `@example.com`, nomor
telepon dummy `0812111100xx`. Tidak ada data pelanggan nyata, sehingga aman
bila aplikasi terbuka di IP publik selama pengembangan.

Isi ulang data contoh:

```bash
cd ~/projects/bookingvendor/backend
php artisan migrate:fresh --seed
```

---

## 5. Yang perlu diketahui tentang mode dev publik

| Hal | Status |
|---|---|
| HTTPS | tidak ada — trafik tidak terenkripsi |
| Dev-login | terbuka bila `DEV_LOGIN_ALLOW_PUBLIC=true` |
| Akun admin | ada (`admin@example.com`), masuk lewat tombol "Masuk sebagai admin uji" |
| Google OAuth | belum aktif — `GOOGLE_CLIENT_ID` kosong |
| Duitku | sandbox, callback tidak bisa mencapai IP ini tanpa HTTPS |
| Hot reload | aktif, bundle tidak di-minify |

Mode ini **hanya untuk pengembangan**. Jangan dipakai untuk menerima booking
nyata atau data klien asli.

---

## 6. Verifikasi cepat

```bash
cd ~/projects/bookingvendor/frontend
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node scripts/verify-dev-public-ip.mjs
```

Skrip memeriksa: login, 7 halaman utama, detail booking, tidak ada API gagal,
dan tidak ada error konsol.
