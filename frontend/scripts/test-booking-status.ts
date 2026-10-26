import assert from 'node:assert/strict'
import {
  availableTransitions,
  BOOKING_STATUS_META,
  isDateOccupying,
  STATUS_CREATE_OPTIONS,
  STATUS_DISPLAY_ORDER,
  transitionLabel,
} from '../src/lib/booking-status.ts'
import { BOOKING_STATUSES } from '../src/types/booking.ts'

/**
 * Uji aturan status booking: transisi yang sah, dampak ke kalender, dan label
 * aksi. Aturan ini dipakai tabel, detail, dan filter — jadi harus konsisten.
 */

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`ok - ${name}`)
}

check('setiap status punya metadata lengkap', () => {
  for (const status of BOOKING_STATUSES) {
    const meta = BOOKING_STATUS_META[status]
    assert.ok(meta.label, `label kosong untuk ${status}`)
    assert.ok(meta.description.length > 10)
    assert.ok(typeof meta.icon !== 'undefined')
    assert.ok(meta.badgeClass.includes('text-'))
  }
})

check('tentatif bisa dikonfirmasi atau dibatalkan', () => {
  assert.deepEqual(availableTransitions('tentative'), ['confirmed', 'cancelled'])
})

check('terkonfirmasi bisa diselesaikan atau dibatalkan', () => {
  assert.deepEqual(availableTransitions('confirmed'), ['completed', 'cancelled'])
})

check('booking selesai bersifat final (tidak ada transisi)', () => {
  assert.deepEqual(availableTransitions('completed'), [])
})

check('booking batal bisa diaktifkan kembali', () => {
  assert.deepEqual(availableTransitions('cancelled'), ['tentative'])
})

check('hanya status batal yang membebaskan tanggal', () => {
  assert.equal(isDateOccupying('tentative'), true)
  assert.equal(isDateOccupying('confirmed'), true)
  assert.equal(isDateOccupying('completed'), true)
  assert.equal(isDateOccupying('cancelled'), false)
})

check('opsi status saat membuat booking tidak memuat batal/selesai', () => {
  assert.deepEqual(STATUS_CREATE_OPTIONS, ['tentative', 'confirmed'])
})

check('urutan tampil memuat semua status sekali', () => {
  assert.equal(STATUS_DISPLAY_ORDER.length, BOOKING_STATUSES.length)
  assert.deepEqual([...STATUS_DISPLAY_ORDER].sort(), [...BOOKING_STATUSES].sort())
})

check('label aksi mengikuti konteks transisi', () => {
  assert.equal(transitionLabel('tentative', 'confirmed'), 'Konfirmasi')
  assert.equal(transitionLabel('confirmed', 'completed'), 'Tandai selesai')
  assert.equal(transitionLabel('confirmed', 'cancelled'), 'Batalkan')
  assert.equal(transitionLabel('cancelled', 'tentative'), 'Aktifkan lagi')
})

check('transisi tidak pernah menunjuk ke status yang sama', () => {
  for (const status of BOOKING_STATUSES) {
    assert.ok(!availableTransitions(status).includes(status))
  }
})

console.log(`\n${passed} assertion group(s) passed`)
