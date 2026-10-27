import { Sparkles } from '@/components/ui/icons'
import { ButtonLink } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import type { SubscriptionSummary } from '@/types/booking'

/**
 * Kartu sisa kuota masa trial (PRD: 2 booking + 2 invoice, sekali pakai).
 *
 * Menampilkan dua bar progres — booking dan invoice — dengan penekanan naik
 * saat jatah tinggal satu dan jadi merah saat habis. Hanya untuk vendor trial:
 * di luar status itu komponen tidak merender apa-apa, jadi pemanggil bisa
 * memasangnya tanpa syarat.
 */
export function TrialQuotaCard({ subscription }: { subscription: SubscriptionSummary }) {
  if (subscription.status !== 'trial') return null

  const items = [
    {
      label: 'Booking',
      used: subscription.trialBookingsUsed,
      limit: subscription.trialBookingsLimit,
    },
    {
      label: 'Invoice',
      used: subscription.trialInvoicesUsed,
      limit: subscription.trialInvoicesLimit,
    },
  ]

  const exhausted = items.every((item) => item.used >= item.limit)
  const urgent = items.some((item) => item.limit - item.used <= 1)

  return (
    <section
      className={cn(
        'rounded-xl border px-4 py-3.5',
        exhausted
          ? 'border-rose-200 bg-rose-50/70'
          : urgent
            ? 'border-amber-200 bg-amber-50/70'
            : 'border-ink-200/80 bg-white',
      )}
      aria-label="Sisa jatah masa trial"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p
            className={cn(
              'flex items-center gap-1.5 text-meta font-semibold',
              exhausted ? 'text-rose-700' : urgent ? 'text-amber-800' : 'text-ink-800',
            )}
          >
            <Sparkles className="size-3.5 shrink-0" />
            {exhausted ? 'Jatah trial habis' : 'Sisa jatah masa trial'}
          </p>
          <div className="mt-2 space-y-2">
            {items.map((item) => (
              <QuotaRow key={item.label} {...item} />
            ))}
          </div>
        </div>

        <ButtonLink
          to="/upgrade"
          size="sm"
          variant={exhausted ? 'primary' : 'secondary'}
          className="shrink-0"
        >
          {exhausted ? 'Berlangganan sekarang' : 'Lihat paket'}
        </ButtonLink>
      </div>
    </section>
  )
}

/** Satu baris kuota: label, progres bar, dan hitungan terpakai. */
function QuotaRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  const left = Math.max(limit - used, 0)
  const percent = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0
  const exhausted = left === 0

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-meta">
        <span className="text-ink-600">{label}</span>
        <span className={cn('tabular-nums font-medium', exhausted ? 'text-rose-700' : 'text-ink-800')}>
          {left > 0 ? `sisa ${left}` : 'habis'}
          <span className="font-normal text-ink-400"> · {used}/{limit} terpakai</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className={cn('h-full rounded-full', exhausted ? 'bg-rose-500' : 'bg-brand-500')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
