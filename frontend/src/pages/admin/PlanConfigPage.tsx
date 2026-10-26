import { CreditCard, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field, inputClass } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { parsePlanPriceInput, type AdminPlan } from '@/lib/admin-plans'
import { listMockAdminPlans, updateMockPlanPrice } from '@/lib/mock/admin'
import { formatCurrency } from '@/lib/format'
import { formatThousands } from '@/lib/vendor-packages'
import { cn } from '@/lib/cn'

/**
 * Konfigurasi harga paket langganan (`/admin/plans`).
 *
 * Tiga paket sesuai PRD: Bulanan (harga pasti), 3 Bulan, Tahunan. Harga
 * 3 Bulan & Tahunan disimpan sebagai konfigurasi — `null` berarti "Segera" dan
 * tidak bisa dibeli vendor. Kuota TIDAK diatur di sini: batas hanya milik masa
 * trial (2 booking + 2 invoice) dan konstan aplikasi.
 *
 * Fase frontend: simpan lewat `updateMockPlanPrice`; begitu API admin
 * tersedia, ganti dengan `PUT /api/admin/plans/{id}` tanpa mengubah halaman.
 */
export function PlanConfigPage() {
  const { notify } = useToast()
  const [plans, setPlans] = useState<AdminPlan[]>(() => listMockAdminPlans())
  const [editing, setEditing] = useState<AdminPlan | null>(null)

  function handleSaved(plan: AdminPlan) {
    setPlans((prev) => prev.map((item) => (item.id === plan.id ? plan : item)))
    notify(
      plan.price === null
        ? `Harga "${plan.name}" dikosongkan — tampil "Segera" di katalog.`
        : `Harga "${plan.name}" ditetapkan ${formatCurrency(plan.price)}.`,
      { tone: 'success' },
    )
    setEditing(null)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">Paket Langganan</h2>
        <p className="mt-0.5 text-[13px] text-ink-500">
          Harga paket untuk katalog upgrade vendor. Kosongkan harga → tampil "Segera".
        </p>
      </div>

      {plans.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CreditCard className="size-5" />}
            title="Belum ada paket"
            description="Paket langganan dibuat bersama seed backend."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onEdit={() => setEditing(plan)} />
          ))}
        </div>
      )}

      <PriceDialog
        plan={editing}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />
    </div>
  )
}

function PlanCard({ plan, onEdit }: { plan: AdminPlan; onEdit: () => void }) {
  const unpriced = plan.price === null

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border bg-white p-4',
        unpriced ? 'border-dashed border-ink-300 bg-ink-50/40' : 'border-ink-200/80',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-semibold text-ink-900">{plan.name}</h3>
          <p className="mt-0.5 text-[12px] text-ink-500">
            Masa aktif {plan.durationMonths} bulan
          </p>
        </div>
        {unpriced ? <Badge className="shrink-0 bg-ink-100 text-ink-500">Segera</Badge> : null}
      </div>

      <p
        className={cn(
          'mt-2 text-[17px] font-semibold tabular-nums',
          unpriced ? 'text-ink-400' : 'text-ink-900',
        )}
      >
        {priceLabelSafe(plan.price)}
      </p>

      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">
        {unpriced
          ? 'Harga belum ditetapkan — vendor melihat "Segera" dan tidak bisa membeli.'
          : 'Langganan aktif tanpa batas booking & invoice selama masa paket.'}
      </p>

      <div className="mt-auto pt-3">
        <Button size="sm" variant="secondary" onClick={onEdit}>
          Atur harga
        </Button>
      </div>
    </div>
  )
}

function priceLabelSafe(price: number | null): string {
  return price === null ? 'Segera' : formatCurrency(price)
}

/**
 * Dialog atur harga satu paket.
 *
 * Harga opsional: dikosongkan berarti "belum ditetapkan" (Segera). Ini
 * sesuai PRD — harga 3 Bulan & Tahunan belum diketahui saat rilis.
 */
function PriceDialog({
  plan,
  onClose,
  onSaved,
}: {
  plan: AdminPlan | null
  onClose: () => void
  onSaved: (plan: AdminPlan) => void
}) {
  const [priceInput, setPriceInput] = useState(() =>
    plan !== null && plan.price !== null ? formatThousands(plan.price) : '',
  )
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // Reset isian saat paket yang diedit berganti.
  const key = plan?.id ?? 'none'
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setPriceInput(plan !== null && plan.price !== null ? formatThousands(plan.price) : '')
    setError(null)
    setSubmitted(false)
  }

  const parsed = useMemo(() => parsePlanPriceInput(priceInput), [priceInput])
  const preview = typeof parsed === 'number' ? formatCurrency(parsed) : 'Segera'

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)

    if (parsed === 'invalid') {
      setError('Harga harus berupa angka lebih besar dari nol.')
      formRef.current?.querySelector<HTMLElement>('[data-field="price"]')?.focus()
      return
    }

    if (plan === null) return

    onSaved(updateMockPlanPrice(plan.id, parsed) ?? plan)
  }

  if (plan === null) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-price-title"
        className="relative w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start gap-2 border-b border-ink-100 px-5 py-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <CreditCard className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="plan-price-title" className="text-[15px] font-semibold text-ink-900">
              Atur harga — {plan.name}
            </h2>
            <p className="text-[12px] text-ink-500">Masa aktif {plan.durationMonths} bulan.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            aria-label="Tutup dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <div className="space-y-3 px-5 py-4">
            <Field
              id="planPrice"
              label="Harga paket"
              error={submitted && error ? error : undefined}
              hint="Kosongkan bila harga belum ditetapkan — katalog menampilkan Segera."
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-400">
                  Rp
                </span>
                <input
                  id="planPrice"
                  data-field="price"
                  value={priceInput}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/[^\d]/g, '')
                    setPriceInput(digits ? formatThousands(Number.parseInt(digits, 10)) : '')
                    if (error) setError(null)
                  }}
                  inputMode="numeric"
                  placeholder="0"
                  className={cn(inputClass(submitted && error !== null), 'pl-9 tabular-nums')}
                />
              </div>
            </Field>

            <div className="rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2 text-[12.5px]">
              <p className="text-ink-500">Katalog menampilkan</p>
              <p className="mt-0.5 font-semibold text-ink-900">{preview}</p>
            </div>

            {submitted && error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 border-t border-ink-100 px-5 py-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit">Simpan harga</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
