import assert from 'node:assert/strict'
import {
  applyStatusOverrides,
  countStatuses,
  withOverride,
  withoutOverride,
} from '../src/lib/booking-status-optimistic.ts'
import type { Booking, BookingStatus } from '../src/types/booking.ts'

/**
 * Uji optimistic update status: override menimpa data server selama request
 * berjalan, lalu dilepas supaya server jadi sumber kebenaran (rollback otomatis).
 */

function makeBooking(id: string, status: BookingStatus): Booking {
  return {
    id,
    client: { id: `cl-${id}`, name: `Klien ${id}`, phone: '08123456789', email: null },
    packageId: null,
    packageName: null,
    eventDate: '2026-11-14',
    eventTime: null,
    eventLocation: null,
    status,
    totalPrice: 1000000,
    notes: null,
    invoiceCount: 0,
    createdAt: '2026-10-01T00:00:00+07:00',
  }
}

const bookings = [makeBooking('a', 'tentative'), makeBooking('b', 'confirmed'), makeBooking('c', 'tentative')]

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`ok - ${name}`)
}

check('tanpa override, daftar dikembalikan apa adanya (referensi sama)', () => {
  const result = applyStatusOverrides(bookings, {})
  assert.equal(result, bookings)
})

check('override menimpa status satu booking saja', () => {
  const result = applyStatusOverrides(bookings, { a: 'confirmed' })
  assert.equal(result[0].status, 'confirmed')
  assert.equal(result[1].status, 'confirmed')
  assert.equal(result[2].status, 'tentative')
})

check('override tidak memutasi objek asli', () => {
  applyStatusOverrides(bookings, { a: 'completed' })
  assert.equal(bookings[0].status, 'tentative')
})

check('withOverride menambah, withoutOverride melepas (rollback)', () => {
  let overrides = withOverride({}, 'a', 'confirmed')
  assert.deepEqual(overrides, { a: 'confirmed' })

  overrides = withOverride(overrides, 'b', 'completed')
  assert.deepEqual(overrides, { a: 'confirmed', b: 'completed' })

  overrides = withoutOverride(overrides, 'a')
  assert.deepEqual(overrides, { b: 'completed' })
})

check('after rollback status kembali ke data server', () => {
  const overrides = withoutOverride(withOverride({}, 'a', 'confirmed'), 'a')
  const result = applyStatusOverrides(bookings, overrides)
  assert.equal(result[0].status, 'tentative')
})

check('withoutOverride untuk id yang tidak ada mengembalikan objek yang sama', () => {
  const overrides = { a: 'confirmed' as BookingStatus }
  assert.equal(withoutOverride(overrides, 'zzz'), overrides)
})

check('override bernilai sama dengan status server tidak menghasilkan objek baru', () => {
  const result = applyStatusOverrides(bookings, { b: 'confirmed' })
  assert.equal(result[1], bookings[1])
})

check('countStatuses menghitung semua status', () => {
  assert.deepEqual(countStatuses(bookings), {
    tentative: 2,
    confirmed: 1,
    completed: 0,
    cancelled: 0,
  })
})

check('countStatuses mengikuti override optimistis', () => {
  const optimistic = applyStatusOverrides(bookings, { a: 'confirmed' })
  assert.deepEqual(countStatuses(optimistic), {
    tentative: 1,
    confirmed: 2,
    completed: 0,
    cancelled: 0,
  })
})

console.log(`\n${passed} assertion group(s) passed`)
