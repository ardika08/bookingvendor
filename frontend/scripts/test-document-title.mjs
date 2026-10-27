/**
 * Uji resolver judul dokumen tanpa browser.
 * Memverifikasi semua pola route, termasuk route admin yang tidak bisa diuji
 * lewat browser karena RoleGate mengalihkan user vendor ke /dashboard.
 */

import { readFileSync } from 'node:fs'

const src = readFileSync('src/lib/document-title.ts', 'utf8')

// Transpilasi ringan: buang tipe TypeScript agar bisa dieval di Node.
// Urutan penting: anotasi `Record<...>` harus dibuang SEBELUM `: string`,
// kalau tidak akan tersisa titik dua menggantung.
const js = src
  .replace(/^import .*$/gm, '')
  .replace(/export function/g, 'function')
  .replace(/: Record<[^>]*>/g, '')
  .replace(/\): string/g, ')')
  .replace(/\): void/g, ')')
  .replace(/\(pathname: string\)/g, '(pathname)')

const { resolveDocumentTitle: r } = new Function(`${js}\nreturn { resolveDocumentTitle }`)()

const cases = [
  ['/admin/vendors', 'Kelola Vendor — Booking Vendor'],
  ['/admin/vendors/new', 'Tambah Vendor — Booking Vendor'],
  ['/admin/vendors/7', 'Detail Vendor — Booking Vendor'],
  ['/admin/vendors/7/edit', 'Edit Vendor — Booking Vendor'],
  ['/admin/plans', 'Konfigurasi Paket — Booking Vendor'],
  ['/admin/akun', 'Akun Saya — Booking Vendor'],
  ['/bookings/18/invoice/new', 'Buat Invoice — Booking Vendor'],
  ['/upgrade/checkout/abc123', 'Pembayaran — Booking Vendor'],
  ['/subscription/success', 'Pembayaran Berhasil — Booking Vendor'],
  ['/dashboard/', 'Dashboard — Booking Vendor'],
  ['/tidak-ada', 'Booking Vendor'],
]

let bad = 0
for (const [path, want] of cases) {
  const got = r(path)
  const ok = got === want
  if (!ok) bad++
  console.log(`${ok ? 'OK   ' : 'GAGAL'} ${path.padEnd(30)} -> "${got}"`)
}

// Token akses pada halaman publik TIDAK boleh muncul di judul.
const secrets = [
  ['/invoice/TOKENRAHASIA123', 'TOKENRAHASIA'],
  ['/jadwal/slug-pribadi-xyz', 'slug-pribadi'],
]
for (const [path, secret] of secrets) {
  const got = r(path)
  const leaks = got.includes(secret)
  if (leaks) bad++
  console.log(`${leaks ? 'BOCOR' : 'AMAN '} ${path.padEnd(30)} -> "${got}"`)
}

console.log(`\n=== GAGAL: ${bad} ===`)
