/**
 * Flag fitur frontend, dibaca dari env Vite saat build (`import.meta.env`).
 *
 * Konvensi penamaan: `VITE_<NAMA>` semua huruf besar. Env ini dibekukan ke
 * bundle saat `npm run build` — mengubah `.env` TANPA build ulang tidak
 * berpengaruh, sama seperti config:cache di Laravel.
 */

/**
 * Kunci pembayaran sementara.
 *
 * Dipakai selama akun Duitku produksi belum aktif: klik paket di halaman
 * harga hanya membuka modal pemberitahuan, dan `/upgrade/checkout/*`
 * ditolak di level route supaya tidak bisa ditembus lewat URL langsung.
 *
 * Sengaja fail-closed: bila env tidak diset, dianggap TERKUNCI. Kalau
 * default-nya terbuka, lupa mengisi env di satu lingkungan berarti vendor
 * bisa membayar ke gateway yang belum siap — jauh lebih buruk daripada
 * sekali mengisi `VITE_CHECKOUT_LOCKED=false` saat ingin membuka.
 */
export const CHECKOUT_LOCKED = import.meta.env.VITE_CHECKOUT_LOCKED !== 'false'
