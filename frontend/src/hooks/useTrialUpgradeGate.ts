import { useCallback, useState } from 'react'
import { ApiError } from '@/lib/api/client'

/**
 * Gerbang modal upgrade untuk error `trial_limit_reached`.
 *
 * Aturan PRD: saat submit ditolak karena jatah trial habis, modal upgrade
 * muncul dan **isian form tetap di layar**. Hook ini hanya mengurus state
 * modal; tidak pernah menyentuh state form — sehingga data form otomatis aman.
 *
 * `blocked` disimpan terpisah agar form bisa menampilkan penanda persisten
 * setelah modal ditutup, supaya vendor tahu kenapa submit gagal.
 *
 * @param autoOpen true bila kuota sudah habis sebelum form dibuka — modal
 *        langsung tampil dan penanda persisten ikut aktif.
 */
export function useTrialUpgradeGate(autoOpen = false) {
  const [open, setOpen] = useState(autoOpen)
  const [blocked, setBlocked] = useState(autoOpen)

  /**
   * Tangani error submit.
   *
   * @returns true bila error adalah batas trial (sudah ditangani), false bila
   *          bukan — pemanggil lanjut menangani error seperti biasa.
   */
  const handleSubmitError = useCallback((error: unknown): boolean => {
    if (error instanceof ApiError && error.isTrialLimit) {
      setBlocked(true)
      setOpen(true)
      return true
    }

    return false
  }, [])

  const close = useCallback(() => setOpen(false), [])

  /** Buka lagi dari penanda persisten. */
  const reopen = useCallback(() => setOpen(true), [])

  return { open, blocked, handleSubmitError, close, reopen }
}
