import { apiRequest } from './client'

/**
 * Lapisan API seri pendapatan (grafik dashboard).
 *
 * Bentuk datanya sengaja dibuat setipis mungkin: satu titik per bulan dengan
 * dua nilai, bukan daftar booking/pembayaran. Grafik tidak pernah butuh
 * rincian transaksi, dan mengirim seluruh baris hanya akan membengkakkan
 * payload yang di-parse di setiap kunjungan dashboard.
 */

/** Satu titik pada garis grafik. */
export interface RevenuePoint {
  /** `YYYY-MM`. */
  month: string
  /** Label pendek untuk sumbu X, mis. "Agu". */
  label: string
  /** Nilai kontrak acara confirmed/completed pada bulan itu. */
  contractValue: number
  /** Uang yang benar-benar masuk pada bulan itu. */
  paid: number
  /** Jumlah booking yang tercatat (termasuk yang batal). */
  bookingCount: number
}

export interface RevenueSeriesResult {
  series: RevenuePoint[]
  /** Total seluruh titik — dipakai kartu ringkasan, bukan dihitung ulang di UI. */
  totals: {
    contractValue: number
    paid: number
  }
  /** Jumlah bulan yang benar-benar dikembalikan server (setelah pembatasan). */
  months: number
}

/**
 * Seri pendapatan `months` bulan terakhir.
 *
 * Server membatasi maksimal 12 bulan; mengirim angka lebih besar tidak
 * menghasilkan error, hanya dipotong.
 */
export async function fetchRevenueSeries(
  months = 6,
  signal?: AbortSignal,
): Promise<RevenueSeriesResult> {
  return apiRequest<RevenueSeriesResult>('/revenue/series', {
    query: { months },
    signal,
  })
}
