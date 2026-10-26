import type { InvoiceFilters, InvoiceStatus } from '@/types/invoice'
import { INVOICE_STATUSES, INVOICE_TYPES } from '@/types/invoice'

/**
 * Sinkronisasi filter daftar invoice dengan query string URL.
 *
 * Nama parameter mengikuti kontrak API: `status`, `type`, `q`, `page` —
 * sehingga URL bisa di-refresh atau dibagikan tanpa kehilangan konteks.
 */

const VALID_STATUS = new Set<string>(INVOICE_STATUSES)
const VALID_TYPE = new Set<string>(INVOICE_TYPES)

export function parseInvoiceFilters(
  searchParams: URLSearchParams,
): InvoiceFilters & { page: number } {
  const status = searchParams.get('status') ?? 'all'
  const type = searchParams.get('type') ?? 'all'
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10)

  return {
    status: VALID_STATUS.has(status) ? (status as InvoiceStatus) : 'all',
    type: VALID_TYPE.has(type) ? (type as InvoiceFilters['type']) : 'all',
    search: (searchParams.get('q') ?? '').slice(0, 100),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  }
}

/** Bangun query string dari filter; nilai default tidak ikut ditulis. */
export function buildInvoiceFilterQuery(
  filters: InvoiceFilters,
  page = 1,
  base: URLSearchParams = new URLSearchParams(),
): string {
  const params = new URLSearchParams(base)

  setOrDelete(params, 'status', filters.status === 'all' ? null : filters.status)
  setOrDelete(params, 'type', filters.type === 'all' ? null : filters.type)
  setOrDelete(params, 'q', filters.search.trim() || null)
  setOrDelete(params, 'page', page > 1 ? String(page) : null)

  return params.toString()
}

/** True bila ada filter aktif selain default — dipakai tombol "Reset". */
export function hasActiveInvoiceFilters(filters: InvoiceFilters): boolean {
  return filters.status !== 'all' || filters.type !== 'all' || filters.search.trim() !== ''
}

function setOrDelete(params: URLSearchParams, key: string, value: string | null) {
  if (value === null) params.delete(key)
  else params.set(key, value)
}
