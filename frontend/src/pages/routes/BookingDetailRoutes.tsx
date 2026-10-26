import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { BookingDetailPage } from '@/pages/BookingDetailPage'
import { BookingEditForm } from '@/pages/BookingEditPage'
import { useToast } from '@/components/ui/Toast'
import {
  fetchBooking,
  fetchPackages,
  fetchTakenDates,
  updateBooking,
  updateBookingStatus,
} from '@/lib/api/bookings'
import { ApiError } from '@/lib/api/client'
import type { Booking, VendorPackage } from '@/types/booking'

/**
 * Route detail & edit booking.
 *
 * Satu modul menangani keduanya karena berbagi data yang sama: detail
 * (`/bookings/:id`) dan edit (`/bookings/:id/edit`). Saat backend aktif, detail
 * diambil via `GET /api/bookings/{id}`; dalam mode mock datanya dari file mock.
 * ID tidak ditemukan → kembali ke daftar (bukan layar kosong).
 */
export function BookingDetailRoute() {
  const { bookingId = '' } = useParams()
  const { booking, loading, notFound } = useBooking(bookingId)
  const { notify } = useToast()

  if (loading || !booking) return <DetailSkeleton />
  if (notFound) return <Navigate to="/bookings" replace />

  return (
    <BookingDetailPage
      booking={booking}
      onChangeStatus={async (status) => {
        try {
          await updateBookingStatus(bookingId, status)
          return true
        } catch (error) {
          notify(
            error instanceof ApiError
              ? error.message
              : 'Perubahan status gagal disimpan. Periksa koneksi lalu coba lagi.',
            { tone: 'error' },
          )
          return false
        }
      }}
    />
  )
}

export function BookingEditRoute() {
  const { bookingId = '' } = useParams()
  const { booking, loading, notFound } = useBooking(bookingId)
  const [packages, setPackages] = useState<VendorPackage[]>([])
  const [takenDates, setTakenDates] = useState<string[]>([])

  useEffect(() => {
    let active = true
    Promise.all([fetchPackages(), fetchTakenDates(bookingId)]).then(([packageList, dates]) => {
      if (!active) return
      setPackages(packageList)
      setTakenDates(dates)
    })
    return () => {
      active = false
    }
  }, [bookingId])

  const handleSave = useCallback(
    async (payload: Parameters<typeof updateBooking>[1]) => {
      await updateBooking(bookingId, payload)
    },
    [bookingId],
  )

  if (loading || !booking) return <DetailSkeleton />
  if (notFound) return <Navigate to="/bookings" replace />

  return (
    <BookingEditForm
      booking={booking}
      packages={packages}
      takenDates={takenDates}
      onSave={handleSave}
    />
  )
}

/** Ambil satu booking dari lapisan API. */
function useBooking(bookingId: string) {
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setNotFound(false)

    fetchBooking(bookingId)
      .then((result) => {
        if (!active) return
        setBooking(result)
      })
      .catch(() => {
        if (active) setNotFound(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [bookingId])

  return useMemo(() => ({ booking, loading, notFound }), [booking, loading, notFound])
}

export function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="h-4 w-32 animate-pulse rounded bg-ink-100" />
      <div className="h-24 animate-pulse rounded-xl bg-white" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="h-48 animate-pulse rounded-xl bg-white" />
        <div className="h-48 animate-pulse rounded-xl bg-white" />
      </div>
    </div>
  )
}
