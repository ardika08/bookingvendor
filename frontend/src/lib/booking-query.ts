import type { BookingFilters } from '@/types/booking'

/**
 * Sinkronisasi filter daftar booking dengan query string URL.
 *
 * Manfaat: vendor bisa me-refresh halaman atau membagikan tautan
 * `/bookings?month=2026-11&status=confirmed&q=rani` tanpa kehilangan konteks —
 * dan tombol back browser mengembalikan filter sebelumnya.
 *
 * Nama parameter mengikuti kontrak API: `month`, `status`, `q`, `page`.
 */

const VALID_STATUS = new Set(['tentative', 'confirmed', 'completed', 'cancelled'])

/** `YYYY-MM` dengan bulan 01–12. */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

/** Tampilan daftar (tabel) atau kalender bulanan. */
export type BookingsView = 'list' | 'calendar'

export function parseFilters(
  searchParams: URLSearchParams,
): BookingFilters & { page: number; view: BookingsView } {
  const month = searchParams.get('month') ?? ''
  const status = searchParams.get('status') ?? 'all'
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const view = searchParams.get('view') ?? 'list'

  return {
    month: MONTH_PATTERN.test(month) ? month : '',
    status: VALID_STATUS.has(status) ? (status as BookingFilters['status']) : 'all',
    search: (searchParams.get('q') ?? '').slice(0, 100),
    page: Number.isFinite(page) && page > 0 ? page : 1,
    view: view === 'calendar' ? 'calendar' : 'list',
  }
}

/** Bangun query string dari filter; nilai default tidak ikut ditulis. */
export function buildFilterQuery(
  filters: BookingFilters,
  page = 1,
  base: URLSearchParams = new URLSearchParams(),
): string {
  const params = new URLSearchParams(base)

  setOrDelete(params, 'month', filters.month || null)
  setOrDelete(params, 'status', filters.status === 'all' ? null : filters.status)
  setOrDelete(params, 'q', filters.search.trim() || null)
  setOrDelete(params, 'page', page > 1 ? String(page) : null)

  return params.toString()
}

/** True bila ada filter aktif selain default — dipakai untuk tombol "Reset". */
export function hasActiveFilters(filters: BookingFilters): boolean {
  return filters.month !== '' || filters.status !== 'all' || filters.search.trim() !== ''
}

function setOrDelete(params: URLSearchParams, key: string, value: string | null) {
  if (value === null) params.delete(key)
  else params.set(key, value)
}
