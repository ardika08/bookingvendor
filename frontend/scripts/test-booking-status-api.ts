import assert from 'node:assert/strict'
import {
  fetchBooking,
  fetchBookings,
  fetchTakenDates,
  updateBookingStatus,
} from '../src/lib/api/bookings.ts'

/** Uji perubahan status melalui adapter mock dan pembacaan ulang dari API. */

let passed = 0
async function check(name: string, fn: () => Promise<void>) {
  await fn()
  passed += 1
  console.log(`ok - ${name}`)
}

async function run() {
  const booking = await fetchBooking('bk-2')
  const originalStatus = booking.status

  try {
    await check('status baru tersimpan dan tampil di detail serta daftar', async () => {
      await updateBookingStatus(booking.id, 'confirmed')
      assert.equal((await fetchBooking(booking.id)).status, 'confirmed')
      const result = await fetchBookings(
        { month: booking.eventDate.slice(0, 7), status: 'confirmed', search: '' },
        1,
      )
      assert.ok(result.items.some((item) => item.id === booking.id))
    })

    await check('status batal membebaskan tanggal dari daftar tanggal terisi', async () => {
      await updateBookingStatus(booking.id, 'cancelled')
      const takenDates = await fetchTakenDates()
      assert.ok(!takenDates.includes(booking.eventDate))
    })

    await check('booking yang tidak ditemukan menghasilkan 404', async () => {
      await assert.rejects(
        updateBookingStatus('missing-booking', 'confirmed'),
        (error: unknown) =>
          typeof error === 'object' && error !== null && 'status' in error && error.status === 404,
      )
    })
  } finally {
    await updateBookingStatus(booking.id, originalStatus)
  }

  console.log(`\n${passed} assertion group(s) passed`)
}

void run()
