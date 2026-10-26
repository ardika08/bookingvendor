import assert from 'node:assert/strict'
import { ApiError } from '../src/lib/api/client.ts'
import {
  createPublicInvoiceLink,
  disablePublicInvoiceLink,
  fetchPublicInvoice,
  resetPublicInvoiceLink,
} from '../src/lib/api/public-invoices.ts'

async function run() {
  const data = await fetchPublicInvoice('demo_public_7e9b4d3f2a1c8b6f0d2e4a6c')
  assert.equal(data.invoice.clientName, 'Rani & Bagas')
  assert.equal(data.invoice.number.startsWith('INV/'), true)
  assert.ok(!('clientPhone' in data.invoice))
  assert.equal(data.vendor.businessName, 'Lumen Wedding Story')
  assert.deepEqual(Object.keys(data.vendor), ['businessName', 'contactPhone', 'bank'])

  await assert.rejects(
    fetchPublicInvoice('unknown-public-token'),
    (error: unknown) => error instanceof ApiError && error.status === 404,
  )

  assert.equal(
    await createPublicInvoiceLink('inv-bk-1-pelunasan', 'https://vendor.test'),
    'https://vendor.test/invoice/demo_public_7e9b4d3f2a1c8b6f0d2e4a6c',
  )
  const oldLink = await createPublicInvoiceLink('inv-bk-1-dp', 'https://vendor.test')
  assert.equal(oldLink, 'https://vendor.test/invoice/demo_public_inv-bk-1-dp')
  const resetLink = await resetPublicInvoiceLink('inv-bk-1-dp', 'https://vendor.test')
  assert.notEqual(resetLink, oldLink)
  await assert.rejects(
    fetchPublicInvoice(oldLink.split('/').pop() ?? ''),
    (error: unknown) => error instanceof ApiError && error.status === 404,
  )
  assert.equal(
    (await fetchPublicInvoice(resetLink.split('/').pop() ?? '')).invoice.clientName,
    'Rani & Bagas',
  )

  await disablePublicInvoiceLink('inv-bk-1-dp')
  await assert.rejects(
    fetchPublicInvoice(resetLink.split('/').pop() ?? ''),
    (error: unknown) => error instanceof ApiError && error.status === 404,
  )
  const reactivatedLink = await createPublicInvoiceLink('inv-bk-1-dp', 'https://vendor.test')
  assert.notEqual(reactivatedLink, resetLink)
  await assert.rejects(
    createPublicInvoiceLink('missing-invoice', 'https://vendor.test'),
    (error: unknown) => error instanceof ApiError && error.status === 404,
  )

  console.log('ok - link invoice dapat dibuat, direset, dan dinonaktifkan')
}

void run()
