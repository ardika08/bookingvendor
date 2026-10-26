import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchBookings } from '@/lib/api/bookings'
import { ApiError } from '@/lib/api/client'
import type { BookingFilters, BookingListResult } from '@/types/booking'

/**
 * Hook daftar booking: memegang filter, melakukan request ke API, dan menjaga
 * agar hasil lama tidak menimpa hasil baru (race condition saat vendor mengetik
 * cepat di kolom pencarian).
 *
 * Perilaku:
 * - `filters` adalah sumber kebenaran; setiap perubahan memicu fetch baru.
 * - Kolom pencarian di-debounce 300 ms di sisi pemanggil (`setSearch`), filter
 *   lain langsung.
 * - Request sebelumnya dibatalkan (`AbortController`) supaya server tidak
 *   dipanggil untuk query yang sudah usang.
 * - `error` berisi `ApiError` sehingga UI bisa membedakan sesi berakhir (401)
 *   dari gangguan jaringan.
 */
export interface BookingListState {
  result: BookingListResult
  loading: boolean
  /** True hanya pada fetch pertama — dipakai untuk skeleton penuh. */
  initialLoading: boolean
  error: ApiError | Error | null
  filters: BookingFilters
  setFilters: (next: BookingFilters) => void
  setSearch: (search: string) => void
  reload: () => void
}

const EMPTY_RESULT: BookingListResult = { items: [], total: 0, page: 1, perPage: 0 }

export function useBookingList(
  initialFilters: Partial<BookingFilters> = {},
  page = 1,
): BookingListState {
  const [filters, setFiltersState] = useState<BookingFilters>({
    month: '',
    status: 'all',
    search: '',
    ...initialFilters,
  })
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search)
  const [result, setResult] = useState<BookingListResult>(EMPTY_RESULT)
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  // Debounce kata kunci pencarian saja; filter lain responsif seketika.
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(filters.search), 300)
    return () => window.clearTimeout(timeout)
  }, [filters.search])

  /*
   * `sort` wajib ada di dependency: tanpa itu, memilih urutan lain mengubah
   * URL tetapi tidak memicu request ulang, sehingga tabel tetap menampilkan
   * urutan lama. Sebelumnya `eslint-disable` di baris ini menyembunyikan
   * dependency yang hilang tersebut.
   */
  const effectiveFilters = useMemo<BookingFilters>(
    () => ({ ...filters, search: debouncedSearch }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.month, filters.status, filters.sort, debouncedSearch],
  )

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    fetchBookings(effectiveFilters, page)
      .then((data) => {
        if (controller.signal.aborted) return
        setResult(data)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause : new Error('Gagal memuat booking.'))
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setLoading(false)
        setInitialLoading(false)
      })

    return () => controller.abort()
  }, [effectiveFilters, page, reloadToken])

  const setFilters = useCallback((next: BookingFilters) => {
    setFiltersState(next)
  }, [])

  const setSearch = useCallback((search: string) => {
    setFiltersState((prev) => ({ ...prev, search }))
  }, [])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  return { result, loading, initialLoading, error, filters, setFilters, setSearch, reload }
}
