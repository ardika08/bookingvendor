/**
 * Identitas badan usaha & kontak.
 *
 * Satu sumber untuk semua tempat yang menampilkannya — footer salespage,
 * halaman masuk, dan halaman pendaftaran. Data ini dipakai untuk verifikasi
 * merchant payment gateway (Duitku), yang memeriksa apakah pemilik situs bisa
 * dihubungi dan apakah badan usahanya jelas.
 *
 * Tahun copyright dihitung saat render, jadi otomatis berganti tiap tahun
 * tanpa perlu menyentuh kode.
 */
export const COMPANY = {
  legalName: 'PT. DIARMA AKSARA MEDIA',
  brand: 'VendorKit',
  email: 'info@vendorkit.my.id',
  /** Format tampil (lokal). */
  phoneDisplay: '0878-4758-4627',
  /** Format internasional untuk tautan wa.me (tanpa + dan tanpa 0 depan). */
  phoneWa: '6287847584627',
  address: {
    street: 'Jl. Kediri Raya No. 2 RT 5 RW 16',
    village: 'Kel. Uwung Jaya, Kec. Cibodas',
    city: 'Kota Tangerang, Banten 15138',
  },
} as const

/** Tahun berjalan untuk baris copyright. */
export function currentYear(): number {
  return new Date().getFullYear()
}

/** Baris copyright lengkap, mis. "© 2026 PT. DIARMA AKSARA MEDIA. …" */
export function copyrightLine(): string {
  return `© ${currentYear()} ${COMPANY.legalName}. Seluruh hak cipta dilindungi.`
}
