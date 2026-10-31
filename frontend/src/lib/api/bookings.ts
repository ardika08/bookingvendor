import type {
  Booking,
  BookingFilters,
  BookingListResult,
  BookingStatus,
  CurrentUser,
  VendorPackage,
} from '@/types/booking'
import type { BookingPayload } from '@/lib/booking-form'
import { ApiError, apiRequest } from './client'
import { mockBookings, mockPackages, mockUser } from '../mock/bookings'

/**
 * Lapisan API booking.
 *
 * Satu-satunya tempat UI berbicara dengan data. Selama `USE_MOCK_DATA` masih
 * true, semua fungsi memakai data tiruan; begitu backend Laravel siap, ubah
 * flag itu ke false — implementasi HTTP di bawah sudah memanggil endpoint yang
 * didefinisikan PRD, dan komponen tidak perlu diubah.
 */

export const USE_MOCK_DATA = false

/** Tunda singkat agar skeleton/loading state terlihat realistis di mode mock. */
const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timeout = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })

// ---------------------------------------------------------------------------
// Data pendukung form
// ---------------------------------------------------------------------------

export async function fetchCurrentUser(): Promise<CurrentUser> {
  if (USE_MOCK_DATA) return structuredClone(mockUser)
  return apiRequest<CurrentUser>('/me')
}

export async function fetchPackages(): Promise<VendorPackage[]> {
  if (USE_MOCK_DATA) return structuredClone(mockPackages)

  /*
   * `active=1` wajib: tanpa filter ini paket yang sudah dinonaktifkan tetap
   * muncul di dropdown dan panel "Paket Cepat". Paket nonaktif sengaja
   * dipertahankan untuk riwayat booking/invoice, bukan untuk dipilih lagi.
   */
  return apiRequest<VendorPackage[]>('/packages', { query: { active: 1 } })
}

/**
 * Tanggal yang sudah terisi untuk double booking guard.
 *
 * `excludeBookingId` dipakai halaman edit supaya booking yang sedang diedit tidak
 * dianggap bentrok dengan dirinya sendiri saat reschedule ke tanggal yang sama.
 */
export async function fetchTakenDates(excludeBookingId?: string): Promise<string[]> {
  if (USE_MOCK_DATA) {
    return mockBookings
      .filter((booking) => booking.status !== 'cancelled' && booking.id !== excludeBookingId)
      .map((booking) => booking.eventDate)
  }
  return apiRequest<string[]>('/bookings/taken-dates', {
    query: { exclude: excludeBookingId },
  })
}

// ---------------------------------------------------------------------------
// Daftar & detail
// ---------------------------------------------------------------------------

export async function fetchBookings(
  filters: BookingFilters,
  page = 1,
  perPage = 10,
  signal?: AbortSignal,
): Promise<BookingListResult> {
  if (USE_MOCK_DATA) {
    await delay(160, signal)
    const matched = mockBookings
      .filter((booking) => {
        if (filters.month && !booking.eventDate.startsWith(filters.month)) return false
        if (filters.status !== 'all' && booking.status !== filters.status) return false
        if (filters.search) {
          const keyword = filters.search.toLowerCase()
          const haystack = `${booking.client.name} ${booking.client.phone}`.toLowerCase()
          if (!haystack.includes(keyword)) return false
        }
        return true
      })
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate))

    const start = (page - 1) * perPage
    return {
      items: matched.slice(start, start + perPage),
      total: matched.length,
      page,
      perPage,
    }
  }

  return apiRequest<BookingListResult>('/bookings', {
    query: {
      month: filters.month || undefined,
      status: filters.status === 'all' ? undefined : filters.status,
      q: filters.search.trim() || undefined,
      sort: filters.sort,
      page,
      per_page: perPage,
    },
    signal,
  })
}

export interface BookingSummary {
  total: number
  byStatus: Record<BookingStatus, number>
  /** Total nilai kontrak dari booking terkonfirmasi + selesai. */
  revenue: number
}

/**
 * Agregat daftar booking untuk kartu ringkasan.
 *
 * Dihitung di server atas seluruh baris yang cocok filter — bukan hanya
 * halaman aktif — supaya angka tidak berubah saat vendor pindah halaman.
 */
export async function fetchBookingSummary(
  filters: BookingFilters,
  signal?: AbortSignal,
): Promise<BookingSummary> {
  if (USE_MOCK_DATA) {
    await delay(120, signal)
    const byStatus = { tentative: 0, confirmed: 0, completed: 0, cancelled: 0 }
    let revenue = 0
    for (const booking of mockBookings) {
      if (filters.month && !booking.eventDate.startsWith(filters.month)) continue
      if (filters.search) {
        const keyword = filters.search.toLowerCase()
        const haystack = `${booking.client.name} ${booking.client.phone}`.toLowerCase()
        if (!haystack.includes(keyword)) continue
      }
      byStatus[booking.status] += 1
      if (booking.status === 'confirmed' || booking.status === 'completed') {
        revenue += booking.totalPrice
      }
    }
    return {
      total: Object.values(byStatus).reduce((sum, value) => sum + value, 0),
      byStatus,
      revenue,
    }
  }

  return apiRequest<BookingSummary>('/bookings/summary', {
    query: {
      month: filters.month || undefined,
      q: filters.search.trim() || undefined,
    },
    signal,
  })
}

export async function fetchBooking(id: string): Promise<Booking> {
  if (USE_MOCK_DATA) {
    const booking = mockBookings.find((item) => item.id === id)
    if (!booking) throw new ApiError('Booking tidak ditemukan.', { status: 404 })
    return structuredClone(booking)
  }
  return apiRequest<Booking>(`/bookings/${id}`)
}

/**
 * Seluruh booking milik vendor tanpa paginasi.
 *
 * Dipakai dashboard untuk menghitung agregat (pesanan masuk, jadwal terdekat,
 * nilai kontrak). Pada backend nanti angka ini datang dari endpoint agregat
 * `GET /api/dashboard/summary`, bukan dari daftar penuh.
 */
export async function fetchAllBookings(signal?: AbortSignal): Promise<Booking[]> {
  if (USE_MOCK_DATA) {
    await delay(140, signal)
    return mockBookings.map((booking) => structuredClone(booking))
  }
  return apiRequest<Booking[]>('/bookings', {
    query: { per_page: 500, sort: 'event_date' },
    signal,
  })
}

// ---------------------------------------------------------------------------
// Mutasi
// ---------------------------------------------------------------------------

/**
 * Buat booking baru.
 *
 * Melempar `ApiError` dengan `isTrialLimit === true` bila server menolak karena
 * jatah trial habis — pemanggil menampilkan modal upgrade tanpa mengosongkan
 * form (sesuai PRD).
 */
export async function createBooking(payload: BookingPayload) {
  if (USE_MOCK_DATA) {
    await delay(450)

    return { id: `bk-mock-${Date.now()}`, ...payload }
  }
  return apiRequest('/bookings', { method: 'POST', body: payload })
}

export async function updateBooking(id: string, payload: BookingPayload) {
  if (USE_MOCK_DATA) {
    await delay(450)
    return { id, ...payload }
  }
  return apiRequest(`/bookings/${id}`, { method: 'PUT', body: payload })
}

export async function updateBookingStatus(id: string, status: BookingStatus) {
  if (USE_MOCK_DATA) {
    await delay(200)
    const booking = mockBookings.find((item) => item.id === id)
    if (!booking) throw new ApiError('Booking tidak ditemukan.', { status: 404 })
    booking.status = status
    return { id, status }
  }
  return apiRequest(`/bookings/${id}/status`, { method: 'PATCH', body: { status } })
}
