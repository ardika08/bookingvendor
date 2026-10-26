import { useCallback, useState } from 'react'
import { updateBookingStatus } from '@/lib/api/bookings'
import { ApiError } from '@/lib/api/client'
import { BOOKING_STATUS_META } from '@/lib/booking-status'
import {
  applyStatusOverrides,
  withOverride,
  withoutOverride,
  type StatusOverrides,
} from '@/lib/booking-status-optimistic'
import { useToast } from '@/components/ui/Toast'
import type { Booking, BookingStatus } from '@/types/booking'

/**
 * Optimistic status change untuk daftar booking.
 *
 * Hook tidak memiliki data booking — ia menyimpan `overrides` (id → status baru
 * yang belum dikonfirmasi server) dan menumpuknya di atas hasil fetch. Dengan
 * begitu hook tetap bekerja meski daftar di-refresh di tengah proses.
 *
 * Alur: UI berubah instan → `PATCH /api/bookings/{id}/status` → sukses: override
 * dibuang (status dari server yang menang) + toast konfirmasi; gagal: override
 * dibuang juga sehingga tampilan kembali ke status server + toast error dengan
 * aksi "Coba lagi".
 */
export function useOptimisticBookingStatus(onSettled?: () => void) {
  const [overrides, setOverrides] = useState<StatusOverrides>({})
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const { notify } = useToast()

  const changeStatus = useCallback(
    async (booking: Booking, next: BookingStatus) => {
      if (booking.status === next) return

      setOverrides((prev) => withOverride(prev, booking.id, next))
      setPendingIds((prev) => new Set(prev).add(booking.id))

      try {
        await updateBookingStatus(booking.id, next)
        notify(`${booking.client.name} → ${BOOKING_STATUS_META[next].label}`, { tone: 'success' })
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : 'Perubahan status gagal disimpan. Periksa koneksi lalu coba lagi.'

        notify(message, {
          tone: 'error',
          action: { label: 'Coba lagi', onClick: () => void changeStatus(booking, next) },
        })
      } finally {
        // Sukses atau gagal, override dilepas: sumber kebenaran tetap server.
        setOverrides((prev) => withoutOverride(prev, booking.id))
        setPendingIds((prev) => {
          const nextSet = new Set(prev)
          nextSet.delete(booking.id)
          return nextSet
        })
        onSettled?.()
      }
    },
    [notify, onSettled],
  )

  const applyOverrides = useCallback(
    (items: Booking[]) => applyStatusOverrides(items, overrides),
    [overrides],
  )

  return { changeStatus, applyOverrides, pendingIds }
}
