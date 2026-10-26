import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { VendorStatusCard } from '../src/components/subscription/VendorStatusCard.tsx'
import type { SubscriptionSummary } from '../src/types/booking.ts'

function build(overrides: Partial<SubscriptionSummary> = {}): SubscriptionSummary {
  return {
    status: 'trial',
    trialBookingsUsed: 2,
    trialBookingsLimit: 2,
    trialInvoicesUsed: 1,
    trialInvoicesLimit: 2,
    endsAt: null,
    ...overrides,
  }
}

function render(subscription: SubscriptionSummary): string {
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(VendorStatusCard, { subscription })),
  )
}

function run() {
  const trial = render(build())
  if (!trial.includes('Jatah trial hampir habis') || !trial.includes('Berlangganan sekarang')) {
    throw new Error('Kartu trial harus memperingatkan jatah hampir habis dan memancing upgrade.')
  }
  if (!trial.includes('2/2') || !trial.includes('1/2')) {
    throw new Error('Kartu trial harus menampilkan hitungan kuota booking dan invoice.')
  }

  const active = render(build({ status: 'active', endsAt: '2030-01-15T00:00:00+07:00' }))
  if (!active.includes('Langganan aktif') || !active.includes('15 Jan 2030')) {
    throw new Error('Kartu aktif harus menampilkan label status dan tanggal berakhir.')
  }
  if (!active.includes('sisa') || !active.includes('hari')) {
    throw new Error('Kartu aktif harus menampilkan sisa hari.')
  }
  if (!active.includes('Kelola langganan')) {
    throw new Error('Kartu aktif harus punya CTA kelola langganan.')
  }

  const expired = render(build({ status: 'expired', endsAt: '2026-01-01' }))
  if (!expired.includes('Langganan berakhir') || !expired.includes('Perpanjang paket')) {
    throw new Error('Kartu kedaluwarsa harus menampilkan status berakhir dan CTA perpanjang.')
  }
  if (!expired.includes('terkunci')) {
    throw new Error('Kartu kedaluwarsa harus menjelaskan akses tulis terkunci.')
  }

  console.log('ok - kartu status vendor menampilkan trial, aktif, dan berakhir dengan CTA yang tepat')
}

void run()
