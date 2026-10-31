import {
  ArrowRight,
  CalendarClock,
  Clock,
  Lock,
} from '@/components/ui/icons'
import type { ReactNode } from 'react'
import { ButtonLink } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { formatShortDate } from '@/lib/format'
import type { SubscriptionSummary } from '@/types/booking'

/**
 * Kartu status akses vendor di dashboard (`/dashboard`).
 *
 * Satu kartu yang merangkum status langganan langsung dari
 * `SubscriptionSummary` (ringkasan yang disediakan `CurrentUser.subscription`),
 * sesuai PRD fase status: label yang mudah dibaca, kuota trial saat masih trial,
 * tanggal berakhir + sisa hari untuk aktif, dan peringatan saat kedaluwarsa.
 * Tiap kondisi punya CTA ke halaman `/upgrade`.
 */
export function VendorStatusCard({ subscription }: { subscription: SubscriptionSummary }) {
  const { status } = subscription

  if (status === 'active') {
    const { endsAt } = subscription
    /*
     * Sisa hari dihitung dari `endsAt`. Tidak memakai helper eksternal supaya
     * tidak ada ketergantungan baru; selisih hari dibulatkan ke atas agar
     * "besok berakhir" tidak tampil sebagai 0 hari.
     */
    const daysLeft = endsAt
      ? Math.max(Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000), 0)
      : null

    return (
      <section
        aria-label="Status langganan aktif"
        className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5"
      >
        <CardHeader
          icon={<CalendarClock className="size-5 text-emerald-600" />}
          label="Langganan aktif"
          tone="emerald"
        />
        <p className="mt-2 max-w-2xl text-meta leading-relaxed text-emerald-900">
          Booking &amp; invoice tanpa batas
          {daysLeft !== null ? (
            <>
              , sisa <span className="font-semibold">{daysLeft}</span> hari
            </>
          ) : null}
          {endsAt ? (
            <>
              {' '}sampai <span className="font-semibold">{formatShortDate(endsAt.slice(0, 10))}</span>.
            </>
          ) : (
            '.'
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ButtonLink to="/bookings/new" size="sm" className="shrink-0">
            Booking baru
          </ButtonLink>
          <ButtonLink to="/upgrade" size="sm" variant="secondary" className="shrink-0">
            Kelola langganan
          </ButtonLink>
        </div>
      </section>
    )
  }

  if (status === 'expired') {
    return (
      <section
        aria-label="Status langganan berakhir"
        className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 sm:p-5"
      >
        <CardHeader
          icon={<Lock className="size-5 text-rose-600" />}
          label="Langganan berakhir"
          tone="rose"
        />
        <p className="mt-2 max-w-2xl text-meta leading-relaxed text-rose-900">
          {subscription.endsAt ? (
            <>
              Masa aktif habis sejak{' '}
              <span className="font-semibold">{formatShortDate(subscription.endsAt.slice(0, 10))}</span>.
            </>
          ) : (
            'Masa aktif telah berakhir.'
          )}{' '}
          Data lama tetap bisa dibaca, tetapi booking &amp; invoice baru terkunci sampai langganan
          diperpanjang.
        </p>
        <div className="mt-3">
          <ButtonLink to="/upgrade" size="sm" className="shrink-0">
            Perpanjang paket <ArrowRight className="size-3.5" />
          </ButtonLink>
        </div>
      </section>
    )
  }

  /*
   * status === 'trial'
   *
   * Masa uji berbasis WAKTU, bukan kuota transaksi. Versi sebelumnya
   * menampilkan dua bar progres ("Booking 2/2", "Invoice 2/2") dengan teks
   * "Kuota sekali pakai — jatah tidak direset per bulan". Itu sisa aturan yang
   * sudah dihapus dan menyesatkan: vendor mengira hanya boleh membuat dua
   * booking padahal semua fitur terbuka selama masa uji.
   */
  const daysLeft = subscription.daysLeft ?? null
  const urgent = daysLeft !== null && daysLeft <= 5

  return (
    <section
      aria-label="Status masa uji"
      className={cn(
        'rounded-xl border p-4 sm:p-5',
        urgent ? 'border-amber-200 bg-amber-50/70' : 'border-ink-200/80 bg-white',
      )}
    >
      <CardHeader
        icon={<Clock className={cn('size-5', urgent ? 'text-amber-600' : 'text-ink-500')} />}
        label="Masa uji"
        tone={urgent ? 'amber' : 'ink'}
      />
      <p className="mt-2 max-w-2xl text-meta leading-relaxed text-ink-700">
        {daysLeft !== null ? (
          <>
            <span className="font-semibold text-ink-900">Sisa {daysLeft} hari lagi.</span> Semua
            fitur terbuka — booking &amp; invoice tanpa batas jumlah.
          </>
        ) : (
          <>Semua fitur terbuka — booking &amp; invoice tanpa batas jumlah.</>
        )}
      </p>
      <div className="mt-3">
        <ButtonLink to="/langganan" size="sm" variant="secondary" className="shrink-0">
          Lihat paket <ArrowRight className="size-3.5" />
        </ButtonLink>
      </div>
    </section>
  )
}

/** Judul status: ikon + label di baris pertama dengan warna sesuai kondisi. */
function CardHeader({ icon, label, tone }: { icon: ReactNode; label: string; tone: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <p
        className={cn(
          'text-body font-semibold',
          tone === 'emerald' && 'text-emerald-800',
          tone === 'rose' && 'text-rose-800',
          tone === 'amber' && 'text-amber-800',
        )}
      >
        {label}
      </p>
    </div>
  )
}

/** Satu bar kuota: label, hitungan sisa, dan progres bar. */
