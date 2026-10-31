import { CalendarClock } from '@/components/ui/icons'
import { ButtonLink } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import type { SubscriptionSummary } from '@/types/booking'

/**
 * Kartu status masa uji — berbasis **waktu**, bukan kuota transaksi.
 *
 * Versi sebelumnya menampilkan dua bar progres ("Booking 2/2", "Invoice 2/2")
 * dengan teks "Kuota sekali pakai, tidak direset per bulan". Itu sisa aturan
 * lama yang sudah dihapus: masa uji kini memberi akses penuh selama N hari
 * tanpa batas jumlah booking maupun invoice. Menampilkan kuota membuat vendor
 * mengira hanya boleh membuat dua booking.
 *
 * Nama berkas dan nama komponen dipertahankan agar pemanggil tidak perlu
 * diubah; isinya sekarang sisa hari.
 */
export function TrialQuotaCard({ subscription }: { subscription: SubscriptionSummary }) {
  if (subscription.status !== 'trial') return null

  const daysLeft = subscription.daysLeft ?? null

  // Sisa ≤5 hari dianggap mendesak: peringatan berubah warna, bukan angka kuota.
  const urgent = daysLeft !== null && daysLeft <= 5

  return (
    <section
      className={cn(
        'rounded-xl border px-4 py-3.5',
        urgent ? 'border-amber-200 bg-amber-50/70' : 'border-ink-200/80 bg-white',
      )}
      aria-label="Status masa uji"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p
            className={cn(
              'flex items-center gap-1.5 text-meta font-semibold',
              urgent ? 'text-amber-800' : 'text-ink-800',
            )}
          >
            <CalendarClock className="size-3.5 shrink-0" />
            Masa uji
          </p>
          <p className="mt-1.5 text-body leading-relaxed text-ink-600">
            {daysLeft !== null ? (
              <>
                <span className="font-semibold text-ink-900">Sisa {daysLeft} hari lagi.</span>{' '}
                Semua fitur terbuka — booking &amp; invoice tanpa batas jumlah.
              </>
            ) : (
              <>Semua fitur terbuka — booking &amp; invoice tanpa batas jumlah.</>
            )}
          </p>
        </div>

        <ButtonLink to="/langganan" size="sm" variant="secondary" className="shrink-0">
          Lihat paket
        </ButtonLink>
      </div>
    </section>
  )
}
