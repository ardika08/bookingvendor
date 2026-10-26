import type { BookingFormErrors } from '@/lib/booking-form'

/**
 * Peta nama field API Laravel → field form lokal.
 *
 * Backend memakai nama bersarang (`client.name`) atau snake_case (`event_date`),
 * sedangkan state form memakai camelCase. Konversi di satu tempat supaya pesan
 * validasi server muncul di bawah input yang benar.
 */
const SERVER_FIELD_MAP: Record<string, keyof BookingFormErrors> = {
  'client.name': 'clientName',
  client_name: 'clientName',
  'client.phone': 'clientPhone',
  client_phone: 'clientPhone',
  'client.email': 'clientEmail',
  client_email: 'clientEmail',
  event_date: 'eventDate',
  event_time: 'eventTime',
  event_location: 'eventLocation',
  package_id: 'packageId',
  total_price: 'totalPrice',
  status: 'status',
  notes: 'notes',
}

/** Ubah `{ 'client.name': 'wajib diisi' }` menjadi error form yang dikenali input. */
export function mapServerErrors(fieldErrors: Record<string, string>): BookingFormErrors {
  const result: BookingFormErrors = {}

  for (const [field, message] of Object.entries(fieldErrors)) {
    const localKey = SERVER_FIELD_MAP[field]
    if (localKey) result[localKey] = message
  }

  return result
}

/** Nama field yang tidak dikenal (untuk log/diagnostik) — tidak ditampilkan ke vendor. */
export function unmappedServerFields(fieldErrors: Record<string, string>): string[] {
  return Object.keys(fieldErrors).filter((field) => !SERVER_FIELD_MAP[field])
}
