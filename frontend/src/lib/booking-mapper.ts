import type { Booking } from '@/types/booking'
import type { BookingFormValues } from './booking-form'

/**
 * Konversi data booking (dari API) ke nilai form edit, dan sebaliknya.
 *
 * Dipisah dari `booking-form.ts` supaya modul form tetap ringan untuk halaman
 * create, sementara halaman edit butuh pemetaan dua arah plus daftar perubahan.
 */
export function bookingToFormValues(booking: Booking): BookingFormValues {
  return {
    clientName: booking.client.name,
    clientPhone: booking.client.phone,
    clientEmail: booking.client.email ?? '',
    eventDate: booking.eventDate,
    eventTime: booking.eventTime ?? '',
    eventLocation: booking.eventLocation ?? '',
    packageId: booking.packageId ?? '',
    totalPrice: booking.totalPrice > 0 ? formatThousands(booking.totalPrice) : '',
    status: booking.status,
    notes: booking.notes ?? '',
  }
}

export interface FieldChange {
  key: keyof BookingFormValues
  label: string
  from: string
  to: string
}

/** Hanya field yang nilainya berubah — dipakai untuk ringkasan "X perubahan". */
export function changedFieldLabels(
  before: BookingFormValues,
  after: BookingFormValues,
): FieldChange[] {
  const labels: Partial<Record<keyof BookingFormValues, string>> = {
    clientName: 'Nama klien',
    clientPhone: 'No. WhatsApp',
    clientEmail: 'Email',
    eventDate: 'Tanggal acara',
    eventTime: 'Jam acara',
    eventLocation: 'Lokasi',
    packageId: 'Paket',
    totalPrice: 'Nilai kontrak',
    status: 'Status',
    notes: 'Catatan',
  }

  return (Object.keys(labels) as Array<keyof BookingFormValues>)
    .filter((key) => before[key] !== after[key])
    .map((key) => ({
      key,
      label: labels[key] as string,
      from: before[key] ? String(before[key]) : '—',
      to: after[key] ? String(after[key]) : '—',
    }))
}

function formatThousands(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value)
}
