import { useEffect, useState } from 'react'
import { fetchBookingSummary, type BookingSummary } from '@/lib/api/bookings'
import type { BookingFilters } from '@/types/booking'

const EMPTY: BookingSummary = {
  total: 0,
  byStatus: { tentative: 0, confirmed: 0, completed: 0, cancelled: 0 },
  revenue: 0,
}

/**
 * Agregat booking untuk kartu ringkasan.
 *
 * Dipisah dari `useBookingList` karena siklus hidupnya berbeda: daftar berubah
 * tiap halaman/pencarian, sedangkan ringkasan hanya bergantung pada bulan dan
 * kata kunci. Memisahkan keduanya mencegah tabel ikut berkedip saat ringkasan
 * dimuat ulang.
 */
export function useBookingSummary(filters: BookingFilters): {
  summary: BookingSummary
  loading: boolean
} {
  const [summary, setSummary] = useState<BookingSummary>(EMPTY)
  const [loading, setLoading] = useState(true)

  // Hanya bulan & pencarian yang memengaruhi agregat.
  const { month, search } = filters

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)

    fetchBookingSummary({ month, status: 'all', search }, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setSummary(data)
      })
      .catch(() => {
        // Kartu ringkasan bersifat pelengkap: kegagalan di sini tidak boleh
        // menjatuhkan halaman. Nilai lama dipertahankan apa adanya.
        if (controller.signal.aborted) return
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setLoading(false)
      })

    return () => controller.abort()
  }, [month, search])

  return { summary, loading }
}
