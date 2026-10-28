/**
 * Pembantu ekspor CSV untuk laporan admin.
 *
 * Memakai `;` sebagai pemisah, bukan `,`: Excel dengan pengaturan wilayah
 * Indonesia memperlakukan `,` sebagai pemisah desimal, sehingga file berisi
 * koma terbaca sebagai satu kolom raksasa. Titik koma adalah pemisah daftar
 * yang dikenali Excel di locale tersebut.
 */

const SEPARATOR = ';'

/**
 * Satu sel CSV.
 *
 * Angka dikirim apa adanya (tanpa pemisah ribuan) supaya bisa langsung
 * dijumlahkan di Excel. Teks yang mengandung pemisah, kutip, atau baris baru
 * dibungkus tanda kutip dengan kutip ganda di-escape.
 */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[";\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/** Susun isi CSV dari baris-baris (baris pertama dianggap header). */
export function buildCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map(cell).join(SEPARATOR)).join('\r\n')
}

/**
 * Unduh CSV lewat blob.
 *
 * `\uFEFF` (BOM) ditambahkan di depan supaya Excel membaca file sebagai UTF-8.
 * Tanpa BOM, huruf beraksen dan tanda hubung panjang tampil rusak.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Objek URL harus dilepas; kalau tidak, blob tetap di memori sampai halaman ditutup.
  URL.revokeObjectURL(url)
}
