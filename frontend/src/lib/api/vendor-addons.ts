import { apiRequest } from './client'
import type { Addon } from '@/lib/vendor-addons'

export function fetchAddons(signal?: AbortSignal): Promise<Addon[]> {
  return apiRequest<Addon[]>('/addons', { signal })
}
export function createAddon(payload: { name: string; price: number; active: boolean }): Promise<Addon> {
  return apiRequest<Addon>('/addons', { method: 'POST', body: payload })
}
export function updateAddon(id: string, payload: { name: string; price: number; active: boolean }): Promise<Addon> {
  return apiRequest<Addon>(`/addons/${id}`, { method: 'PUT', body: payload })
}
export function deleteAddon(id: string): Promise<void> {
  return apiRequest<void>(`/addons/${id}`, { method: 'DELETE' })
}
export function updatePackageAddons(id: string, addons: Array<{ addon_id: string; price: number }>): Promise<unknown> {
  return apiRequest(`/packages/${id}/addons`, { method: 'PUT', body: { addons } })
}
export function createPackageWithAddons<T>(payload: unknown): Promise<T> {
  return apiRequest<T>('/packages', { method: 'POST', body: payload })
}
