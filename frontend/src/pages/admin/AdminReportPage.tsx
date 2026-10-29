import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  Clock3,
  CreditCard,
  Download,
  Printer,
  RefreshCw,
  Store,
  Users,
  Wallet,
} from '@/components/ui/icons'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ReportPrintDocument } from '@/components/admin/ReportPrintDocument'
import { YearlyBarChart } from '@/components/admin/YearlyBarChart'
import { ApiError } from '@/lib/api/client'
import { fetchAdminReport, type AdminReport } from '@/lib/api/admin-reports'
import { buildCsv, downloadCsv } from '@/lib/csv'
import { formatCurrency, formatLongDate, formatShortDate } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Laporan tahunan platform (`/admin/reports`).
 *
 * Tiga tab, satu tahun:
 * 1. Pendapatan — total, tren 12 bulan, sebaran per paket & status.
 * 2. Vendor — jumlah akun, vendor baru per bulan, sebaran kategori.
 * 3. Perlu ditindak — langganan yang berakhir dalam 7 hari.
 *
 * Semua tab berbagi satu permintaan API. Memisahkannya per tab berarti tiga
 * kali loading dan tiga kesempatan tahun antar tab tidak sinkron.
 *
 * CAKUPAN: hanya pendapatan langganan platform dan akun vendor. Data
 * operasional vendor (booking, klien, invoice) sengaja tidak ada.
 */

const TABS = [
  { id: 'revenue', label: 'Pendapatan', icon: Wallet },
  { id: 'vendors', label: 'Vendor', icon: Users },
  { id: 'action', label: 'Perlu Ditindak', icon: AlertTriangle },
] as const

type TabId = (typeof TABS)[number]['id']

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: 'Lunas',
  pending: 'Menunggu',
  failed: 'Gagal',
  expired: 'Kedaluwarsa',
  refunded: 'Dana kembali',
}

export function AdminReportPage() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [report, setReport] = useState<AdminReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('revenue')
  const [reloadToken, setReloadToken] = useState(0)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    setLoading(true)
    setError(null)

    fetchAdminReport(year, controller.signal)
      .then((data) => {
        if (active) setReport(data)
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Gagal memuat laporan. Periksa koneksi lalu coba lagi.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [year, reloadToken])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  /** Pilihan tahun dari server, selalu memuat tahun yang sedang dipilih. */
  const yearOptions = useMemo(() => {
    const years = report?.availableYears ?? [year]
    return years.includes(year) ? years : [year, ...years]
  }, [report, year])

  /** Pindah tab dengan tombol panah kiri/kanan (pola tablist WAI-ARIA). */
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

  function exportCsv() {
    if (report === null) return

    const { revenue, vendors, expiring } = report
    const rows: Array<Array<string | number | null>> = [
      ['Laporan Booking Vendor', `Tahun ${report.year}`],
      [],
      ['RINGKASAN'],
      ['Total pendapatan langganan', revenue.total],
      ['Transaksi lunas', revenue.paidCount],
      ['Rata-rata per transaksi', Math.round(revenue.averagePerTransaction)],
      ['Vendor terdaftar (semua tahun)', vendors.total],
      ['Vendor aktif', vendors.active],
      ['Vendor nonaktif', vendors.inactive],
      ['Vendor baru tahun ini', vendors.newThisYear],
      [],
      ['PENDAPATAN PER BULAN'],
      ['Bulan', 'Transaksi lunas', 'Pendapatan'],
      ...revenue.monthly.map((month) => [month.label, month.count, month.revenue]),
      [],
      ['PENDAPATAN PER PAKET'],
      ['Paket', 'Transaksi lunas', 'Pendapatan'],
      ...revenue.byPlan.map((plan) => [plan.planName, plan.count, plan.revenue]),
      [],
      ['TRANSAKSI PER STATUS'],
      ['Status', 'Jumlah', 'Nominal'],
      ...revenue.byStatus.map((item) => [
        PAYMENT_STATUS_LABEL[item.status] ?? item.status,
        item.count,
        item.amount,
      ]),
      [],
      ['VENDOR BARU PER BULAN'],
      ['Bulan', 'Jumlah vendor baru'],
      ...vendors.monthlyNew.map((month) => [month.label, month.count]),
      [],
      ['VENDOR PER KATEGORI'],
      ['Kategori', 'Jumlah'],
      ...vendors.byCategory.map((item) => [item.category, item.count]),
      [],
      ['LANGGANAN BERAKHIR DALAM 7 HARI'],
      ['Vendor', 'Paket', 'Berakhir', 'Sisa hari'],
      ...expiring.map((item) => [item.vendorName, item.planName, item.endsAt, item.daysLeft]),
    ]

    downloadCsv(`laporan-booking-vendor-${report.year}.csv`, buildCsv(rows))
  }

  return (
    <div className="space-y-4">
      {/* Tombol cetak/unduh disembunyikan saat mencetak — kertas tidak butuh tombol. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div>
          <h1 className="text-title tracking-tight text-ink-900">Laporan</h1>
          <p className="mt-0.5 text-body text-ink-500">
            Pendapatan langganan, pertumbuhan vendor, dan langganan yang perlu ditindak.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="report-year" className="sr-only">
            Pilih tahun laporan
          </label>
          <select
            id="report-year"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="h-9 rounded-lg border border-ink-200 bg-white px-2.5 text-body text-ink-800 shadow-sm focus:border-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-800/20"
          >
            {yearOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={report === null}>
            <Download className="size-3.5" />
            Unduh CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()} disabled={report === null}>
            <Printer className="size-3.5" />
            Cetak / PDF
          </Button>
        </div>
      </div>

      {error !== null ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3">
          <p className="text-meta text-rose-900">{error}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-meta font-medium text-ink-700 shadow-sm ring-1 ring-ink-200 hover:bg-ink-50"
          >
            <RefreshCw className="size-3.5" />
            Coba lagi
          </button>
        </div>
      ) : null}

      {loading && report === null ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-xl bg-white" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-xl bg-white" />
        </div>
      ) : report === null ? null : (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 print:hidden">
            <StatTile
              icon={<Wallet className="size-4" />}
              label="Pendapatan"
              value={formatCurrency(report.revenue.total)}
              hint={`${report.revenue.paidCount} transaksi lunas`}
            />
            <StatTile
              icon={<CreditCard className="size-4" />}
              label="Rata-rata Transaksi"
              value={formatCurrency(report.revenue.averagePerTransaction)}
              hint={`tahun ${report.year}`}
            />
            <StatTile
              icon={<Store className="size-4" />}
              label="Vendor Baru"
              value={String(report.vendors.newThisYear)}
              hint={`${report.vendors.total} terdaftar · ${report.vendors.active} aktif`}
            />
            <StatTile
              icon={<Clock3 className="size-4" />}
              label="Segera Berakhir"
              value={String(report.expiring.length)}
              hint="dalam 7 hari"
              tone={report.expiring.length > 0 ? 'amber' : 'neutral'}
            />
          </div>

          {/* Tablist manual: panah kiri/kanan, satu tab fokusable. */}
          <div
            role="tablist"
            aria-label="Kelompok laporan"
            /*
             * Di layar sempit tab dibungkus ke baris berikutnya, bukan digeser
             * ke samping. Sebelumnya tablist ini melebar 375px di layar 320px
             * sehingga tab ketiga terpotong di tepi — labelnya tidak terbaca
             * dan tidak ada petunjuk bahwa area itu bisa digeser. Membungkus
             * membuat ketiga label utuh tanpa perlu gestur tersembunyi.
             */
            className="flex flex-wrap gap-1 rounded-xl border border-ink-200/80 bg-white p-1 sm:flex-nowrap sm:overflow-x-auto sm:scroll-px-1 print:hidden"
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
                  {item.id === 'action' && report.expiring.length > 0 ? (
                    <span className="ml-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-amber-800">
                      {report.expiring.length}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          {/*
            Ketiga panel selalu dirender, yang tidak aktif diberi `hidden`.
            Sebelumnya hanya panel aktif yang ada di DOM, sehingga
            `aria-controls` pada dua tab lain menunjuk id yang tidak ada —
            tab mengklaim mengendalikan panel yang tidak berwujud. `hidden`
            juga mengeluarkan panel non-aktif dari pohon aksesibilitas, jadi
            pembaca layar tidak membacakan isi tab yang tidak dipilih.
          */}
          {TABS.map((item) => (
            <div
              key={item.id}
              role="tabpanel"
              id={`panel-${item.id}`}
              aria-labelledby={`tab-${item.id}`}
              hidden={tab !== item.id}
              tabIndex={0}
              className="space-y-4"
            >
              {item.id === 'revenue' ? <RevenueTab report={report} /> : null}
              {item.id === 'vendors' ? <VendorsTab report={report} /> : null}
              {item.id === 'action' ? <ActionTab report={report} /> : null}
            </div>
          ))}
        </>
      )}

      {/* Hanya terlihat saat mencetak; isinya lengkap untuk ketiga tab. */}
      {report !== null ? <ReportPrintDocument report={report} /> : null}
    </div>
  )
}

function RevenueTab({ report }: { report: AdminReport }) {
  const { revenue } = report
  const chartData = revenue.monthly.map((month) => ({
    label: month.label,
    value: month.revenue,
    count: month.count,
  }))

  return (
    <>
      <Card>
        <CardHeader
          title="Pendapatan per bulan"
          description={`Hanya transaksi lunas, dihitung dari tanggal pembayaran. Tahun ${report.year}.`}
        />
        <CardBody>
          <YearlyBarChart data={chartData} format="currency" unit="" />
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pendapatan per paket" description="Diurutkan dari terbesar." />
          {revenue.byPlan.length === 0 ? (
            <EmptyState
              icon={<BarChart3 className="size-5" />}
              title="Belum ada pendapatan"
              description={`Tidak ada transaksi lunas pada tahun ${report.year}.`}
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {revenue.byPlan.map((plan) => (
                <li
                  key={plan.planName}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-body font-medium text-ink-900">{plan.planName}</p>
                    <p className="text-caption text-ink-500">{plan.count} transaksi lunas</p>
                  </div>
                  <p className="shrink-0 text-body font-semibold tabular-nums text-ink-900">
                    {formatCurrency(plan.revenue)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Transaksi per status"
            description="Termasuk yang belum lunas, untuk melihat kegagalan."
          />
          {revenue.byStatus.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="size-5" />}
              title="Belum ada transaksi"
              description={`Tidak ada transaksi pada tahun ${report.year}.`}
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {revenue.byStatus.map((item) => (
                <li
                  key={item.status}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        item.status === 'paid'
                          ? 'bg-emerald-500'
                          : item.status === 'pending'
                            ? 'bg-amber-500'
                            : 'bg-rose-500',
                      )}
                    />
                    <p className="text-body text-ink-800">
                      {PAYMENT_STATUS_LABEL[item.status] ?? item.status}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-body font-medium tabular-nums text-ink-900">
                      {formatCurrency(item.amount)}
                    </p>
                    <p className="text-caption tabular-nums text-ink-500">{item.count} transaksi</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

function VendorsTab({ report }: { report: AdminReport }) {
  const { vendors } = report
  const chartData = vendors.monthlyNew.map((month) => ({
    label: month.label,
    value: month.count,
  }))

  return (
    <>
      <Card>
        <CardHeader
          title="Vendor baru per bulan"
          description={`Pendaftaran pada tahun ${report.year}.`}
        />
        <CardBody>
          <YearlyBarChart data={chartData} format="number" color="emerald" unit="vendor" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Vendor per kategori"
          description={`Kategori vendor yang mendaftar pada tahun ${report.year}.`}
        />
        {vendors.byCategory.length === 0 ? (
          <EmptyState
            icon={<Store className="size-5" />}
            title="Belum ada vendor baru"
            description={`Tidak ada vendor yang mendaftar pada tahun ${report.year}.`}
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {vendors.byCategory.map((item) => (
              <li
                key={item.category}
                className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5"
              >
                <p className="min-w-0 truncate text-body text-ink-800">{item.category}</p>
                <p className="shrink-0 text-body font-semibold tabular-nums text-ink-900">
                  {item.count}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-caption leading-relaxed text-ink-500">
        Jumlah terdaftar, aktif, dan nonaktif menunjukkan keadaan saat ini, mencakup semua tahun —
        tabel vendor tidak menyimpan riwayat perubahan status. Yang dibatasi tahun hanya jumlah
        vendor baru dan sebaran kategorinya.
      </p>
    </>
  )
}

function ActionTab({ report }: { report: AdminReport }) {
  if (report.expiring.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Clock3 className="size-5" />}
          title="Tidak ada yang mendesak"
          description="Tidak ada langganan aktif yang berakhir dalam 7 hari ke depan."
        />
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title="Langganan berakhir dalam 7 hari"
        description="Hubungi vendor sebelum masa aktifnya habis. Diurutkan dari yang paling mendesak."
      />
      <ul className="divide-y divide-ink-100">
        {report.expiring.map((item) => (
          <li key={item.subscriptionId} className="flex items-start gap-3 px-4 py-3 sm:px-5">
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full',
                item.daysLeft <= 2 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600',
              )}
            >
              <Clock3 className="size-4" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link
                  to={`/admin/vendors/${item.vendorId}`}
                  className="truncate text-body font-semibold text-ink-900 hover:text-brand-700 hover:underline"
                >
                  {item.vendorName}
                </Link>
                {!item.vendorActive ? (
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-2xs font-medium text-ink-500">
                    Akun nonaktif
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-caption text-ink-500">
                {item.planName} · berakhir {formatShortDate(item.endsAt)}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p
                className={cn(
                  'text-body font-semibold tabular-nums',
                  item.daysLeft <= 2 ? 'text-rose-700' : 'text-amber-700',
                )}
              >
                {item.daysLeft === 0 ? 'Hari ini' : `${item.daysLeft} hari`}
              </p>
              <p className="text-caption text-ink-400">{formatLongDate(item.endsAt)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

const TONE_CLASS = {
  neutral: 'text-ink-900',
  amber: 'text-amber-700',
} as const

function StatTile({
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
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          {icon}
        </span>
        <p className="text-caption font-medium uppercase tracking-wide text-ink-400">{label}</p>
      </div>
      <p className={cn('mt-1.5 text-lead font-semibold tabular-nums', TONE_CLASS[tone])}>{value}</p>
      {hint ? <p className="mt-0.5 text-2xs leading-snug text-ink-400">{hint}</p> : null}
    </div>
  )
}
