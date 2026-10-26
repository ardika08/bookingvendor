import assert from 'node:assert/strict'
import {
  fetchInvoice,
  fetchInvoicePayments,
  recordInvoicePayment,
} from '../src/lib/api/invoices.ts'
import { toIsoDate } from '../src/lib/format.ts'
import { toPaymentPayload, validatePaymentForm } from '../src/lib/payment-form.ts'
import { ApiError } from '../src/lib/api/client.ts'

/** Uji validasi form dan alur mock pencatatan pembayaran invoice. */

async function run() {
  const invoice = await fetchInvoice('inv-bk-1-pelunasan')
  assert.equal((await fetchInvoicePayments('inv-bk-1-dp')).length, 1)
  const values = {
    invoiceId: invoice.id,
    amount: '1.000.000',
    paidAt: toIsoDate(new Date()),
    method: 'transfer' as const,
    note: 'Transfer DP',
  }

  assert.deepEqual(validatePaymentForm(values, invoice), {})
  assert.ok(validatePaymentForm({ ...values, amount: '0' }, invoice).amount)
  assert.ok(validatePaymentForm({ ...values, amount: '10.000.000' }, invoice).amount)
  assert.ok(validatePaymentForm({ ...values, paidAt: '2999-01-01' }, invoice).paidAt)
  assert.deepEqual(toPaymentPayload({ ...values, note: '  ' }).note, null)

  await recordInvoicePayment(toPaymentPayload(values))
  const partiallyPaid = await fetchInvoice(invoice.id)
  assert.equal(partiallyPaid.status, 'partial')
  assert.equal(partiallyPaid.paidAmount, 1000000)
  const partialHistory = await fetchInvoicePayments(invoice.id)
  assert.equal(partialHistory.length, 1)
  assert.equal(partialHistory[0].amount, 1000000)
  assert.equal(partialHistory[0].method, 'transfer')
  assert.equal(partialHistory[0].note, 'Transfer DP')

  await recordInvoicePayment({
    ...toPaymentPayload(values),
    amount: partiallyPaid.amount - partiallyPaid.paidAmount,
  })
  const paid = await fetchInvoice(invoice.id)
  assert.equal(paid.status, 'paid')
  assert.equal(paid.paidAmount, paid.amount)
  const fullHistory = await fetchInvoicePayments(invoice.id)
  assert.equal(fullHistory.length, 2)
  assert.equal(fullHistory[0].amount + fullHistory[1].amount, paid.amount)

  await assert.rejects(
    recordInvoicePayment({ ...toPaymentPayload(values), amount: 1 }),
    (error: unknown) => error instanceof ApiError && error.status === 422,
  )

  console.log('ok - validasi, pembayaran parsial, pelunasan, dan batas sisa invoice')
}

void run()
