import { apiRequest } from './client'

/**
 * Lapisan API dashboard admin.
 *
 * CAKUPAN: hanya jumlah vendor dan pendapatan langganan aplikasi.
 * Data operasional vendor (booking, klien, invoice, pembayaran klien) tidak
 * diambil di sini — admin tidak membutuhkannya untuk mengelola platform.
 */

export interface AdminDashboardSummary {
  vendors: {
    total: number
    active: number
    inactive: number
  }
  subscription: {
    /** Total pendapatan langganan sepanjang waktu. */
    revenueTotal: number
    /** Pendapatan langganan bulan berjalan. */
    revenueThisMonth: number
    /** Jumlah transaksi langganan berstatus lunas. */
    paidCount: number
    /** Vendor dengan langganan aktif (berbayar). */
    activeCount: number
    /** Vendor yang masih dalam masa trial. */
    trialCount: number
  }
}

/** Satu titik grafik: pendapatan langganan pada satu bulan. */
export interface AdminRevenuePoint {
  /** `YYYY-MM`. */
  month: string
  /** Label pendek sumbu X, mis. "Okt". */
  label: string
  /** Pendapatan langganan bulan itu. */
  revenue: number
  /** Jumlah transaksi lunas bulan itu. */
  paymentCount: number
}

export interface AdminRevenueSeriesResult {
  series: AdminRevenuePoint[]
  totals: { revenue: number }
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
