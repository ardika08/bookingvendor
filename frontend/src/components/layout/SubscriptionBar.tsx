import { ArrowRight, CalendarClock } from '@/components/ui/icons'
import { ButtonLink } from '@/components/ui/Button'
import type { SubscriptionSummary } from '@/types/booking'

/**
 * Strip status langganan di atas halaman vendor.
 *
 * Masa uji berbasis **waktu**, bukan kuota transaksi. Sebelumnya strip ini
 * menulis "tersisa 2 booking & 2 invoice. Jatah tidak direset" — sisa aturan
 * lama yang sudah tidak berlaku, dan menyesatkan: vendor mengira hanya boleh
 * membuat dua booking padahal semua fitur terbuka selama 30 hari.
 *
 * Sekarang yang ditampilkan adalah sisa **hari**.
 */
export function SubscriptionBar({ subscription }: { subscription: SubscriptionSummary }) {
  if (subscription.status === 'active') {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body text-emerald-800">
          <span className="font-semibold">Langganan aktif.</span> Booking &amp; invoice tanpa batas
          {subscription.endsAt ? ` sampai ${subscription.endsAt}.` : '.'}
        </p>
        <ButtonLink to="/langganan" variant="secondary" size="sm">
          Kelola langganan
        </ButtonLink>
      </div>
    )
  }

  if (subscription.status === 'expired') {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body text-rose-800">
          <span className="font-semibold">Masa aktif berakhir.</span> Data lama tetap bisa dibaca,
          tetapi booking baru perlu perpanjangan paket.
        </p>
        <ButtonLink to="/langganan" size="sm">
          Perpanjang paket <ArrowRight className="size-3.5" />
        </ButtonLink>
      </div>
    )
  }

  const daysLeft = subscription.daysLeft ?? null

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <p className="text-body leading-relaxed text-amber-900">
          <span className="font-semibold">Masa uji:</span>{' '}
          {daysLeft !== null
            ? `sisa ${daysLeft} hari lagi. Semua fitur terbuka — booking & invoice tanpa batas jumlah.`
            : 'semua fitur terbuka tanpa batas jumlah selama masa uji.'}
        </p>
      </div>
      <ButtonLink to="/langganan" size="sm" className="shrink-0">
        Lihat paket <ArrowRight className="size-3.5" />
      </ButtonLink>
    </div>
  )
}
