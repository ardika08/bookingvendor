import { isDateOccupying } from '@/lib/booking-status'
import { fetchBlockedDates } from '@/lib/api/blocked-dates'
import { USE_MOCK_DATA } from '@/lib/api/bookings'
import { ApiError, apiRequest } from '@/lib/api/client'
import { mockBookings, mockUser } from '@/lib/mock/bookings'

export interface PublicScheduleData {
  vendor: {
    businessName: string
    category: string | null
  }
  month: string
  unavailableDates: string[]
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
    const blockedDates = await fetchBlockedDates(signal)
    const unavailableDates = [...new Set([
      ...bookings,
      ...blockedDates.filter((item) => item.date.startsWith(month)).map((item) => item.date),
    ])].sort()

    return {
      vendor: {
        businessName: vendor.businessName,
        category: vendor.category,
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
