import { ArrowRight, CalendarClock, Lock, Sparkles } from '@/components/ui/icons'
import type { ReactNode } from 'react'
import { ButtonLink } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { formatShortDate, toDate, toIsoDate } from '@/lib/format'
import type { SubscriptionSummary } from '@/types/booking'

/**
 * Kartu status akses vendor di dashboard (`/dashboard`).
 *
 * Satu kartu yang merangkum status langganan langsung dari
 * `SubscriptionSummary` (ringkasan yang disediakan `CurrentUser.subscription`),
 * sesuai PRD fase status: label yang mudah dibaca, kuota trial saat masih trial,
 * tanggal berakhir + sisa hari untuk aktif, dan peringatan saat kedaluwarsa.
 * Tiap kondisi punya CTA ke halaman `/upgrade`.
 */
export function VendorStatusCard({ subscription }: { subscription: SubscriptionSummary }) {
  const { status } = subscription

  if (status === 'active') {
    const { endsAt } = subscription
    const daysLeft = endsAt ? daysUntil(endsAt) : null

    return (
      <section
        aria-label="Status langganan aktif"
        className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5"
      >
        <CardHeader
          icon={<CalendarClock className="size-5 text-emerald-600" />}
          label="Langganan aktif"
          tone="emerald"
        />
        <p className="mt-2 max-w-2xl text-meta leading-relaxed text-emerald-900">
          Booking &amp; invoice tanpa batas
          {daysLeft !== null ? (
            <>
              , sisa <span className="font-semibold">{daysLeft}</span> hari
            </>
          ) : null}
          {endsAt ? (
            <>
              {' '}sampai <span className="font-semibold">{formatShortDate(endsAt.slice(0, 10))}</span>.
            </>
          ) : (
            '.'
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ButtonLink to="/bookings/new" size="sm" className="shrink-0">
            Booking baru
          </ButtonLink>
          <ButtonLink to="/upgrade" size="sm" variant="secondary" className="shrink-0">
            Kelola langganan
          </ButtonLink>
        </div>
      </section>
    )
  }

  if (status === 'expired') {
    return (
      <section
        aria-label="Status langganan berakhir"
        className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 sm:p-5"
      >
        <CardHeader
          icon={<Lock className="size-5 text-rose-600" />}
          label="Langganan berakhir"
          tone="rose"
        />
        <p className="mt-2 max-w-2xl text-meta leading-relaxed text-rose-900">
          {subscription.endsAt ? (
            <>
              Masa aktif habis sejak{' '}
              <span className="font-semibold">{formatShortDate(subscription.endsAt.slice(0, 10))}</span>.
            </>
          ) : (
            'Masa aktif telah berakhir.'
          )}{' '}
          Data lama tetap bisa dibaca, tetapi booking &amp; invoice baru terkunci sampai langganan
          diperpanjang.
        </p>
        <div className="mt-3">
          <ButtonLink to="/upgrade" size="sm" className="shrink-0">
            Perpanjang paket <ArrowRight className="size-3.5" />
          </ButtonLink>
        </div>
      </section>
    )
  }

  // status === 'trial'
  const bookingLeft = Math.max(subscription.trialBookingsLimit - subscription.trialBookingsUsed, 0)
  const invoiceLeft = Math.max(subscription.trialInvoicesLimit - subscription.trialInvoicesUsed, 0)
  const nearlyUsed = bookingLeft === 0 || invoiceLeft === 0

  return (
    <section
      aria-label="Status masa trial"
      className={cn(
        'rounded-xl border p-4 sm:p-5',
        nearlyUsed ? 'border-rose-200 bg-rose-50/70' : 'border-amber-200 bg-amber-50/70',
      )}
    >
      <CardHeader
        icon={<Sparkles className={cn('size-5', nearlyUsed ? 'text-rose-600' : 'text-amber-600')} />}
        label={nearlyUsed ? 'Jatah trial hampir habis' : 'Masa trial'}
        tone={nearlyUsed ? 'rose' : 'amber'}
      />
      <p className="mt-2 max-w-2xl text-meta leading-relaxed text-ink-700">
        Kuota sekali pakai — {bookingLeft} booking &amp; {invoiceLeft} invoice tersisa. Jatah tidak
        direset per bulan; berlangganan untuk akses tanpa batas.
      </p>
      <div className="mt-3 grid max-w-md grid-cols-2 gap-2">
        <QuotaBar
          label="Booking"
          used={subscription.trialBookingsUsed}
          limit={subscription.trialBookingsLimit}
        />
        <QuotaBar
          label="Invoice"
          used={subscription.trialInvoicesUsed}
          limit={subscription.trialInvoicesLimit}
        />
      </div>
      <div className="mt-3">
        <ButtonLink to="/upgrade" size="sm" variant="primary" className="shrink-0">
          Berlangganan sekarang <ArrowRight className="size-3.5" />
        </ButtonLink>
      </div>
    </section>
  )
}

/** Judul status: ikon + label di baris pertama dengan warna sesuai kondisi. */
function CardHeader({ icon, label, tone }: { icon: ReactNode; label: string; tone: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <p
        className={cn(
          'text-body font-semibold',
          tone === 'emerald' && 'text-emerald-800',
          tone === 'rose' && 'text-rose-800',
          tone === 'amber' && 'text-amber-800',
        )}
      >
        {label}
      </p>
    </div>
  )
}

/** Satu bar kuota: label, hitungan sisa, dan progres bar. */
function QuotaBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const left = Math.max(limit - used, 0)
  const percent = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0
  const exhausted = left === 0

  return (
    <div className="rounded-lg bg-white/80 px-2.5 py-2 ring-1 ring-inset ring-black/5">
      <p className="flex items-baseline justify-between gap-2 text-caption font-medium text-ink-600">
        {label}
        <span className={cn('tabular-nums', exhausted ? 'text-rose-700' : 'text-ink-800')}>
          {left > 0 ? `sisa ${left}` : 'habis'}
          <span className="font-normal text-ink-400"> · {used}/{limit}</span>
        </span>
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className={cn('h-full rounded-full', exhausted ? 'bg-rose-500' : 'bg-amber-400')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

/** Selisih hari dari hari ini sampai `endsAt` (ISO date), dihitung per tanggal. */
function daysUntil(endsAt: string): number {
  const end = toDate(endsAt.slice(0, 10))
  const today = toDate(toIsoDate(new Date()))
  return Math.round((end.getTime() - today.getTime()) / 86_400_000)
}
