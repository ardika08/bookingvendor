import { USE_MOCK_DATA } from '@/lib/api/bookings'
import { ApiError, apiRequest } from './client'
import { mockVendorPackages } from '../mock/vendor-packages'
import type {
  PackageFilters,
  PackagePayload,
  VendorPackageDetail,
} from '@/lib/vendor-packages'

/**
 * Lapisan API paket layanan vendor.
 *
 * Pola sama dengan `bookings.ts`: selama `USE_MOCK_DATA` masih true, data dari
 * mock; begitu backend aktif, flag dimatikan dan pemanggilan HTTP di bawah
 * langsung dipakai tanpa mengubah komponen.
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

/** Daftar paket (`GET /api/packages`). Filter dikerjakan di server. */
export async function fetchPackagesList(
  filters: PackageFilters,
  signal?: AbortSignal,
): Promise<VendorPackageDetail[]> {
  if (USE_MOCK_DATA) {
    await delay(140, signal)
    const keyword = filters.search.trim().toLowerCase()
    return mockVendorPackages
      .filter((pkg) => {
        if (filters.active === 'active' && !pkg.active) return false
        if (filters.active === 'inactive' && pkg.active) return false
        if (keyword && !pkg.name.toLowerCase().includes(keyword)) return false
        return true
      })
      .sort((a, b) => Number(b.active) - Number(a.active) || a.price - b.price)
      .map((pkg) => structuredClone(pkg))
  }

  return apiRequest<VendorPackageDetail[]>('/packages', {
    query: {
      active:
        filters.active === 'all' ? undefined : filters.active === 'active' ? '1' : '0',
      q: filters.search.trim() || undefined,
    },
    signal,
  })
}

export async function createPackage(payload: PackagePayload): Promise<VendorPackageDetail> {
  if (USE_MOCK_DATA) {
    await delay(380)
    return structuredClone({
      id: `pkg-mock-${Date.now()}`,
      name: payload.name,
      price: payload.price,
      description: payload.description,
      durationHours: payload.duration_hours,
      active: payload.active,
      usageCount: 0,
    })
  }
  return apiRequest<VendorPackageDetail>('/packages', { method: 'POST', body: payload })
}

export async function updatePackage(
  id: string,
  payload: PackagePayload,
): Promise<VendorPackageDetail> {
  if (USE_MOCK_DATA) {
    await delay(380)
    const existing = mockVendorPackages.find((pkg) => pkg.id === id)
    if (!existing) throw new ApiError('Paket tidak ditemukan.', { status: 404 })
    return structuredClone({
      ...existing,
      name: payload.name,
      price: payload.price,
      description: payload.description,
      durationHours: payload.duration_hours,
      active: payload.active,
    })
  }
  return apiRequest<VendorPackageDetail>(`/packages/${id}`, { method: 'PUT', body: payload })
}

export async function deletePackage(id: string): Promise<void> {
  if (USE_MOCK_DATA) {
    await delay(300)
    return
  }
  return apiRequest<void>(`/packages/${id}`, { method: 'DELETE' })
}
