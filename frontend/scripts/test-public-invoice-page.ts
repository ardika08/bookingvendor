
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { InvoiceShareLinkCard } from '../src/components/invoices/InvoiceShareLinkCard.tsx'
import { fetchPublicInvoice } from '../src/lib/api/public-invoices.ts'
import { PublicInvoicePage } from '../src/pages/PublicInvoicePage.tsx'

async function run() {
  const data = await fetchPublicInvoice('demo_public_7e9b4d3f2a1c8b6f0d2e4a6c')
  const markup = renderToStaticMarkup(createElement(PublicInvoicePage, { data }))
  const shareCard = renderToStaticMarkup(
    createElement(InvoiceShareLinkCard, { invoiceId: 'inv-bk-1-pelunasan' }),
  )

  const expectedContent = [
    'Rincian invoice',
    'Cara pembayaran',
    'Nomor invoice',
    'Tanggal acara',
    'Sisa tagihan',
    'Hubungi vendor via WhatsApp',
    'Rani &amp; Bagas',
    'Lumen Wedding Story',
  ]

  for (const text of expectedContent) {
    if (!markup.includes(text)) throw new Error(`Konten invoice publik tidak ditemukan: ${text}`)
  }
  if (!shareCard.includes('Buat link publik')) {
    throw new Error('Kontrol pembuatan link publik invoice tidak ditemukan.')
  }

  console.log('ok - detail publik dan kontrol berbagi invoice dirender')
}

void run()
