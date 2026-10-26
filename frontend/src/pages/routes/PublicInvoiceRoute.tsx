import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ApiError } from '@/lib/api/client'
import { fetchPublicInvoice, type PublicInvoiceData } from '@/lib/api/public-invoices'
import { PublicInvoicePage } from '@/pages/PublicInvoicePage'

export function PublicInvoiceRoute() {
  const { token = '' } = useParams()
  const [data, setData] = useState<PublicInvoiceData | null>(null)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError(null)

    fetchPublicInvoice(token, controller.signal)
      .then((result) => {
        if (active) setData(result)
      })
      .catch((cause: unknown) => {
        if (!active || (cause instanceof DOMException && cause.name === 'AbortError')) return
        setError(cause instanceof Error ? cause : new Error('Gagal memuat invoice.'))
        setData(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [token, reloadToken])

  if (loading) {
    return (
      <main className="min-h-screen bg-ink-50 px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl space-y-4" aria-busy="true">
          <div className="h-16 animate-pulse rounded-xl bg-white" />
          <div className="h-80 animate-pulse rounded-xl bg-white" />
          <div className="h-40 animate-pulse rounded-xl bg-white" />
        </div>
      </main>
    )
  }

  if (!data) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-8">
        <div className="w-full max-w-md rounded-xl border border-ink-200 bg-white px-6 py-10 text-center">
          <h1 className="text-base font-semibold text-ink-900">
            {notFound ? 'Invoice tidak ditemukan' : 'Invoice belum dapat dimuat'}
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
            {notFound
              ? 'Link mungkin sudah tidak aktif. Silakan minta vendor mengirimkan link invoice yang baru.'
              : error?.message ?? 'Periksa koneksi internet lalu coba lagi.'}
          </p>
          {!notFound ? (
            <Button
              size="sm"
              variant="secondary"
              className="mt-4"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              Coba lagi
            </Button>
          ) : null}
        </div>
      </main>
    )
  }

  return <PublicInvoicePage data={data} />
}
