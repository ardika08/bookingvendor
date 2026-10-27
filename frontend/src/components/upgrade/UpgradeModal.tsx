import {
  ArrowRight,
  Check,
  CreditCard,
  Lock,
} from '@/components/ui/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { formatCurrency } from '@/lib/format'
import { mockPlans } from '@/lib/mock/subscription'

/**
 * Modal penawaran upgrade langganan.
 *
 * Muncul saat server menolak pembuatan booking/invoice ke-3 dengan kode
 * `trial_limit_reached`. Sesuai PRD: alasan ditampilkan, daftar paket terlihat,
 * dan **isian form tidak dihapus** — modal hanya menghalangi submit.
 *
 * Detail perilaku:
 * - Katalog diturunkan dari `mockPlans` sehingga harga & manfaat mengikuti
 *   konfigurasi admin (paket tanpa harga tampil "Segera" dan tidak bisa dipilih);
 * - Satu paket terpilih lewat radio; tombol bawah membawa paket itu ke halaman
 *   `/upgrade?plan=…` agar vendor tidak memilih ulang;
 * - Esc, klik backdrop, dan tombol tutup menutup modal; fokus dipindahkan ke
 *   dialog saat dibuka agar pengguna keyboard tidak "tersesat" di belakang.
 */

export interface UpgradePlan {
  id: string
  code: 'monthly' | 'quarterly' | 'yearly'
  name: string
  durationMonths: number
  /** null = harga belum ditetapkan admin (ditampilkan "Segera"). */
  price: number | null
  highlight?: boolean
  benefits?: string[]
}

/** Katalog bawaan: mengikuti mock paket langganan. */
export const DEFAULT_UPGRADE_PLANS: UpgradePlan[] = mockPlans.map((plan) => ({
  id: plan.id,
  code: plan.code,
  name: plan.name,
  durationMonths: plan.durationMonths,
  price: plan.price,
  highlight: plan.highlight,
  benefits: plan.benefits,
}))

/** Pemakaian trial saat ini — opsional, untuk menjelaskan kenapa diblokir. */
export interface TrialUsage {
  bookingsUsed?: number
  bookingsLimit?: number
  invoicesUsed?: number
  invoicesLimit?: number
}

export function UpgradeModal({
  open,
  onClose,
  plans = DEFAULT_UPGRADE_PLANS,
  resource = 'booking',
  trialUsage,
}: {
  open: boolean
  onClose: () => void
  plans?: UpgradePlan[]
  resource?: 'booking' | 'invoice'
  trialUsage?: TrialUsage
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectable = useMemo(() => plans.filter((plan) => plan.price !== null), [plans])
  const fallbackSelected = useMemo(
    () => selectable.find((plan) => plan.highlight)?.id ?? selectable[0]?.id ?? null,
    [selectable],
  )
  const selected = selectable.some((plan) => plan.id === selectedId) ? selectedId : fallbackSelected

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        aria-describedby="upgrade-description"
        tabIndex={-1}
        className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl outline-none sm:rounded-2xl"
      >
        <div className="border-b border-ink-100 bg-gradient-to-br from-brand-50 to-white px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <Lock className="size-4" />
            </span>
            <div>
              <h2 id="upgrade-title" className="text-lead font-semibold text-ink-900">
                Jatah trial habis
              </h2>
              <p className="text-meta text-ink-500">
                Booking &amp; invoice berikutnya butuh langganan aktif.
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          <p id="upgrade-description" className="text-body leading-relaxed text-ink-600">
            Kamu sudah memakai seluruh jatah trial. Isian {resource} yang sedang kamu buat
            <span className="font-medium text-ink-800"> tetap tersimpan di layar</span>. Pilih
            paket untuk melanjutkan — setelah pembayaran terverifikasi, akses tanpa batas
            langsung aktif.
          </p>

          {trialUsage ? (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-caption text-amber-900">
              {trialUsage.bookingsUsed !== undefined && trialUsage.bookingsLimit !== undefined ? (
                <p>
                  Booking: <span className="font-semibold">{trialUsage.bookingsUsed}</span>/
                  {trialUsage.bookingsLimit}
                </p>
              ) : null}
              {trialUsage.invoicesUsed !== undefined && trialUsage.invoicesLimit !== undefined ? (
                <p>
                  Invoice: <span className="font-semibold">{trialUsage.invoicesUsed}</span>/
                  {trialUsage.invoicesLimit}
                </p>
              ) : null}
            </div>
          ) : null}

          <fieldset className="mt-3">
            <legend className="sr-only">Pilih paket langganan</legend>
            <ul className="space-y-2">
              {plans.map((plan) => (
                <PlanOption
                  key={plan.id}
                  plan={plan}
                  checked={plan.id === selected}
                  onSelect={() => setSelectedId(plan.id)}
                />
              ))}
            </ul>
          </fieldset>

          <p className="mt-3 flex items-start gap-1.5 text-caption leading-relaxed text-ink-500">
            <CreditCard className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
            Pembayaran lewat payment gateway. Jatah trial tidak direset — langganan berlaku
            sampai masa paket berakhir.
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-ink-100 px-5 py-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Nanti saja
          </Button>
          <ButtonLink
            to={selected ? `/upgrade?plan=${encodeURIComponent(selected)}` : '/upgrade'}
            onClick={onClose}
          >
            Lihat &amp; bayar paket <ArrowRight className="size-3.5" />
          </ButtonLink>
        </div>
      </div>
    </div>
  )
}

function PlanOption({
  plan,
  checked,
  onSelect,
}: {
  plan: UpgradePlan
  checked: boolean
  onSelect: () => void
}) {
  const available = plan.price !== null

  return (
    <li>
      <label
        className={cn(
          'flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors',
          checked
            ? 'border-brand-300 bg-brand-50/60'
            : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50',
          !available && 'cursor-not-allowed opacity-70 hover:border-ink-200 hover:bg-transparent',
        )}
      >
        <input
          type="radio"
          name="upgrade-plan"
          className="mt-0.5 size-3.5 shrink-0 accent-brand-600"
          checked={checked}
          disabled={!available}
          onChange={onSelect}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-body font-medium text-ink-900">{plan.name}</span>
            {plan.highlight ? (
              <span className="rounded bg-brand-400 px-1.5 py-0.5 text-2xs font-semibold uppercase text-ink-900">
                Populer
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-caption text-ink-500">
            {plan.durationMonths} bulan · booking &amp; invoice tanpa batas
          </span>
          {plan.benefits && plan.benefits.length > 0 ? (
            <span className="mt-1.5 flex flex-col gap-0.5">
              {plan.benefits.slice(0, 3).map((benefit) => (
                <span key={benefit} className="flex items-start gap-1 text-caption text-ink-500">
                  <Check className="mt-0.5 size-3 shrink-0 text-brand-700" aria-hidden />
                  {benefit}
                </span>
              ))}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-right">
          {available ? (
            <span className="text-body font-semibold tabular-nums text-ink-900">
              {formatCurrency(plan.price as number)}
            </span>
          ) : (
            <span className="text-meta font-medium text-ink-400">Segera</span>
          )}
        </span>
      </label>
    </li>
  )
}
