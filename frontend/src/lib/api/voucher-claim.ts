import { apiRequest } from './client'

/**
 * Klaim voucher dari sisi vendor (`/subscription/voucher`).
 *
 * Hanya voucher tipe "gratis N bulan" yang bisa diklaim di sini. Voucher
 * potongan harga dipakai saat checkout, karena potongannya harus menempel pada
 * transaksi tertentu.
 */

export interface VoucherClaimResult {
  code: string
  granted_months: number | null
  redeemed_at: string | null
}

export interface VoucherHistoryItem {
  code: string | null
  description: string | null
  granted_months: number | null
  discount_applied: string | null
  redeemed_at: string | null
}

export async function claimVoucher(code: string): Promise<VoucherClaimResult> {
  return apiRequest<VoucherClaimResult>('/subscription/voucher', {
    method: 'POST',
    body: { code: code.trim().toUpperCase() },
  })
}

export async function fetchVoucherHistory(signal?: AbortSignal): Promise<VoucherHistoryItem[]> {
  return apiRequest<VoucherHistoryItem[]>('/subscription/voucher', { signal })
}
