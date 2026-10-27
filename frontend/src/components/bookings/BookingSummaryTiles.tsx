import { CheckCircle2, Clock, Wallet, XCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatCurrency } from '@/lib/format'
import type { BookingSummary } from '@/lib/api/bookings'
import type { BookingStatus } from '@/types/booking'

/**
 * Kartu ringkasan "Minggu Ini" — padanan panel statistik pada acuan desain.
 *
 * Empat tile pastel: terkonfirmasi, tentatif, batal, dan nilai kontrak. Warna
 * tile sengaja lembut (bukan warna status pekat) supaya tidak bersaing dengan
 * grid tanggal di sebelahnya; angka tetap jadi fokus.
 *
 * Angka berasal dari `GET /api/bookings/summary`, bukan dari baris halaman
 * aktif — kalau dihitung di klien, "Terkonfirmasi 3" akan berubah saat vendor
 * berpindah halaman.
 */
export function BookingSummaryTiles({
  summary,
  loading,
  activeStatus,
  onSelectStatus,
}: {
  summary: BookingSummary
  loading?: boolean
  activeStatus?: BookingStatus | 'all'
  onSelectStatus?: (status: BookingStatus | 'all') => void
}) {
  const tiles: Array<{
    key: BookingStatus | 'revenue'
    label: string
    value: string
    icon: LucideIcon
    tone: string
    iconTone: string
    status?: BookingStatus
  }> = [
    {
      key: 'confirmed',
      label: 'Terkonfirmasi',
      value: String(summary.byStatus.confirmed),
      icon: CheckCircle2,
      tone: 'bg-emerald-50',
      iconTone: 'bg-emerald-100 text-emerald-700',
      status: 'confirmed',
    },
    {
      key: 'tentative',
      label: 'Tentatif',
      value: String(summary.byStatus.tentative),
      icon: Clock,
      tone: 'bg-amber-50',
      iconTone: 'bg-amber-100 text-amber-700',
      status: 'tentative',
    },
    {
      key: 'cancelled',
      label: 'Batal',
      value: String(summary.byStatus.cancelled),
      icon: XCircle,
      tone: 'bg-rose-50',
      iconTone: 'bg-rose-100 text-rose-700',
      status: 'cancelled',
    },
    {
      key: 'revenue',
      label: 'Nilai kontrak',
      value: formatCurrency(summary.revenue),
      icon: Wallet,
      tone: 'bg-brand-50',
      iconTone: 'bg-brand-100 text-brand-700',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {tiles.map((tile) => {
        const Icon = tile.icon
        const isActive = tile.status !== undefined && activeStatus === tile.status
        const interactive = tile.status !== undefined && onSelectStatus !== undefined

        return (
          <button
            key={tile.key}
            type="button"
            disabled={!interactive}
            onClick={() => tile.status && onSelectStatus?.(isActive ? 'all' : tile.status)}
            aria-pressed={interactive ? isActive : undefined}
            title={interactive ? 'Klik untuk memfilter status ini' : undefined}
            className={cn(
              'rounded-xl px-3.5 py-3 text-left transition-all',
              tile.tone,
              interactive && 'cursor-pointer hover:brightness-[0.98]',
              !interactive && 'cursor-default',
              isActive && 'ring-2 ring-inset ring-ink-900/15',
            )}
          >
            <span
              className={cn(
                'mb-2 inline-flex size-7 items-center justify-center rounded-lg',
                tile.iconTone,
              )}
              aria-hidden
            >
              <Icon className="size-4" />
            </span>
            <p
              className={cn(
                /*
                 * "Rp 213.000.000" adalah string terpanjang yang pernah masuk sini:
                 * 15 digit + titik. Pada 19px bold ia butuh ~148px, sedangkan kartu
                 * hanya ~122px di 375px dan ~142px di sidebar desktop — jadi 19px
                 * selalu meluber, di layar kecil maupun besar.
                 *
                 * Karena itu nilainya turun satu tingkat (12px -> 15px) dan hanya
                 * naik setelah kartu benar-benar cukup lebar. Label lain tetap 19px
                 * karena isinya pendek ("12", "3").
                 */
                'font-bold leading-none tabular-nums text-ink-900',
                tile.key === 'revenue' ? 'text-meta sm:text-lead' : 'text-title',
                loading && 'opacity-50',
              )}
            >
              {tile.value}
            </p>
            <p className="mt-1 text-caption font-medium text-ink-500">{tile.label}</p>
          </button>
        )
      })}
    </div>
  )
}
