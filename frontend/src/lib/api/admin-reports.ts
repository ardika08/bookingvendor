import { apiRequest } from './client'

/**
 * API laporan tahunan untuk panel admin (`/admin/reports`).
 *
 * Satu endpoint mengembalikan tiga kelompok data yang dipakai tiga tab:
 * pendapatan, pertumbuhan vendor, dan langganan yang segera habis. Semuanya
 * memakai satu `year` yang sama supaya angka antar tab tidak pernah berbeda
 * tahun tanpa disadari.
 *
 * CAKUPAN: hanya pendapatan langganan platform dan akun vendor. Data
 * operasional vendor (booking, klien, invoice) tidak ada di sini.
 */

export interface ReportMonthRevenue {
  month: number
  label: string
  revenue: number
  count: number
}

export interface ReportPlanRevenue {
  planName: string
  revenue: number
  count: number
}

export interface ReportStatusCount {
  status: string
  count: number
  amount: number
}

export interface ReportMonthCount {
  month: number
  label: string
  count: number
}

export interface ReportCategoryCount {
  category: string
  count: number
}

export interface ReportExpiringVendor {
  subscriptionId: string
  vendorId: string
  vendorName: string
  vendorActive: boolean
  planName: string
  /** ISO date `YYYY-MM-DD`. */
  endsAt: string
  /** 0 = berakhir hari ini. */
  daysLeft: number
}

export interface AdminReport {
  year: number
  /** Tahun yang punya data, selalu termasuk tahun berjalan. */
  availableYears: number[]
  revenue: {
    total: number
    paidCount: number
    averagePerTransaction: number
    monthly: ReportMonthRevenue[]
    byPlan: ReportPlanRevenue[]
    byStatus: ReportStatusCount[]
  }
  vendors: {
    total: number
    active: number
    inactive: number
    newThisYear: number
    monthlyNew: ReportMonthCount[]
    byCategory: ReportCategoryCount[]
  }
  expiring: ReportExpiringVendor[]
}

export async function fetchAdminReport(
  year: number,
  signal?: AbortSignal,
): Promise<AdminReport> {
  return apiRequest<AdminReport>('/admin/reports', { query: { year }, signal })
}
