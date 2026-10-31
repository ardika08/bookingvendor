/**
 * Tipe domain inti aplikasi Booking Vendor.
 *
 * Bentuk ini mengikuti skema database di PRD (users, vendors, clients, bookings,
 * packages, invoices, payments). Selama backend Laravel belum ada, data dipasok
 * dari adapter mock di `src/lib/mock/` yang mengembalikan bentuk yang sama,
 * sehingga penggantian ke HTTP API tidak mengubah komponen UI.
 */

export type BookingStatus = 'tentative' | 'confirmed' | 'completed' | 'cancelled'

/** Persis enum `bookings.status` di PRD. */
export const BOOKING_STATUSES: BookingStatus[] = [
  'tentative',
  'confirmed',
  'completed',
  'cancelled',
]

export interface Client {
  id: string
  name: string
  phone: string
  email?: string | null
}

export interface VendorPackage {
  id: string
  name: string
  price: number
}

export interface Booking {
  id: string
  client: Client
  packageId: string | null
  packageName: string | null
  /** ISO date `YYYY-MM-DD`. */
  eventDate: string
  /** `HH:mm` atau null bila jam belum ditentukan. */
  eventTime: string | null
  eventLocation: string | null
  status: BookingStatus
  totalPrice: number
  notes: string | null
  invoiceCount: number
  createdAt: string
}

/**
 * Ringkasan status langganan vendor, dipakai untuk banner masa uji di header.
 *
 * Masa uji berbasis **waktu**: tidak ada kuota booking/invoice. `daysLeft`
 * menggantikan `remainingBookings`/`remainingInvoices` yang dulu ada.
 */
export interface SubscriptionSummary {
  status: 'trial' | 'active' | 'expired'
  endsAt: string | null
  /** Sisa hari masa aktif; null bila tanpa batas atau tidak ada langganan. */
  daysLeft?: number | null
}

export interface VendorProfile {
  id: string
  businessName: string
  category: string | null
  slug: string
  avatarUrl: string | null
}

export interface CurrentUser {
  name: string
  email: string
  avatarUrl: string | null
  role: 'vendor' | 'admin'
  vendor: VendorProfile | null
  subscription: SubscriptionSummary
}

/** Urutan daftar booking. Nilai ini dipetakan ke allowlist di backend. */
export const BOOKING_SORTS = [
  'event_date',
  'event_date_desc',
  'price_desc',
  'created_desc',
] as const

export type BookingSort = (typeof BOOKING_SORTS)[number]

export interface BookingFilters {
  /** `YYYY-MM`, kosong = semua bulan. */
  month: string
  status: BookingStatus | 'all'
  /** Kata kunci nama klien. */
  search: string
  /**
   * Opsional supaya pemanggil lama tetap valid; `undefined` berarti urut
   * tanggal acara terdekat (default backend).
   */
  sort?: BookingSort
}

export interface BookingListResult {
  items: Booking[]
  /** Total baris yang cocok filter, sebelum paginasi. */
  total: number
  page: number
  perPage: number
}
