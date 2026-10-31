import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchBooking } from '@/lib/api/bookings'
import { createInvoice, fetchBookingInvoices } from '@/lib/api/invoices'
import { InvoiceCreateFormPage } from '@/pages/InvoiceCreateFormPage'
import { DetailSkeleton } from '@/pages/routes/BookingDetailRoutes'
import { InvoiceDetailError } from '@/pages/InvoiceDetailPage'
import type { InvoicePayload } from '@/lib/invoice-form'
import type { Booking } from '@/types/booking'
import type { Invoice } from '@/types/invoice'
import { ApiError } from '@/lib/api/client'

/**
 * Route `/bookings/:bookingId/invoice/new`.
 *
 * Invoice selalu terbit dari booking, jadi route ini memuat booking + seluruh
 * invoice yang sudah ada (dasar perhitungan sisa kontrak) sebelum menampilkan
 * form. Setelah submit sukses, form menavigasi sendiri ke daftar invoice.
 */
export function InvoiceCreateRoute() {
  const { bookingId = '' } = useParams()
  const { booking, invoices, loading, notFound, reload } = useInvoiceCreateData(bookingId)

  const handleSubmit = useCallback(
    async (payload: InvoicePayload) => {
      await createInvoice(bookingId, payload)
    },
    [bookingId],
  )

  if (loading) return <DetailSkeleton />
  if (!booking) return <InvoiceDetailError notFound={notFound} onRetry={reload} />

  return (
    <InvoiceCreateFormPage
      booking={booking}
      existingInvoices={invoices}
      onSubmit={handleSubmit}
    />
  )
}

function useInvoiceCreateData(bookingId: string) {
  const [booking, setBooking] = useState<Booking | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setNotFound(false)

    fetchBooking(bookingId)
      .then(async (result) => {
        if (!active) return
        setBooking(result)
        const related = await fetchBookingInvoices(bookingId)
        if (active) setInvoices(related)
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 404) setNotFound(true)
        setBooking(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [bookingId, reloadToken])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  return { booking, invoices, loading, notFound, reload }
}
