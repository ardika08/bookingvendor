import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { TrendingUp } from '@/components/ui/icons'
import { useAdminRevenueSeries } from '@/hooks/useAdminRevenueSeries'
import { formatCurrency } from '@/lib/format'
import type { AdminRevenuePoint } from '@/lib/api/admin-dashboard'

/**
 * Grafik pendapatan langganan aplikasi (admin).
 *
 * Satu kurva saja — berbeda dari grafik vendor yang membandingkan nilai
 * kontrak vs uang masuk. Di panel admin hanya ada satu angka yang berarti:
 * berapa uang yang diterima platform dari langganan vendor.
 *
 * Warna garis memakai hex literal, bukan `var(--color-*)`: Recharts menulis
 * warna sebagai atribut SVG dan browser tidak me-resolve custom property di
 * atribut, sehingga garis tidak akan terlihat.
 */

const RANGE_OPTIONS = [3, 6, 12] as const

const REVENUE_COLOR = '#276fb9'
const INK_100 = '#eceef0'
const INK_300 = '#b6bdc6'
const INK_400 = '#5f6a77'

function AreaGradient({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.28} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  )
}

export function AdminRevenueChart() {
  const { points, total, range, setRange, loading, error, reload } = useAdminRevenueSeries(6)

  if (error) {
    return (
      <section className="rounded-xl border border-ink-200/80 bg-white px-5 py-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lead font-semibold text-ink-900">Pendapatan langganan</h2>
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

  const hasData = points.some((point) => point.revenue > 0)

  return (
    <section className="rounded-xl border border-ink-200/80 bg-white px-5 py-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <TrendingUp className="size-4" />
          </span>
          <div>
            <h2 className="text-lead font-semibold text-ink-900">Pendapatan langganan</h2>
            <p className="mt-0.5 text-meta text-ink-500">
              Uang yang diterima platform dari paket langganan vendor, per bulan.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 sm:justify-end">
          <div>
            <p className="text-2xs font-medium uppercase tracking-wide text-ink-400">Total</p>
            <p className="text-lead font-semibold tabular-nums text-ink-900">
              {formatCurrency(total)}
            </p>
          </div>
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
                <AreaGradient id="gradAdminSubscription" color={REVENUE_COLOR} />
              </defs>
              <CartesianGrid stroke={INK_100} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: INK_400, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
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
                content={<SubscriptionTooltip />}
                cursor={{ stroke: INK_300, strokeDasharray: '3 3' }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Pendapatan langganan"
                stroke={REVENUE_COLOR}
                strokeWidth={2.5}
                fill="url(#gradAdminSubscription)"
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff', fill: REVENUE_COLOR }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="mt-3 text-caption leading-relaxed text-ink-400">
        Dihitung dari transaksi langganan berstatus lunas. Pemasukan vendor dari klien tidak
        termasuk di sini.
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

function SubscriptionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload: AdminRevenuePoint }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const point = payload[0].payload

  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 shadow-md">
      <p className="text-meta font-semibold text-ink-900">{label}</p>
      <p className="mt-1 text-caption tabular-nums" style={{ color: REVENUE_COLOR }}>
        {formatCurrency(point.revenue)}
      </p>
      <p className="mt-0.5 text-caption text-ink-400">
        {point.paymentCount} transaksi lunas
      </p>
    </div>
  )
}

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
      <p className="text-meta font-medium text-ink-700">Belum ada pendapatan langganan</p>
      <p className="mt-1 max-w-xs text-caption text-ink-500">
        Grafik terisi setelah ada vendor yang membayar paket langganan.
      </p>
    </div>
  )
}

function ChartSkeleton() {
  return <div className="h-full animate-pulse rounded-lg bg-ink-50" aria-hidden />
}
