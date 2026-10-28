import { apiRequest } from './client'

/**
 * API kelola vendor untuk admin (`/admin/vendors`).
 *
 * Backend sudah lama menyediakan endpoint ini (`AdminVendorController`), tetapi
 * halaman admin sebelumnya memakai data contoh. Modul ini menyambungkannya ke
 * data nyata.
 *
 * CATATAN CAKUPAN: admin tidak membaca data operasional vendor (booking,
 * invoice). Yang dikirim backend hanya hitungan jumlahnya, bukan isinya.
 */

export type AdminSubscriptionStatus = 'trial' | 'active' | 'grace' | 'expired'

export interface AdminVendorSummary {
  id: string
  name: string
  ownerName: string
  email: string
  category: string | null
  city: string | null
  description: string | null
  contact: string | null
  isActive: boolean
  subscription: {
    status: AdminSubscriptionStatus
    endsAt: string | null
  }
  bookingsCount: number
  invoicesCount: number
  createdAt: string | null
}

export interface AdminVendorFilters {
  search: string
  subscription: AdminSubscriptionStatus | 'all'
  account: 'all' | 'active' | 'inactive'
}

export const EMPTY_ADMIN_VENDOR_FILTERS: AdminVendorFilters = {
  search: '',
  subscription: 'all',
  account: 'all',
}

/**
 * Daftar vendor.
 *
 * Pencarian & filter status akun dikerjakan server (query `q`, `account`).
 * Filter langganan juga dikerjakan server karena statusnya turunan dari
 * tanggal, bukan kolom biasa.
 */
export async function fetchAdminVendors(
  filters: AdminVendorFilters = EMPTY_ADMIN_VENDOR_FILTERS,
  signal?: AbortSignal,
): Promise<AdminVendorSummary[]> {
  const query: Record<string, string> = {}

  if (filters.search.trim() !== '') query.q = filters.search.trim()
  if (filters.account !== 'all') query.account = filters.account
  if (filters.subscription !== 'all') query.subscription = filters.subscription

  return apiRequest<AdminVendorSummary[]>('/admin/vendors', { query, signal })
}

export async function fetchAdminVendor(
  id: string,
  signal?: AbortSignal,
): Promise<AdminVendorSummary> {
  return apiRequest<AdminVendorSummary>(`/admin/vendors/${id}`, { signal })
}

/* ------------------------------------------------------------------ *
 * Riwayat transaksi langganan vendor
 * ------------------------------------------------------------------ */

/** Status pembayaran gateway, sesuai kolom `subscription_payments.status`. */
export type AdminPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded'

export interface AdminSubscriptionPayment {
  id: string
  /** `order_id` yang dikirim ke gateway. */
  reference: string
  vendorId: string
  planName: string
  amount: number
  status: AdminPaymentStatus
  /** Channel pembayaran, fallback ke nama gateway. */
  method: string
  /** ISO date `YYYY-MM-DD`. */
  createdAt: string
  /** ISO date `YYYY-MM-DD`; null bila belum dibayar. */
  paidAt: string | null
}

/**
 * Riwayat transaksi satu vendor.
 *
 * Backend sudah mengurutkan dari yang terbaru (`created_at` desc), jadi urutan
 * dari server dipakai apa adanya — mengurutkan ulang di klien hanya menambah
 * tempat untuk berbeda pendapat dengan server.
 */
export async function fetchAdminVendorPayments(
  id: string,
  signal?: AbortSignal,
): Promise<AdminSubscriptionPayment[]> {
  return apiRequest<AdminSubscriptionPayment[]>(`/admin/vendors/${id}/payments`, { signal })
}

/* ------------------------------------------------------------------ *
 * Tambah vendor
 * ------------------------------------------------------------------ */

/**
 * Nilai form tambah vendor. Backend memakai snake_case.
 *
 * `email` adalah email akun Google calon vendor — harus belum terdaftar
 * (backend menolak dengan 422 bila sudah dipakai akun lain).
 */
export interface CreateAdminVendorPayload {
  name: string
  owner_name: string
  email: string
  category: string
  city: string | null
}

export async function createAdminVendor(
  payload: CreateAdminVendorPayload,
): Promise<AdminVendorSummary> {
  return apiRequest<AdminVendorSummary>('/admin/vendors', {
    method: 'POST',
    body: payload,
  })
}

/* ------------------------------------------------------------------ *
 * Aktivasi / perpanjangan langganan manual
 * ------------------------------------------------------------------ */

export interface RenewSubscriptionResult {
  id: string
  status: string
  planName: string | null
  /** ISO date `YYYY-MM-DD`. */
  startsAt: string | null
  /** ISO date `YYYY-MM-DD`. */
  endsAt: string | null
  amountPaid: number
}

/**
 * Aktifkan/perpanjang langganan vendor tanpa lewat gateway.
 *
 * Dipakai saat webhook gateway gagal atau vendor membayar di luar gateway.
 * Backend menghitung masa aktif dari tanggal berakhir yang masih berlaku
 * (menumpuk), atau dari hari ini bila langganan sudah lewat — jadi UI tidak
 * perlu menghitung sendiri, cukup menampilkan hasilnya.
 */
export async function renewAdminVendorSubscription(
  vendorId: string,
  planId: string,
): Promise<RenewSubscriptionResult> {
  return apiRequest<RenewSubscriptionResult>(`/admin/vendors/${vendorId}/subscriptions/renew`, {
    method: 'POST',
    body: { plan_id: planId },
  })
}

/** Nilai form edit vendor. Backend memakai snake_case. */
export interface UpdateAdminVendorPayload {
  name: string
  owner_name: string
  category: string
  city: string | null
  description: string | null
  contact: string | null
}

export async function updateAdminVendor(
  id: string,
  payload: UpdateAdminVendorPayload,
): Promise<AdminVendorSummary> {
  return apiRequest<AdminVendorSummary>(`/admin/vendors/${id}`, {
    method: 'PATCH',
    body: payload,
  })
}

/**
 * Aktif/nonaktifkan akun vendor.
 *
 * Ini satu-satunya aksi "hapus" yang dipakai panel admin: vendor tidak bisa
 * masuk lagi, tetapi booking, klien, dan invoice miliknya tetap utuh dan bisa
 * diaktifkan kembali kapan saja.
 */
export async function setAdminVendorActive(
  id: string,
  isActive: boolean,
): Promise<AdminVendorSummary> {
  return apiRequest<AdminVendorSummary>(`/admin/vendors/${id}/status`, {
    method: 'PATCH',
    // Backend memakai nama kolom `is_active`, bukan camelCase.
    body: { is_active: isActive },
  })
}
