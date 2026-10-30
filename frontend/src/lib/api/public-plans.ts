import { useEffect, useState } from 'react'
import { apiRequest } from './client'
import type { Plan } from '@/types/subscription'

/**
 * Katalog paket untuk halaman promosi (publik, tanpa sesi).
 *
 * Sebelumnya halaman promosi memakai `mockPlans` yang harganya di-hardcode dan
 * dua paketnya bernilai `null`, sehingga kartu menampilkan "Segera" dengan
 * tombol mati meski admin sudah menetapkan harga ketiga paket. Calon vendor
 * yang membuka halaman jualan melihat paket yang sebenarnya bisa dibeli sebagai
 * "belum tersedia".
 *
 * Sekarang harga diambil dari `GET /api/public/plans` — endpoint publik yang
 * memang disediakan untuk halaman ini.
 */
export async function fetchPublicPlans(signal?: AbortSignal): Promise<Plan[]> {
  return apiRequest<Plan[]>('/public/plans', { signal })
}

/**
 * Hook pemuat paket untuk halaman promosi.
 *
 * Mengembalikan `null` selama memuat, dan array kosong bila gagal. Halaman
 * promosi memperlakukan kegagalan dengan menyembunyikan seksi harga, bukan
 * menampilkan angka palsu — harga yang salah lebih buruk daripada tidak ada
 * harga sama sekali di halaman jualan.
 */
export function usePublicPlans(): { plans: Plan[] | null; failed: boolean } {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    fetchPublicPlans(controller.signal)
      .then((list) => {
        if (!controller.signal.aborted) setPlans(list)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailed(true)
          setPlans([])
        }
      })

    return () => {
      controller.abort()
    }
  }, [])

  return { plans, failed }
}
