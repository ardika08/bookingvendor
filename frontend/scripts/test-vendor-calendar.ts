import assert from 'node:assert/strict'
import {
  buildMonthMatrix,
  dominantStatus,
  groupBookingsByDate,
  shiftMonthKey,
  summarizeMonth,
} from '../src/lib/vendor-calendar.ts'
import type { Booking, BookingStatus } from '../src/types/booking.ts'

/**
 * Uji logika kalender bulanan (dipakai `VendorCalendar` & halaman `/calendar`).
 *
 * Semua fungsi murni — tidak perlu DOM. Fokus: bentuk grid, penanda hari ini,
 * pengabaian booking batal, dan ringkasan bulan.
 */

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`ok - ${name}`)
}

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: crypto.randomUUID(),
    client: { id: 'cl-1', name: 'Rani & Bagas', phone: '6281234567890', email: null },
    packageId: 'pkg-gold',
    packageName: 'Paket Gold',
    eventDate: '2026-10-14',
    eventTime: '08:00',
    eventLocation: 'Balai Kartini',
    status: 'confirmed',
    totalPrice: 15000000,
    notes: null,
    invoiceCount: 0,
    createdAt: '2026-09-01',
    ...overrides,
  }
}

check('shiftMonthKey melewati batas tahun', () => {
  assert.equal(shiftMonthKey('2026-01', -1), '2025-12')
  assert.equal(shiftMonthKey('2026-12', 1), '2027-01')
  assert.equal(shiftMonthKey('2026-10', 0), '2026-10')
  assert.equal(shiftMonthKey('2026-10', 3), '2027-01')
})

check('grid selalu kelipatan 7 sel', () => {
  for (const month of ['2026-02', '2026-10', '2027-01', '2024-02']) {
    const matrix = buildMonthMatrix(month, [])
    assert.equal(matrix.cells.length % 7, 0, `grid ${month} bukan kelipatan 7`)
  }
})

check('jumlah hari mengikuti bulan (termasuk tahun kabisat)', () => {
  assert.equal(buildMonthMatrix('2024-02', []).daysInMonth, 29)
  assert.equal(buildMonthMatrix('2026-02', []).daysInMonth, 28)
  assert.equal(buildMonthMatrix('2026-04', []).daysInMonth, 30)
  assert.equal(buildMonthMatrix('2026-10', []).daysInMonth, 31)
})

check('sel di luar bulan berupa pengisi kosong', () => {
  const matrix = buildMonthMatrix('2026-10', [])
  const inMonth = matrix.cells.filter((cell) => cell.inMonth)
  const blanks = matrix.cells.filter((cell) => cell.date === null)

  assert.equal(inMonth.length, 31)
  assert.equal(inMonth[0].day, 1)
  assert.equal(inMonth[30].day, 31)
  assert.equal(blanks.length, matrix.cells.length - 31)
  blanks.forEach((cell) => {
    assert.equal(cell.day, null)
    assert.deepEqual(cell.bookings, [])
  })
})

check('hari ini ditandai tepat satu sel', () => {
  const matrix = buildMonthMatrix('2026-10', [], '2026-10-23')
  const todayCells = matrix.cells.filter((cell) => cell.isToday)

  assert.equal(todayCells.length, 1)
  assert.equal(todayCells[0].date, '2026-10-23')
})

check('booking batal tidak menempati tanggal', () => {
  const byDate = groupBookingsByDate([
    booking({ eventDate: '2026-10-14', status: 'confirmed' }),
    booking({ eventDate: '2026-10-15', status: 'cancelled' }),
  ])

  assert.ok(byDate.has('2026-10-14'))
  assert.equal(byDate.has('2026-10-15'), false)
})

check('beberapa booking di satu tanggal diurutkan per jam', () => {
  const byDate = groupBookingsByDate([
    booking({ eventDate: '2026-10-20', eventTime: '14:00' }),
    booking({ eventDate: '2026-10-20', eventTime: '06:00' }),
    booking({ eventDate: '2026-10-20', eventTime: '09:00' }),
  ])

  const times = byDate.get('2026-10-20')?.map((item) => item.eventTime)
  assert.deepEqual(times, ['06:00', '09:00', '14:00'])
})

check('ringkasan bulan menghitung acara, status, dan hari', () => {
  const bookings: Booking[] = [
    booking({ eventDate: '2026-10-01', status: 'confirmed' }),
    booking({ eventDate: '2026-10-01', status: 'tentative' }),
    booking({ eventDate: '2026-10-15', status: 'completed' }),
    booking({ eventDate: '2026-10-20', status: 'cancelled' }),
    // Bulan lain — tidak ikut karena matrix hanya memuat bulan aktif.
    booking({ eventDate: '2026-11-02', status: 'confirmed' }),
  ]

  const summary = summarizeMonth(buildMonthMatrix('2026-10', bookings))

  assert.equal(summary.total, 3)
  assert.equal(summary.byStatus.confirmed, 1)
  assert.equal(summary.byStatus.tentative, 1)
  assert.equal(summary.byStatus.completed, 1)
  assert.equal(summary.byStatus.cancelled, 0)
  assert.equal(summary.busyDays, 2)
  assert.equal(summary.freeDays, 31 - 2)
})

check('status dominan memprioritaskan yang paling pasti', () => {
  const statuses = (list: BookingStatus[]) => list.map((status) => booking({ status }))

  assert.equal(dominantStatus(statuses(['tentative', 'confirmed'])), 'confirmed')
  assert.equal(dominantStatus(statuses(['completed', 'tentative'])), 'tentative')
  assert.equal(dominantStatus(statuses(['cancelled', 'completed'])), 'completed')
  assert.equal(dominantStatus([]), null)
})

console.log(`\n${passed} pemeriksaan lulus`)
