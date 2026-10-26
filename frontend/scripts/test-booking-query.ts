import assert from 'node:assert/strict'
import { buildFilterQuery, hasActiveFilters, parseFilters } from '../src/lib/booking-query.ts'

/**
 * Uji sinkronisasi filter daftar booking ↔ query string URL.
 *
 * Yang dijaga: nilai sampah di URL tidak merusak state, default tidak ditulis,
 * dan round-trip parse → build menghasilkan string yang stabil.
 */

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`ok - ${name}`)
}

const qs = (value: string) => new URLSearchParams(value)

check('URL kosong menghasilkan filter default', () => {
  const filters = parseFilters(qs(''))
  assert.deepEqual(filters, { month: '', status: 'all', search: '', page: 1 })
})

check('filter valid dibaca apa adanya', () => {
  const filters = parseFilters(qs('month=2026-11&status=confirmed&q=rani&page=3'))
  assert.equal(filters.month, '2026-11')
  assert.equal(filters.status, 'confirmed')
  assert.equal(filters.search, 'rani')
  assert.equal(filters.page, 3)
})

check('bulan berformat salah diabaikan', () => {
  assert.equal(parseFilters(qs('month=2026')).month, '')
  assert.equal(parseFilters(qs('month=11-2026')).month, '')
  assert.equal(parseFilters(qs('month=2026-13')).month, '')
})

check('status tak dikenal jatuh ke all', () => {
  assert.equal(parseFilters(qs('status=selesai')).status, 'all')
  assert.equal(parseFilters(qs('status=cancelled')).status, 'cancelled')
})

check('page negatif / bukan angka menjadi 1', () => {
  assert.equal(parseFilters(qs('page=-2')).page, 1)
  assert.equal(parseFilters(qs('page=abc')).page, 1)
})

check('kata kunci panjang dipotong 100 karakter', () => {
  const long = 'a'.repeat(150)
  assert.equal(parseFilters(qs(`q=${long}`)).search.length, 100)
})

check('nilai default tidak ditulis ke query', () => {
  assert.equal(buildFilterQuery({ month: '', status: 'all', search: '' }), '')
  assert.equal(buildFilterQuery({ month: '', status: 'all', search: '' }, 1), '')
})

check('filter aktif ditulis sesuai nama parameter API', () => {
  const query = buildFilterQuery({ month: '2026-11', status: 'tentative', search: 'sinta' }, 2)
  const params = qs(query)
  assert.equal(params.get('month'), '2026-11')
  assert.equal(params.get('status'), 'tentative')
  assert.equal(params.get('q'), 'sinta')
  assert.equal(params.get('page'), '2')
})

check('spasi di kata kunci dipangkas sebelum ditulis', () => {
  assert.equal(buildFilterQuery({ month: '', status: 'all', search: '  rani  ' }), 'q=rani')
})

check('round-trip parse(build(x)) mengembalikan nilai semula', () => {
  const filters = { month: '2026-12', status: 'confirmed' as const, search: 'nadia' }
  const roundTripped = parseFilters(qs(buildFilterQuery(filters, 2)))
  assert.deepEqual(roundTripped, { ...filters, page: 2 })
})

check('hasActiveFilters membedakan default vs terisi', () => {
  assert.equal(hasActiveFilters({ month: '', status: 'all', search: '' }), false)
  assert.equal(hasActiveFilters({ month: '2026-11', status: 'all', search: '' }), true)
  assert.equal(hasActiveFilters({ month: '', status: 'completed', search: '' }), true)
  assert.equal(hasActiveFilters({ month: '', status: 'all', search: 'rani' }), true)
})

check('parameter lain di URL tidak hilang saat filter ditulis', () => {
  const query = buildFilterQuery({ month: '2026-11', status: 'all', search: '' }, 1, qs('tab=kalender'))
  assert.equal(qs(query).get('tab'), 'kalender')
  assert.equal(qs(query).get('month'), '2026-11')
})

console.log(`\n${passed} assertion group(s) passed`)
