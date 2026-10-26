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

/** Riwayat transaksi terbaru di atas. */
export function sortPayments(payments: AdminSubscriptionPayment[]): AdminSubscriptionPayment[] {
  return [...payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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

/** Cari berdasarkan nama usaha, pemilik, email, atau kota (tanpa case). */
export function matchesAdminVendorSearch(vendor: AdminVendorSummary, keyword: string): boolean {
  const query = keyword.trim().toLowerCase()
  if (query === '') return true

  return [
    vendor.name,
    vendor.ownerName,
    vendor.email,
    vendor.category ?? '',
    vendor.city ?? '',
  ]
    .some((field) => field.toLowerCase().includes(query))
}

/**
 * Saring daftar vendor untuk admin.
 * Urutan: nonaktif di bawah, lalu terbaru ditambahkan di atas.
 */
export function filterAdminVendors(
  vendors: AdminVendorSummary[],
  filters: AdminVendorFilters,
): AdminVendorSummary[] {
  return vendors
    .filter((vendor) => {
      if (filters.subscription !== 'all' && vendor.subscription.status !== filters.subscription) {
        return false
      }
      if (filters.account === 'active' && !vendor.isActive) return false
      if (filters.account === 'inactive' && vendor.isActive) return false

      return matchesAdminVendorSearch(vendor, filters.search)
    })
    .sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) || b.createdAt.localeCompare(a.createdAt),
    )
}

/** True bila ada filter aktif selain default — dipakai tombol "Reset". */
export function hasActiveAdminVendorFilters(filters: AdminVendorFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.subscription !== 'all' ||
    filters.account !== 'all'
  )
}

/** Rekap ringkas untuk strip di atas daftar. */
export function summarizeAdminVendors(vendors: AdminVendorSummary[]): {
  total: number
  active: number
  activeSubscription: number
  trial: number
} {
  return {
    total: vendors.length,
    active: vendors.filter((vendor) => vendor.isActive).length,
    activeSubscription: vendors.filter((vendor) => vendor.subscription.status === 'active').length,
    trial: vendors.filter((vendor) => vendor.subscription.status === 'trial').length,
  }
}

/** Tanggal hari ini sebagai `YYYY-MM-DD` (dipakai saat menambah vendor). */
export const todayIso = (): string => toIsoDate(new Date())
