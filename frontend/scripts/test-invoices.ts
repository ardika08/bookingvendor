import assert from 'node:assert/strict'
import { isOverdue, paidPercent, remainingAmount } from '../src/lib/invoice-status.ts'
import { buildInvoiceFilterQuery, hasActiveInvoiceFilters, parseInvoiceFilters } from '../src/lib/invoice-query.ts'
import { summarizeInvoices } from '../src/lib/api/invoices.ts'
import type { Invoice } from '../src/types/invoice.ts'

/**
 * Uji logika daftar invoice: deteksi jatuh tempo, progress pembayaran, dan
 * sinkronisasi filter ke query string. TSX me-resolve alias `@/` lewat
 * tsconfig, jadi modul aplikasi boleh diimpor langsung.
 */

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`ok - ${name}`)
}

const TODAY = new Date(2026, 9, 23) // 23 Okt 2026

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-1',
    number: 'INV/2026/10/0001',
    bookingId: 'bk-1',
    clientName: 'Rani & Bagas',
    clientPhone: '0812-3456-7890',
    packageName: 'Paket Gold',
    type: 'dp',
    status: 'unpaid',
    issuedAt: '2026-10-01',
    dueAt: '2026-10-10',
    bookingTotal: 15000000,
    amount: 6000000,
    paidAmount: 0,
    eventDate: '2026-11-14',
    ...overrides,
  }
}

check('remainingAmount = amount - paid, tidak negatif', () => {
  assert.equal(remainingAmount({ amount: 6000000, paidAmount: 2000000 }), 4000000)
  assert.equal(remainingAmount({ amount: 6000000, paidAmount: 7000000 }), 0)
})

check('paidPercent membulatkan ke bilangan bulat dan dibatasi 100', () => {
  assert.equal(paidPercent({ amount: 6000000, paidAmount: 2000000 }), 33)
  assert.equal(paidPercent({ amount: 6000000, paidAmount: 6000000 }), 100)
  assert.equal(paidPercent({ amount: 0, paidAmount: 0 }), 0)
})

check('invoice unpaid yang lewat dueAt dianggap terlambat', () => {
  assert.equal(isOverdue(invoice({ dueAt: '2026-10-10' }), TODAY), true)
})

check('jatuh tempo hari ini belum dihitung terlambat', () => {
  assert.equal(isOverdue(invoice({ dueAt: '2026-10-23' }), TODAY), false)
})

check('invoice lunas / batal tidak pernah terlambat', () => {
  assert.equal(isOverdue(invoice({ status: 'paid', dueAt: '2026-09-01' }), TODAY), false)
  assert.equal(isOverdue(invoice({ status: 'void', dueAt: '2026-09-01' }), TODAY), false)
})

check('summarizeInvoices menjumlahkan billed/paid dan mengabaikan void', () => {
  const summary = summarizeInvoices(
    [
      invoice({ id: 'a', amount: 6000000, paidAmount: 6000000, status: 'paid' }),
      invoice({ id: 'b', amount: 9000000, paidAmount: 3000000, status: 'partial' }),
      invoice({ id: 'c', amount: 3000000, paidAmount: 0, status: 'void' }),
    ],
    TODAY,
  )
  assert.equal(summary.billed, 15000000)
  assert.equal(summary.paid, 9000000)
  assert.equal(summary.outstanding, 6000000)
})

check('summarizeInvoices menghitung overdueCount dari invoice collectible', () => {
  const summary = summarizeInvoices(
    [
      invoice({ id: 'a', dueAt: '2026-10-01', status: 'unpaid' }),
      invoice({ id: 'b', dueAt: '2026-10-20', status: 'partial', paidAmount: 1000000 }),
      invoice({ id: 'c', dueAt: '2026-12-01', status: 'unpaid' }),
    ],
    TODAY,
  )
  assert.equal(summary.overdueCount, 2)
})

check('parseInvoiceFilters menolak status/type yang tidak dikenal', () => {
  const parsed = parseInvoiceFilters(
    new URLSearchParams('status=hacked&type=bogus&q=rani&page=3'),
  )
  assert.equal(parsed.status, 'all')
  assert.equal(parsed.type, 'all')
  assert.equal(parsed.search, 'rani')
  assert.equal(parsed.page, 3)
})

check('parseInvoiceFilters menerima nilai sah', () => {
  const parsed = parseInvoiceFilters(new URLSearchParams('status=partial&type=pelunasan'))
  assert.equal(parsed.status, 'partial')
  assert.equal(parsed.type, 'pelunasan')
  assert.equal(parsed.page, 1)
})

check('buildInvoiceFilterQuery membuang nilai default', () => {
  assert.equal(buildInvoiceFilterQuery({ status: 'all', type: 'all', search: '  ' }), '')
})

check('buildInvoiceFilterQuery menulis filter aktif + page > 1', () => {
  const query = buildInvoiceFilterQuery({ status: 'unpaid', type: 'dp', search: ' rani ' }, 2)
  const params = new URLSearchParams(query)
  assert.equal(params.get('status'), 'unpaid')
  assert.equal(params.get('type'), 'dp')
  assert.equal(params.get('q'), 'rani')
  assert.equal(params.get('page'), '2')
})

check('hasActiveInvoiceFilters mendeteksi filter', () => {
  assert.equal(hasActiveInvoiceFilters({ status: 'all', type: 'all', search: '' }), false)
  assert.equal(hasActiveInvoiceFilters({ status: 'paid', type: 'all', search: '' }), true)
})

console.log(`\n${passed} pemeriksaan lulus`)
