import { apiRequest } from './client'

/**
 * Aturan platform yang bisa diubah admin (`/admin/settings`).
 *
 * Nama field di sini sengaja datar (`graceDays`), bukan nama config bertitik
 * (`subscription.grace_days`): titik di dalam nama field bermakna "notasi
 * bersarang" dan membingungkan validator maupun pembaca JSON.
 */

export interface PlatformSettingValues {
  /** Hari setelah langganan berakhir saat vendor masih bisa memakai aplikasi. */
  graceDays: number
  /** Batas jumlah booking selama masa trial. */
  trialDays: number
  /** Batas jumlah invoice selama masa trial. */

}

export type PlatformSettingField = keyof PlatformSettingValues

export interface PlatformSettingRule {
  min: number
  max: number
  default: number
}

export interface PlatformSettingHistoryEntry {
  field: string
  oldValue: string | null
  newValue: string
  /** Null bila akun admin yang mengubah sudah dihapus. */
  actorName: string | null
  changedAt: string
}

export interface PlatformSettingsResponse {
  settings: PlatformSettingValues
  /** Batas min/max dari server, supaya UI tidak menebak angka sendiri. */
  rules: Record<PlatformSettingField, PlatformSettingRule>
  impact: {
    /** Vendor yang sedang dalam masa tenggang saat ini. */
    vendorsInGrace: number
  }
  history: PlatformSettingHistoryEntry[]
}

export async function fetchPlatformSettings(
  signal?: AbortSignal,
): Promise<PlatformSettingsResponse> {
  return apiRequest<PlatformSettingsResponse>('/admin/settings', { signal })
}

export async function updatePlatformSettings(
  changes: Partial<PlatformSettingValues>,
): Promise<PlatformSettingsResponse & { changed: PlatformSettingField[] }> {
  return apiRequest<PlatformSettingsResponse & { changed: PlatformSettingField[] }>(
    '/admin/settings',
    { method: 'PUT', body: changes },
  )
}
