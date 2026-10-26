import type { Booking } from '@/types/booking'
import { isDateOccupying } from '@/lib/booking-status'

/**
 * Tanggal yang diblokir vendor.
 *
 * Vendor bisa menandai tanggal yang **tidak** mau menerima booking (libur,
 * acara pribadi, maintenance). Tanggal terblokir tampil beda di kalender dan
 * ikut diperhitungkan saat form booking memberi peringatan bentrok.
 */

export interface BlockedDate {
  id: string
  /** ISO date `YYYY-MM-DD`. */
  date: string
  /** Alasan singkat, mis. "Libur Lebaran". null = tanpa keterangan. */
  reason: string | null
  createdAt: string
}

export interface BlockedDatePayload {
  date: string
  reason: string | null
}

/** Rentang tanggal terblokir: minggu / akhir pekan / bulan penuh. */
export interface BlockRange {
  from: string
  to: string
  reason: string | null
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function validateBlockedDate(
  payload: BlockedDatePayload,
  existing: BlockedDate[] = [],
): string | null {
  if (!payload.date || !ISO_DATE_PATTERN.test(payload.date)) {
    return 'Tanggal tidak valid.'
  }
  if (existing.some((item) => item.date === payload.date)) {
    return 'Tanggal ini sudah diblokir.'
  }
  if (payload.reason && payload.reason.trim().length > 120) {
    return 'Keterangan maksimal 120 karakter.'
  }
  return null
}

/** Expand rentang tanggal menjadi daftar ISO date (inklusif). */
export function expandRange(from: string, to: string): string[] {
  if (!ISO_DATE_PATTERN.test(from) || !ISO_DATE_PATTERN.test(to) || from > to) return []
  const dates: string[] = []
  const [fy, fm, fd] = from.split('-').map(Number)
  const end = new Date(to.slice(0, 4) as unknown as number, 0, 1)

  const cursor = new Date(fy, (fm ?? 1) - 1, fd ?? 1)
  const last = new Date(
    Number(to.slice(0, 4)),
    Number(to.slice(5, 7)) - 1,
    Number(to.slice(8, 10)),
  )
  void end

  while (cursor <= last && dates.length < 366) {
    const iso = `${cursor.getFullYear()}-${`${cursor.getMonth() + 1}`.padStart(2, '0')}-${`${cursor.getDate()}`.padStart(2, '0')}`
    dates.push(iso)
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

/** Set tanggal terblokir untuk pengecekan cepat di render kalender. */
export function blockedDateSet(blocked: BlockedDate[]): Set<string> {
  return new Set(blocked.map((item) => item.date))
}

/**
 * Tanggal dianggap tidak tersedia bila ditempati booking aktif **atau**
 * diblokir vendor. Dipakai form booking untuk double booking guard.
 */
export function unavailableDates(
  bookings: Booking[],
  blocked: BlockedDate[],
): Set<string> {
  const set = new Set<string>()
  for (const booking of bookings) {
    if (isDateOccupying(booking.status)) set.add(booking.eventDate)
  }
  for (const item of blocked) set.add(item.date)
  return set
}

/** Apakah tanggal tertentu masih bisa menerima booking. */
export function isDateAvailable(
  date: string,
  bookings: Booking[],
  blocked: BlockedDate[],
): boolean {
  return !unavailableDates(bookings, blocked).has(date)
}
