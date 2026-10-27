# Frontend — Booking Vendor

React 19 + TypeScript + Vite, Tailwind v4 (konfigurasi via CSS, tanpa `tailwind.config.*`).

## Prasyarat: kunci lisensi Hugeicons Pro

Ikon memakai **Hugeicons Pro** (`@hugeicons-pro/core-stroke-standard`) yang dipasang
dari registry privat. Tanpa kunci lisensi, `npm install` **gagal dengan 401** —
ini perilaku yang benar, bukan kerusakan.

1. Ambil Universal License Key dari akun Hugeicons (tab **Tokens**).
2. Set sebagai environment variable:

   ```bash
   export HUGEICONS_LICENSE_KEY="kunci-universal-kamu"
   ```

3. Baru jalankan `npm install`.

`.npmrc` di direktori ini hanya **menunjuk** variabel tersebut
(`${HUGEICONS_LICENSE_KEY}`), jadi aman di-commit dan tidak menyimpan rahasia.
Jangan pernah menulis kunci langsung ke `.npmrc` atau file lain yang masuk repo.

Kalau `HUGEICONS_LICENSE_KEY` belum ada, pesan errornya menyebut 401 pada
`npm.hugeicons.com` — itu tanda kunci belum di-set.

## Menjalankan

```bash
npm install          # butuh HUGEICONS_LICENSE_KEY
npm run dev          # http://localhost:5173
npm run build
```

## Ikon

Seluruh ikon diimpor lewat satu modul: `src/components/ui/icons.tsx`.

Jangan mengimpor dari `@hugeicons-pro/*` atau `@hugeicons/react` langsung di
komponen. Modul itu memetakan nama Lucide lama (`Search`, `XCircle`, …) ke ikon
Hugeicons yang setara, sehingga:

- kode pemakaian tetap `<Search className="size-4" />`,
- mengganti style Pro (mis. ke `core-stroke-rounded` atau `core-solid-standard`)
  cukup mengubah satu baris impor di file itu,
- nama ikon yang tidak ada di paket akan ketahuan saat `tsc`, bukan saat runtime.

`size` sengaja tidak diberi nilai default di modul tersebut: ukuran ikon
ditentukan kelas `size-*` di tiap pemakaian, sama seperti sebelumnya.

## Skrip verifikasi

Semua butuh dev server berjalan di `http://127.0.0.1:4173` dan
`PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright`.

| Skrip | Kegunaan |
|---|---|
| `scripts/check-icons-render.mjs` | Ikon benar-benar ter-render, tidak ada `<svg>` kosong |
| `scripts/check-icon-size.mjs` | Ukuran terhitung tetap mengikuti kelas `size-*` |
| `scripts/check-icon-stroke.mjs` | Ketebalan garis seragam antar ikon |
| `scripts/check-icon-treeshaking.mjs` | Hanya ikon terpakai yang masuk bundle |
| `scripts/verify-pro-icon-names.mjs` | Semua nama ikon ada di paket Pro |
| `scripts/check-typography-responsive.mjs` | Overflow/teks terpotong di 375/768/1280px |
| `scripts/audit-heading-hierarchy.mjs` | Tidak ada inversi hirarki heading |

## Catatan pengembangan

Setelah menukar paket ikon, **hapus cache Vite** (`rm -rf node_modules/.vite`) dan
restart dev server. Tanpa itu, halaman bisa ter-render kosong karena cache
dependency lama masih menunjuk paket yang sudah dilepas. Ini pernah terjadi saat
migrasi dari paket gratis ke Pro — gejalanya `<div id="root">` kosong tanpa error
di console, sehingga mudah disalahartikan sebagai bug kode.
