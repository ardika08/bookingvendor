import { apiRequest } from '@/lib/api/client'
import type { PublicScheduleAddon } from '@/lib/api/public-schedule'

/**
 * API booking publik.
 *
 * Klien memesan dari link jadwal tanpa akun. Harga TIDAK dikirim dari form —
 * server menghitung total dari paket + addon yang dipilih, jadi kolom harga
 * di UI read-only.
 */

export interface PublicBookingPayload {
  slug: string
  client: { name: string; phone: string; email: string | null }
  event_date: string
  event_time: string | null
  event_location: string | null
  package_id: string
  addon_ids: string[]
  notes: string | null
}

export interface PublicBookingResult {
  message: string
  booking: {
    id: string
    eventDate: string
    status: string
    totalPrice: number
    clientName: string
  }
}

export function createPublicBooking(payload: PublicBookingPayload): Promise<PublicBookingResult> {
  return apiRequest<PublicBookingResult>('/public/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Total dihitung di UI untuk pratinjau; server tetap validasi ulang. */
export function calculatePublicTotal(packagePrice: number, addons: PublicScheduleAddon[], selectedIds: string[]): number {
  const selected = addons.filter((addon) => selectedIds.includes(addon.id))
  return packagePrice + selected.reduce((sum, addon) => sum + addon.price, 0)
}
