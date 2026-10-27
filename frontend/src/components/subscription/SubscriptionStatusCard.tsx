import { CalendarClock, Hourglass } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { SubscriptionState } from '@/types/subscription'

/**
 * Ringkasan langganan untuk halaman /upgrade: kartu status dengan sisa jatah
 * trial, tanggal berakhir, dan masa tenggang.
 *
 * Empat status (PRD):
 * - `trial` → sisa jatah sekali pakai, peringatan mendekati batas.
 * - `active` → masa aktif + tanggal berakhir.
 * - `grace` → kedaluwarsa tapi masih dalam masa tenggang, boleh dibaca saja.
 * - `expired` → akses tulis terkunci, tinggal perpanjang.
 */
export function SubscriptionStatusCard({ subscription }: { subscription: SubscriptionState }) {
  const { status } = subscription

  if (status === 'trial') {
    const bookingLeft = Math.max(subscription.trialBookingsLimit - subscription.trialBookingsUsed, 0)
    const invoiceLeft = Math.max(subscription.trialInvoicesLimit - subscription.trialInvoicesUsed, 0)
    const nearlyUsed = bookingLeft === 0 || invoiceLeft === 0

    return (
      <div
        className={cn(
          'rounded-xl border px-4 py-3.5',
          nearlyUsed ? 'border-rose-200 bg-rose-50/70' : 'border-amber-200 bg-amber-50/70',
        )}
      >
        <div className="flex items-start gap-2.5">
          <Hourglass
            className={cn(
              'mt-0.5 size-4 shrink-0',
              nearlyUsed ? 'text-rose-600' : 'text-amber-600',
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold text-ink-900">Masa trial</p>
            <p className="mt-0.5 text-meta text-ink-600">
              {nearlyUsed
                ? 'Jatah hampir habis — submit berikutnya akan ditolak bila melebihi batas.'
                : 'Kuota sekali pakai, tidak direset per bulan.'}
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <QuotaBar label="Booking" used={subscription.trialBookingsUsed} limit={subscription.trialBookingsLimit} />
              <QuotaBar label="Invoice" used={subscription.trialInvoicesUsed} limit={subscription.trialInvoicesLimit} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'active') {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3.5">
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <div>
          <p className="text-body font-semibold text-ink-900">Langganan aktif</p>
          <p className="mt-0.5 text-meta text-ink-600">
            Booking &amp; invoice tanpa batas sampai{' '}
            <span className="font-medium text-ink-800">{formatDateId(subscription.endsAt)}</span>.
            Perpanjangan menambah durasi dari tanggal berakhir, bukan dari hari pembelian.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'grace') {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3.5">
        <Hourglass className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div>
          <p className="text-body font-semibold text-ink-900">Masa tenggang</p>
          <p className="mt-0.5 text-meta text-ink-600">
            Langganan berakhir {formatDateId(subscription.endsAt)}. Data masih bisa dibuka sampai{' '}
            <span className="font-medium text-ink-800">{formatDateId(subscription.graceEndsAt)}</span>{' '}
            — perpanjang supaya tidak kehilangan akses tulis.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3.5">
      <CalendarClock className="mt-0.5 size-4 shrink-0 text-rose-600" />
      <div>
        <p className="text-body font-semibold text-ink-900">Langganan berakhir</p>
        <p className="mt-0.5 text-meta text-ink-600">
          Berakhir {formatDateId(subscription.endsAt)} — booking &amp; invoice baru terkunci.
          Data lama tetap bisa dibaca.
        </p>
      </div>
    </div>
  )
}

function QuotaBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const left = Math.max(limit - used, 0)
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  const danger = left === 0

  return (
    <div className="rounded-lg bg-white/70 px-2.5 py-2 ring-1 ring-inset ring-black/5">
      <p className="flex items-baseline justify-between text-caption font-medium text-ink-600">
        {label}
        <span className={cn('tabular-nums', danger ? 'text-rose-600' : 'text-ink-800')}>
          {left} / {limit} sisa
        </span>
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className={cn('h-full rounded-full transition-all', danger ? 'bg-rose-500' : 'bg-amber-400')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/** Format tanggal singkat untuk kalimat status (13 Nov 2026). */
function formatDateId(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(y, (m ?? 1) - 1, d ?? 1))
}
