import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/api/client'
import {
  fetchClients,
  type ClientFilters,
  type ClientSummary,
} from '@/lib/api/clients'

const DEFAULT_FILTERS: ClientFilters = { search: '', sort: 'recent' }
const PER_PAGE = 10

/**
 * State daftar klien: filter, paginasi, dan pemuatan ulang.
 *
 * Pencarian ditunda 300 ms sebelum dikirim. Tanpa jeda itu setiap ketikan
 * menjadi satu permintaan HTTP, dan hasil lama bisa tiba setelah hasil baru
 * (race condition) sehingga tabel menampilkan data yang tidak cocok dengan
 * kotak pencarian.
 */
export function useClientList() {
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<ClientFilters>(DEFAULT_FILTERS)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Menyimpan permintaan terakhir supaya respons yang sudah usang dibuang.
  const requestId = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300)
    return () => clearTimeout(timer)
  }, [filters.search])

  // Setiap perubahan pencarian atau urutan mengembalikan tampilan ke halaman 1,
  // karena hasil lama di halaman 3 belum tentu ada pada kata kunci baru.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, filters.sort])

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const current = ++requestId.current

      setLoading(true)
      setError(null)

      try {
        const data = await fetchClients(
          { search: debouncedSearch, sort: filters.sort },
          page,
          PER_PAGE,
          signal,
        )

        // Abaikan hasil yang bukan dari permintaan terakhir.
        if (current !== requestId.current) return

        setClients(data.items)
        setTotal(data.total)
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        if (current !== requestId.current) return

        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Daftar klien gagal dimuat. Periksa koneksi lalu coba lagi.',
        )
        setClients([])
        setTotal(0)
      } finally {
        if (current === requestId.current) {
          setLoading(false)
          setInitialLoading(false)
        }
      }
    },
    [debouncedSearch, filters.sort, page],
  )

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const reload = useCallback(() => {
    void load()
  }, [load])

  return {
    clients,
    total,
    page,
    perPage: PER_PAGE,
    filters,
    setFilters,
    loading,
    initialLoading,
    error,
    setPage,
    reload,
    hasFilter: filters.search.trim() !== '' || filters.sort !== 'recent',
  }
}
