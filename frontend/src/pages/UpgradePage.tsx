import { Lock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PlanCard } from '@/components/subscription/PlanCard'
import { PaymentHistory } from '@/components/subscription/PaymentHistory'
import { SubscriptionStatusCard } from '@/components/subscription/SubscriptionStatusCard'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { fetchPayments, fetchPlans, fetchSubscription } from '@/lib/api/subscription'
import type { Payment, Plan, SubscriptionState } from '@/types/subscription'

/**
 * Halaman /upgrade — katalog paket langganan.
 *
 * Tiga blok, sesuai PRD:
 * 1. SubscriptionStatusCard — status sekarang (trial/active/grace/expired)
 *    beserta sisa jatah & tanggal.
 * 2. Katalog paket dalam grid responsif; Bulanan Rp50.000 selalu ada, paket
 *    lain bisa berharga null (tampil "Segera", nonaktif).
 * 3. Riwayat pembayaran — transaksi pending bisa dilanjutkan ke checkout,
 *    expired/rejected bisa dibuat ulang.
 *
 * Data dari `lib/api/subscription` (masih mock); transaksi & aktivasi adalah
 * task backend berikutnya.
 */
export function UpgradePage() {
  const [searchParams] = useSearchParams()
  /**
   * Diisi `RequireWriteAccess` saat vendor terlempar dari halaman pembuatan
   * data. Tujuannya supaya pengalihan tidak terasa seperti error: vendor diberi
   * tahu kenapa aksinya diblokir, bukan hanya tiba-tiba mendarat di katalog.
   */
  const redirectedFromExpired = searchParams.get('from') === 'expired'
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([fetchPlans(), fetchSubscription(), fetchPayments()])
      .then(([planList, sub, paymentList]) => {
        if (!active) return
        setPlans(planList)
        setSubscription(sub)
        setPayments(paymentList)
      })
      // Tanpa catch, kegagalan API membuat halaman kosong tanpa penjelasan.
      // Halaman tetap tampil dengan data kosong dan pesan galat.
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

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-xl bg-white" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-64 animate-pulse rounded-xl bg-white" />
          <div className="h-64 animate-pulse rounded-xl bg-white" />
          <div className="h-64 animate-pulse rounded-xl bg-white" />
        </div>
      </div>
    )
  }

  // Gagal memuat: tampilkan penyebabnya, jangan halaman kosong.
  if (error !== null || !subscription) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3">
        <p className="text-[12.5px] text-rose-900">
          {error ?? 'Data langganan tidak tersedia.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">Langganan</h2>
        <p className="mt-0.5 text-[13px] text-ink-500">
          Buka booking &amp; invoice tanpa batas dengan memilih paket. Jatah trial tidak hangus
          saat kamu upgrade.
        </p>
      </div>

      {redirectedFromExpired ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3"
        >
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <Lock className="size-3.5" />
          </span>
          <p className="text-[12.5px] leading-relaxed text-rose-900">
            <span className="font-semibold">Aksi itu terkunci karena langganan berakhir.</span>{' '}
            Data lama tetap bisa dibaca dan diekspor. Pilih paket di bawah untuk membuka kembali
            pembuatan booking &amp; invoice.
          </p>
        </div>
      ) : null}

      <SubscriptionStatusCard subscription={subscription} />

      {pendingPayment ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-amber-900">
            <span className="font-semibold">Ada transaksi menunggu pembayaran</span> —{' '}
            {pendingPayment.planName} ·{' '}
            {new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              maximumFractionDigits: 0,
            }).format(pendingPayment.amount)}
            . Selesaikan sebelum batas waktu supaya tidak perlu membuat ulang.
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            current={subscription.status === 'active' && plan.code === 'monthly'}
          />
        ))}
      </div>

      <Card>
        <CardHeader
          title="Cara pembayaran"
          description="Bayar lewat payment gateway — langganan aktif otomatis setelah terverifikasi."
        />
        <CardBody>
          <ol className="list-inside list-decimal space-y-1.5 text-[12.5px] leading-relaxed text-ink-600">
            <li>Pilih paket — kamu masuk ke halaman checkout dengan nomor referensi.</li>
            <li>Pilih metode: QRIS, Virtual Account, atau e-wallet, lalu selesaikan pembayaran.</li>
            <li>
              Setelah pembayaran terverifikasi, masa aktif paket aktif otomatis dan batas trial
              hilang.
            </li>
          </ol>
        </CardBody>
      </Card>

      <PaymentHistory payments={payments} />
    </div>
  )
}
