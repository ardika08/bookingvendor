import type { Booking, BookingStatus } from '@/types/booking'

/**
 * Logika murni optimistic update status booking.
 *
 * Dipisah dari hook supaya bisa diuji tanpa React dan dipakai ulang oleh daftar
 * maupun kalender. Semantiknya: `overrides` adalah status yang BELUM terkonfirmasi
 * server; begitu request selesai (sukses atau gagal) entri itu dihapus dan UI
 * kembali membaca status dari data server.
 */

export type StatusOverrides = Record<string, BookingStatus>

/** Tempelkan override ke daftar booking dari server. */
export function applyStatusOverrides(items: Booking[], overrides: StatusOverrides): Booking[] {
  if (Object.keys(overrides).length === 0) return items
  return items.map((booking) => {
    const next = overrides[booking.id]
    return next && next !== booking.status ? { ...booking, status: next } : booking
  })
}

/** Tambahkan satu override (dipakai saat request dimulai). */
export function withOverride(
  overrides: StatusOverrides,
  bookingId: string,
  status: BookingStatus,
): StatusOverrides {
  return { ...overrides, [bookingId]: status }
}

/** Buang override (dipakai saat request selesai, sukses maupun gagal). */
export function withoutOverride(overrides: StatusOverrides, bookingId: string): StatusOverrides {
  if (!(bookingId in overrides)) return overrides
  const next = { ...overrides }
  delete next[bookingId]
  return next
}

/**
 * Hitung ringkasan status dari daftar yang sudah memuat override.
 * Dipakai pill filter & kartu statistik supaya angka ikut berubah optimistis.
 */
export function countStatuses(items: Booking[]): Record<BookingStatus, number> {
  const counts: Record<BookingStatus, number> = {
    tentative: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
  }
  for (const booking of items) counts[booking.status] += 1
  return counts
}
