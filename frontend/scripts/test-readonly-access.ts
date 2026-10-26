import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import {
  ReadOnlyActionHint,
  ReadOnlyBanner,
} from '../src/components/subscription/ReadOnlyBanner.tsx'
import { resolveAccess } from '../src/lib/subscription-access.ts'
import type { SubscriptionSummary } from '../src/types/booking.ts'

function build(overrides: Partial<SubscriptionSummary> = {}): SubscriptionSummary {
  return {
    status: 'trial',
    trialBookingsUsed: 1,
    trialBookingsLimit: 2,
    trialInvoicesUsed: 0,
    trialInvoicesLimit: 2,
    endsAt: null,
    ...overrides,
  }
}

function renderBanner(subscription: SubscriptionSummary): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(ReadOnlyBanner, { access: resolveAccess(subscription) }),
    ),
  )
}

function run() {
  // 1. Status langganan berakhir → banner tampil dan menjelaskan mode baca saja.
  const expired = build({ status: 'expired', endsAt: '2026-10-01T00:00:00+07:00' })
  const expiredMarkup = renderBanner(expired)
  if (!expiredMarkup.includes('mode baca saja')) {
    throw new Error('Banner kedaluwarsa harus menyebut mode baca saja.')
  }
  if (!expiredMarkup.includes('Data lama tetap bisa dibaca')) {
    throw new Error('Banner kedaluwarsa harus menegaskan data lama tetap terbaca.')
  }
  if (!expiredMarkup.includes('unduh PDF tetap berjalan normal')) {
    throw new Error('Banner kedaluwarsa harus menyebut ekspor PDF tetap bisa.')
  }
  if (!expiredMarkup.includes('Perpanjang paket')) {
    throw new Error('Banner kedaluwarsa harus punya CTA perpanjang paket.')
  }

  // 2. Trial & aktif → tidak ada banner (pembatasan trial ditangani server).
  for (const status of ['trial', 'active'] as const) {
    const markup = renderBanner(build({ status, endsAt: '2030-01-15T00:00:00+07:00' }))
    if (markup !== '') {
      throw new Error(`Banner tidak boleh tampil untuk status ${status}.`)
    }
  }

  // 3. resolveAccess: hanya expired yang mengunci aksi tulis.
  if (resolveAccess(build({ status: 'trial' })).readOnly) {
    throw new Error('Trial tidak boleh masuk mode baca saja.')
  }
  if (resolveAccess(build({ status: 'active' })).readOnly) {
    throw new Error('Langganan aktif tidak boleh masuk mode baca saja.')
  }
  const expiredAccess = resolveAccess(expired)
  if (!expiredAccess.readOnly || expiredAccess.reason !== 'expired') {
    throw new Error('Langganan berakhir harus menghasilkan access readOnly bertanda expired.')
  }

  // 4. Tombol pengganti tetap terlihat, terkunci, dan menjelaskan alasannya.
  const hint = renderToStaticMarkup(createElement(ReadOnlyActionHint, { label: 'Booking Baru' }))
  if (!hint.includes('Booking Baru') || !hint.includes('cursor-not-allowed')) {
    throw new Error('Penanda aksi terkunci harus menampilkan label dan status nonaktif.')
  }
  if (!hint.includes('terkunci sampai langganan diperpanjang')) {
    throw new Error('Penanda aksi terkunci harus menjelaskan alasan lewat title.')
  }

  console.log(
    'ok - mode baca saja muncul saat langganan berakhir, data lama tetap terbaca, dan aksi tulis direm',
  )
}

void run()
