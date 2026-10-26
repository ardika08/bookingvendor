import type { BookingStatus } from '@/types/booking'
import { BOOKING_STATUSES } from '@/types/booking'

/**
 * Bentuk data form booking (sisi klien).
 *
 * Semua nilai disimpan sebagai string karena berasal dari input HTML; konversi
 * ke angka dan tanggal WIB dilakukan saat submit (`toBookingPayload`), sama
 * seperti yang akan divalidasi server.
 */
export interface BookingFormValues {
  clientName: string
  clientPhone: string
  clientEmail: string
  eventDate: string
  eventTime: string
  eventLocation: string
  packageId: string
  totalPrice: string
  status: BookingStatus
  notes: string
}

export type BookingFormErrors = Partial<Record<keyof BookingFormValues, string>>

export const EMPTY_BOOKING_FORM: BookingFormValues = {
  clientName: '',
  clientPhone: '',
  clientEmail: '',
  eventDate: '',
  eventTime: '',
  eventLocation: '',
  packageId: '',
  totalPrice: '',
  status: 'tentative',
  notes: '',
}

/** Format no. HP Indonesia: 08xx, 628xx, atau +628xx. */
const PHONE_PATTERN = /^(\+62|62|0)8[1-9][0-9]{6,11}$/

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * Validasi form booking sesuai PRD: klien wajib nama + no. WA, tanggal acara
 * wajib, harga harus angka ≥ 0, email opsional tetapi harus valid bila diisi.
 *
 * `takenDates` dipakai untuk double booking guard di level UI (server tetap
 * validasi ulang karena indeks unik `vendor_id + event_date`).
 */
export function validateBookingForm(
  values: BookingFormValues,
  takenDates: string[] = [],
): BookingFormErrors {
  const errors: BookingFormErrors = {}

  if (!values.clientName.trim()) {
    errors.clientName = 'Nama klien wajib diisi.'
  } else if (values.clientName.trim().length < 2) {
    errors.clientName = 'Nama klien terlalu pendek.'
  }

  if (!values.clientPhone.trim()) {
    errors.clientPhone = 'Nomor WhatsApp wajib diisi.'
  } else if (!PHONE_PATTERN.test(normalizePhone(values.clientPhone))) {
    errors.clientPhone = 'Format nomor tidak valid. Contoh: 08123456789.'
  }

  if (values.clientEmail.trim() && !EMAIL_PATTERN.test(values.clientEmail.trim())) {
    errors.clientEmail = 'Format email tidak valid.'
  }

  if (!values.eventDate) {
    errors.eventDate = 'Tanggal acara wajib diisi.'
  } else if (!ISO_DATE_PATTERN.test(values.eventDate)) {
    errors.eventDate = 'Format tanggal tidak valid.'
  } else if (takenDates.includes(values.eventDate)) {
    errors.eventDate = 'Tanggal ini sudah ada booking lain. Pilih tanggal berbeda.'
  }

  if (values.eventTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.eventTime)) {
    errors.eventTime = 'Format jam tidak valid (HH:MM).'
  }

  if (!values.totalPrice.trim()) {
    errors.totalPrice = 'Nilai kontrak wajib diisi.'
  } else if (!/^\d+$/.test(values.totalPrice.replace(/\./g, ''))) {
    errors.totalPrice = 'Nilai kontrak harus berupa angka.'
  }

  if (!BOOKING_STATUSES.includes(values.status)) {
    errors.status = 'Status tidak dikenal.'
  }

  return errors
}

/** Hapus spasi, tanda hubung, dan kurung supaya nomor bisa divalidasi. */
export function normalizePhone(value: string): string {
  return value.replace(/[\s\-().]/g, '')
}

/** Ambil digit nominal dari input berformat (`15.000.000` → `15000000`). */
export function parseCurrencyInput(value: string): number {
  const digits = value.replace(/[^\d]/g, '')
  return digits ? Number.parseInt(digits, 10) : 0
}

/** `15000000` → `15.000.000` untuk ditampilkan di input teks. */
export function formatCurrencyInput(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  return new Intl.NumberFormat('id-ID').format(value)
}

/** Payload yang diharapkan API `POST /api/bookings`. */
export interface BookingPayload {
  client: { name: string; phone: string; email: string | null }
  event_date: string
  event_time: string | null
  event_location: string | null
  package_id: string | null
  total_price: number
  status: BookingStatus
  notes: string | null
}

export function toBookingPayload(values: BookingFormValues): BookingPayload {
  return {
    client: {
      name: values.clientName.trim(),
      phone: normalizePhone(values.clientPhone),
      email: values.clientEmail.trim() || null,
    },
    event_date: values.eventDate,
    event_time: values.eventTime || null,
    event_location: values.eventLocation.trim() || null,
    package_id: values.packageId || null,
    total_price: parseCurrencyInput(values.totalPrice),
    status: values.status,
    notes: values.notes.trim() || null,
  }
}
