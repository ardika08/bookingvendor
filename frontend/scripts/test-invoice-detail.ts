import assert from 'node:assert/strict'
import { ApiError } from '../src/lib/api/client.ts'
import { fetchBookingInvoices, fetchInvoice } from '../src/lib/api/invoices.ts'

/** Verifikasi data mock yang dipakai route dan halaman detail invoice. */

let passed = 0
async function check(name: string, fn: () => Promise<void>) {
  await fn()
  passed += 1
  console.log(`ok - ${name}`)
}

async function run() {
  const invoice = await fetchInvoice('inv-bk-1-dp')
  await check('detail invoice memuat data klien dan nominal mock', async () => {
    assert.equal(invoice.clientName, 'Rani & Bagas')
    assert.equal(invoice.amount, 6000000)
    assert.equal(invoice.bookingId, 'bk-1')
  })

  await check('detail menyediakan invoice lain untuk booking yang sama', async () => {
    const related = await fetchBookingInvoices(invoice.bookingId)
    assert.equal(related.length, 2)
    assert.ok(related.some((item) => item.id === invoice.id))
    assert.deepEqual(
      related.map((item) => item.issuedAt),
      [...related.map((item) => item.issuedAt)].sort(),
    )
  })

  await check('ID invoice tidak dikenal menghasilkan 404', async () => {
    await assert.rejects(fetchInvoice('missing-invoice'), (error: unknown) =>
      error instanceof ApiError && error.status === 404,
    )
  })

  console.log(`\n${passed} assertion group(s) passed`)
}

void run()
