import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { useRevenueSeries } from '@/hooks/useRevenueSeries'
import { formatCurrency } from '@/lib/format'
import type { RevenuePoint } from '@/lib/api/revenue'

/**
 * Grafik pendapatan vendor.
 *
 * Dua garis, karena menjawab pertanyaan berbeda:
 * - **Nilai kontrak** (oranye) — acara yang sudah pasti berjalan, dihitung dari
 *   tanggal acara. Ini kapasitas kerja vendor.
 * - **Uang masuk** (hijau) — dana yang benar-benar diterima, dihitung dari
 *   tanggal pembayaran. Ini arus kas.
 *
 * Jarak antara kedua garis itu sendiri informatif: garis kontrak yang jauh di
 * atas garis pembayaran berarti banyak acara sudah fix tetapi dananya belum
 * tertagih.
 *
 * Rentang default 6 bulan. Enam titik cukup untuk melihat tren tanpa membuat
 * sumbu-X sumpit; kalau lebih, label bulan saling bertumpuk.
 */

const RANGE_OPTIONS = [3, 6, 12] as const

/**
 * Warna garis: nilai hex langsung, BUKAN `var(--color-*)`.
 * Recharts menulis warna ini sebagai presentation attribute (`stroke="..."`),
 * dan browser tidak me-resolve custom property di atribut SVG — akibatnya
 * garis & grid tidak terlihat sama sekali. `#f97316` = `--color-brand-500`.
 */
const CONTRACT_COLOR = '#f97316'
const PAID_COLOR = '#059669'
/** Token netral yang dipakai grid/sumbu (lihat `index.css`). */
const INK_100 = '#eceef0'
const INK_200 = '#d9dde2'
const INK_300 = '#b6bdc6'
const INK_400 = '#8c96a3'

export function RevenueChart() {
  const { points, totals, range, setRange, loading, error, reload } = useRevenueSeries(6)

  if (error) {
    return (
      <section className="rounded-xl border border-ink-200/80 bg-white px-5 py-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[13.5px] font-semibold text-ink-900">Grafik pendapatan</h2>
            <p className="mt-0.5 text-[12px] text-ink-500">{error.message}</p>
          </div>
          <button
            type="button"
            onClick={reload}
            className="inline-flex h-8 shrink-0 items-center rounded-lg bg-white px-3 text-[12.5px] font-medium text-ink-700 shadow-sm ring-1 ring-ink-200 hover:bg-ink-50"
          >
            Coba lagi
          </button>
        </div>
      </section>
    )
  }

  const hasData = points.some((point) => point.contractValue > 0 || point.paid > 0)

  return (
    <section className="rounded-xl border border-ink-200/80 bg-white px-5 py-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <TrendingUp className="size-4" />
          </span>
          <div>
            <h2 className="text-[13.5px] font-semibold text-ink-900">Grafik pendapatan</h2>
            <p className="mt-0.5 text-[12px] text-ink-500">
              Nilai kontrak acara vs uang yang benar-benar masuk, per bulan.
            </p>
          </div>
        </div>

        <RangeSelector value={range} onChange={setRange} />
      </header>

      <dl className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <div>
          <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <LegendDot className="bg-brand-500" /> Nilai kontrak
          </dt>
          <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink-900">
            {formatCurrency(totals.contractValue)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">
            <LegendDot className="bg-emerald-600" /> Uang masuk
          </dt>
          <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-emerald-700">
            {formatCurrency(totals.paid)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 h-56">
        {loading && points.length === 0 ? (
          <ChartSkeleton />
        ) : !hasData ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
              <CartesianGrid stroke={INK_100} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: INK_400, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: INK_200 }}
                /* Titik pertama & terakhir ditarik masuk agar tidak terpotong tepi plot. */
                padding={{ left: 12, right: 12 }}
              />
              <YAxis
                tickFormatter={compactCurrency}
                tick={{ fill: INK_400, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={54}
              />
              <Tooltip
                content={<RevenueTooltip />}
                cursor={{ stroke: INK_300, strokeDasharray: '3 3' }}
              />
              <Line
                type="monotone"
                dataKey="contractValue"
                name="Nilai kontrak"
                stroke={CONTRACT_COLOR}
                strokeWidth={2.5}
                /* Tanpa animasi: grafik langsung utuh saat dibuka, dan tidak
                   sempat terlihat "putus" ketika tata letak berubah/scroll. */
                isAnimationActive={false}
                dot={{ r: 3.5, fill: '#fff', stroke: CONTRACT_COLOR, strokeWidth: 2 }}
                activeDot={{ r: 5, strokeWidth: 0, fill: CONTRACT_COLOR }}
              />
              <Line
                type="monotone"
                dataKey="paid"
                name="Uang masuk"
                stroke={PAID_COLOR}
                strokeWidth={2.5}
                isAnimationActive={false}
                dot={{ r: 3.5, fill: '#fff', stroke: PAID_COLOR, strokeWidth: 2 }}
                activeDot={{ r: 5, strokeWidth: 0, fill: PAID_COLOR }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-400">
        Nilai kontrak dihitung dari acara terkonfirmasi & selesai; booking batal tidak
        diikutkan. Uang masuk memakai tanggal pembayaran yang kamu catat.
      </p>
    </section>
  )
}

function RangeSelector({
  value,
  onChange,
}: {
  value: number
  onChange: (months: number) => void
}) {
  return (
    <div
      role="group"
      aria-label="Rentang grafik"
      className="flex shrink-0 items-center gap-0.5 rounded-lg bg-ink-50 p-0.5"
    >
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={
            value === option
              ? 'rounded-[6px] bg-white px-2.5 py-1 text-[12px] font-medium text-ink-900 shadow-sm'
              : 'rounded-[6px] px-2.5 py-1 text-[12px] text-ink-500 hover:text-ink-700'
          }
        >
          {option}B
        </button>
      ))}
    </div>
  )
}

/** Tooltip menampilkan nominal penuh, bukan versi ringkas seperti sumbu-Y. */
function RevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload: RevenuePoint }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const point = payload[0].payload

  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 shadow-md">
      <p className="text-[12px] font-semibold text-ink-900">{label}</p>
      <p className="mt-1 text-[11.5px] tabular-nums text-brand-700">
        Kontrak {formatCurrency(point.contractValue)}
      </p>
      <p className="text-[11.5px] tabular-nums text-emerald-700">
        Masuk {formatCurrency(point.paid)}
      </p>
      <p className="mt-1 text-[11px] text-ink-400">
        {point.bookingCount} booking tercatat
      </p>
    </div>
  )
}

/** "Rp12,5jt" agar sumbu-Y tidak memakan separuh lebar kartu. */
function compactCurrency(value: number): string {
  if (value === 0) return '0'
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    const rounded = millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10
    return `Rp${rounded}jt`
  }
  if (value >= 1_000) return `Rp${Math.round(value / 1_000)}rb`
  return `Rp${value}`
}

function EmptyChart() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-ink-200 px-4 text-center">
      <p className="text-[12.5px] font-medium text-ink-700">Belum ada pendapatan tercatat</p>
      <p className="mt-1 max-w-xs text-[11.5px] text-ink-500">
        Grafik terisi setelah ada booking terkonfirmasi atau pembayaran yang kamu catat.
      </p>
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="h-full animate-pulse rounded-lg bg-ink-50" aria-hidden />
  )
}

function LegendDot({ className }: { className: string }) {
  return <span className={`inline-block size-2 rounded-full ${className}`} />
}
