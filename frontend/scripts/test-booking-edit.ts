import assert from 'node:assert/strict'
import { bookingToFormValues, changedFieldLabels } from '../src/lib/booking-mapper.ts'
import { validateBookingForm } from '../src/lib/booking-form.ts'
import type { Booking } from '../src/types/booking.ts'

/**
 * Uji pemetaan booking → form edit dan deteksi perubahan.
 *
 * Yang dijaga: field null dari API menjadi string kosong (bukan "null"), harga
 * diformat ribuan, dan daftar perubahan hanya memuat field yang benar-benar beda
 * sehingga tombol simpan tidak aktif tanpa alasan.
 */

const booking: Booking = {
  id: 'bk-1',
  client: { id: 'cl-1', name: 'Rani & Bagas', phone: '0812-3456-7890', email: null },
  packageId: 'pkg-gold',
  packageName: 'Paket Gold — Full Day + Album',
  eventDate: '2026-11-14',
  eventTime: '08:00',
  eventLocation: 'Balai Kartini',
  status: 'confirmed',
  totalPrice: 15000000,
  notes: null,
  invoiceCount: 1,
  createdAt: '2026-09-02T10:00:00+07:00',
}

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`ok - ${name}`)
}

const form = bookingToFormValues(booking)

check('null dari API menjadi string kosong', () => {
  assert.equal(form.clientEmail, '')
  assert.equal(form.notes, '')
})

check('nilai terisi dipindahkan apa adanya', () => {
  assert.equal(form.clientName, 'Rani & Bagas')
  assert.equal(form.eventDate, '2026-11-14')
  assert.equal(form.eventTime, '08:00')
  assert.equal(form.packageId, 'pkg-gold')
  assert.equal(form.status, 'confirmed')
})

check('harga diformat ribuan untuk input teks', () => {
  assert.equal(form.totalPrice, '15.000.000')
})

check('form hasil mapping lolos validasi', () => {
  assert.deepEqual(validateBookingForm(form, []), {})
})

check('tanpa perubahan → daftar perubahan kosong', () => {
  assert.deepEqual(changedFieldLabels(form, { ...form }), [])
})

check('perubahan tanggal & status terdeteksi dengan label benar', () => {
  const changes = changedFieldLabels(form, { ...form, eventDate: '2026-12-01', status: 'tentative' })
  const labels = changes.map((change) => change.label).sort()
  assert.deepEqual(labels, ['Status', 'Tanggal acara'])
})

check('nilai kosong ditampilkan sebagai strip', () => {
  const changes = changedFieldLabels(form, { ...form, notes: 'DP masuk 50%' })
  assert.equal(changes[0].from, '—')
  assert.equal(changes[0].to, 'DP masuk 50%')
})

check('form dengan tanggal milik booking lain ditolak (reschedule bentrok)', () => {
  const errors = validateBookingForm({ ...form, eventDate: '2026-11-22' }, ['2026-11-22'])
  assert.ok(errors.eventDate)
})

check('reschedule ke tanggal sendiri tidak dianggap bentrok', () => {
  // takenDates di route mengecualikan booking ini, jadi tanggalnya tidak ada di list.
  assert.deepEqual(validateBookingForm({ ...form, eventTime: '09:30' }, []), {})
})

console.log(`\n${passed} assertion group(s) passed`)
