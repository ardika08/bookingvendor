import { ChevronLeft, ChevronRight } from '@/components/ui/icons'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { BOOKING_STATUS_META } from '@/lib/booking-status'
import { formatMonthYear } from '@/lib/format'
import type { Booking, BookingStatus } from '@/types/booking'
import type { BlockedDate } from '@/lib/vendor-availability'

/**
 * Grid status tanggal — padanan "Room Status" pada acuan desain.
 *
 * Setiap sel mewakili satu tanggal dalam bulan aktif; warnanya mengikuti status
 * booking pada tanggal itu. Karena satu tanggal bisa memuat lebih dari satu
 * acara, sel memakai status "terkuat" (terkonfirmasi > tentatif > selesai >
 * batal) agar warna tidak ambigu.
 *
 * Tujuan panel ini adalah pemindaian cepat: vendor melihat sebaran tanggal
 * terisi dalam satu bulan tanpa harus membaca tabel atau membuka kalender
 * penuh. Tanggal yang diblokir diberi corak berbeda karena bukan booking.
 */

/** Prioritas warna bila satu tanggal punya beberapa acara. */
const STATUS_PRIORITY: BookingStatus[] = ['confirmed', 'tentative', 'completed', 'cancelled']

/*
 * Warna sel status. Setiap pasangan diverifikasi terhadap WCAG 1.4.3 (teks
 * 4.5:1), karena sel ini memuat ANGKA tanggal, bukan sekadar bidang warna.
 *
 * Nilai lama gagal:
 *   - confirmed `bg-emerald-500 text-white` hanya 2.47:1
 *   - cancelled `bg-rose-400 text-white` hanya 2.69:1
 *
 * Digelapkan satu-dua langkah sampai lulus. `tentative` dan `completed` sudah
 * lulus sejak awal (8.97:1 dan 8.83:1) dan tidak diubah.
 */
const CELL_CLASS: Record<BookingStatus, string> = {
  confirmed: 'bg-emerald-700 text-white hover:bg-emerald-800',
  tentative: 'bg-amber-400 text-amber-950 hover:bg-amber-500',
  completed: 'bg-ink-300 text-ink-900 hover:bg-ink-400',
  cancelled: 'bg-rose-600 text-white hover:bg-rose-700',
}

const BLOCKED_CLASS = 'bg-ink-100 text-ink-400 line-through hover:bg-ink-200'

export function BookingDateGrid({
  bookings,
  blocked = [],
  monthKey,
  onMonthChange,
  onSelectDate,
  activeDate,
}: {
  bookings: Booking[]
  blocked?: BlockedDate[]
  /** `YYYY-MM`. */
  monthKey: string
  onMonthChange: (next: string) => void
  onSelectDate?: (date: string) => void
  /** Tanggal yang sedang dipilih (opsional, untuk sorotan). */
  activeDate?: string | null
}) {
  const [year, month] = monthKey.split('-').map(Number)
  const daysInMonth = new Date(year, (month ?? 1), 0).getDate()

  /** Tanggal → status terkuat yang menempatinya. */
  const statusByDate = new Map<string, BookingStatus>()
  for (const booking of bookings) {
    if (!booking.eventDate.startsWith(monthKey)) continue
    const current = statusByDate.get(booking.eventDate)
    const next = booking.status
    if (
      current === undefined ||
      STATUS_PRIORITY.indexOf(next) < STATUS_PRIORITY.indexOf(current)
    ) {
      statusByDate.set(booking.eventDate, next)
    }
  }

  const blockedDates = new Set(
    blocked.filter((item) => item.date.startsWith(monthKey)).map((item) => item.date),
  )

  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const iso = `${monthKey}-${String(day).padStart(2, '0')}`
    return { day, iso, status: statusByDate.get(iso) ?? null, isBlocked: blockedDates.has(iso) }
  })

  /** Acara bulan ini, urut tanggal — mengisi daftar di bawah legenda. */
  const monthBookings = bookings
    .filter((booking) => booking.eventDate.startsWith(monthKey))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))

  function shiftMonth(delta: number) {
    const base = new Date(year, (month ?? 1) - 1 + delta, 1)
    const next = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`
    onMonthChange(next)
  }

  const counts = days.reduce(
    (acc, day) => {
      if (day.status) acc[day.status] += 1
      else if (day.isBlocked) acc.blocked += 1
      else acc.free += 1
      return acc
    },
    { confirmed: 0, tentative: 0, completed: 0, cancelled: 0, blocked: 0, free: 0 },
  )

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-body font-semibold text-ink-900">{formatMonthYear(monthKey)}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="inline-flex size-7 items-center justify-center rounded-full text-ink-500 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-ink-50 hover:text-ink-900"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="inline-flex size-7 items-center justify-center rounded-full text-ink-500 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-ink-50 hover:text-ink-900"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-11">
        {days.map((day) => {
          const isActive = activeDate === day.iso
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onSelectDate?.(day.iso)}
              title={
                day.status
                  ? `${day.iso} — ${BOOKING_STATUS_META[day.status].label}`
                  : day.isBlocked
                    ? `${day.iso} — diblokir`
                    : `${day.iso} — kosong`
              }
              aria-label={`Tanggal ${day.day}`}
              className={cn(
                'flex h-8 items-center justify-center rounded-lg text-meta font-semibold tabular-nums transition-colors',
                day.status
                  ? CELL_CLASS[day.status]
                  : day.isBlocked
                    ? BLOCKED_CLASS
                    : 'bg-ink-50 text-ink-600 ring-1 ring-inset ring-ink-100 hover:bg-ink-100',
                isActive && 'ring-2 ring-brand-700 ring-offset-1',
              )}
            >
              {String(day.day).padStart(2, '0')}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-ink-100 pt-2.5">
        <LegendItem className="bg-emerald-500" label={`Terkonfirmasi ${counts.confirmed}`} />
        <LegendItem className="bg-amber-400" label={`Tentatif ${counts.tentative}`} />
        <LegendItem className="bg-ink-300" label={`Selesai ${counts.completed}`} />
        <LegendItem className="bg-rose-400" label={`Batal ${counts.cancelled}`} />
        <LegendItem className="bg-ink-100" label={`Diblokir ${counts.blocked}`} />
        <LegendItem className="bg-ink-50 ring-1 ring-inset ring-ink-200" label={`Kosong ${counts.free}`} />
      </div>

      {/*
       * Daftar acara bulan ini mengisi ruang yang tadinya kosong di bawah
       * legenda, dan memberi konteks yang tidak diberikan grid: siapa yang
       * mengisi tanggal berwarna.
       */}
      <div className="mt-3 border-t border-ink-100 pt-2.5">
        <p className="mb-1.5 text-caption font-semibold uppercase tracking-wide text-ink-400">
          Acara bulan ini
        </p>
        {monthBookings.length === 0 ? (
          <p className="text-meta text-ink-400">
            {/*
             * Jangan bilang "belum ada acara" saat tabel di bawah jelas berisi
             * baris — bisa terjadi jika filter status/pencarian menyaring habis
             * bulan yang sedang ditampilkan.
             */}
            {bookings.length > 0
              ? 'Tidak ada acara di bulan ini pada filter aktif.'
              : 'Belum ada acara pada bulan ini.'}
          </p>
        ) : (
          <ul className="max-h-[7.5rem] space-y-1 overflow-y-auto scrollbar-slim pr-1">
            {monthBookings.slice(0, 6).map((booking) => (
              <li key={booking.id}>
                <Link
                  to={`/bookings/${booking.id}`}
                  className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-ink-50"
                >
                  <span className="w-9 shrink-0 text-caption font-semibold tabular-nums text-ink-500">
                    {booking.eventDate.slice(8, 10)}/{booking.eventDate.slice(5, 7)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-meta text-ink-800">
                    {booking.client.name}
                  </span>
                  <span className={cn('size-1.5 shrink-0 rounded-full', BOOKING_STATUS_META[booking.status].dotClass)} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {monthBookings.length > 6 ? (
          <p className="mt-1 text-caption text-ink-400">+{monthBookings.length - 6} acara lain</p>
        ) : null}
      </div>
    </div>
  )
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-caption text-ink-500">
      <span className={cn('size-2 rounded-full', className)} aria-hidden />
      {label}
    </span>
  )
}
