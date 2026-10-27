import { useEffect, useState } from 'react'
import { Users, Wallet, RefreshCw, ShieldCheck, CreditCard } from '@/components/ui/icons'
import { AdminRevenueChart } from '@/components/admin/AdminRevenueChart'
import { ApiError } from '@/lib/api/client'
import { fetchAdminSummary, type AdminDashboardSummary } from '@/lib/api/admin-dashboard'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Dashboard admin (`/admin`).
 *
 * Hanya menampilkan hal yang relevan untuk mengelola platform:
 * berapa vendor yang aktif, dan berapa pendapatan langganan aplikasi.
 *
 * Data operasional vendor — booking, klien, invoice, dan pemasukan vendor
 * dari kliennya — sengaja TIDAK ditampilkan. Itu urusan masing-masing vendor
 * dan bukan bagian dari pekerjaan admin.
 */
export function AdminDashboardPage() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)

    fetchAdminSummary(controller.signal)
      .then((data) => {
        if (!active) return
        setSummary(data)
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof Error ? cause : new Error('Gagal memuat dashboard.'))
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [reloadToken])

  const reload = () => setReloadToken((t) => t + 1)

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-xl bg-white" />
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-white" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl bg-white" />
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="rounded-xl border border-ink-200/80 bg-white px-6 py-16 text-center">
        <h2 className="text-lead text-ink-900">
          {error instanceof ApiError && error.isUnauthorized ? 'Sesi berakhir' : 'Gagal memuat dashboard'}
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-body text-ink-500">
          {error instanceof ApiError && error.isUnauthorized
            ? 'Masuk kembali untuk melanjutkan.'
            : error?.message || 'Periksa koneksi lalu coba lagi.'}
        </p>
        <button
          type="button"
          onClick={reload}
          className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-400 px-3 text-body font-medium text-ink-900 hover:bg-brand-500"
        >
          <RefreshCw className="size-3.5" />
          Coba lagi
        </button>
      </div>
    )
  }

  const { vendors, subscription } = summary

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-title tracking-tight text-ink-900">Dashboard</h1>
        <p className="mt-0.5 text-body text-ink-500">
          Ringkasan vendor dan pendapatan langganan platform.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <AdminStatTile
          icon={<Users className="size-4" />}
          label="Vendor Aktif"
          value={String(vendors.active)}
          hint={
            vendors.inactive > 0
              ? `dari ${vendors.total} terdaftar · ${vendors.inactive} nonaktif`
              : `dari ${vendors.total} terdaftar`
          }
        />
        <AdminStatTile
          icon={<CreditCard className="size-4" />}
          label="Langganan Berbayar"
          value={String(subscription.activeCount)}
          hint={`${subscription.trialCount} masih trial`}
        />
        <AdminStatTile
          icon={<Wallet className="size-4" />}
          label="Pendapatan Bulan Ini"
          value={formatCurrency(subscription.revenueThisMonth)}
          hint={`${subscription.paidCount} transaksi lunas total`}
        />
        <AdminStatTile
          icon={<ShieldCheck className="size-4" />}
          label="Total Pendapatan"
          value={formatCurrency(subscription.revenueTotal)}
          hint="Sejak awal, dari langganan"
        />
      </div>

      <AdminRevenueChart />
    </div>
  )
}

const TONE_CLASS = {
  neutral: 'text-ink-900',
  emerald: 'text-emerald-700',
} as const

function AdminStatTile({
  icon,
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  tone?: keyof typeof TONE_CLASS
}) {
  return (
    <div className="rounded-xl border border-ink-200/80 bg-white px-3.5 py-3">
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          {icon}
        </span>
        <p className="text-caption font-medium uppercase tracking-wide text-ink-400">{label}</p>
      </div>
      <p className={cn('mt-1.5 text-lead font-semibold tabular-nums', TONE_CLASS[tone])}>{value}</p>
      {hint ? <p className="mt-0.5 text-2xs leading-snug text-ink-400">{hint}</p> : null}
    </div>
  )
}
