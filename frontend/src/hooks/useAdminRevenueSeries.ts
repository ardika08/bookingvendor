import { useEffect, useState } from 'react'
import {
  fetchAdminRevenueSeries,
  type AdminRevenuePoint,
  type AdminRevenueSeriesResult,
} from '@/lib/api/admin-dashboard'

/**
 * Seri pendapatan langganan aplikasi untuk grafik dashboard admin.
 *
 * Hanya berisi pendapatan langganan (vendor membayar paket ke platform),
 * bukan pemasukan vendor dari kliennya.
 */
export function useAdminRevenueSeries(months = 6) {
  const [data, setData] = useState<AdminRevenueSeriesResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [range, setRange] = useState(months)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)

    fetchAdminRevenueSeries(range, controller.signal)
      .then((result) => {
        if (!active) return
        setData(result)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(
          cause instanceof Error ? cause : new Error('Gagal memuat grafik pendapatan langganan.'),
        )
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

  const points: AdminRevenuePoint[] = data?.series ?? []

  return {
    points,
    total: data?.totals.revenue ?? 0,
    range,
    setRange,
    loading,
    error,
    reload: () => setRange((value) => value),
  }
}
