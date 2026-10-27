import { useEffect, useState } from 'react'
import {
  fetchAdminRevenueSeries,
  type AdminRevenueSeriesResult,
} from '@/lib/api/admin-dashboard'
import type { RevenuePoint } from '@/lib/api/revenue'

/**
 * Seri pendapatan platform untuk grafik dashboard admin.
 *
 * Sama seperti `useRevenueSeries` vendor, tetapi memanggil endpoint admin yang
 * menggabungkan seluruh vendor — bukan hanya vendor yang login.
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
        setError(cause instanceof Error ? cause : new Error('Gagal memuat grafik pendapatan platform.'))
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
    range,
    setRange,
    loading,
    error,
    reload: () => setRange((value) => value),
  }
}
