import { mockBookings } from '@/lib/mock/bookings'
import { toIsoDate } from '@/lib/format'
import type { Invoice, InvoicePayment, InvoiceType } from '@/types/invoice'

/**
 * Data tiruan invoice — diturunkan dari `mockBookings` agar nomor klien,
 * tanggal acara, dan nilai kontrak konsisten dengan halaman booking.
 *
 * Tanggal dibuat relatif terhadap hari ini supaya state "lewat jatuh tempo",
 * "jatuh tempo minggu ini", dan "lunas" selalu ada isinya tanpa mengedit data.
 */

const today = new Date()

function shiftDays(days: number): string {
  return toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days))
}

function monthKey(isoDate: string): string {
  return isoDate.slice(5, 7)
}

/**
 * Nomor invoice berurutan per tahun, format `INV/2026/10/0007`.
 * Nomor tidak pernah dipakai ulang meski invoice dibatalkan.
 */
function invoiceNumber(issuedAt: string, sequence: number): string {
  return `INV/${issuedAt.slice(0, 4)}/${monthKey(issuedAt)}/${`${sequence}`.padStart(4, '0')}`
}

/** Bagian kontrak yang dipakai invoice; 40% untuk DP, sisanya pelunasan. */
function splitAmounts(total: number, type: InvoiceType): number {
  if (type === 'dp') return Math.round(total * 0.4)
  return total - Math.round(total * 0.4)
}

interface InvoiceSeed {
  bookingId: string
  type: InvoiceType
  status: Invoice['status']
  /** Offset hari untuk tanggal terbit (negatif = masa lalu). */
  issuedOffset: number
  /** Offset hari untuk jatuh tempo. */
  dueOffset: number
  /** Pembayaran sebagian untuk status `partial`; default 0. */
  paidAmount?: number
}

const seeds: InvoiceSeed[] = [
  // Booking terkonfirmasi bulan ini — DP sudah lunas, pelunasan belum jatuh tempo.
  { bookingId: 'bk-1', type: 'dp', status: 'paid', issuedOffset: -40, dueOffset: -30 },
  { bookingId: 'bk-1', type: 'pelunasan', status: 'unpaid', issuedOffset: -2, dueOffset: 12 },
  // Booking platinum bulan ini — DP lunas, pelunasan lewat jatuh tempo.
  { bookingId: 'bk-2', type: 'dp', status: 'paid', issuedOffset: -35, dueOffset: -25 },
  { bookingId: 'bk-2', type: 'pelunasan', status: 'unpaid', issuedOffset: -21, dueOffset: -7 },
  // Booking tentatif — baru DP yang ditagihkan, belum dibayar.
  { bookingId: 'bk-3', type: 'dp', status: 'unpaid', issuedOffset: -5, dueOffset: 2 },
  // Booking mendatang — DP dibayar sebagian (biaya venue belum masuk semua).
  { bookingId: 'bk-4', type: 'dp', status: 'partial', issuedOffset: -12, dueOffset: 3, paidAmount: 3000000 },
  // Booking yang sudah selesai — seluruh invoice lunas.
  { bookingId: 'bk-5', type: 'dp', status: 'paid', issuedOffset: -120, dueOffset: -110 },
  { bookingId: 'bk-5', type: 'pelunasan', status: 'paid', issuedOffset: -30, dueOffset: -20 },
  // Booking batal — invoice pelunasan digugurkan, DP tetap tercatat masuk.
  { bookingId: 'bk-6', type: 'dp', status: 'paid', issuedOffset: -90, dueOffset: -80 },
  { bookingId: 'bk-6', type: 'pelunasan', status: 'void', issuedOffset: -20, dueOffset: -10 },
  // Booking bulan depan — DP baru terbit, jatuh tempo minggu ini.
  { bookingId: 'bk-7', type: 'dp', status: 'unpaid', issuedOffset: -1, dueOffset: 5 },
]

const bookingById = new Map(mockBookings.map((booking) => [booking.id, booking]))

export const mockInvoices: Invoice[] = seeds
  .flatMap((seed) => {
    const booking = bookingById.get(seed.bookingId)
    if (!booking) return []

    const issuedAt = shiftDays(seed.issuedOffset)
    const amount = splitAmounts(booking.totalPrice, seed.type)

    return [
      {
        id: `inv-${seed.bookingId}-${seed.type}`,
        number: '',
        bookingId: booking.id,
        clientName: booking.client.name,
        clientPhone: booking.client.phone,
        packageName: booking.packageName,
        type: seed.type,
        status: seed.status,
        issuedAt,
        dueAt: shiftDays(seed.dueOffset),
        bookingTotal: booking.totalPrice,
        amount,
        paidAmount:
          seed.status === 'paid' ? amount : seed.status === 'void' ? 0 : (seed.paidAmount ?? 0),
        eventDate: booking.eventDate,
        term: { term: 1, total: 1 },
      },
    ]
  })
  // Nomor diberikan setelah diurutkan terbit terlama → terbaru supaya urutannya
  // masuk akal (invoice terbaru selalu bernomor terbesar).
  .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt))
  .map((invoice, index) => ({ ...invoice, number: invoiceNumber(invoice.issuedAt, index + 1) }))

export const mockPublicInvoiceTokens: Record<string, string> = {
  demo_public_7e9b4d3f2a1c8b6f0d2e4a6c: 'inv-bk-1-pelunasan',
  ...Object.fromEntries(
    mockInvoices.map((invoice) => [`demo_public_${invoice.id}`, invoice.id]),
  ),
}

export const mockInvoicePayments: InvoicePayment[] = mockInvoices
  .filter((invoice) => invoice.paidAmount > 0 && invoice.status !== 'void')
  .map((invoice) => ({
    id: `payment-${invoice.id}-initial`,
    invoiceId: invoice.id,
    amount: invoice.paidAmount,
    paidAt: invoice.issuedAt,
    method: 'transfer',
    note: invoice.status === 'partial' ? 'Pembayaran sebagian' : null,
  }))
