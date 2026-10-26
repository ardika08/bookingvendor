import assert from 'node:assert/strict'
import {
  EMPTY_BOOKING_FORM,
  formatCurrencyInput,
  normalizePhone,
  parseCurrencyInput,
  toBookingPayload,
  validateBookingForm,
  type BookingFormValues,
} from '../src/lib/booking-form.ts'

/**
 * Uji cepat logika form booking (tanpa framework, dijalankan lewat tsx).
 *
 * Fokus pada aturan yang juga ditegakkan server: field wajib, format no. WA,
 * double booking guard, dan pembentukan payload angka.
 */

const valid: BookingFormValues = {
  ...EMPTY_BOOKING_FORM,
  clientName: 'Rani & Bagas',
  clientPhone: '0812-3456-7890',
  clientEmail: 'rani@gmail.com',
  eventDate: '2026-11-14',
  eventTime: '08:00',
  eventLocation: 'Balai Kartini',
  packageId: 'pkg-gold',
  totalPrice: '15.000.000',
  status: 'confirmed',
  notes: 'Datang 1 jam lebih awal',
}

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`ok - ${name}`)
}

check('form valid tidak menghasilkan error', () => {
  assert.deepEqual(validateBookingForm(valid), {})
})

check('field wajib ditandai saat kosong', () => {
  const errors = validateBookingForm({ ...EMPTY_BOOKING_FORM }, [])
  assert.ok(errors.clientName)
  assert.ok(errors.clientPhone)
  assert.ok(errors.eventDate)
  assert.ok(errors.totalPrice)
})

check('nomor WA tidak valid ditolak', () => {
  const errors = validateBookingForm({ ...valid, clientPhone: '12345' }, [])
  assert.ok(errors.clientPhone)
})

check('nomor +62 dan 628 diterima', () => {
  assert.deepEqual(validateBookingForm({ ...valid, clientPhone: '+6281234567890' }, []), {})
  assert.deepEqual(validateBookingForm({ ...valid, clientPhone: '6281234567890' }, []), {})
})

check('email opsional kosong tidak error', () => {
  assert.deepEqual(validateBookingForm({ ...valid, clientEmail: '' }, []), {})
})

check('email salah format ditolak', () => {
  assert.ok(validateBookingForm({ ...valid, clientEmail: 'bukan-email' }, []).clientEmail)
})

check('tanggal sudah terisi ditolak (double booking guard)', () => {
  const errors = validateBookingForm(valid, ['2026-11-14'])
  assert.ok(errors.eventDate)
})

check('harga bukan angka ditolak', () => {
  assert.ok(validateBookingForm({ ...valid, totalPrice: 'lima juta' }, []).totalPrice)
})

check('normalizePhone membersihkan spasi & tanda hubung', () => {
  assert.equal(normalizePhone('0812-3456 7890'), '081234567890')
})

check('parseCurrencyInput membaca format ribuan', () => {
  assert.equal(parseCurrencyInput('15.000.000'), 15000000)
  assert.equal(parseCurrencyInput(''), 0)
})

check('formatCurrencyInput memberi pemisah ribuan', () => {
  assert.equal(formatCurrencyInput(15000000), '15.000.000')
  assert.equal(formatCurrencyInput(0), '')
})

check('payload submit memakai tipe yang diharapkan API', () => {
  const payload = toBookingPayload({ ...valid, clientPhone: '0812-3456-7890' })
  assert.equal(payload.client.phone, '081234567890')
  assert.equal(payload.total_price, 15000000)
  assert.equal(payload.event_time, '08:00')
  assert.equal(payload.event_date, '2026-11-14')
  assert.equal(payload.package_id, 'pkg-gold')
})

console.log(`\n${passed} assertion group(s) passed`)
