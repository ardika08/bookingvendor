import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '@/lib/format'

/**
 * Grafik batang 12 bulan untuk laporan tahunan.
 *
 * Batang, bukan garis: laporan membandingkan bulan-bulan yang terpisah, bukan
 * memperlihatkan aliran berkelanjutan. Garis menyiratkan nilai "di antara"
 * bulan yang sebenarnya tidak ada.
 *
 * Warna memakai hex literal, bukan `var(--color-*)`: Recharts menulis warna
 * sebagai atribut SVG dan browser tidak me-resolve custom property di atribut,
 * sehingga batang tidak akan terlihat.
 */

const INK_100 = '#eceef0'
const INK_400 = '#5f6a77'
const BRAND = '#b8963f'
const EMERALD = '#047857'

interface YearlyBarChartProps {
  data: Array<{ label: string; value: number; count?: number }>
  /** `currency` memformat nilai sebagai rupiah, `number` sebagai angka biasa. */
  format: 'currency' | 'number'
  color?: 'brand' | 'emerald'
  /** Label satuan untuk tooltip, mis. "transaksi". */
  unit?: string
}

export function YearlyBarChart({
  data,
  format,
  color = 'brand',
  unit,
}: YearlyBarChartProps) {
  const fill = color === 'emerald' ? EMERALD : BRAND
  const hasValue = data.some((point) => point.value > 0)

  if (!hasValue) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-ink-200 text-meta text-ink-400">
        Belum ada data pada tahun ini.
      </div>
    )
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={INK_100} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: INK_400 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: INK_400 }}
            axisLine={false}
            tickLine={false}
            width={64}
            /*
             * Untuk jumlah (vendor/transaksi) sumbu harus bilangan bulat.
             * Tanpa `allowDecimals={false}`, Recharts memilih langkah 0,25
             * saat nilai maksimumnya 1 — sumbu menampilkan "0,25 · 0,5 · 0,75"
             * padahal tidak ada seperempat orang.
             */
            allowDecimals={format === 'currency'}
            tickFormatter={(value: number) =>
              format === 'currency'
                ? value === 0
                  ? '0'
                  : `${Math.round(value / 1000)}rb`
                : String(Math.round(value))
            }
          />
          <Tooltip
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null
              const point = payload[0].payload as { value: number; count?: number }

              return (
                <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 shadow-lg">
                  <p className="text-caption font-semibold text-ink-900">{label}</p>
                  <p className="mt-0.5 text-meta tabular-nums text-ink-700">
                    {format === 'currency' ? formatCurrency(point.value) : point.value}
                    {unit ? ` ${unit}` : ''}
                  </p>
                  {point.count !== undefined && format === 'currency' ? (
                    <p className="text-caption tabular-nums text-ink-500">
                      {point.count} transaksi lunas
                    </p>
                  ) : null}
                </div>
              )
            }}
          />
          <Bar dataKey="value" fill={fill} radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
