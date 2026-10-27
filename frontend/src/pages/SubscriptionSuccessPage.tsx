import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock3, LoaderCircle, XCircle } from '@/components/ui/icons'
import { checkPaymentStatus, fetchSubscription } from '@/lib/api/subscription'

/**
 * Halaman tujuan setelah vendor menyelesaikan pembayaran di Duitku
 * (`DUITKU_RETURN_URL`).
 *
 * Duitku mengarahkan browser ke sini, tetapi **tidak** mengirim status yang
 * bisa dipercaya — status sebenarnya ditentukan webhook. Karena itu halaman ini
 * hanya menampilkan hasil polling; ia tidak pernah mengaktifkan langganan.
 *
 * Webhook bisa tiba beberapa detik setelah browser kembali, jadi status
 * "pending" di sini normal: halaman akan mencoba ulang beberapa kali.
 */
export function SubscriptionSuccessPage() {
  const [params] = useSearchParams()
  const reference = params.get('merchantOrderId') ?? params.get('reference') ?? ''

  const [state, setState] = useState<'checking' | 'paid' | 'pending' | 'unknown'>('checking')
  const [endsAt, setEndsAt] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let attempts = 0

    // Webhook Duitku biasanya masuk dalam hitungan detik; 5 percobaan dengan
    // jeda 2 detik memberi ruang tanpa membuat vendor menunggu terlalu lama.
    const poll = async () => {
      attempts += 1

      try {
        if (reference !== '') {
          const { status } = await checkPaymentStatus(reference)

          if (!active) return

          if (status === 'confirmed') {
            setState('paid')
            const subscription = await fetchSubscription()
            if (active) setEndsAt(subscription.endsAt)
            return
          }

          if (status === 'expired' || status === 'rejected') {
            setState('unknown')
            return
          }
        } else {
          // Tanpa referensi, satu-satunya sumber kebenaran adalah status langganan.
          const subscription = await fetchSubscription()
          if (!active) return

          if (subscription.status === 'active') {
            setState('paid')
            setEndsAt(subscription.endsAt)
            return
          }
        }
      } catch {
        if (active && attempts >= 5) setState('unknown')
      }

      if (!active) return

      if (attempts >= 5) {
        setState('pending')
        return
      }

      setTimeout(poll, 2000)
    }

    poll()

    return () => {
      active = false
    }
  }, [reference])

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-ink-200 bg-white p-8 text-center shadow-sm">
        {state === 'checking' ? (
          <>
            <LoaderCircle className="mx-auto size-10 animate-spin text-brand-700" />
            <h1 className="mt-4 text-title text-ink-900">Memeriksa pembayaran…</h1>
            <p className="mt-1 text-body text-ink-500">Mohon tunggu sebentar, jangan tutup halaman ini.</p>
          </>
        ) : null}

        {state === 'paid' ? (
          <>
            <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
            <h1 className="mt-4 text-title text-ink-900">Pembayaran berhasil</h1>
            <p className="mt-1 text-body text-ink-500">
              Langganan Anda sudah aktif
              {endsAt ? ` sampai ${new Date(endsAt).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}` : ''}.
            </p>
            <Link
              to="/dashboard"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-brand-400 px-5 text-body font-medium text-ink-900 hover:bg-brand-500"
            >
              Ke dashboard
            </Link>
          </>
        ) : null}

        {state === 'pending' ? (
          <>
            <Clock3 className="mx-auto size-10 text-amber-500" />
            <h1 className="mt-4 text-title text-ink-900">Pembayaran sedang diproses</h1>
            <p className="mt-1 text-body text-ink-500">
              Kami belum menerima konfirmasi dari penyedia pembayaran. Langganan akan aktif
              otomatis begitu pembayaran terkonfirmasi — tidak perlu membayar ulang.
            </p>
            <Link
              to="/upgrade"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-lg border border-ink-200 px-5 text-body font-medium text-ink-700 hover:bg-ink-50"
            >
              Lihat status langganan
            </Link>
          </>
        ) : null}

        {state === 'unknown' ? (
          <>
            <XCircle className="mx-auto size-10 text-rose-500" />
            <h1 className="mt-4 text-title text-ink-900">Pembayaran belum terkonfirmasi</h1>
            <p className="mt-1 text-body text-ink-500">
              Transaksi tidak ditemukan atau sudah kedaluwarsa. Bila Anda sudah membayar, hubungi
              kami dengan menyertakan bukti pembayaran.
            </p>
            <Link
              to="/upgrade"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-brand-400 px-5 text-body font-medium text-ink-900 hover:bg-brand-500"
            >
              Kembali ke paket
            </Link>
          </>
        ) : null}
      </div>
    </div>
  )
}
