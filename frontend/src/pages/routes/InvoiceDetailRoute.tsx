import { useCallback, useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import {
  fetchBookingInvoices,
  fetchInvoice,
  fetchInvoicePayments,
  recordInvoicePayment,
} from '@/lib/api/invoices'
import { fetchVendorProfile } from '@/lib/api/vendor-profile'
import { toIsoDate } from '@/lib/format'
import { ApiError } from '@/lib/api/client'
import {
  InvoiceDetailError,
  InvoiceDetailPage,
  InvoiceDetailSkeleton,
} from '@/pages/InvoiceDetailPage'
import type { VendorProfileDetail } from '@/lib/vendor-profile'
import type { PaymentPayload } from '@/lib/payment-form'
import type { Invoice, InvoicePayment } from '@/types/invoice'

/**
 * Route `/invoices/:invoiceId`.
 *
 * Mengambil invoice beserta tagihan lain pada booking yang sama lewat lapisan
 * API (mock selama backend belum aktif). ID yang tidak ada dijawab dengan layar
 * "tidak ditemukan" — bukan redirect diam-diam — karena invoice biasanya
 * dibuka langsung dari tautan.
 */
export function InvoiceDetailRoute() {
  const { invoiceId = '' } = useParams()
  const { invoice, siblings, payments, vendorProfile, loading, notFound, reload } =
    useInvoiceDetail(invoiceId)

  if (loading) return <InvoiceDetailSkeleton />
  if (!invoice) return <InvoiceDetailError notFound={notFound} onRetry={reload} />
  if (notFound) return <Navigate to="/invoices" replace />

  return (
    <InvoiceDetailPage
      invoice={invoice}
      siblings={siblings}
      payments={payments}
      vendorProfile={vendorProfile}
      onRecordPayment={async (payload: PaymentPayload) => {
        await recordInvoicePayment(payload)
        reload()
      }}
      onMarkPaid={async (amount: number) => {
        await recordInvoicePayment({
          invoice_id: invoice.id,
          amount,
          paid_at: toIsoDate(new Date()),
          method: 'transfer',
          note: 'Ditandai lunas oleh vendor',
        })
        reload()
      }}
      onReorderTerms={() => reload()}
    />
  )
}

function useInvoiceDetail(invoiceId: string) {
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [siblings, setSiblings] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<InvoicePayment[]>([])
  const [vendorProfile, setVendorProfile] = useState<VendorProfileDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setNotFound(false)

    fetchInvoice(invoiceId, controller.signal)
      .then(async (result) => {
        if (!active) return
        setInvoice(result)
        const [related, paymentHistory, profile] = await Promise.all([
          fetchBookingInvoices(result.bookingId, controller.signal),
          fetchInvoicePayments(result.id, controller.signal),
          fetchVendorProfile(controller.signal).catch(() => null),
        ])
        if (active) {
          setSiblings(related)
          setPayments(paymentHistory)
          setVendorProfile(profile)
        }
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        if (cause instanceof ApiError && cause.status === 404) {
          setNotFound(true)
          return
        }
        setInvoice(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [invoiceId, reloadToken])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  return { invoice, siblings, payments, vendorProfile, loading, notFound, reload }
}
