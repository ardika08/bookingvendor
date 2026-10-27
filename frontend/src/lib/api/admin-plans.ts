import { apiRequest } from './client'

/**
 * API katalog paket langganan untuk admin (`/admin/plans`).
 *
 * Istilah harga mengikuti pemilik produk:
 * - `price`       = harga coret / harga promo, angka yang DIBAYAR vendor.
 * - `normalPrice` = harga normal sebelum diskon, ditampilkan dicoret.
 *
 * `price` boleh `null` — artinya harga belum ditetapkan dan katalog vendor
 * menampilkan "Segera".
 */
export interface AdminPlan {
  id: string
  code: string
  name: string
  durationMonths: number
  /** Harga yang dibayar (harga coret/promo). */
  price: number | null
  /** Harga sebelum diskon, ditampilkan dicoret. */
  normalPrice: number | null
  description: string | null
  isActive: boolean
}

export interface PlanPayload {
  name: string
  duration_months: number
  price: number | null
  normal_price: number | null
  description: string | null
}

export async function fetchAdminPlans(signal?: AbortSignal): Promise<AdminPlan[]> {
  return apiRequest<AdminPlan[]>('/admin/plans', { signal })
}

export async function createAdminPlan(payload: PlanPayload): Promise<AdminPlan> {
  return apiRequest<AdminPlan>('/admin/plans', { method: 'POST', body: payload })
}

export async function updateAdminPlan(
  id: string,
  payload: Partial<PlanPayload>,
): Promise<AdminPlan> {
  return apiRequest<AdminPlan>(`/admin/plans/${id}`, { method: 'PATCH', body: payload })
}

export async function deleteAdminPlan(id: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(`/admin/plans/${id}`, { method: 'DELETE' })
}
