import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildMonthMatrix } from '../src/lib/vendor-calendar.ts'
import { PublicScheduleCalendar } from '../src/pages/PublicSchedulePage.tsx'

const todayIso = '2026-11-10'
const markup = renderToStaticMarkup(
  createElement(PublicScheduleCalendar, {
    matrix: buildMonthMatrix('2026-11', [], todayIso),
    todayIso,
    unavailableDates: new Set(['2026-11-12']),
    selectedDate: '2026-11-12',
    onSelectDate: () => undefined,
  }),
)

for (const label of [
  'Senin, 9 November 2026 — Lewat',
  'Rabu, 11 November 2026 — Tersedia',
  'Kamis, 12 November 2026 — Terisi',
]) {
  if (!markup.includes(label)) throw new Error(`Status tanggal tidak dirender: ${label}`)
}
for (const tone of ['bg-ink-50', 'bg-emerald-50', 'bg-rose-50']) {
  if (!markup.includes(tone)) throw new Error(`Warna status tidak ditemukan: ${tone}`)
}
if (!markup.includes('role="list"') || !markup.includes('role="listitem"')) {
  throw new Error('Tanggal kalender harus memiliki struktur yang dapat diakses.')
}
if (!markup.includes('aria-current="date"')) {
  throw new Error('Tanggal hari ini harus diberi penanda aksesibilitas.')
}
if (!markup.includes('Maaf, tanggal ini sudah terisi. Silakan pilih tanggal lain yang bertanda Tersedia.')) {
  throw new Error('Pesan untuk tanggal tidak tersedia tidak muncul saat dipilih.')
}

console.log('ok - status tanggal berbeda dan klien mendapat pesan saat memilih tanggal terisi')
