import { isDateOccupying } from '@/lib/booking-status'
import { USE_MOCK_DATA } from '@/lib/api/bookings'
import { ApiError, apiRequest } from '@/lib/api/client'
import { mockBookings, mockUser } from '@/lib/mock/bookings'
import { mockBlockedDates } from '@/lib/mock/blocked-dates'

export interface PublicScheduleData {
  vendor: {
    businessName: string
    category: string | null
    location?: string | null
    description?: string | null
    /** Paket aktif yang bisa dipesan calon klien. */
    packages?: PublicSchedulePackage[]
  }
  month: string
  unavailableDates: string[]
}

export interface PublicSchedulePackage {
  id: string
  name: string
  price: number
  durationHours: number | null
  description: string | null
}

/** Ambil ketersediaan publik tanpa mengirim data booking atau klien ke halaman. */
export async function fetchPublicSchedule(
  slug: string,
  month: string,
  signal?: AbortSignal,
): Promise<PublicScheduleData> {
  if (USE_MOCK_DATA) {
    await delay(120, signal)
    const vendor = mockUser.vendor
    if (!vendor || slug !== vendor.slug) {
      throw new ApiError('Jadwal vendor tidak ditemukan atau tidak aktif.', { status: 404 })
    }

    const bookings = mockBookings
      .filter((booking) => booking.eventDate.startsWith(month) && isDateOccupying(booking.status))
      .map((booking) => booking.eventDate)
    // Di mode mock, tanggal terblokir dibaca dari state mock — bukan lewat
    // `fetchBlockedDates()`, yang akan memanggil backend dan gagal karena
    // memang tidak ada server di mode mock.
    const blockedDates = mockBlockedDates
    const unavailableDates = [...new Set([
      ...bookings,
      ...blockedDates.filter((item) => item.date.startsWith(month)).map((item) => item.date),
    ])].sort()

    return {
      vendor: {
        businessName: vendor.businessName,
        category: vendor.category,
        location: null,
        description: null,
        packages: [],
      },
      month,
      unavailableDates,
    }
  }

  return apiRequest<PublicScheduleData>(`/public/schedules/${encodeURIComponent(slug)}`, {
    query: { month },
    signal,
  })
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
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
}
