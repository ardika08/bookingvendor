import { useEffect, useState } from 'react'
import { Users, CalendarDays, Wallet, TrendingUp, RefreshCw } from '@/components/ui/icons'
import { AdminRevenueChart } from '@/components/admin/AdminRevenueChart'
import { ApiError } from '@/lib/api/client'
import { fetchAdminSummary, type AdminDashboardSummary } from '@/lib/api/admin-dashboard'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Dashboard admin (`/admin`).
 *
 * Halaman utama panel admin: ringkasan angka platform + grafik pendapatan
 * agregat seluruh vendor. Berbeda dari dashboard vendor yang hanya menampilkan
 * datanya sendiri, di sini angka menggabungkan semua vendor di platform.
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
        <div className="h-20 animate-pulse rounded-xl bg-white" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-title tracking-tight text-ink-900">Dashboard</h1>
        <p className="mt-0.5 text-body text-ink-500">
          Ringkasan kesehatan platform: vendor, booking, dan pendapatan.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <AdminStatTile
          icon={<Users className="size-4" />}
          label="Total Vendor"
          value={String(summary.vendors.total)}
          hint={`${summary.vendors.active} aktif · ${summary.vendors.newThisMonth} baru bulan ini`}
        />
        <AdminStatTile
          icon={<CalendarDays className="size-4" />}
          label="Total Booking"
          value={String(summary.bookings.total)}
          hint={`${summary.bookings.newThisMonth} baru bulan ini`}
        />
        <AdminStatTile
          icon={<Wallet className="size-4" />}
          label="Uang Masuk"
          value={formatCurrency(summary.payments.paidIn)}
          hint={`${summary.payments.total} transaksi · total semua waktu`}
          tone="emerald"
        />
        <AdminStatTile
          icon={<TrendingUp className="size-4" />}
          label="Pendapatan Langganan"
          value={formatCurrency(summary.subscription.revenue)}
          hint="Dari pembayaran paket vendor"
          tone="emerald"
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
