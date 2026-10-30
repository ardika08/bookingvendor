# Menguji Pembayaran Duitku di IP Publik (Tanpa Domain)

Panduan ini untuk menguji alur bayar langganan **sampai benar-benar lunas** selama
aplikasi masih berjalan di IP publik `43.134.66.81`, sebelum domain
`vendorkit.my.id` diarahkan ke VPS.

## Konfigurasi yang dipakai

`.env` backend:

```env
DUITKU_MERCHANT_CODE=DS37116
DUITKU_API_KEY=***REDACTED***
DUITKU_CALLBACK_URL=http://43.134.66.81:8082/api/webhooks/duitku
DUITKU_RETURN_URL=http://43.134.66.81:4173/subscription/success
DUITKU_SANDBOX=true
```

Dua hal yang perlu diketahui tentang mode IP ini:

1. **Duitku menerima callback URL berupa IP + HTTP.** Sudah diuji: transaksi
   berhasil dibuat dan halaman pembayaran sandbox terbuka. Ini bukan jaminan
   untuk produksi — Duitku produksi mensyaratkan HTTPS, dan halaman pembayaran
   produksi menolak `http://`.
2. **Port harus terbuka ke publik.** `8082` (backend) dan `4173` (frontend)
   dipakai langsung, jadi tidak ada reverse proxy yang menangani TLS.

Setelah mengubah `.env`, **wajib** membersihkan cache config:

```bash
cd backend && php artisan config:clear
```

Tanpa ini `config('duitku.callback_url')` masih berisi nilai lama.

## Cara menguji sampai benar-benar terbayar

Sandbox Duitku **tidak** menyediakan tombol "simulasikan pembayaran". QR yang
dihasilkan adalah QRIS sungguhan yang mengarah ke simulator pembayaran Duitku,
bukan uang nyata. Ada tiga cara membuktikan alur lunas:

### Cara 1 — Bayar QR sandbox (paling mendekati nyata)

1. Login vendor: `http://43.134.66.81:4173/auth/dev-login?as=vendor`
2. Buka **Paket Layanan** → pilih paket → **Langganan sekarang**
3. Pilih QRIS. QR muncul di layar.
4. Buka juga **"Buka halaman pembayaran"** — ini membuka halaman Duitku
   (`sandbox.duitku.com/topup/...`) yang menampilkan QR yang sama.
5. Pindai QR dengan aplikasi e-wallet **mode sandbox** (ShopeePay sandbox,
   Nobu sandbox) — atau gunakan [Duitku Sandbox Testing](https://docs.duitku.com)
   untuk menandai transaksi lunas.
6. Setelah Duitku menandai lunas, webhook dikirim ke
   `http://43.134.66.81:8082/api/webhooks/duitku` dan langganan aktif otomatis.

Verifikasi:

```bash
cd backend
php artisan tinker --execute="
\$p = App\Models\SubscriptionPayment::latest('id')->first();
echo \$p->order_id.' => '.\$p->status.PHP_EOL;
echo 'ends_at: '.App\Models\Subscription::where('vendor_id',1)->first()->ends_at.PHP_EOL;
"
```

`status` harus `paid` dan `ends_at` bertambah satu bulan.

### Cara 2 — Paksa status di sisi Duitku

Kalau punya akses dashboard Duitku sandbox, transaksi bisa ditandai lunas dari
sana. Duitku lalu mengirim webhook sendiri. Ini menguji jalur webhook asli
tanpa menyentuh kode.

### Cara 3 — Uji jalur aktivasi dengan tes otomatis

Jalur "callback masuk → langganan aktif" sudah tercakup 16 tes otomatis yang
memakai `Http::fake()` untuk membalas status `00` dari gateway:

```bash
cd backend && php artisan test --filter=DuitkuCallbackTest
```

Ini membuktikan logika aktivasinya benar, tetapi **tidak** membuktikan webhook
sungguhan sampai ke server. Untuk itu pakai Cara 1 atau 2.

## Keamanan yang sudah diverifikasi di IP publik

Empat skenario diuji langsung dengan `curl` ke
`http://43.134.66.81:8082/api/webhooks/duitku`:

| Yang dikirim | Balasan | Efek |
|---|---|---|
| Signature salah | `401 Signature tidak valid` | Ditolak |
| Signature valid, nominal beda (1000 vs 50000) | `422 Nominal tidak cocok` | Ditolak |
| Signature valid, `resultCode: "00"` (pura-pura lunas), gateway masih `01` | `200 OK` | **Langganan tetap pending** |
| Order tidak dikenal | `200 Order tidak dikenal` | Diabaikan |

Baris ketiga adalah yang terpenting: **payload palsu tidak bisa mengaktifkan
langganan** karena controller mengecek ulang status ke Duitku dan memakai
status gateway, bukan `resultCode` dari callback.

## Yang belum bisa diuji di IP

- **HTTPS.** Duitku produksi menolak callback HTTP. Sebelum naik produksi,
  domain + TLS wajib siap.
- **Kredensial produksi.** `DS37116` adalah merchant sandbox. Produksi butuh
  merchant code & API key berbeda, dan `DUITKU_SANDBOX=false`.
- **Callback dari jaringan Duitku yang sebenarnya.** Semua uji di atas dikirim
  dari mesin ini. Kalau ada firewall yang memblokir IP Duitku, baru ketahuan
  saat transaksi sandbox sungguhan dibayar.

## Kalau callback tidak masuk

1. Pastikan port 8082 terbuka: `curl -s -o /dev/null -w "%{http_code}" http://43.134.66.81:8082/api/me`
   → harus `401` (bukan timeout).
2. Pastikan `config('duitku.callback_url')` sudah benar:
   `php artisan tinker --execute="echo config('duitku.callback_url');"`
3. Cek log: `tail -50 backend/storage/logs/laravel.log | grep -i duitku`
4. Cek status langsung ke Duitku:
   ```bash
   php artisan tinker --execute="
   \$gw = App\Services\Payment\DuitkuGateway::fromConfig();
   \$p = App\Models\SubscriptionPayment::latest('id')->first();
   print_r(\$gw->checkStatus(\$p->order_id));
   "
   ```
   Kalau di sini `00` tapi DB masih `pending`, berarti webhook tidak sampai —
   masalah jaringan, bukan logika.

## Sebelum pindah ke domain

- [ ] Arahkan `vendorkit.my.id` ke `43.134.66.81`
- [ ] Pasang TLS (Traefik/Coolify sudah memegang port 80/443)
- [ ] Ubah `DUITKU_CALLBACK_URL` dan `DUITKU_RETURN_URL` ke `https://vendorkit.my.id/...`
- [ ] Set `SESSION_DOMAIN=vendorkit.my.id`, `SESSION_SECURE_COOKIE=true`
- [ ] **Hapus `DEV_LOGIN_ALLOW_PUBLIC=true`** — selama aktif, siapa pun yang tahu
      URL bisa masuk sebagai vendor tanpa password
- [ ] `php artisan config:cache`
