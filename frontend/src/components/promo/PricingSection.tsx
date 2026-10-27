import { Check } from 'lucide-react'
import { GoogleSignInCta } from '@/components/promo/GoogleSignInCta'
import { formatCurrency } from '@/lib/format'
import { mockPlans } from '@/lib/mock/subscription'
import { cn } from '@/lib/cn'
import type { Plan } from '@/types/subscription'

/**
 * Section harga di halaman promosi (`#harga`).
 *
 * Menampilkan katalog paket langganan beserta statusnya. Harga `null` berarti
 * belum ditetapkan admin — kartu menampilkan "Segera" dan tombol beli mati.
 * Sumber data masih mock (`lib/mock/subscription`) sampai endpoint publik
 * `/api/plans` dipakai di fase backend.
 *
 * Semua paket membuka booking & invoice tanpa batas; kuota hanya berlaku
 * selama masa trial.
 */
export function PricingSection() {
  return (
    <section id="harga" className="scroll-mt-20 border-t border-ink-200/70 bg-ink-50/60">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-caption font-semibold uppercase tracking-wider text-brand-700">
            Harga
          </p>
          <h2 className="mt-2 text-heading tracking-tight text-ink-900 sm:text-display">
            Satu paket, semua fitur terbuka
          </h2>
          <p className="mt-3 text-body leading-relaxed text-ink-500">
            Mulai gratis dengan 2 booking + 2 invoice. Naik paket kapan saja saat operasional
            bertambah — tanpa biaya tersembunyi.
          </p>
        </div>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mockPlans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} />
          ))}
        </ul>

        <p className="mt-6 text-center text-caption text-ink-400">
          Semua paket berbayar membuka booking &amp; invoice tanpa batas selama masa aktif.
        </p>
      </div>
    </section>
  )
}

function PricingCard({ plan }: { plan: Plan }) {
  const price = plan.price
  const available = price !== null

  return (
    <li
      className={cn(
        'relative flex flex-col rounded-xl border bg-white p-5',
        plan.highlight ? 'border-brand-300 ring-1 ring-brand-200' : 'border-ink-200/80',
      )}
    >
      {plan.highlight ? (
        <span className="absolute -top-2.5 left-5 rounded-full bg-brand-600 px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wide text-white">
          Populer
        </span>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lead font-semibold text-ink-900">{plan.name}</h3>
          <p className="mt-0.5 text-meta text-ink-500">Aktif {plan.durationMonths} bulan</p>
        </div>
        {available ? null : (
          <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-2xs font-medium text-ink-500">
            Segera
          </span>
        )}
      </div>

      <p
        className={cn(
          'mt-3 text-heading font-semibold tabular-nums',
          available ? 'text-ink-900' : 'text-ink-400',
        )}
      >
        {available ? formatCurrency(price) : 'Segera'}
      </p>
      <p className="mt-0.5 text-caption text-ink-400">
        {available ? 'per paket, sekali bayar' : 'Harga belum ditetapkan'}
      </p>

      <ul className="mt-4 space-y-2">
        {plan.benefits.map((benefit) => (
          <li key={benefit} className="flex items-start gap-2 text-meta text-ink-600">
            <Check className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-5">
        {available ? (
          <GoogleSignInCta
            label="Mulai dengan Google"
            size="md"
            block
            variant={plan.highlight ? 'primary' : 'secondary'}
          />
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center rounded-lg bg-ink-100 text-body font-medium text-ink-400"
          >
            Belum tersedia
          </button>
        )}
      </div>
    </li>
  )
}
