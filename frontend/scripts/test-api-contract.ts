import assert from 'node:assert/strict'
import { mapServerErrors, unmappedServerFields } from '../src/lib/api/field-errors.ts'
import { ApiError } from '../src/lib/api/client.ts'

/**
 * Uji kontrak API: pemetaan error validasi Laravel ke field form, dan penanda
 * error khusus (trial limit, jaringan, unauthorized).
 */

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`ok - ${name}`)
}

check('field bersarang client.name dipetakan ke clientName', () => {
  const result = mapServerErrors({ 'client.name': 'Nama wajib diisi.' })
  assert.equal(result.clientName, 'Nama wajib diisi.')
})

check('snake_case event_date dipetakan ke eventDate', () => {
  const result = mapServerErrors({ event_date: 'Tanggal sudah terisi.' })
  assert.equal(result.eventDate, 'Tanggal sudah terisi.')
})

check('total_price & package_id ikut dipetakan', () => {
  const result = mapServerErrors({ total_price: 'Harus angka.', package_id: 'Paket tidak valid.' })
  assert.equal(result.totalPrice, 'Harus angka.')
  assert.equal(result.packageId, 'Paket tidak valid.')
})

check('beberapa error sekaligus dipetakan semua', () => {
  const result = mapServerErrors({
    'client.phone': 'Format salah.',
    'client.email': 'Email tidak valid.',
    event_time: 'Jam tidak valid.',
  })
  assert.deepEqual(Object.keys(result).sort(), ['clientEmail', 'clientPhone', 'eventTime'])
})

check('field tak dikenal tidak masuk ke form', () => {
  const result = mapServerErrors({ something_else: 'x' })
  assert.deepEqual(result, {})
  assert.deepEqual(unmappedServerFields({ something_else: 'x' }), ['something_else'])
})

check('ApiError 422 trial_limit_reached ditandai isTrialLimit', () => {
  const error = new ApiError('Jatah trial habis', { status: 422, code: 'trial_limit_reached' })
  assert.equal(error.isTrialLimit, true)
  assert.equal(error.isUnauthorized, false)
})

check('422 validasi biasa bukan trial limit', () => {
  const error = new ApiError('Validasi gagal', {
    status: 422,
    fieldErrors: { event_date: 'sudah terisi' },
  })
  assert.equal(error.isTrialLimit, false)
  assert.equal(error.fieldErrors.event_date, 'sudah terisi')
})

check('401 / 419 dikenali sebagai sesi berakhir', () => {
  assert.equal(new ApiError('x', { status: 401 }).isUnauthorized, true)
  assert.equal(new ApiError('x', { status: 419 }).isUnauthorized, true)
})

check('error jaringan (status 0) bukan trial/unauthorized', () => {
  const error = new ApiError('Tidak dapat menghubungi server.', { status: 0 })
  assert.equal(error.isTrialLimit, false)
  assert.equal(error.isUnauthorized, false)
  assert.equal(error.status, 0)
})

console.log(`\n${passed} assertion group(s) passed`)
