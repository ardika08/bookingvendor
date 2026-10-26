import { USE_MOCK_DATA } from '@/lib/api/bookings'
import { ApiError, apiRequest } from './client'
import type {
  VendorProfileDetail,
  VendorProfilePayload,
} from '@/lib/vendor-profile'
import { mockVendorProfile } from '../mock/vendor-profile'

/**
 * Lapisan API profil vendor.
 *
 * Pola sama dengan `bookings.ts`: selama `USE_MOCK_DATA` masih true, data berasal
 * dari mock; begitu backend Laravel siap, flag di `bookings.ts` dimatikan dan
 * pemanggilan HTTP di bawah langsung aktif tanpa mengubah komponen.
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

let mockProfileState: VendorProfileDetail = structuredClone(mockVendorProfile)

/** Profil vendor yang sedang login (`GET /api/vendor/profile`). */
export async function fetchVendorProfile(signal?: AbortSignal): Promise<VendorProfileDetail> {
  if (USE_MOCK_DATA) {
    await delay(120, signal)
    return structuredClone(mockProfileState)
  }
  return apiRequest<VendorProfileDetail>('/vendor/profile', { signal })
}

/**
 * Simpan perubahan profil (`PUT /api/vendor/profile`).
 *
 * Error validasi server dipetakan pemanggil lewat `mapVendorServerErrors`, jadi
 * fungsi ini hanya melempar `ApiError` apa adanya.
 */
export async function updateVendorProfile(
  payload: VendorProfilePayload,
): Promise<VendorProfileDetail> {
  if (USE_MOCK_DATA) {
    await delay(400)
    const current = mockProfileState
    mockProfileState = {
      ...current,
      businessName: payload.business_name,
      category: payload.category,
      description: payload.description,
      contactPhone: payload.contact_phone,
      contactEmail: payload.contact_email,
      city: payload.city,
      bank: {
        name: payload.bank.name,
        accountNumber: payload.bank.account_number,
        accountHolder: payload.bank.account_holder,
      },
    }
    return structuredClone(mockProfileState)
  }
  return apiRequest<VendorProfileDetail>('/vendor/profile', {
    method: 'PUT',
    body: payload,
  })
}

/** Profil wajib ada untuk vendor; `null` berarti akun belum punya data vendor. */
export async function fetchVendorProfileOrNull(
  signal?: AbortSignal,
): Promise<VendorProfileDetail | null> {
  try {
    return await fetchVendorProfile(signal)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}
