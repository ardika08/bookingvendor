import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'

/**
 * Modal pemberitahuan saat jalur pembayaran masih dikunci
 * (`CHECKOUT_LOCKED` saat akun Duitku produksi belum aktif).
 *
 * Dipisah ke berkas sendiri karena dipakai DUA halaman yang sama-sama punya
 * katalog paket: `/upgrade` (UpgradePage) dan `/langganan` tab Paket
 * (SubscriptionPage). Sempat tertulis di dalam UpgradePage saja, dan
 * akibatnya `/langganan` tetap membuka checkout — halaman itu punya tombol
 * sendiri yang tidak ikut terkunci.
 */
export function CheckoutLockedModal({
  plan,
  onClose,
}: {
  plan: { name: string }
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="locked-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-t-2xl bg-white shadow-xl focus:outline-none sm:rounded-2xl"
      >
        <div className="border-b border-ink-100 px-5 py-4">
          <p className="text-caption font-medium text-brand-700">Masa Testing VendorKit</p>
          <h2 id="locked-title" className="mt-0.5 text-lead font-semibold text-ink-900">
            Pembayaran Belum Dibuka
          </h2>
        </div>

        <div className="space-y-3 px-5 py-4 text-body leading-relaxed text-ink-700">
          <p>
            Terima kasih sudah berminat upgrade ke paket{' '}
            <span className="font-semibold text-ink-900">{plan.name}</span>!
          </p>
          <p className="text-meta text-ink-600">
            Saat ini jalur pembayaran online sedang dalam tahap aktivasi gateway. Selama masa
            testing ini, kamu{' '}
            <span className="font-semibold text-ink-900">tetap bisa memakai semua fitur</span>{' '}
            tanpa batasan dan tanpa perlu membayar apa pun.
          </p>
          <div className="rounded-lg border border-brand-200 bg-brand-50/60 px-3.5 py-3">
            <p className="text-meta text-ink-700">
              Jatah booking &amp; invoice kamu bebas dipakai. Kalau ada kebutuhan khusus, kamu
              bisa hubungi kami lewat tombol bantuan di menu samping.
            </p>
          </div>
        </div>

        <div className="flex justify-end border-t border-ink-100 px-5 py-4">
          <Button onClick={onClose} className="w-full sm:w-auto">
            Mengerti
          </Button>
        </div>
      </div>
    </div>
  )
}
