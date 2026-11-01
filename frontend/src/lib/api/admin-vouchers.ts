import { apiRequest } from './client'

/**
 * API voucher untuk admin (`/admin/vouchers`).
 *
 * Dua tipe voucher:
 * - `free_months` → menambah masa aktif vendor, tanpa pembayaran.
 * - `discount`    → memotong harga saat checkout (nominal atau persen).
 *
 * `status` adalah nilai TURUNAN dari backend (gabungan is_active, tanggal,
 * dan kuota). Frontend tidak menghitungnya sendiri supaya tampilan admin dan
 * aturan backend tidak pernah berbeda.
 */

export type VoucherType = 'free_months' | 'discount'
export type DiscountKind = 'amount' | 'percent'
export type VoucherStatus = 'active' | 'inactive' | 'scheduled' | 'expired' | 'exhausted'

export interface AdminVoucher {
  id: number
  code: string
  description: string | null
  type: VoucherType
  free_months: number | null
  plan_id: number | null
  plan_name: string | null
  discount_kind: DiscountKind | null
  discount_amount: string | null
  discount_percent: number | null
  max_uses: number | null
  used_count: number
  /** null = tanpa batas total. */
  remaining_uses: number | null
  starts_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string | null
  /** Label siap tampil, mis. "1 bulan gratis" atau "50% potongan". */
  discount_label: string
  status: VoucherStatus
}

export interface VoucherPayload {
  code?: string
  description?: string | null
  type?: VoucherType
  free_months?: number | null
  plan_id?: number | null
  discount_kind?: DiscountKind | null
  discount_amount?: number | null
  discount_percent?: number | null
  max_uses?: number | null
  starts_at?: string | null
  expires_at?: string | null
  is_active?: boolean
}

/** Label status untuk ditampilkan di tabel admin. */
export const VOUCHER_STATUS_LABEL: Record<VoucherStatus, string> = {
  active: 'Aktif',
  inactive: 'Nonaktif',
  scheduled: 'Belum mulai',
  expired: 'Kedaluwarsa',
  exhausted: 'Kuota habis',
}

/**
 * Warna badge status.
 *
 * Memakai token palet yang sudah ada di aplikasi: `brand` untuk aktif,
 * `ink` untuk netral, `red` untuk yang tidak bisa dipakai.
 */
export const VOUCHER_STATUS_TONE: Record<VoucherStatus, string> = {
  active: 'bg-brand-100 text-brand-800',
  scheduled: 'bg-ink-100 text-ink-700',
  exhausted: 'bg-ink-100 text-ink-700',
  expired: 'bg-rose-50 text-rose-700',
  inactive: 'bg-rose-50 text-rose-700',
}

export async function fetchAdminVouchers(
  params: { q?: string; status?: VoucherStatus | '' } = {},
  signal?: AbortSignal,
): Promise<AdminVoucher[]> {
  return apiRequest<AdminVoucher[]>('/admin/vouchers', {
    query: { q: params.q, status: params.status || undefined },
    signal,
  })
}

export async function createAdminVoucher(payload: VoucherPayload): Promise<AdminVoucher> {
  return apiRequest<AdminVoucher>('/admin/vouchers', { method: 'POST', body: payload })
}

export async function updateAdminVoucher(
  id: number,
  payload: VoucherPayload,
): Promise<AdminVoucher> {
  return apiRequest<AdminVoucher>(`/admin/vouchers/${id}`, { method: 'PATCH', body: payload })
}

export async function setAdminVoucherActive(id: number, isActive: boolean): Promise<AdminVoucher> {
  return apiRequest<AdminVoucher>(`/admin/vouchers/${id}/status`, {
    method: 'PATCH',
    body: { is_active: isActive },
  })
}

/**
 * Format tanggal ISO ke bentuk ringkas Indonesia.
 *
 * Ditulis lokal, bukan memakai `toLocaleDateString` dengan locale 'id-ID',
 * karena hasilnya berbeda antar browser (beberapa tidak punya data locale
 * Indonesia dan jatuh ke bahasa Inggris).
 */
export function formatVoucherDate(iso: string | null): string {
  if (!iso) return '—'

  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'

  const bulan = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ]

  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`
}
