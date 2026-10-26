import type { Invoice, InvoicePaymentMethod } from '@/types/invoice'
import { remainingAmount } from '@/lib/invoice-status'
import { parseCurrencyInput } from '@/lib/booking-form'

/**
 * Aturan form pencatatan pembayaran invoice.
 *
 * Pembayaran dicatat manual oleh vendor setelah dana benar-benar masuk. Aturan
 * yang dijaga di sini sama dengan yang akan divalidasi server: nominal > 0,
 * tidak melebihi sisa tagihan, tanggal bayar wajib & tidak di masa depan,
 * metode wajib.
 */

export type PaymentMethod = InvoicePaymentMethod

export const PAYMENT_METHODS: PaymentMethod[] = ['transfer', 'qris', 'cash', 'other']

export interface PaymentFormValues {
  invoiceId: string
  /** Nominal dalam format ribuan (`6.000.000`). */
  amount: string
  /** ISO date `YYYY-MM-DD`. */
  paidAt: string
  method: PaymentMethod
  note: string
}

export type PaymentFormErrors = Partial<Record<keyof PaymentFormValues, string>>

/** Payload yang diharapkan API `POST /api/invoices/{id}/payments`. */
export interface PaymentPayload {
  invoice_id: string
  amount: number
  paid_at: string
  method: PaymentMethod
  note: string | null
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function validatePaymentForm(
  values: PaymentFormValues,
  invoice: Invoice,
  todayIso: string = new Date().toISOString().slice(0, 10),
): PaymentFormErrors {
  const errors: PaymentFormErrors = {}
  const amount = parseCurrencyInput(values.amount)
  const remaining = remainingAmount(invoice)

  if (invoice.status === 'void') {
    errors.amount = 'Invoice dibatalkan — pembayaran tidak bisa dicatat.'
  } else if (invoice.status === 'paid' || remaining <= 0) {
    errors.amount = 'Invoice sudah lunas.'
  } else if (!values.amount.trim()) {
    errors.amount = 'Nominal pembayaran wajib diisi.'
  } else if (amount <= 0) {
    errors.amount = 'Nominal harus lebih besar dari nol.'
  } else if (amount > remaining) {
    errors.amount = `Nominal melebihi sisa tagihan (${new Intl.NumberFormat('id-ID').format(remaining)}).`
  }

  if (!values.paidAt) {
    errors.paidAt = 'Tanggal bayar wajib diisi.'
  } else if (!ISO_DATE_PATTERN.test(values.paidAt)) {
    errors.paidAt = 'Format tanggal tidak valid.'
  } else if (values.paidAt > todayIso) {
    errors.paidAt = 'Tanggal bayar tidak boleh di masa depan.'
  }

  if (!PAYMENT_METHODS.includes(values.method)) {
    errors.method = 'Pilih metode pembayaran.'
  }

  return errors
}

export function toPaymentPayload(values: PaymentFormValues): PaymentPayload {
  return {
    invoice_id: values.invoiceId,
    amount: parseCurrencyInput(values.amount),
    paid_at: values.paidAt,
    method: values.method,
    note: values.note.trim() || null,
  }
}

/** Status invoice setelah pembayaran sebesar `amount` dicatat. */
export function statusAfterPayment(invoice: Invoice, amount: number): Invoice['status'] {
  if (invoice.status === 'void') return 'void'
  const paid = invoice.paidAmount + amount
  if (paid >= invoice.amount) return 'paid'
  if (paid > 0) return 'partial'
  return 'unpaid'
}
