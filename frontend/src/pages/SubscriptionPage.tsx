import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Banknote,
  CalendarClock,
  Clock3,
  History,
  Lock,
  Package,
} from '@/components/ui/icons'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PaymentHistory } from '@/components/subscription/PaymentHistory'
import { PlanCard } from '@/components/subscription/PlanCard'
import { SubscriptionStatusCard } from '@/components/subscription/SubscriptionStatusCard'
import { cn } from '@/lib/cn'
import { formatCurrency, formatLongDate } from '@/lib/format'
import { fetchPayments, fetchPlans, fetchSubscription } from '@/lib/api/subscription'
import type { Payment, Plan, SubscriptionState } from '@/types/subscription'

/**
 * Halaman `/langganan` — pusat informasi langganan vendor.
 *
 * Sebelumnya status dan riwayat pembayaran menumpuk di bawah katalog paket
 * pada `/upgrade`, jadi vendor harus menggulir melewati tiga kartu harga
 * untuk menjawab pertanyaan sederhana: "kapan langganan saya berakhir?".
 *
 * Halaman ini memisahkan tiga kebutuhan itu menjadi tab:
 *   - Status   → masa aktif, sisa trial, tanggal berakhir
 *   - Riwayat  → semua transaksi, termasuk yang gagal/kedaluwarsa
 *   - Paket    → katalog untuk memperpanjang
 *
 * `/upgrade` tetap ada karena dipakai pengalihan dari aksi yang terkunci
 * (`RequireWriteAccess` → `/upgrade?from=expired`) dan tautan lama.
 */
const TABS = [
  { id: 'status', label: 'Status', icon: CalendarClock },
  { id: 'riwayat', label: 'Riwayat', icon: History },
  { id: 'paket', label: 'Paket', icon: Package },
] as const

type TabId = (typeof TABS)[number]['id']

export function SubscriptionPage() {
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<TabId>(() => {
    const requested = searchParams.get('tab')
    return TABS.some((item) => item.id === requested) ? (requested as TabId) : 'status'
  })

  const [plans, setPlans] = useState<Plan[]>([])
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    let active = true

    Promise.all([fetchPlans(), fetchSubscription(), fetchPayments()])
      .then(([planList, sub, paymentList]) => {
        if (!active) return
        setPlans(planList)
        setSubscription(sub)
        setPayments(paymentList)
      })
      .catch(() => {
        if (active) setError('Gagal memuat data langganan. Coba muat ulang halaman.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const pendingPayment = useMemo(
    () => payments.find((payment) => payment.status === 'pending') ?? null,
    [payments],
  )

  /** Transaksi yang benar-benar mengaktifkan langganan (bukan yang gagal). */
  const confirmedPayments = useMemo(
    () => payments.filter((payment) => payment.status === 'confirmed'),
    [payments],
  )

  const lastConfirmed = confirmedPayments[0] ?? null

  function onTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()

    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % TABS.length
        : (index - 1 + TABS.length) % TABS.length

    const nextId = TABS[next].id
    setTab(nextId)
    tabRefs.current[nextId]?.focus()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-xl bg-white" />
        <div className="h-48 animate-pulse rounded-xl bg-white" />
      </div>
    )
  }

  if (error !== null || !subscription) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3">
        <p className="text-meta text-rose-900">{error ?? 'Data langganan tidak tersedia.'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-title tracking-tight text-ink-900">Langganan</h1>
        <p className="mt-0.5 text-body text-ink-500">
          Masa aktif, riwayat pembayaran, dan paket yang tersedia untuk akun ini.
        </p>
      </div>

      {/* Ringkasan singkat — selalu terlihat di semua tab. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          label="Status"
          value={SUBSCRIPTION_LABEL[subscription.status]}
          tone={subscription.status === 'active' ? 'emerald' : subscription.status === 'trial' ? 'amber' : 'rose'}
        />
        <SummaryTile
          label="Aktif sampai"
          value={subscription.endsAt ? formatLongDate(subscription.endsAt.slice(0, 10)) : 'Belum ada'}
        />
        <SummaryTile
          label="Terakhir dibayar"
          value={lastConfirmed ? formatCurrency(lastConfirmed.amount) : '—'}
          hint={lastConfirmed ? formatLongDate(lastConfirmed.createdAt.slice(0, 10)) : undefined}
        />
      </div>

      {pendingPayment ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-meta text-amber-900">
            <span className="font-semibold">Ada transaksi menunggu pembayaran</span> —{' '}
            {pendingPayment.planName} · {formatCurrency(pendingPayment.amount)}. Selesaikan sebelum
            batas waktu supaya tidak perlu membuat ulang.
          </p>
          <ButtonLink
            to={`/upgrade/checkout/${pendingPayment.id}`}
            size="sm"
            variant="secondary"
            className="shrink-0"
          >
            Lanjutkan pembayaran
          </ButtonLink>
        </div>
      ) : null}

      {/* Tablist manual: panah kiri/kanan, satu tab fokusable. */}
      <div
        role="tablist"
        aria-label="Bagian langganan"
        className="flex flex-wrap gap-1 rounded-xl border border-ink-200/80 bg-white p-1 sm:flex-nowrap"
      >
        {TABS.map((item, index) => {
          const Icon = item.icon
          const selected = tab === item.id

          return (
            <button
              key={item.id}
              ref={(element) => {
                tabRefs.current[item.id] = element
              }}
              role="tab"
              type="button"
              id={`tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-body font-medium transition-colors',
                selected
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800',
              )}
            >
              <Icon className="size-4" />
              {item.label}
              {item.id === 'riwayat' && payments.length > 0 ? (
                <span className="ml-0.5 rounded-full bg-ink-100 px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-ink-600">
                  {payments.length}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/*
        Ketiga panel selalu dirender; yang tidak aktif diberi `hidden` supaya
        `aria-controls` menunjuk elemen yang benar-benar ada dan pembaca layar
        tidak membacakan isi tab yang tidak dipilih.
      */}
      <div role="tabpanel" id="panel-status" aria-labelledby="tab-status" hidden={tab !== 'status'}>
        <div className="space-y-4">
          <SubscriptionStatusCard subscription={subscription} />

          <Card>
            <CardHeader
              title="Cara memperpanjang"
              description="Pembayaran lewat gateway — langganan aktif otomatis setelah terverifikasi."
            />
            <CardBody>
              <ol className="list-inside list-decimal space-y-1.5 text-meta leading-relaxed text-ink-600">
                <li>Buka tab Paket, lalu pilih paket yang diinginkan.</li>
                <li>Pilih metode pembayaran (QRIS), lalu selesaikan pembayaran.</li>
                <li>
                  Masa aktif bertambah otomatis. Kalau status belum berubah, tekan “Cek status
                  pembayaran” di halaman checkout.
                </li>
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>

      <div role="tabpanel" id="panel-riwayat" aria-labelledby="tab-riwayat" hidden={tab !== 'riwayat'}>
        <div className="space-y-4">
          {payments.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Banknote className="size-5" />}
                title="Belum ada transaksi"
                description="Transaksi muncul di sini setelah kamu memilih paket dan membuat pembayaran."
                action={
                  <ButtonLink to="/langganan?tab=paket" size="sm">
                    Lihat paket
                  </ButtonLink>
                }
              />
            </Card>
          ) : (
            <>
              {/*
                Ringkasan kecil: vendor sering datang ke sini untuk menjawab
                "total yang sudah saya bayar berapa?" — menjumlahkan sendiri
                dari daftar panjang itu melelahkan.
              */}
              <Card>
                <CardBody className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-caption text-ink-500">Total transaksi</p>
                    <p className="text-lead font-semibold tabular-nums text-ink-900">
                      {payments.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption text-ink-500">Pembayaran berhasil</p>
                    <p className="text-lead font-semibold tabular-nums text-emerald-700">
                      {confirmedPayments.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption text-ink-500">Total dibayar</p>
                    <p className="text-lead font-semibold tabular-nums text-ink-900">
                      {formatCurrency(
                        confirmedPayments.reduce((sum, payment) => sum + payment.amount, 0),
                      )}
                    </p>
                  </div>
                </CardBody>
              </Card>

              <PaymentHistory payments={payments} />
            </>
          )}
        </div>
      </div>

      <div role="tabpanel" id="panel-paket" aria-labelledby="tab-paket" hidden={tab !== 'paket'}>
        <div className="space-y-4">
          {subscription.status === 'expired' ? (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3"
            >
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                <Lock className="size-3.5" />
              </span>
              <p className="text-meta leading-relaxed text-rose-900">
                <span className="font-semibold">Langganan sudah berakhir.</span> Data lama tetap
                bisa dibaca dan diekspor. Pilih paket untuk membuka kembali pembuatan booking &amp;
                invoice.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                current={subscription.status === 'active' && plan.code === 'monthly'}
                action={
                  subscription.status === 'active' && plan.code === 'monthly' ? (
                    <span className="flex h-10 items-center justify-center rounded-lg bg-ink-100 text-body font-medium text-ink-500">
                      Paket kamu saat ini
                    </span>
                  ) : plan.price !== null ? (
                    /*
                     * Awalan `plan-` wajib: `CheckoutRoute` memakainya untuk
                     * membedakan titik masuk dari katalog dengan melanjutkan
                     * transaksi pending. Tanpa awalan, id paket dibaca sebagai
                     * id payment dan halaman checkout gagal memuat.
                     */
                    <ButtonLink to={`/upgrade/checkout/plan-${plan.id}`} className="w-full">
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
                  )
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const SUBSCRIPTION_LABEL: Record<SubscriptionState['status'], string> = {
  active: 'Aktif',
  trial: 'Masa uji',
  grace: 'Masa tenggang',
  expired: 'Berakhir',
}

function SummaryTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'emerald' | 'amber' | 'rose'
}) {
  return (
    <div className="rounded-xl border border-ink-200/80 bg-white px-4 py-3">
      <p className="text-caption text-ink-500">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-body font-semibold tabular-nums',
          tone === 'emerald'
            ? 'text-emerald-700'
            : tone === 'amber'
              ? 'text-amber-700'
              : tone === 'rose'
                ? 'text-rose-700'
                : 'text-ink-900',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-caption text-ink-400">{hint}</p> : null}
    </div>
  )
}
