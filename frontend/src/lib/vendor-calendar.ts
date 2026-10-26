import type { Booking } from '@/types/booking'
import type { BookingStatus } from '@/types/booking'
import { toDate, toIsoDate } from '@/lib/format'
import { isDateOccupying } from '@/lib/booking-status'

/**
 * Logika kalender jadwal vendor.
 *
 * Kalender menampilkan satu bulan penuh (Senin–Minggu) dengan penanda status
 * per tanggal. Booking `cancelled` tidak menempati tanggal, sehingga hari itu
 * tampil sebagai "tersedia" — sama dengan aturan double booking di form.
 */

/** Satu sel kalender; `date === null` berarti sel pengisi di awal/akhir grid. */
export interface CalendarCell {
  date: string | null
  day: number | null
  inMonth: boolean
  isToday: boolean
  /** Booking yang menempati tanggal ini (batal tidak dihitung). */
  bookings: Booking[]
}

export interface MonthMatrix {
  /** `YYYY-MM`. */
  monthKey: string
  /** Label judul, mis. `Oktober 2026`. */
  label: string
  cells: CalendarCell[]
  /** Jumlah tanggal di bulan ini (28–31). */
  daysInMonth: number
}

/** Hari pertama minggu = Senin (kebiasaan Indonesia). */
const WEEKDAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] as const

export const CALENDAR_WEEKDAYS = WEEKDAY_LABELS

/** `2026-10` + offset bulan → `2026-11`. */
export function shiftMonthKey(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, (month ?? 1) - 1 + offset, 1)
  return toIsoDate(date).slice(0, 7)
}

/** `2026-10` → `Oktober 2026`. */
export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
    new Date(year, (month ?? 1) - 1, 1),
  )
}

/** Kelompokkan booking per tanggal acara; batal diabaikan. */
export function groupBookingsByDate(bookings: Booking[]): Map<string, Booking[]> {
  const map = new Map<string, Booking[]>()
  for (const booking of bookings) {
    if (!isDateOccupying(booking.status)) continue
    const list = map.get(booking.eventDate)
    if (list) list.push(booking)
    else map.set(booking.eventDate, [booking])
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.eventTime ?? '').localeCompare(b.eventTime ?? ''))
  }
  return map
}

/**
 * Susun matriks bulan untuk render kalender.
 *
 * Grid selalu kelipatan 7 sel; tanggal dari bulan tetangga diisi `null` agar
 * sel kosong (bukan angka) dan fokus tetap pada bulan aktif.
 */
export function buildMonthMatrix(
  monthKey: string,
  bookings: Booking[],
  todayIso: string = toIsoDate(new Date()),
): MonthMatrix {
  const [year, month] = monthKey.split('-').map(Number)
  const monthIndex = (month ?? 1) - 1
  const firstDay = new Date(year, monthIndex, 1)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

  // getDay(): 0 = Minggu → geser agar Senin = 0.
  const leading = (firstDay.getDay() + 6) % 7

  const byDate = groupBookingsByDate(bookings)
  const cells: CalendarCell[] = []

  for (let i = 0; i < leading; i += 1) {
    cells.push({ date: null, day: null, inMonth: false, isToday: false, bookings: [] })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = toIsoDate(new Date(year, monthIndex, day))
    cells.push({
      date: iso,
      day,
      inMonth: true,
      isToday: iso === todayIso,
      bookings: byDate.get(iso) ?? [],
    })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null, inMonth: false, isToday: false, bookings: [] })
  }

  return {
    monthKey,
    label: formatMonthLabel(monthKey),
    cells,
    daysInMonth,
  }
}

/** Ringkasan bulan: jumlah acara per status + tanggal yang masih kosong. */
export function summarizeMonth(
  matrix: MonthMatrix,
): { total: number; byStatus: Record<BookingStatus, number>; busyDays: number; freeDays: number } {
  const byStatus: Record<BookingStatus, number> = {
    tentative: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
  }
  let total = 0
  let busyDays = 0

  for (const cell of matrix.cells) {
    if (!cell.inMonth || cell.date === null) continue
    if (cell.bookings.length > 0) busyDays += 1
    for (const booking of cell.bookings) {
      total += 1
      byStatus[booking.status] += 1
    }
  }

  return { total, byStatus, busyDays, freeDays: matrix.daysInMonth - busyDays }
}

/** Status dominan pada suatu tanggal (untuk warna sel bila ada >1 booking). */
export function dominantStatus(bookings: Booking[]): BookingStatus | null {
  if (bookings.length === 0) return null
  const order: BookingStatus[] = ['confirmed', 'tentative', 'completed', 'cancelled']
  for (const status of order) {
    if (bookings.some((booking) => booking.status === status)) return status
  }
  return bookings[0].status
}

/** Tanggal ini berada di masa lalu (dipakai untuk meredupkan sel). */
export function isPastDate(isoDate: string, todayIso: string = toIsoDate(new Date())): boolean {
  return isoDate < todayIso
}

/** Ambil objek Date dari kunci bulan (untuk perbandingan rentang). */
export function monthStart(monthKey: string): Date {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, 1)
}

/** Apakah dua kunci bulan sama. */
export function isSameMonth(a: string, b: string): boolean {
  return a === b
}

/** Ubah ISO date menjadi nomor hari dalam bulan (1–31). */
export function dayOfMonth(isoDate: string): number {
  return toDate(isoDate).getDate()
}
