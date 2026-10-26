import assert from 'node:assert/strict'
import { toBookingPayload, validateBookingForm } from '../src/lib/booking-form.ts'
import { bookingToFormValues } from '../src/lib/booking-mapper.ts'
import type { Booking } from '../src/types/booking.ts'

/**
 * Uji alur update booking: payload yang dikirim `PUT /api/bookings/{id}` harus
 * memuat semua field (bukan hanya yang berubah) supaya server bisa memvalidasi
 * ulang secara utuh, dan perubahan tanggal bentrok tetap tertangkap di klien.
 */

const booking: Booking = {
  id: 'bk-7',
  client: { id: 'cl-7', name: 'Melati & Rangga', phone: '0896-3344-5566', email: 'melati@gmail.com' },
  packageId: 'pkg-platinum',
  packageName: 'Paket Platinum — 2 Crew + Video',
  eventDate: '2026-12-27',
  eventTime: '08:30',
  eventLocation: 'Ayana Bali, Jimbaran',
  status: 'confirmed',
  totalPrice: 24500000,
  notes: 'Butuh drone shot untuk sesi sunset.',
  invoiceCount: 1,
  createdAt: '2026-10-11T09:00:00+07:00',
}

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`ok - ${name}`)
}

const form = bookingToFormValues(booking)
const payload = toBookingPayload(form)

check('payload update memuat seluruh field booking', () => {
  assert.equal(payload.client.name, 'Melati & Rangga')
  assert.equal(payload.client.phone, '089633445566')
  assert.equal(payload.client.email, 'melati@gmail.com')
  assert.equal(payload.event_date, '2026-12-27')
  assert.equal(payload.event_time, '08:30')
  assert.equal(payload.event_location, 'Ayana Bali, Jimbaran')
  assert.equal(payload.package_id, 'pkg-platinum')
  assert.equal(payload.total_price, 24500000)
  assert.equal(payload.status, 'confirmed')
  assert.equal(payload.notes, 'Butuh drone shot untuk sesi sunset.')
})

check('nomor telepon dinormalisasi tanpa tanda hubung', () => {
  assert.ok(!payload.client.phone.includes('-'))
})

check('perubahan hanya pada jam tetap mengirim tanggal yang sama', () => {
  const changed = toBookingPayload({ ...form, eventTime: '07:00' })
  assert.equal(changed.event_time, '07:00')
  assert.equal(changed.event_date, form.eventDate)
})

check('mengosongkan catatan mengirim null (bukan string kosong)', () => {
  const cleared = toBookingPayload({ ...form, notes: '   ' })
  assert.equal(cleared.notes, null)
})

check('mengosongkan email mengirim null', () => {
  assert.equal(toBookingPayload({ ...form, clientEmail: '' }).client.email, null)
})

check('status batal boleh dikirim saat edit (berbeda dari create)', () => {
  assert.equal(toBookingPayload({ ...form, status: 'cancelled' }).status, 'cancelled')
})

check('tanggal bentrok ditolak sebelum request dikirim', () => {
  const errors = validateBookingForm({ ...form, eventDate: '2026-11-14' }, ['2026-11-14'])
  assert.ok(errors.eventDate)
})

check('tanggal milik booking sendiri tidak bentrok', () => {
  const errors = validateBookingForm({ ...form, eventTime: '09:00' }, [])
  assert.deepEqual(errors, {})
})

check('harga nol ditolak (kontrak harus bernilai)', () => {
  assert.ok(validateBookingForm({ ...form, totalPrice: '' }, []).totalPrice)
})

console.log(`\n${passed} assertion group(s) passed`)
