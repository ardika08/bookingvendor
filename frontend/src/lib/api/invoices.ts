import { USE_MOCK_DATA } from '@/lib/api/bookings'
import { ApiError, apiRequest } from './client'
import { mockInvoices, mockInvoicePayments } from '../mock/invoices'
import { INVOICE_STATUS_META, isOverdue, remainingAmount } from '../invoice-status'
import type {
  Invoice,
  InvoicePayment,
  InvoiceFilters,
  InvoiceListResult,
  InvoiceStatus,
  InvoiceSummary,
} from '@/types/invoice'
import type { InvoicePayload } from '@/lib/invoice-form'
import { statusAfterPayment, type PaymentPayload } from '@/lib/payment-form'

/**
 * Lapisan API invoice.
 *
 * Sama seperti `bookings.ts`: selama `USE_MOCK_DATA` masih true, fungsi memakai
 * data tiruan; begitu backend Laravel siap, flag di `bookings.ts` dimatikan dan
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

let mockPaymentState: InvoicePayment[] = [...mockInvoicePayments]

/** Agregat nominal dari sekumpulan invoice (mengabaikan invoice `void`). */
export function summarizeInvoices(invoices: Invoice[], today: Date = new Date()): InvoiceSummary {
  let billed = 0
  let paid = 0
  let overdueCount = 0

  for (const invoice of invoices) {
    if (invoice.status === 'void') continue
    billed += invoice.amount
    paid += invoice.paidAmount
    if (isOverdue(invoice, today)) overdueCount += 1
  }

  return { billed, paid, outstanding: billed - paid, overdueCount }
}

export async function fetchInvoices(
  filters: InvoiceFilters,
  page = 1,
  perPage = 10,
  signal?: AbortSignal,
): Promise<InvoiceListResult> {
  if (USE_MOCK_DATA) {
    await delay(160, signal)

    const keyword = filters.search.trim().toLowerCase()
    const digits = keyword.replace(/\D/g, '')
    const matched = mockInvoices
      .filter((invoice) => {
        if (filters.status !== 'all' && invoice.status !== filters.status) return false
        if (filters.type !== 'all' && invoice.type !== filters.type) return false
        if (keyword) {
          const haystack =
            `${invoice.number} ${invoice.clientName} ${invoice.clientPhone} ${invoice.packageName ?? ''}`.toLowerCase()
          if (haystack.includes(keyword)) return true
          // Nomor invoice/WA sering diketik tanpa pemisah (`inv202610` , `0812...`).
          if (digits.length >= 3) {
            const digitHaystack = `${invoice.number} ${invoice.clientPhone}`.replace(/\D/g, '')
            if (digitHaystack.includes(digits)) return true
          }
          return false
        }
        return true
      })
      // Terbaru di atas: vendor paling sering mengurus invoice yang baru terbit.
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))

    const start = (page - 1) * perPage
    return {
      items: matched.slice(start, start + perPage),
      total: matched.length,
      page,
      perPage,
      summary: summarizeInvoices(matched),
    }
  }

  return apiRequest<InvoiceListResult>('/invoices', {
    query: {
      status: filters.status === 'all' ? undefined : filters.status,
      type: filters.type === 'all' ? undefined : filters.type,
      q: filters.search.trim() || undefined,
      page,
      per_page: perPage,
    },
    signal,
  })
}

export async function fetchInvoice(id: string, signal?: AbortSignal): Promise<Invoice> {
  if (USE_MOCK_DATA) {
    await delay(120, signal)
    const invoice = mockInvoices.find((item) => item.id === id)
    if (!invoice) throw new ApiError('Invoice tidak ditemukan.', { status: 404 })
    return structuredClone(invoice)
  }
  return apiRequest<Invoice>(`/invoices/${id}`, { signal })
}

/** Riwayat pembayaran manual untuk satu invoice, terbaru di atas. */
export async function fetchInvoicePayments(
  invoiceId: string,
  signal?: AbortSignal,
): Promise<InvoicePayment[]> {
  if (USE_MOCK_DATA) {
    await delay(100, signal)
    if (!mockInvoices.some((invoice) => invoice.id === invoiceId)) {
      throw new ApiError('Invoice tidak ditemukan.', { status: 404 })
    }
    return mockPaymentState
      .filter((payment) => payment.invoiceId === invoiceId)
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
      .map((payment) => structuredClone(payment))
  }
  return apiRequest<InvoicePayment[]>(`/invoices/${invoiceId}/payments`, { signal })
}

/**
 * Seluruh invoice milik satu booking, terbit terlama di atas.
 *
 * Dipakai halaman rincian invoice (navigasi antar tagihan pada booking yang
 * sama) dan kartu invoice di halaman detail booking.
 */
export async function fetchBookingInvoices(
  bookingId: string,
  signal?: AbortSignal,
): Promise<Invoice[]> {
  if (USE_MOCK_DATA) {
    await delay(120, signal)
    return mockInvoices
      .filter((invoice) => invoice.bookingId === bookingId)
      .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt))
      .map((invoice) => structuredClone(invoice))
  }
  return apiRequest<Invoice[]>(`/bookings/${bookingId}/invoices`, { signal })
}

/**
 * Susun ulang nomor term invoice pada satu booking.
 *
 * `terms` berisi seluruh invoice booking beserta nomor term barunya. Server
 * menolak bila ada nomor yang duplikat atau invoice milik booking lain.
 */
export async function reorderInvoiceTerms(
  bookingId: string,
  terms: { id: string; term_number: number }[],
): Promise<Invoice[]> {
  if (USE_MOCK_DATA) {
    await delay(200)
    for (const row of terms) {
      const invoice = mockInvoices.find((item) => item.id === row.id)
      if (invoice) invoice.term = { term: row.term_number, total: terms.length }
    }
    return structuredClone(mockInvoices.filter((item) => item.bookingId === bookingId))
  }

  return apiRequest<Invoice[]>(`/bookings/${bookingId}/invoices/reorder`, {
    method: 'PATCH',
    body: { terms },
  })
}

/**
 * Terbitkan invoice baru untuk satu booking.
 *
 * Melempar `ApiError` dengan `isTrialLimit === true` bila server menolak karena
 * jatah trial habis — form membuka `UpgradeModal` tanpa mengosongkan isian.
 */
export async function createInvoice(
  bookingId: string,
  payload: InvoicePayload,
): Promise<Invoice> {
  if (USE_MOCK_DATA) {
    await delay(400)
    const issuedAt = payload.issued_at
    return structuredClone({
      id: `inv-mock-${Date.now()}`,
      number: `INV/${issuedAt.slice(0, 4)}/${issuedAt.slice(5, 7)}/9999`,
      bookingId,
      clientName: '',
      clientPhone: '',
      packageName: null,
      type: payload.type,
      status: 'unpaid',
      issuedAt,
      dueAt: payload.due_at,
      bookingTotal: payload.amount,
      amount: payload.amount,
      paidAmount: 0,
      eventDate: issuedAt,
      term: { term: 1, total: 1 },
    })
  }
  return apiRequest<Invoice>(`/bookings/${bookingId}/invoices`, {
    method: 'POST',
    body: payload,
  })
}

/** Catat pembayaran manual yang sudah diterima untuk satu invoice. */
export async function recordInvoicePayment(payload: PaymentPayload): Promise<InvoicePayment> {
  if (USE_MOCK_DATA) {
    await delay(300)
    const invoice = mockInvoices.find((item) => item.id === payload.invoice_id)
    if (!invoice) throw new ApiError('Invoice tidak ditemukan.', { status: 404 })

    const remaining = remainingAmount(invoice)
    if (
      invoice.status === 'void' ||
      invoice.status === 'paid' ||
      !Number.isFinite(payload.amount) ||
      payload.amount <= 0 ||
      payload.amount > remaining
    ) {
      throw new ApiError('Nominal pembayaran tidak sesuai dengan sisa tagihan.', {
        status: 422,
        fieldErrors: { amount: 'Masukkan nominal yang valid dan tidak melebihi sisa tagihan.' },
      })
    }

    const nextStatus = statusAfterPayment(invoice, payload.amount)
    invoice.paidAmount += payload.amount
    invoice.status = nextStatus
    const payment: InvoicePayment = {
      id: `payment-${payload.invoice_id}-${Date.now()}`,
      invoiceId: payload.invoice_id,
      amount: payload.amount,
      paidAt: payload.paid_at,
      method: payload.method,
      note: payload.note,
    }
    mockPaymentState = [...mockPaymentState, payment]
    return structuredClone(payment)
  }

  return apiRequest<InvoicePayment>(`/invoices/${payload.invoice_id}/payments`, {
    method: 'POST',
    body: payload,
  })
}

/** Hitung jumlah invoice per status untuk pill filter (dari seluruh data). */
export function countInvoiceStatuses(invoices: Invoice[]): Record<InvoiceStatus, number> {
  const counts: Record<InvoiceStatus, number> = { unpaid: 0, partial: 0, paid: 0, void: 0 }
  for (const invoice of invoices) counts[invoice.status] += 1
  return counts
}

/** Total sisa tagihan per booking — dipakai badge di halaman detail booking nanti. */
export function outstandingByBooking(invoices: Invoice[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const invoice of invoices) {
    if (!INVOICE_STATUS_META[invoice.status].collectible) continue
    map.set(invoice.bookingId, (map.get(invoice.bookingId) ?? 0) + remainingAmount(invoice))
  }
  return map
}
