/**
 * Judul dokumen (`document.title`) per route.
 *
 * Sebelumnya `<title>` hanya diatur sekali di `index.html`
 * ("Booking Vendor — Dashboard Vendor Wedding") dan tidak pernah berubah.
 * Akibatnya tab browser, riwayat, dan pembaca layar menampilkan judul yang
 * sama untuk semua halaman — pengguna tidak tahu sedang di mana
 * (WCAG 2.4.2 "Page Titled").
 *
 * Modul ini adalah SATU sumber kebenaran untuk judul. Layout dashboard dan
 * admin sudah punya `resolveTitle` masing-masing untuk label Topbar; fungsi
 * di sini dipakai untuk `document.title` dan sengaja mencakup route yang
 * tidak punya layout (login, publik, redirect) supaya tidak ada halaman
 * yang tertinggal memakai judul default.
 *
 * Format: "<halaman> — Booking Vendor". Nama aplikasi ditaruh di belakang
 * karena saat banyak tab terbuka, bagian depan yang terlihat lebih dulu.
 */

const APP_NAME = 'Booking Vendor'

/** Judul untuk route yang punya halaman tetap. */
const STATIC_TITLES: Record<string, string> = {
  '/': 'Beranda',
  '/login': 'Masuk',
  '/dashboard': 'Dashboard',
  '/bookings': 'Booking',
  '/bookings/new': 'Booking Baru',
  '/calendar': 'Kalender',
  '/invoices': 'Invoice',
  '/clients': 'Klien',
  '/packages': 'Paket Layanan',
  '/settings': 'Profil Vendor',
  '/settings/akun': 'Akun Saya',
  '/upgrade': 'Langganan',
  '/subscription/success': 'Pembayaran Berhasil',
  '/admin': 'Dashboard Admin',
  '/admin/vendors': 'Kelola Vendor',
  '/admin/vendors/new': 'Tambah Vendor',
  '/admin/plans': 'Konfigurasi Paket',
  '/admin/akun': 'Akun Saya',
}

/**
 * Resolusi judul dari pathname.
 *
 * Route bersarang dicek lebih dulu karena polanya lebih spesifik. Untuk
 * halaman detail, judul memakai label generik ("Detail Booking") dan bukan
 * nama klien: `document.title` dihitung sinkron saat render, sedangkan data
 * booking baru tersedia setelah fetch. Memakai data yang belum ada akan
 * membuat judul berkedip dari generik ke spesifik. Label generik tetap
 * memenuhi WCAG 2.4.2 karena membedakan halaman satu dengan lainnya.
 */
export function resolveDocumentTitle(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/'

  if (STATIC_TITLES[path]) return `${STATIC_TITLES[path]} — ${APP_NAME}`

  // Detail & turunan booking.
  if (/^\/bookings\/[^/]+\/invoice\/new$/.test(path)) return `Buat Invoice — ${APP_NAME}`
  if (/^\/bookings\/[^/]+\/edit$/.test(path)) return `Edit Booking — ${APP_NAME}`
  if (/^\/bookings\/[^/]+$/.test(path)) return `Detail Booking — ${APP_NAME}`

  // Invoice & turunan.
  if (/^\/invoices\/[^/]+$/.test(path)) return `Detail Invoice — ${APP_NAME}`

  // Checkout langganan.
  if (/^\/upgrade\/checkout\/[^/]+$/.test(path)) return `Pembayaran — ${APP_NAME}`

  // Admin: vendor detail & edit.
  if (/^\/admin\/vendors\/[^/]+\/edit$/.test(path)) return `Edit Vendor — ${APP_NAME}`
  if (/^\/admin\/vendors\/[^/]+$/.test(path)) return `Detail Vendor — ${APP_NAME}`

  /*
   * Halaman publik memakai token acak di URL. Token itu TIDAK boleh masuk
   * judul: ia adalah kredensial akses, dan judul dokumen muncul di riwayat
   * browser, judul tab yang dibagikan, serta log. Judul sengaja generik.
   */
  if (/^\/invoice\/[^/]+$/.test(path)) return `Invoice — ${APP_NAME}`
  if (/^\/jadwal\/[^/]+$/.test(path)) return `Jadwal Ketersediaan — ${APP_NAME}`

  return APP_NAME
}

/** Pasang judul ke dokumen. Dipisah agar mudah diuji dan dipakai ulang. */
export function applyDocumentTitle(pathname: string): void {
  document.title = resolveDocumentTitle(pathname)
}
