import { apiRequest } from './client'

/**
 * Lapisan API daftar klien.
 *
 * Klien dibuat otomatis saat booking disimpan, jadi di sini hanya ada operasi
 * baca. `USE_MOCK_DATA` tidak dipakai lagi: endpoint backend sudah tersedia dan
 * data mock akan menyembunyikan masalah nyata seperti isolasi antar-vendor.
 */

/** Satu baris klien beserta ringkasan pemakaiannya. */
export interface ClientSummary {
  id: string
  name: string
  phone: string
  email: string | null
  address: string | null
  notes: string | null
  bookingCount: number
  totalValue: number
  /** Tanggal acara terakhir (`YYYY-MM-DD`), null bila belum pernah booking. */
  lastEventDate: string | null
  /** Status booking terakhir, null bila belum pernah booking. */
  lastStatus: string | null
  createdAt: string | null
}

export type ClientSort = 'recent' | 'name' | 'value' | 'bookings'

export interface ClientFilters {
  search: string
  sort: ClientSort
}

export interface PaginatedClients {
  items: ClientSummary[]
  total: number
  page: number
  perPage: number
}

/**
 * Daftar klien dengan pencarian, urutan, dan paginasi.
 *
 * Filter dikerjakan di server supaya vendor dengan ratusan klien tidak
 * mengunduh seluruh tabel hanya untuk menyaring satu nama.
 */
export async function fetchClients(
  filters: ClientFilters,
  page: number,
  perPage: number,
  signal?: AbortSignal,
): Promise<PaginatedClients> {
  return apiRequest<PaginatedClients>('/clients', {
    query: {
      q: filters.search.trim() || undefined,
      sort: filters.sort,
      page,
      per_page: perPage,
    },
    signal,
  })
}

/** Detail satu klien. 404 bila klien milik vendor lain. */
export async function fetchClient(
  id: string,
  signal?: AbortSignal,
): Promise<ClientSummary> {
  return apiRequest<ClientSummary>(`/clients/${encodeURIComponent(id)}`, { signal })
}
