import { ArrowRight, Sparkles } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import type { SubscriptionSummary } from '@/types/booking'

/**
 * Strip status langganan di atas halaman booking.
 *
 * Menjelaskan sisa jatah trial atau masa aktif paket. Sesuai PRD, batas hanya
 * berlaku selama trial (2 booking + 2 invoice, sekali pakai); vendor dengan
 * langganan aktif melihat pesan tanpa batas.
 */
export function SubscriptionBar({ subscription }: { subscription: SubscriptionSummary }) {
  if (subscription.status === 'active') {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-emerald-800">
          <span className="font-semibold">Langganan aktif.</span> Booking &amp; invoice tanpa batas
          sampai {subscription.endsAt ?? 'masa paket berakhir'}.
        </p>
        <ButtonLink to="/settings" variant="secondary" size="sm">
          Kelola langganan
        </ButtonLink>
      </div>
    )
  }

  if (subscription.status === 'expired') {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-rose-800">
          <span className="font-semibold">Langganan berakhir.</span> Data lama tetap bisa dibaca,
          tetapi booking baru perlu perpanjangan paket.
        </p>
        <ButtonLink to="/upgrade" size="sm">
          Perpanjang paket <ArrowRight className="size-3.5" />
        </ButtonLink>
      </div>
    )
  }

  const bookingLeft = Math.max(subscription.trialBookingsLimit - subscription.trialBookingsUsed, 0)
  const invoiceLeft = Math.max(subscription.trialInvoicesLimit - subscription.trialInvoicesUsed, 0)

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <p className="text-[13px] leading-relaxed text-amber-900">
          <span className="font-semibold">Masa trial:</span> tersisa {bookingLeft} booking &amp;{' '}
          {invoiceLeft} invoice. Jatah tidak direset — berlangganan untuk akses tanpa batas.
        </p>
      </div>
      <ButtonLink to="/upgrade" size="sm" className="shrink-0">
        Lihat paket <ArrowRight className="size-3.5" />
      </ButtonLink>
    </div>
  )
}
