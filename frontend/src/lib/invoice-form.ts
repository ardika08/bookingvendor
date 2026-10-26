import type { InvoiceType } from '@/types/invoice'
import type { Booking } from '@/types/booking'
import { formatCurrencyInput, parseCurrencyInput } from '@/lib/booking-form'

/**
 * Aturan form pembuatan invoice dari booking.
 *
 * Invoice selalu lahir dari booking (PRD: "Invoice otomatis dari booking"), jadi
 * form hanya perlu memilih jenis tagihan, nominal, tanggal terbit, dan jatuh
 * tempo. Nilai awal dihitung dari `booking.totalPrice`: 40% untuk DP dan sisa
 * kontrak untuk pelunasan — vendor tetap boleh menimpanya dengan angka sendiri.
 */

/** Bagian DP dari nilai kontrak; sisa tagihan pelunasan = 60%. */
export const DP_PERCENTAGE = 0.4

export interface InvoiceFormValues {
  bookingId: string
  type: InvoiceType
  /** Nominal invoice dalam format ribuan (`6.000.000`). */
  amount: string
  /** ISO date `YYYY-MM-DD`. */
  issuedAt: string
  /** ISO date `YYYY-MM-DD`. */
  dueAt: string
}

export type InvoiceFormErrors = Partial<Record<keyof InvoiceFormValues, string>>

/** Payload yang diharapkan API `POST /api/bookings/{id}/invoices`. */
export interface InvoicePayload {
  booking_id: string
  type: InvoiceType
  amount: number
  issued_at: string
  due_at: string
}

/** Nominal DP/Pelunasan untuk nilai kontrak tertentu (dibulatkan ke rupiah). */
export function splitInvoiceAmount(total: number, type: InvoiceType): number {
  const dp = Math.round(total * DP_PERCENTAGE)
  return type === 'dp' ? dp : Math.max(total - dp, 0)
}

/** Total nominal invoice yang sudah terbit (dibatalkan tidak dihitung). */
export function billedTotal(billedAmounts: number[]): number {
  return billedAmounts.reduce((sum, amount) => sum + amount, 0)
}

/** Sisa kontrak yang belum ditagihkan oleh invoice lain (tidak pernah negatif). */
export function remainingToBill(booking: Booking, billedAmounts: number[]): number {
  return Math.max(booking.totalPrice - billedTotal(billedAmounts), 0)
}

/**
 * Nominal yang disarankan saat vendor memilih jenis tagihan.
 *
 * Pelunasan memakai sisa kontrak bila masih ada, supaya tagihan terakhir menutup
 * persis nilai kontrak (tidak menyisakan selisih pembulatan). DP selalu memakai
 * pembagian 40% dari nilai kontrak.
 */
export function suggestedAmount(
  booking: Booking,
  type: InvoiceType,
  billedAmounts: number[] = [],
): number {
  const remaining = remainingToBill(booking, billedAmounts)
  if (type === 'pelunasan' && remaining > 0) return remaining
  return splitInvoiceAmount(booking.totalPrice, type)
}

/** Rincian kalkulasi nominal untuk ditampilkan di ringkasan form. */
export interface InvoiceAmountBreakdown {
  /** Nilai kontrak booking. */
  total: number
  /** Nominal invoice yang sudah terbit (tanpa yang dibatalkan). */
  billed: number
  /** Sisa kontrak yang belum ditagihkan. */
  remaining: number
  /** Nominal yang sedang diisi di form. */
  current: number
  /** Sisa setelah invoice ini diterbitkan. */
  afterThis: number
}

export function invoiceAmountBreakdown(
  booking: Booking,
  billedAmounts: number[],
  currentAmount: number,
): InvoiceAmountBreakdown {
  const billed = billedTotal(billedAmounts)
  const remaining = Math.max(booking.totalPrice - billed, 0)
  return {
    total: booking.totalPrice,
    billed,
    remaining,
    current: currentAmount,
    afterThis: Math.max(remaining - currentAmount, 0),
  }
}

/** Tambah hari ke ISO date tanpa konversi UTC. */
export function addDaysIso(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, (month ?? 1) - 1, (day ?? 1) + days)
  const nextMonth = `${date.getMonth() + 1}`.padStart(2, '0')
  const nextDay = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`
}

/**
 * Nilai awal form: jenis tagihan pertama yang belum pernah diterbitkan, nominal
 * mengikuti sisa kontrak, jatuh tempo 7 hari setelah terbit.
 */
export function initialInvoiceForm(
  booking: Booking,
  todayIso: string,
  billedAmounts: number[] = [],
): InvoiceFormValues {
  const remaining = remainingToBill(booking, billedAmounts)
  const type: InvoiceType = billedAmounts.length === 0 ? 'dp' : 'pelunasan'
  const defaultAmount = remaining > 0 ? remaining : splitInvoiceAmount(booking.totalPrice, type)

  return {
    bookingId: booking.id,
    type,
    amount: formatCurrencyInput(defaultAmount),
    issuedAt: todayIso,
    dueAt: addDaysIso(todayIso, 7),
  }
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Validasi form invoice.
 *
 * Aturan (mengikuti PRD): nominal wajib > 0 dan tidak boleh melebihi sisa
 * kontrak, tanggal terbit wajib, jatuh tempo tidak boleh sebelum tanggal terbit.
 */
export function validateInvoiceForm(
  values: InvoiceFormValues,
  booking: Booking,
  billedAmounts: number[] = [],
): InvoiceFormErrors {
  const errors: InvoiceFormErrors = {}
  const amount = parseCurrencyInput(values.amount)
  const remaining = remainingToBill(booking, billedAmounts)

  if (!values.amount.trim()) {
    errors.amount = 'Nominal tagihan wajib diisi.'
  } else if (amount <= 0) {
    errors.amount = 'Nominal harus lebih besar dari nol.'
  } else if (remaining > 0 && amount > remaining) {
    errors.amount = `Nominal melebihi sisa kontrak (${formatCurrencyInput(remaining)}).`
  }

  if (!values.issuedAt) {
    errors.issuedAt = 'Tanggal terbit wajib diisi.'
  } else if (!ISO_DATE_PATTERN.test(values.issuedAt)) {
    errors.issuedAt = 'Format tanggal tidak valid.'
  }

  if (!values.dueAt) {
    errors.dueAt = 'Jatuh tempo wajib diisi.'
  } else if (!ISO_DATE_PATTERN.test(values.dueAt)) {
    errors.dueAt = 'Format tanggal tidak valid.'
  } else if (values.issuedAt && values.dueAt < values.issuedAt) {
    errors.dueAt = 'Jatuh tempo tidak boleh sebelum tanggal terbit.'
  }

  return errors
}

export function toInvoicePayload(values: InvoiceFormValues): InvoicePayload {
  return {
    booking_id: values.bookingId,
    type: values.type,
    amount: parseCurrencyInput(values.amount),
    issued_at: values.issuedAt,
    due_at: values.dueAt,
  }
}

/** Peta nama field API invoice → field form lokal. */
const INVOICE_SERVER_FIELD_MAP: Record<string, keyof InvoiceFormErrors> = {
  amount: 'amount',
  total: 'amount',
  issued_at: 'issuedAt',
  issue_date: 'issuedAt',
  due_at: 'dueAt',
  due_date: 'dueAt',
  type: 'type',
}

/** Ubah error validasi server menjadi error di bawah input yang tepat. */
export function mapInvoiceServerErrors(fieldErrors: Record<string, string>): InvoiceFormErrors {
  const result: InvoiceFormErrors = {}
  for (const [field, message] of Object.entries(fieldErrors)) {
    const localKey = INVOICE_SERVER_FIELD_MAP[field]
    if (localKey) result[localKey] = message
  }
  return result
}
