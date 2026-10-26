import { ApiError } from '../src/lib/api/client.ts'
import { fetchPublicSchedule } from '../src/lib/api/public-schedule.ts'
import { currentMonthKey } from '../src/lib/format.ts'
import { shiftMonthKey } from '../src/lib/vendor-calendar.ts'

async function run() {
  const month = currentMonthKey()
  const schedule = await fetchPublicSchedule('lumen-wedding-story', month)

  if (schedule.vendor.businessName !== 'Lumen Wedding Story') {
    throw new Error('Nama vendor publik tidak sesuai.')
  }
  if (schedule.month !== month || schedule.unavailableDates.length === 0) {
    throw new Error('Mock jadwal publik tidak memuat tanggal terisi pada bulan ini.')
  }
  if (schedule.unavailableDates.some((date) => !date.startsWith(month))) {
    throw new Error('Jadwal publik memuat tanggal dari bulan yang salah.')
  }
  if ('bookings' in schedule || 'clients' in schedule) {
    throw new Error('Respons jadwal publik tidak boleh memuat data booking atau klien.')
  }
  if (Object.keys(schedule).sort().join(',') !== 'month,unavailableDates,vendor') {
    throw new Error('Respons publik hanya boleh berisi ringkasan vendor dan ketersediaan.')
  }

  const nextMonth = shiftMonthKey(month, 1)
  const nextSchedule = await fetchPublicSchedule('lumen-wedding-story', nextMonth)
  if (nextSchedule.month !== nextMonth || nextSchedule.unavailableDates.length === 0) {
    throw new Error('Navigasi kalender harus memuat ulang ketersediaan untuk bulan baru.')
  }
  if (nextSchedule.unavailableDates.some((date) => !date.startsWith(nextMonth))) {
    throw new Error('Respons bulan baru memuat tanggal di luar bulan yang diminta.')
  }

  let unknownSlugRejected = false
  try {
    await fetchPublicSchedule('vendor-tidak-ada', month)
  } catch (cause) {
    unknownSlugRejected = cause instanceof ApiError && cause.status === 404
  }
  if (!unknownSlugRejected) throw new Error('Slug vendor yang tidak dikenal harus menghasilkan 404.')

  console.log('ok - kalender publik hanya mengirim tanggal tidak tersedia tanpa data klien')
}

void run()
