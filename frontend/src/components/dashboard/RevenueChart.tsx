import {
  Area,
  AreaChart,
  CartesianGrid,
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
 * Dua kurva, karena menjawab pertanyaan berbeda:
 * - **Nilai kontrak** (biru) — acara yang sudah pasti berjalan, dihitung dari
 *   tanggal acara. Ini kapasitas kerja vendor.
 * - **Uang masuk** (ungu) — dana yang benar-benar diterima, dihitung dari
 *   tanggal pembayaran. Ini arus kas.
 *
 * Jarak antara kedua kurva itu sendiri informatif: kurva kontrak yang jauh di
 * atas kurva pembayaran berarti banyak acara sudah fix tetapi dananya belum
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
 * garis & grid tidak terlihat sama sekali.
 *
 * Palet mengikuti referensi desain: biru azure untuk kontrak, ungu violet
 * untuk uang masuk. Dua hue ini cukup berjauhan di roda warna sehingga area
 * yang bertumpuk tetap terbaca sebagai dua bidang berbeda.
 */
const CONTRACT_COLOR = '#4a90d9'
const PAID_COLOR = '#8b5cf6'
/** Token netral yang dipakai grid/sumbu (lihat `index.css`). */
const INK_100 = '#eceef0'
const INK_300 = '#b6bdc6'
const INK_400 = '#8c96a3'

/**
 * Gradasi area: pekat di dekat garis, luruh ke transparan di dasar plot.
 * `stopOpacity` sengaja rendah (0.28 → 0) supaya dua bidang yang bertumpuk
 * tidak menjadi blok warna pekat yang menutupi grid di belakangnya.
 */
function AreaGradient({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.28} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  )
}

export function RevenueChart() {
  const { points, totals, range, setRange, loading, error, reload } = useRevenueSeries(6)

  if (error) {
    return (
      <section className="rounded-xl border border-ink-200/80 bg-white px-5 py-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lead font-semibold text-ink-900">Grafik pendapatan</h2>
            <p className="mt-0.5 text-meta text-ink-500">{error.message}</p>
          </div>
          <button
            type="button"
            onClick={reload}
            className="inline-flex h-8 shrink-0 items-center rounded-lg bg-white px-3 text-meta font-medium text-ink-700 shadow-sm ring-1 ring-ink-200 hover:bg-ink-50"
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
            <h2 className="text-lead font-semibold text-ink-900">Grafik pendapatan</h2>
            <p className="mt-0.5 text-meta text-ink-500">
              Nilai kontrak acara vs uang yang benar-benar masuk, per bulan.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 sm:justify-end">
          {/* Metrik ringkas di kanan atas, mengikuti tata letak referensi:
              angka besar jadi jangkar, label kecil di atasnya. */}
          <dl className="flex items-baseline gap-5">
            <div>
              <dt className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-ink-400">
                <LegendDot color={CONTRACT_COLOR} /> Kontrak
              </dt>
              <dd className="text-lead font-semibold tabular-nums text-ink-900">
                {formatCurrency(totals.contractValue)}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-ink-400">
                <LegendDot color={PAID_COLOR} /> Masuk
              </dt>
              <dd className="text-lead font-semibold tabular-nums text-ink-900">
                {formatCurrency(totals.paid)}
              </dd>
            </div>
          </dl>

          <RangeSelector value={range} onChange={setRange} />
        </div>
      </header>

      <div className="mt-4 h-56">
        {loading && points.length === 0 ? (
          <ChartSkeleton />
        ) : !hasData ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 4 }}>
              <defs>
                <AreaGradient id="gradContract" color={CONTRACT_COLOR} />
                <AreaGradient id="gradPaid" color={PAID_COLOR} />
              </defs>
              <CartesianGrid stroke={INK_100} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: INK_400, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
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
              <Area
                type="monotone"
                dataKey="contractValue"
                name="Nilai kontrak"
                stroke={CONTRACT_COLOR}
                strokeWidth={2.5}
                fill="url(#gradContract)"
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff', fill: CONTRACT_COLOR }}
              />
              <Area
                type="monotone"
                dataKey="paid"
                name="Uang masuk"
                stroke={PAID_COLOR}
                strokeWidth={2.5}
                fill="url(#gradPaid)"
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff', fill: PAID_COLOR }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="mt-3 text-caption leading-relaxed text-ink-400">
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
              ? 'rounded-[6px] bg-white px-2.5 py-1 text-meta font-medium text-ink-900 shadow-sm'
              : 'rounded-[6px] px-2.5 py-1 text-meta text-ink-500 hover:text-ink-700'
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
      <p className="text-meta font-semibold text-ink-900">{label}</p>
      <p className="mt-1 text-caption tabular-nums" style={{ color: CONTRACT_COLOR }}>
        Kontrak {formatCurrency(point.contractValue)}
      </p>
      <p className="text-caption tabular-nums" style={{ color: PAID_COLOR }}>
        Masuk {formatCurrency(point.paid)}
      </p>
      <p className="mt-1 text-caption text-ink-400">
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
      <p className="text-meta font-medium text-ink-700">Belum ada pendapatan tercatat</p>
      <p className="mt-1 max-w-xs text-caption text-ink-500">
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

function LegendDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-2 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  )
}
