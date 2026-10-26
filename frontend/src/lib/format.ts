/**
 * Helper format tampilan (tanggal, jam, rupiah) dengan locale Indonesia.
 *
 * Semua fungsi murni dan aman dipakai di browser; dipisah dari komponen agar
 * halaman daftar, kalender, dan invoice memakai representasi yang konsisten.
 */

const JAKARTA_TZ = 'Asia/Jakarta'

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: JAKARTA_TZ,
})

const shortDateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: JAKARTA_TZ,
})

const dayMonthFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: JAKARTA_TZ,
})

const monthYearFormatter = new Intl.DateTimeFormat('id-ID', {
  month: 'long',
  year: 'numeric',
  timeZone: JAKARTA_TZ,
})

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** `2026-11-14` → `14 November 2026`. */
export function formatDate(isoDate: string): string {
  return dateFormatter.format(toDate(isoDate))
}

/** `2026-11-14` → `14 Nov 2026` (varian ringkas untuk tabel). */
export function formatShortDate(isoDate: string): string {
  return shortDateFormatter.format(toDate(isoDate))
}

/** `2026-11-14` → `Sabtu, 14 November 2026`. */
export function formatLongDate(isoDate: string): string {
  return dayMonthFormatter.format(toDate(isoDate))
}

/** `2026-11` (atau `2026-11-14`) → `November 2026`. */
export function formatMonthYear(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return monthYearFormatter.format(new Date(year, (month ?? 1) - 1, 1))
}

/** `3450000` → `Rp3.450.000`. */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value)
}

/** `45000` → `45.000` (tanpa simbol, untuk label grafik yang sempit). */
export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) return `${trimZero(value / 1_000_000)} jt`
  if (value >= 1_000) return `${trimZero(value / 1_000)} rb`
  return value.toString()
}

/** `14:30:00` → `14.30`. */
export function formatTime(time: string | null): string | null {
  if (!time) return null
  return time.slice(0, 5).replace(':', '.')
}

/** Inisial nama untuk avatar fallback: "Rani & Bagas" → "RB". */
export function initials(name: string): string {
  const parts = name
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Ubah `YYYY-MM-DD` menjadi Date pada tengah malam WIB (hindari geser hari). */
export function toDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

/** Date → `YYYY-MM-DD` tanpa konversi UTC. */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** `2026-11` → `2026-11` guard untuk nilai input month yang kosong. */
export function currentMonthKey(date = new Date()): string {
  return toIsoDate(date).slice(0, 7)
}

function trimZero(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1).replace('.', ',')
}
