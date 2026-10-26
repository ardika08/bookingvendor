import { ApiError } from './client'
import { USE_MOCK_DATA } from '@/lib/api/bookings'
import { mockBlockedDates } from '../mock/blocked-dates'
import type { BlockedDate, BlockedDatePayload } from '@/lib/vendor-availability'
import { toIsoDate } from '@/lib/format'

/**
 * Lapisan API tanggal terblokir.
 *
 * Endpoint mengikuti pola resource: `GET /api/blocked-dates`,
 * `POST /api/blocked-dates`, `DELETE /api/blocked-dates/{id}`. Selama mode mock,
 * perubahan disimpan di array modul sehingga UI bisa diuji tanpa backend.
 */

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

/** Salinan yang bisa dimutasi selama mode mock (module-level state). */
let mockState: BlockedDate[] = [...mockBlockedDates]

export async function fetchBlockedDates(signal?: AbortSignal): Promise<BlockedDate[]> {
  if (USE_MOCK_DATA) {
    await delay(100, signal)
    return mockState.map((item) => ({ ...item }))
  }
  return apiRequestJson<BlockedDate[]>('/blocked-dates', signal)
}

export async function createBlockedDate(payload: BlockedDatePayload): Promise<BlockedDate> {
  if (USE_MOCK_DATA) {
    await delay(260)
    if (mockState.some((item) => item.date === payload.date)) {
      throw new ApiError('Tanggal ini sudah diblokir.', {
        status: 422,
        fieldErrors: { date: 'Tanggal ini sudah diblokir.' },
      })
    }
    const created: BlockedDate = {
      id: `blk-mock-${Date.now()}`,
      date: payload.date,
      reason: payload.reason,
      createdAt: toIsoDate(new Date()),
    }
    mockState = [...mockState, created]
    return { ...created }
  }
  return apiRequestJson<BlockedDate>('/blocked-dates', undefined, {
    method: 'POST',
    body: payload,
  })
}

export async function deleteBlockedDate(id: string): Promise<void> {
  if (USE_MOCK_DATA) {
    await delay(200)
    mockState = mockState.filter((item) => item.id !== id)
    return
  }
  await apiRequestJson<void>(`/blocked-dates/${id}`, undefined, { method: 'DELETE' })
}

/** Reset state mock — dipakai bila halaman butuh data awal lagi (dev only). */
export function resetMockBlockedDates(): void {
  mockState = [...mockBlockedDates]
}

// Import ditaruh di bawah agar dokumentasi modul terbaca lebih dulu.
import { apiRequest } from './client'

function apiRequestJson<T>(
  path: string,
  signal?: AbortSignal,
  options: { method?: 'POST' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  return apiRequest<T>(path, { ...options, signal })
}
