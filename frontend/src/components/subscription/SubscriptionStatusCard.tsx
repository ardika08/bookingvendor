import { CalendarClock, Hourglass } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import type { SubscriptionState } from '@/types/subscription'

/**
 * Ringkasan langganan: kartu status dengan sisa **hari**, tanggal berakhir,
 * dan masa tenggang.
 *
 * Masa uji berbasis waktu, bukan kuota transaksi. Versi sebelumnya menampilkan
 * dua bar progres ("Booking 2/2", "Invoice 2/2") dengan teks "Kuota sekali
 * pakai, tidak direset per bulan" — sisa aturan yang sudah dihapus, dan
 * menyesatkan karena vendor mengira hanya boleh membuat dua booking padahal
 * semua fitur terbuka.
 *
 * Empat status (PRD):
 * - `trial` → sisa hari masa uji, peringatan bila mendekati akhir.
 * - `active` → masa aktif + tanggal berakhir.
 * - `grace` → kedaluwarsa tapi masih dalam masa tenggang, boleh dibaca saja.
 * - `expired` → akses tulis terkunci, tinggal perpanjang.
 */
export function SubscriptionStatusCard({ subscription }: { subscription: SubscriptionState }) {
  const { status } = subscription

  if (status === 'trial') {
    const daysLeft = subscription.daysLeft ?? null
    const urgent = daysLeft !== null && daysLeft <= 5

    return (
      <div
        className={cn(
          'rounded-xl border px-4 py-3.5',
          urgent ? 'border-amber-200 bg-amber-50/70' : 'border-ink-200/80 bg-white',
        )}
      >
        <div className="flex items-start gap-2.5">
          <Hourglass
            className={cn('mt-0.5 size-4 shrink-0', urgent ? 'text-amber-600' : 'text-ink-500')}
          />
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold text-ink-900">Masa uji</p>
            <p className="mt-0.5 text-meta leading-relaxed text-ink-600">
              {daysLeft !== null ? (
                <>
                  <span className="font-medium text-ink-800">Sisa {daysLeft} hari lagi.</span> Semua
                  fitur terbuka — booking &amp; invoice tanpa batas jumlah.
                </>
              ) : (
                <>Semua fitur terbuka — booking &amp; invoice tanpa batas jumlah.</>
              )}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'active') {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3.5">
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <div>
          <p className="text-body font-semibold text-ink-900">Langganan aktif</p>
          <p className="mt-0.5 text-meta text-ink-600">
            Booking &amp; invoice tanpa batas
            {subscription.endsAt ? ` sampai ${subscription.endsAt}.` : '.'}
          </p>
        </div>
      </div>
    )
  }

  if (status === 'grace') {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3.5">
        <Hourglass className="mt-0.5 size-4 shrink-0 text-sky-600" />
        <div>
          <p className="text-body font-semibold text-ink-900">Masa tenggang</p>
          <p className="mt-0.5 text-meta text-ink-600">
            Masa aktif sudah lewat, data masih bisa dibaca
            {subscription.graceEndsAt ? ` sampai ${subscription.graceEndsAt}.` : '.'} Perpanjang
            untuk membuat booking baru.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3.5">
      <Hourglass className="mt-0.5 size-4 shrink-0 text-rose-600" />
      <div>
        <p className="text-body font-semibold text-ink-900">Masa aktif berakhir</p>
        <p className="mt-0.5 text-meta text-ink-600">
          Data lama tetap bisa dibaca dan diunduh. Perpanjang paket untuk membuat booking &amp;
          invoice baru.
        </p>
      </div>
    </div>
  )
}
