import { useEffect, useState } from 'react'
import { fetchRevenueSeries, type RevenuePoint, type RevenueSeriesResult } from '@/lib/api/revenue'

/**
 * Seri pendapatan untuk grafik dashboard.
 *
 * Jumlah bulan dijadikan state supaya pengguna bisa memperluas/menyempitkan
 * rentang tanpa pindah halaman; tiap perubahan memicu request baru.
 */
export function useRevenueSeries(months = 6) {
  const [data, setData] = useState<RevenueSeriesResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [range, setRange] = useState(months)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)

    fetchRevenueSeries(range, controller.signal)
      .then((result) => {
        if (!active) return
        setData(result)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof Error ? cause : new Error('Gagal memuat grafik pendapatan.'))
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [range])

  const points: RevenuePoint[] = data?.series ?? []

  return {
    points,
    totals: data?.totals ?? { contractValue: 0, paid: 0 },
    /** Jumlah bulan efektif yang dipakai server (bisa lebih kecil dari permintaan). */
    activeMonths: data?.months ?? range,
    range,
    setRange,
    loading,
    error,
    reload: () => setRange((value) => value),
  }
}
