import { apiRequest } from './client'
import type { RevenuePoint } from './revenue'

/**
 * Lapisan API dashboard admin.
 *
 * Berbeda dari `/revenue/series` vendor yang terfilter ke vendor yang login,
 * endpoint admin menggabungkan seluruh vendor.
 */

export interface AdminDashboardSummary {
  vendors: {
    total: number
    active: number
    newThisMonth: number
  }
  bookings: {
    total: number
    newThisMonth: number
  }
  payments: {
    total: number
    /** Total uang masuk dari seluruh vendor. */
    paidIn: number
  }
  subscription: {
    /** Total pendapatan langganan yang sudah dibayar. */
    revenue: number
  }
}

export interface AdminRevenueSeriesResult {
  series: RevenuePoint[]
  totals: {
    contractValue: number
    paid: number
  }
  months: number
}

export async function fetchAdminSummary(
  signal?: AbortSignal,
): Promise<AdminDashboardSummary> {
  return apiRequest<AdminDashboardSummary>('/admin/dashboard/summary', { signal })
}

export async function fetchAdminRevenueSeries(
  months = 6,
  signal?: AbortSignal,
): Promise<AdminRevenueSeriesResult> {
  return apiRequest<AdminRevenueSeriesResult>('/admin/dashboard/revenue-series', {
    query: { months },
    signal,
  })
}
