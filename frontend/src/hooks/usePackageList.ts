import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchPackagesList } from '@/lib/api/vendor-packages'
import { ApiError } from '@/lib/api/client'
import {
  EMPTY_PACKAGE_FILTERS,
  hasActivePackageFilters,
  type PackageFilters,
  type VendorPackageDetail,
} from '@/lib/vendor-packages'

/**
 * Hook daftar paket layanan vendor.
 *
 * Pola sama dengan `useBookingList`/`useInvoiceList`: filter = sumber kebenaran,
 * pencarian di-debounce 300 ms, request lama dibatalkan, error berupa `ApiError`
 * agar UI bisa membedakan sesi berakhir (401) dari gangguan jaringan.
 */
export interface PackageListState {
  packages: VendorPackageDetail[]
  loading: boolean
  initialLoading: boolean
  error: ApiError | Error | null
  filters: PackageFilters
  setFilters: (next: PackageFilters) => void
  /** Ganti satu paket di state lokal setelah simpan/hapus tanpa fetch ulang. */
  replacePackage: (pkg: VendorPackageDetail) => void
  removePackage: (id: string) => void
  /** Sisipkan paket baru ke daftar (hasil `POST /api/packages`). */
  appendPackage: (pkg: VendorPackageDetail) => void
  /** True bila ada filter aktif selain default — dipakai tombol "Reset". */
  hasFilter: boolean
  reload: () => void
}

export function usePackageList(): PackageListState {
  const [filters, setFiltersState] = useState<PackageFilters>(EMPTY_PACKAGE_FILTERS)
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search)
  const [packages, setPackages] = useState<VendorPackageDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(filters.search), 300)
    return () => window.clearTimeout(timeout)
  }, [filters.search])

  const effectiveFilters = useMemo<PackageFilters>(
    () => ({ active: filters.active, search: debouncedSearch }),
    [filters.active, debouncedSearch],
  )

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    fetchPackagesList(effectiveFilters, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setPackages(data)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof Error ? cause : new Error('Gagal memuat paket layanan.'))
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setLoading(false)
        setInitialLoading(false)
      })

    return () => controller.abort()
  }, [effectiveFilters, reloadToken])

  const setFilters = useCallback((next: PackageFilters) => {
    setFiltersState(next)
  }, [])

  const replacePackage = useCallback((pkg: VendorPackageDetail) => {
    setPackages((prev) => prev.map((item) => (item.id === pkg.id ? pkg : item)))
  }, [])

  const removePackage = useCallback((id: string) => {
    setPackages((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const appendPackage = useCallback((pkg: VendorPackageDetail) => {
    setPackages((prev) => [...prev, pkg])
  }, [])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  const hasFilter = hasActivePackageFilters(filters)

  return {
    packages,
    loading,
    initialLoading,
    error,
    filters,
    setFilters,
    replacePackage,
    removePackage,
    appendPackage,
    reload,
    hasFilter,
  }
}
