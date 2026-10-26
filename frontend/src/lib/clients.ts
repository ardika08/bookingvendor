import type { BookingStatus, Client } from '@/types/booking'

/**
 * Daftar klien turunan dari data booking.
 *
 * Di model database, `clients` adalah tabel sendiri yang dibuat otomatis saat
 * booking pertama. Selama API belum ada, klien dirakit dari booking mock dengan
 * deduplikasi berdasarkan nomor telepon (identitas paling stabil yang dimiliki
 * vendor), lalu dihitung ringkasan pemakaiannya.
 */
export interface ClientSummary extends Client {
  /** Jumlah booking milik klien ini. */
  bookingCount: number
  /** Total nilai kontrak dari booking yang tidak dibatalkan. */
  totalValue: number
  /** Tanggal acara terakhir (ISO) untuk kolom "terakhir booking". */
  lastEventDate: string | null
  /** Status booking terakhir, membantu vendor melihat konteks. */
  lastStatus: BookingStatus | null
}

interface BookingLike {
  client: Client
  eventDate: string
  status: BookingStatus
  totalPrice: number
}

export function buildClientSummaries(bookings: BookingLike[]): ClientSummary[] {
  const map = new Map<string, ClientSummary>()

  for (const booking of bookings) {
    const key = normalizeKey(booking.client.phone) || booking.client.name.toLowerCase()
    const existing = map.get(key)

    if (!existing) {
      map.set(key, {
        ...booking.client,
        bookingCount: 1,
        totalValue: booking.status === 'cancelled' ? 0 : booking.totalPrice,
        lastEventDate: booking.eventDate,
        lastStatus: booking.status,
      })
      continue
    }

    existing.bookingCount += 1
    if (booking.status !== 'cancelled') existing.totalValue += booking.totalPrice
    if (!existing.lastEventDate || booking.eventDate > existing.lastEventDate) {
      existing.lastEventDate = booking.eventDate
      existing.lastStatus = booking.status
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'id'))
}

/**
 * Cari klien berdasarkan nama atau nomor telepon.
 *
 * Normalisasi nomor penting: vendor sering mengetik `0812...`, `62812...`, atau
 * `+62 812-...` untuk orang yang sama — ketiganya harus menemukan klien yang sama.
 */
export function searchClients(clients: ClientSummary[], keyword: string, limit = 6): ClientSummary[] {
  const query = keyword.trim().toLowerCase()
  if (query.length < 2) return []

  const digits = normalizeKey(query)
  const results = clients.filter((client) => {
    if (client.name.toLowerCase().includes(query)) return true
    if (digits.length >= 3) return normalizeKey(client.phone).includes(digits)
    return false
  })

  return results.slice(0, limit)
}

/** `+62 812-3456 7890` → `6281234567890` untuk pencocokan. */
export function normalizeKey(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  return digits
}
