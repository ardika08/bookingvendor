import { Check, Clock3, Crown } from '@/components/ui/icons'
import { ButtonLink } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { formatCurrency } from '@/lib/format'
import type { Plan } from '@/types/subscription'

/**
 * Rincian manfaat per paket di kartu.
 *
 * Tambahan: badge "Populer" + checklist manfaat dari `Plan.benefits`.
 * `price === null` tetap tampil "Segera" (tidak bisa dibeli).
 */
export function PlanCard({ plan, current }: { plan: Plan; current?: boolean }) {
  const available = plan.price !== null
  const durationDays = plan.durationMonths === 12 ? 365 : plan.durationMonths * 30

  return (
    <article
      className={cn(
        'relative flex flex-col rounded-xl border bg-white p-5',
        plan.highlight ? 'border-brand-300 ring-2 ring-brand-100' : 'border-ink-200/80',
      )}
    >
      {plan.highlight ? (
        <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-white">
          <Crown className="size-3" />
          Populer
        </span>
      ) : null}

      <header>
        <h3 className="text-lead font-semibold text-ink-900">{plan.name}</h3>
        <p className="text-meta text-ink-500">Aktif {durationDays} hari</p>
      </header>

      <p className="mt-3">
        {plan.price !== null ? (
          <>
            <span className="text-heading font-semibold tabular-nums text-ink-900">
              {formatCurrency(plan.price)}
            </span>
            <span className="text-meta text-ink-500"> / {plan.durationMonths} bulan</span>
          </>
        ) : (
          <span className="text-lead font-medium text-ink-400">Harga menyusul</span>
        )}
      </p>

      <ul className="mt-4 flex-1 space-y-2">
        {plan.benefits.map((benefit) => (
          <li key={benefit} className="flex items-start gap-2 text-meta text-ink-700">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            {benefit}
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {current ? (
          <span className="flex h-10 items-center justify-center rounded-lg bg-ink-100 text-body font-medium text-ink-500">
            Paket kamu saat ini
          </span>
        ) : available ? (
          <ButtonLink to={`/upgrade/checkout/${plan.id}`} className="w-full">
            Pilih {plan.name}
          </ButtonLink>
        ) : (
          <button
            type="button"
            disabled
            title="Harga paket ini belum ditetapkan"
            className="flex h-10 w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg bg-ink-50 text-body font-medium text-ink-400"
          >
            <Clock3 className="size-3.5" />
            Segera
          </button>
        )}
      </div>
    </article>
  )
}
