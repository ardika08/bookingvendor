import { toIsoDate } from '@/lib/format'

/**
 * Tipe & aturan daftar vendor untuk admin (`/admin/vendors`).
 *
 * Admin tidak membaca booking vendor — hanya identitas usaha, akun pemilik,
 * status langganan, dan status akun (PRD). Helper di sini murni agar gampang
 * diuji dan dipakai ulang begitu API admin tersedia.
 */

/** Status langganan yang tampil di daftar admin. */
export type AdminSubscriptionStatus = 'trial' | 'active' | 'grace' | 'expired'

export interface AdminVendorSummary {
  id: string
  /** Nama usaha vendor. */
  name: string
  /** Nama pemilik akun (dari Google). */
  ownerName: string
  /** Email akun Google pemilik. */
  email: string
  /** Nama kategori usaha (mis. "Wedding Organizer"). */
  category: string | null
  city: string | null
  isActive: boolean
  subscription: {
    status: AdminSubscriptionStatus
    /** ISO date atau null (trial). */
    endsAt: string | null
  }
  bookingsCount: number
  invoicesCount: number
  /** ISO date vendor ditambahkan admin. */
  createdAt: string
}

/** Detail vendor untuk halaman admin (`/admin/vendors/:id`). */
export interface AdminVendorDetail extends AdminVendorSummary {
  description: string | null
  /** Kontak/WA publik vendor. */
  contact: string | null
}

/** Sisa hari langganan (negatif = telah lewat); null bila tidak ada batas. */
export function subscriptionDaysLeft(
  endsAt: string | null,
  todayIso: string,
): number | null {
  if (endsAt === null) return null
  return Math.ceil((new Date(endsAt).getTime() - new Date(todayIso).getTime()) / 86_400_000)
}

/**
 * Transaksi langganan vendor lewat payment gateway (PRD: `subscription_payments`).
 *
 * Admin hanya **melihat** riwayat ini untuk konteks pengelolaan — konfirmasi
 * pembayaran dan pengaturan masa aktif adalah tindakan terpisah.
 */
export type AdminPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded'

export interface AdminSubscriptionPayment {
  id: string
  /** ID transaksi internal yang dikirim ke gateway. */
  reference: string
  vendorId: string
  planName: string
  amount: number
  status: AdminPaymentStatus
  /** Channel gateway, mis. `midtrans-qris`. */
  method: string
  /** ISO datetime dibuat. */
  createdAt: string
  /** ISO datetime dibayar; null bila belum. */
  paidAt: string | null
}


export type AdminVendorFilters = {
  search: string
  subscription: AdminSubscriptionStatus | 'all'
  account: 'all' | 'active' | 'inactive'
}

export const EMPTY_ADMIN_VENDOR_FILTERS: AdminVendorFilters = {
  search: '',
  subscription: 'all',
  account: 'all',
}





/** Tanggal hari ini sebagai `YYYY-MM-DD` (dipakai saat menambah vendor). */
export const todayIso = (): string => toIsoDate(new Date())
