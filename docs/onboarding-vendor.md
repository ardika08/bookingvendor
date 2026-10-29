# Rancangan — Onboarding Vendor

**Status:** **Fase 1 dan Fase 2 selesai diimplementasikan** (29 Oktober 2026). Fase 3–4 belum.
**Tanggal:** 29 Oktober 2026
**Prasyarat:** dokumen ini menjawab *apa* dan *bagaimana*, bukan *kerjakan sekarang*.

---

## 1. Ringkasan

Onboarding adalah alur pengisian profil bertahap untuk vendor yang **sudah punya akun**, supaya data yang dibutuhkan aplikasi lengkap sebelum vendor mulai bekerja — terutama **rekening bank**, karena tanpa itu invoice yang dikirim ke klien tidak bisa dibayar.

Onboarding **bukan** pendaftaran publik. Pendaftaran (pembuatan akun + vendor) tetap wewenang admin lewat `/admin/vendors/new`.

---

## 2. Keputusan yang sudah diambil

| # | Keputusan | Alasan |
|---|---|---|
| 1 | Onboarding **setelah** login, bukan form pendaftaran | Login pakai Google, jadi tidak perlu membangun kata sandi, verifikasi email, dan reset password |
| 2 | Pembuatan akun tetap oleh **admin** | Menutup celah penyalahgunaan kuota trial (lihat §9) |
| 3 | Data disimpan **per langkah** | Vendor bisa berhenti di tengah dan melanjutkan; tidak ada isian yang hilang |
| 4 | Langkah rekening **wajib**, langkah lain boleh dilewati | Rekening adalah satu-satunya field yang memblokir fungsi inti (invoice tak bisa dibayar) |
| 5 | Tanpa tabel baru | Status langkah **diturunkan** dari kelengkapan data (lihat §5) |
| 6 | Tanpa kolom penanda "selesai onboarding" | Turunan lebih jujur: kalau vendor mengosongkan rekening nanti, status otomatis kembali belum lengkap |

---

## 3. Masalah yang diselesaikan

### 3.1 Masalah utama — vendor tidak bisa menerima pembayaran

Halaman invoice publik (`PublicInvoicePage.tsx:179`) menampilkan:

> "Informasi rekening belum tersedia. Hubungi vendor untuk mendapatkan instruksi pembayaran."

Kondisi ini terjadi kalau `bank_name`, `bank_account_number`, atau `bank_account_name` kosong. Vendor mengirim invoice, klien membukanya, dan **tidak ada tujuan transfer**. Ini kegagalan yang tidak terlihat oleh vendor.

### 3.2 Masalah sekunder — profil tidak lengkap tidak terasa akibatnya

Vendor baru bisa langsung membuat booking tanpa deskripsi, kategori, atau kontak. Akibatnya baru terasa belakangan: halaman publik vendor kosong, klien tidak bisa menghubungi, dan invoice tanpa identitas.

### 3.3 Yang **tidak** diselesaikan onboarding

- Tidak menggantikan verifikasi pembayaran langganan.
- Tidak memaksa vendor melengkapi semua data — hanya rekening yang wajib.
- Tidak mengubah alur booking, invoice, atau laporan.

---

## 4. Alur

### 4.1 Posisi dalam alur yang ada

```
Admin buat vendor          → POST /api/admin/vendors
   (user + vendor + trial)     password = null, trial 2 booking + 2 invoice
        ↓
Vendor login (Google)      → /auth/google/callback
        ↓
   ┌────────────────────────────────────────┐
   │ Rekening lengkap?                      │
   │   tidak → /onboarding  (dipaksa)       │
   │   ya    → /dashboard                   │
   └────────────────────────────────────────┘
        ↓
Vendor bekerja             → /bookings, /invoices, dst.
```

### 4.2 Empat langkah

| Langkah | Isi | Wajib? | Boleh dilewati? |
|---|---|---|---|
| **1. Usaha** | Nama usaha, kategori, kota | Nama + kota (sudah terisi admin); kategori **belum tentu** | Tidak — tinggal konfirmasi |
| **2. Kontak** | No. WhatsApp, email publik | Tidak | Ya |
| **3. Rekening** | Nama bank, nomor rekening, atas nama | **Ya** | **Tidak** |
| **4. Selesai** | Ringkasan + tombol "Buat booking pertama" | — | — |

**Catatan penting soal langkah 1:** nama usaha dan kota sudah diisi admin saat membuat vendor (`StoreAdminVendorRequest` mewajibkan `category`, tapi `UpdateVendorProfileRequest` mengizinkannya kosong). Jadi langkah ini adalah **konfirmasi + pelengkapan kategori**, bukan pengisian dari nol.

### 4.3 Perilaku tiap langkah

**Simpan per langkah memakai `PATCH`, bukan `PUT`.** Ini koreksi penting terhadap rancangan awal.

`PUT /api/vendor/profile` menimpa **seluruh** profil: field yang tidak dikirim dianggap "kosongkan" (`VendorProfileController` versi lama memakai `$validated['x'] ?? null`). Kalau onboarding menyimpan langkah rekening lewat `PUT`, kontak dan deskripsi yang sudah diisi di langkah sebelumnya akan terhapus.

Karena itu endpoint `PUT|PATCH` sekarang membedakan keduanya:

| Method | Perilaku | Dipakai oleh |
|---|---|---|
| `PUT` | Timpa seluruh profil (field yang tidak dikirim = dikosongkan) | Form `/settings` (perilaku lama, tidak berubah) |
| `PATCH` | Tambal — hanya field yang dikirim yang diubah | Onboarding |

Validasi `business_name` juga menyesuaikan: wajib di `PUT`, `sometimes|required` di `PATCH`. Tanpa itu langkah rekening tidak akan pernah lolos validasi karena tidak mengirim nama usaha.

**Validasi sama dengan yang sudah berjalan.** Memakai `UpdateVendorProfileRequest` yang sudah ada (`business_name` min 2 max 80, `contact_phone` regex `^(\+62|62|0)8[1-9][0-9]{6,11}$`, `bank.account_number` 6–20 digit). Tidak ada aturan baru yang perlu dipelajari vendor.

**Boleh mundur.** Tombol "Kembali" ke langkah sebelumnya tanpa kehilangan isian.

**Boleh keluar.** Menutup browser di langkah 3 lalu kembali → dibuka lagi di langkah 3 dengan isian yang sudah tersimpan.

**Tombol "Selesai" menyimpan dulu, baru berpindah.** Rancangan awal tidak menyebut ini dan implementasi pertama salah: "Selesai" hanya bernavigasi, sehingga isian rekening yang baru diketik hilang tanpa pesan. Sekarang "Selesai" memakai jalur simpan yang sama dengan "Lanjut", dan hanya berpindah setelah server memastikan `blockingStep === null`.

**Tidak bisa melewati rekening.** Kalau vendor mencoba menutup paksa atau mengubah URL ke `/dashboard`, diarahkan kembali ke `/onboarding`. Ini ditegakkan **di frontend dan backend** — frontend saja tidak cukup karena API bisa dipanggil langsung.

### 4.4 Setelah onboarding selesai

Vendor diarahkan ke `/dashboard`. Onboarding **tidak muncul lagi**.

Kalau nanti vendor mengosongkan rekening lewat `/settings`, halaman invoice publik kembali menampilkan "Informasi rekening belum tersedia" — dan onboarding **tidak** otomatis muncul lagi (mengganggu). Sebagai gantinya, muncul peringatan di halaman invoice (lihat §7).

---

## 5. Skema data

### 5.1 Tidak ada tabel baru

Status onboarding **dihitung** dari kelengkapan kolom yang sudah ada di tabel `vendors`:

| Langkah | Kolom yang diperiksa | Sumber |
|---|---|---|
| 1. Usaha | `name`, `category_id`, `location` | sudah ada |
| 2. Kontak | `contact`, `contact_email` | sudah ada |
| 3. Rekening | `bank_name`, `bank_account_number`, `bank_account_name` | sudah ada |
| 4. Selesai | semua di atas | — |

### 5.2 Kenapa tidak menambah kolom `onboarding_completed_at`

| Aspek | Kolom penanda | Turunan (dipilih) |
|---|---|---|
| Kalau data dihapus nanti | Status bilang "selesai" padahal rekening kosong | Status otomatis benar |
| Migrasi | Perlu migrasi + backfill data lama | Tidak perlu |
| Sumber kebenaran | Dua (penanda + data) bisa berbeda | Satu (data) |
| Kebutuhan analitik | Bisa | Bisa dihitung dari query yang sama |

Satu-satunya kelemahan turunan: tidak bisa membedakan "vendor baru yang belum pernah onboarding" dari "vendor lama yang datanya sudah lengkap". Untuk membedakan, cukup lihat `created_at` vendor.

### 5.3 Endpoint status

```
GET /api/vendor/onboarding
```

Mengembalikan status kelengkapan per langkah. **Belum ada** — perlu ditambahkan ke `VendorProfileController`.

```json
{
  "steps": [
    { "key": "business",  "label": "Usaha",    "complete": true,  "required": true,  "missing": [] },
    { "key": "contact",   "label": "Kontak",   "complete": false, "required": false, "missing": ["contact"] },
    { "key": "bank",      "label": "Rekening", "complete": false, "required": true,  "missing": ["bank_name", "bank_account_number", "bank_account_name"] }
  ],
  "complete": false,
  "blockingStep": "bank",
  "nextStep": "bank"
}
```

`blockingStep` = langkah wajib pertama yang belum lengkap, atau `null` kalau semua wajib sudah lengkap. Frontend memakai ini untuk menentukan halaman mana yang dibuka.

### 5.4 Kenapa perlu endpoint baru (bukan `/api/me`)

`/api/me` mengembalikan `CurrentUser` (`types/booking.ts:68`) yang hanya memuat `vendor: { id, businessName, category, slug, avatarUrl }`. **Tidak ada data rekening** di sana, sehingga guard frontend tidak bisa memutuskan sendiri apakah onboarding sudah lengkap.

Dua pilihan:

| Pilihan | Kelebihan | Kekurangan |
|---|---|---|
| Tambah field rekening ke `/api/me` | Satu permintaan | Rekening bank ikut terkirim di setiap muat halaman, termasuk ke panel admin yang tidak butuh |
| **Endpoint terpisah `/api/vendor/onboarding`** (dipilih) | Data rekening hanya dikirim saat onboarding dibuka; `/api/me` tetap ringan | Satu permintaan tambahan saat login |

Guard frontend memanggil endpoint ini sekali saat layout vendor dimuat, lalu menyimpannya di context. Middleware backend tetap menjadi penegak sebenarnya — frontend hanya untuk kenyamanan navigasi.

### 5.5 Middleware penegakan

```
EnsureOnboardingComplete   (baru, ~30 baris)
```

Diterapkan pada grup route vendor yang **butuh rekening**:

| Route | Kena middleware? | Alasan |
|---|---|---|
| `POST /api/bookings` | Tidak | Vendor harus bisa mencatat pesanan sebelum rekening siap |
| `POST /api/bookings/{id}/invoices` | **Ya** | Invoice tanpa rekening tidak bisa dibayar |
| `GET /api/invoices` | Tidak | Hanya membaca |
| `PUT /api/vendor/profile` | Tidak | Justru dipakai untuk melengkapi |

Respons penolakan:

```json
{ "message": "Lengkapi rekening bank terlebih dahulu.", "code": "onboarding_incomplete", "step": "bank" }
```

Kode `422` + `code` — mengikuti pola `trial_limit_reached` yang sudah ada, supaya frontend bisa menangani dengan cara yang sama (buka dialog, isian tidak hilang).

---

## 6. Perubahan per lapisan

### 6.1 Backend

| Berkas | Perubahan | Ukuran |
|---|---|---|
| `routes/api.php` | Tambah `GET /api/vendor/onboarding`; pasang middleware pada route invoice | ~5 baris |
| `Http/Controllers/Api/VendorProfileController.php` | Tambah method `onboarding()` | ~40 baris |
| `Services/OnboardingStatus.php` | **Baru** — hitung kelengkapan, satu sumber kebenaran | ~80 baris |
| `Http/Middleware/EnsureOnboardingComplete.php` | **Baru** | ~30 baris |
| `tests/Feature/OnboardingTest.php` | **Baru** — status, middleware, kelengkapan | ~150 baris |

**Tidak ada migrasi.**

### 6.2 Frontend

| Berkas | Perubahan | Ukuran |
|---|---|---|
| `pages/OnboardingPage.tsx` | **Baru** — 4 langkah, progress, navigasi | ~320 baris |
| `components/onboarding/StepBusiness.tsx` | **Baru** | ~90 baris |
| `components/onboarding/StepContact.tsx` | **Baru** | ~80 baris |
| `components/onboarding/StepBank.tsx` | **Baru** | ~90 baris |
| `components/onboarding/StepDone.tsx` | **Baru** | ~50 baris |
| `lib/api/onboarding.ts` | **Baru** — tipe + pemanggilan | ~60 baris |
| `App.tsx` | Daftarkan `/onboarding` **di luar** `<RoleGate role="vendor">` | ~3 baris |
| `components/auth/RequireOnboarding.tsx` | **Baru** — guard, pola sama seperti `RequireWriteAccess` | ~45 baris |
| `App.tsx` | Bungkus route vendor dengan `RequireOnboarding` | ~5 baris |
| `lib/document-title.ts` | Tambah judul route | ~1 baris |

**Catatan penting:** proyek ini **tidak punya** `ProtectedRoute`. Guard ditulis sebagai komponen terpisah yang membungkus elemen route, mengikuti pola `RequireWriteAccess.tsx` yang sudah ada. `/onboarding` didaftarkan **di luar** `<RoleGate role="vendor">` supaya tidak memakai `DashboardLayout` (tanpa sidebar) — konsisten dengan cara `/login` dan `/invoice/:token` didaftarkan.

### 6.3 Halaman admin (opsional, bisa menyusul)

Kolom "Onboarding" di `/admin/vendors` — menampilkan vendor mana yang belum lengkap rekeningnya. Berguna untuk menindaklanjuti vendor yang mandek. Bisa ditunda.

---

## 7. Peringatan di tempat lain

Supaya masalah rekening kosong tidak kembali diam-diam:

| Lokasi | Perilaku |
|---|---|
| `/invoices/:id` (dashboard vendor) | Banner kuning bila rekening kosong: "Invoice ini belum bisa dibayar — lengkapi rekening di Pengaturan" + tautan |
| Halaman invoice publik (klien) | Sudah ada pesan "Informasi rekening belum tersedia" — tidak diubah |
| `/settings` | Tanda "Belum lengkap" di kartu rekening |

---

## 8. Yang sengaja **tidak** dibuat

| Tidak dibuat | Alasan |
|---|---|
| Halaman pendaftaran publik | Celah kuota trial (§9); admin yang membuat akun |
| Login kata sandi | Google sudah cukup; menambah kata sandi berarti menambah reset password, verifikasi email, dan permukaan keamanan |
| Unggah logo/foto usaha | Belum ada penyimpanan berkas; pekerjaan terpisah |
| Tur berpemandu (tooltip keliling UI) | Beban pemeliharaan tinggi, mudah usang; onboarding berbasis form lebih tahan lama |
| Email selamat datang | `MAIL_MAILER=log` — belum ada SMTP; akan diam-diam tidak terkirim |
| Paksaan melengkapi semua field | Menghambat vendor yang buru-buru; hanya rekening yang benar-benar memblokir |

---

## 9. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| **Vendor tetap tidak bisa login** | Onboarding tidak ada gunanya | **Prasyarat:** Google OAuth harus aktif dulu (`GOOGLE_CLIENT_ID` masih kosong). Butuh domain HTTPS — Google menolak IP mentah |
| Rekening diisi asal-asalan | Klien transfer ke rekening salah | Validasi format sudah ada (6–20 digit). Verifikasi nama pemilik rekening di luar lingkup |
| Middleware memblokir alur yang sah | Vendor tidak bisa menerbitkan invoice | Hanya `POST` invoice yang diblokir; `GET`, booking, dan profil tetap bebas |
| Vendor lama (data dev) tiba-tiba dipaksa onboarding | Mengganggu demo | Data dev saat ini sudah punya rekening lengkap — tidak terpengaruh |
| `DEV_LOGIN_ALLOW_PUBLIC=true` masih menyala | Siapa pun bisa masuk sebagai vendor/admin | Wajib dimatikan sebelum domain final (sudah tercatat di `docs/run-vps-dev.md`) |

---

## 10. Urutan pengerjaan yang disarankan

| Fase | Isi | Prasyarat |
|---|---|---|
| **0** | Domain `vendorkit.my.id` + HTTPS + kredensial Google OAuth | — |
| **1** | Backend: `OnboardingStatus`, endpoint status, middleware, tes | — |
| **2** | Frontend: `/onboarding` 4 langkah + pengalihan | Fase 1 |
| **3** | Banner peringatan rekening di halaman invoice | Fase 2 |
| **4** | Kolom onboarding di `/admin/vendors` (opsional) | Fase 1 |

Fase 1 dan 2 bisa dikerjakan tanpa domain, tapi **tidak bisa diuji end-to-end** tanpa login Google. Untuk pengujian sementara, dev-login cukup.

---

## 11. Pertanyaan terbuka

1. **Langkah 1 perlu ditampilkan atau tidak?** Datanya sudah diisi admin. Menampilkannya berarti vendor melihat form yang sudah terisi (kesempatan mengoreksi); melewatinya berarti onboarding jadi 3 langkah (lebih cepat). Saya condong **ditampilkan** — vendor biasanya ingin memastikan nama usahanya benar sebelum dipublikasikan.
2. **Apakah kategori wajib?** Di database `vendors.category_id` boleh kosong. Admin **wajib** mengisi kategori saat membuat vendor (`StoreAdminVendorRequest`), tetapi vendor bisa mengosongkannya lewat `PATCH /api/vendor/profile` (`UpdateVendorProfileRequest` → `nullable`). Jadi kategori hari ini bisa hilang setelah admin membuatnya. Saya condong **wajib** — kategori dipakai untuk pencarian di halaman publik. Kalau dipilih wajib, `UpdateVendorProfileRequest` perlu diubah, dan itu perubahan aturan yang berdampak ke halaman Pengaturan vendor.
3. **Berapa lama vendor boleh menunda?** Kalau vendor tidak pernah melengkapi rekening, apakah akunnya dibatasi setelah N hari? Saya condong **tidak dibatasi** — biarkan trial habis dengan sendirinya.
