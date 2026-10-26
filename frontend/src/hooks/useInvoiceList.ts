import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchInvoices } from '@/lib/api/invoices'
import { ApiError } from '@/lib/api/client'
import type { InvoiceFilters, InvoiceListResult } from '@/types/invoice'

/**
 * Hook daftar invoice: memegang filter, meminta data ke API, dan membuang hasil
 * usang (vendor mengetik cepat di kolom pencarian).
 *
 * Pola sengaja dibuat sama dengan `useBookingList` supaya perilaku kedua
 * halaman konsisten: filter = sumber kebenaran, pencarian di-debounce 300 ms,
 * request lama dibatalkan, error berupa `ApiError` agar UI bisa membedakan
 * sesi berakhir (401) dari gangguan jaringan.
 */

export interface InvoiceListState {
  result: InvoiceListResult
  loading: boolean
  /** True hanya pada fetch pertama — dipakai untuk skeleton penuh. */
  initialLoading: boolean
  error: ApiError | Error | null
  filters: InvoiceFilters
  /** Halaman yang sedang ditampilkan (1-based). */
  page: number
  /** Total halaman dari `total` + `perPage` respons server. */
  totalPages: number
  /**
   * Ubah filter dan kembali ke halaman 1.
   *
   * Filter tidak pernah berlaku lintas halaman: kalau vendor sedang di halaman 3
   * lalu mempersempit hasil, halaman itu bisa jadi kosong.
   */
  setFilters: (next: InvoiceFilters) => void
  /** Pindah halaman tanpa mengubah filter. */
  setPage: (next: number) => void
  reload: () => void
}

const EMPTY_RESULT: InvoiceListResult = {
  items: [],
  total: 0,
  page: 1,
  perPage: 0,
  summary: { billed: 0, paid: 0, outstanding: 0, overdueCount: 0 },
}

export function useInvoiceList(
  initialFilters: Partial<InvoiceFilters> = {},
  initialPage = 1,
): InvoiceListState {
  const [filters, setFiltersState] = useState<InvoiceFilters>({
    status: 'all',
    type: 'all',
    search: '',
    ...initialFilters,
  })
  const [page, setPageState] = useState(initialPage > 0 ? initialPage : 1)
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search)
  const [result, setResult] = useState<InvoiceListResult>(EMPTY_RESULT)
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(filters.search), 300)
    return () => window.clearTimeout(timeout)
  }, [filters.search])

  const effectiveFilters = useMemo<InvoiceFilters>(
    () => ({ ...filters, search: debouncedSearch }),
    [filters.status, filters.type, debouncedSearch], // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    fetchInvoices(effectiveFilters, page, 10, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setResult(data)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        // AbortError dari mock delay bukan kegagalan yang perlu ditampilkan.
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof Error ? cause : new Error('Gagal memuat invoice.'))
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setLoading(false)
        setInitialLoading(false)
      })

    return () => controller.abort()
  }, [effectiveFilters, page, reloadToken])

  const setPage = useCallback((next: number) => {
    setPageState(Number.isFinite(next) && next > 0 ? Math.floor(next) : 1)
  }, [])

  const setFilters = useCallback((next: InvoiceFilters) => {
    setFiltersState(next)
    setPageState(1)
  }, [])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  const totalPages = result.perPage > 0 ? Math.max(Math.ceil(result.total / result.perPage), 1) : 1

  return {
    result,
    loading,
    initialLoading,
    error,
    filters,
    page,
    totalPages,
    setFilters,
    setPage,
    reload,
  }
}
