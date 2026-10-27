import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ReceiptText,
  Unlock,
} from '@/components/ui/icons'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/bookings/StatusControls'
import { BOOKING_STATUS_META } from '@/lib/booking-status'
import {
  CALENDAR_WEEKDAYS,
  buildMonthMatrix,
  formatMonthLabel,
  shiftMonthKey,
  summarizeMonth,
  type CalendarCell,
} from '@/lib/vendor-calendar'
import { formatCurrency, formatTime, initials, toIsoDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Booking, BookingStatus } from '@/types/booking'
import type { BlockedDate } from '@/lib/vendor-availability'

/**
 * Kalender jadwal vendor untuk satu bulan.
 *
 * Tanggal yang sudah ditempati booking diberi warna sesuai status; hari kosong
 * tampil netral sehingga vendor bisa langsung menjawab pertanyaan "tanggal ini
 * masih kosong?". Klik tanggal untuk melihat daftar acara hari itu di panel
 * kanan — dipakai saat vendor menelepon klien sambil melihat kalender.
 */
export function VendorCalendar({
  bookings,
  blocked = [],
  monthKey,
  onMonthChange,
  onCreateBooking,
  onSelectDate,
  onToggleBlocked,
  createBookingLocked = false,
}: {
  bookings: Booking[]
  /** Tanggal yang diblokir vendor (libur / tidak menerima booking). */
  blocked?: BlockedDate[]
  /** Bulan aktif dalam format `YYYY-MM`. */
  monthKey: string
  onMonthChange: (nextMonthKey: string) => void
  onCreateBooking?: () => void
  onSelectDate?: (date: string) => void
  /** Blokir tanggal dengan keterangan opsional, atau lepas blokir yang ada. */
  onToggleBlocked?: (date: string, reason: string | null) => Promise<boolean>
  /**
   * Panel kanan tetap menampilkan pintasan "Booking baru", tetapi dikunci saat
   * langganan berakhir. `onCreateBooking` saja tidak cukup: pintasan di panel
   * ini adalah tautan langsung ke `/bookings/new`, bukan callback — jadi guard
   * route akan mengalihkan tanpa penjelasan. Dengan flag ini tombolnya berhenti
   * jadi tautan dan berubah menjadi penanda terkunci yang menjelaskan alasannya.
   */
  createBookingLocked?: boolean
}) {
  const [todayIso] = useState(() => toIsoDate(new Date()))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [blockReason, setBlockReason] = useState('')
  const [savingBlock, setSavingBlock] = useState(false)

  const blockedByDate = useMemo(() => {
    const map = new Map<string, BlockedDate>()
    for (const item of blocked) map.set(item.date, item)
    return map
  }, [blocked])

  const matrix = useMemo(
    () => buildMonthMatrix(monthKey, bookings, todayIso),
    [bookings, monthKey, todayIso],
  )
  const summary = useMemo(() => summarizeMonth(matrix), [matrix])

  const selectedBookings = useMemo(() => {
    if (!selectedDate) return []
    const cell = matrix.cells.find((item) => item.date === selectedDate)
    return cell?.bookings ?? []
  }, [matrix, selectedDate])

  const selectedBlock = selectedDate ? (blockedByDate.get(selectedDate) ?? null) : null

  function handleCellClick(cell: CalendarCell) {
    if (!cell.date) return
    setSelectedDate(cell.date)
    setBlockReason('')
    onSelectDate?.(cell.date)
  }

  async function toggleSelectedBlock() {
    if (!selectedDate || !onToggleBlocked || savingBlock) return
    setSavingBlock(true)
    try {
      const reason = selectedBlock ? null : blockReason.trim() || null
      const succeeded = await onToggleBlocked(selectedDate, reason)
      if (succeeded) setBlockReason('')
    } finally {
      setSavingBlock(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Jadwal Bulanan"
        description={
          summary.total > 0
            ? `${summary.total} acara · ${summary.busyDays} tanggal terisi · ${summary.freeDays} tanggal masih kosong.`
            : 'Belum ada acara di bulan ini — semua tanggal masih kosong.'
        }
        action={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onMonthChange(shiftMonthKey(monthKey, -1))}
              className="inline-flex size-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-[7.5rem] text-center text-body font-medium text-ink-800">
              {formatMonthLabel(monthKey)}
            </span>
            <button
              type="button"
              onClick={() => onMonthChange(shiftMonthKey(monthKey, 1))}
              className="inline-flex size-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight className="size-4" />
            </button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onMonthChange(todayIso.slice(0, 7))}
              className="ml-1"
            >
              Bulan ini
            </Button>
          </div>
        }
      />

      <div className="border-b border-ink-100 px-4 py-2.5 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-caption text-ink-500">
          {(Object.keys(BOOKING_STATUS_META) as BookingStatus[]).map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span className={cn('size-2 rounded-full', BOOKING_STATUS_META[status].dotClass)} />
              {BOOKING_STATUS_META[status].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full ring-1 ring-ink-300" />
            Tersedia
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3 text-ink-400" />
            Diblokir
          </span>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-1 pb-1">
            {CALENDAR_WEEKDAYS.map((label) => (
              <div
                key={label}
                className="py-1 text-center text-2xs font-semibold uppercase tracking-wide text-ink-400"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {matrix.cells.map((cell, index) =>
              cell.date === null ? (
                <div key={`empty-${index}`} className="min-h-[3.5rem] rounded-lg bg-transparent" />
              ) : (
                <CalendarDay
                  key={cell.date}
                  cell={cell}
                  selected={cell.date === selectedDate}
                  isPast={cell.date < todayIso}
                  blocked={blockedByDate.get(cell.date) ?? null}
                  onClick={() => handleCellClick(cell)}
                />
              ),
            )}
          </div>
        </div>

        <aside className="border-t border-ink-100 p-4 lg:border-l lg:border-t-0">
          <h3 className="text-meta font-semibold uppercase tracking-wide text-ink-400">
            {selectedDate ? formatSelectedDate(selectedDate) : 'Pilih tanggal'}
          </h3>

          {selectedDate === null ? (
            <p className="mt-2 text-meta leading-relaxed text-ink-500">
              Klik salah satu tanggal untuk melihat acara pada hari itu.
            </p>
          ) : selectedBookings.length === 0 ? (
            <div className="mt-2 space-y-2">
              {selectedBlock ? (
                <div className="rounded-lg border border-dashed border-ink-300 bg-ink-100/70 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-meta font-medium text-ink-800">
                    <Lock className="size-3.5 text-ink-500" />
                    Tanggal diblokir
                  </p>
                  <p className="mt-0.5 text-caption text-ink-500">
                    {selectedBlock.reason ?? 'Tanpa keterangan'}
                  </p>
                </div>
              ) : (
                <p className="text-meta leading-relaxed text-emerald-800">
                  Tanggal ini masih kosong — aman untuk menerima booking baru.
                </p>
              )}

              {onCreateBooking && !selectedBlock ? (
                <Button size="sm" onClick={onCreateBooking} className="w-full">
                  <CalendarPlus className="size-3.5" />
                  Buat booking di tanggal ini
                </Button>
              ) : null}

              {onToggleBlocked && selectedDate ? (
                selectedBlock ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void toggleSelectedBlock()}
                    disabled={savingBlock}
                    className="w-full"
                  >
                    <Unlock className="size-3.5" />
                    {savingBlock ? 'Melepas blokir…' : 'Lepas blokir tanggal ini'}
                  </Button>
                ) : (
                  <form
                    className="space-y-2 rounded-lg border border-ink-200 p-3"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void toggleSelectedBlock()
                    }}
                  >
                    <label
                      htmlFor={`block-reason-${selectedDate}`}
                      className="block text-caption font-medium text-ink-700"
                    >
                      Keterangan blokir <span className="font-normal text-ink-400">(opsional)</span>
                    </label>
                    <input
                      id={`block-reason-${selectedDate}`}
                      value={blockReason}
                      onChange={(event) => setBlockReason(event.target.value)}
                      maxLength={120}
                      placeholder="Contoh: acara keluarga"
                      className="h-9 w-full rounded-md border border-ink-200 px-2.5 text-meta text-ink-800 placeholder:text-ink-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                    <Button type="submit" size="sm" disabled={savingBlock} className="w-full">
                      <Lock className="size-3.5" />
                      {savingBlock ? 'Menyimpan…' : 'Blokir tanggal ini'}
                    </Button>
                  </form>
                )
              ) : null}
            </div>
          ) : (
            <ul className="mt-2 space-y-2">
              {selectedBookings.map((booking) => {
                const phoneDigits = booking.client.phone.replace(/\D/g, '')
                const whatsappNumber = phoneDigits.replace(/^0/, '62')

                return (
                  <li key={booking.id}>
                    <div className="rounded-lg border border-ink-200 px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-body font-medium text-ink-900">
                          {booking.client.name}
                        </p>
                        <StatusBadge status={booking.status} className="shrink-0" />
                      </div>
                      <p className="mt-1 text-caption text-ink-500">
                        {formatTime(booking.eventTime) ?? 'Jam belum ditentukan'} ·{' '}
                        {booking.packageName ?? 'Tanpa paket'}
                      </p>
                      {booking.eventLocation ? (
                        <p className="mt-1 flex items-start gap-1 text-caption text-ink-500">
                          <MapPin className="mt-0.5 size-3 shrink-0" />
                          <span>{booking.eventLocation}</span>
                        </p>
                      ) : null}
                      <p className="mt-1 text-caption font-medium tabular-nums text-ink-700">
                        {formatCurrency(booking.totalPrice)}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink-100 pt-2 text-caption">
                        <a
                          href={`tel:${booking.client.phone.replace(/[^\d+]/g, '')}`}
                          className="inline-flex items-center gap-1 text-ink-600 hover:text-ink-900"
                        >
                          <Phone className="size-3" />
                          {booking.client.phone}
                        </a>
                        <a
                          href={`https://wa.me/${whatsappNumber}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:text-emerald-800"
                        >
                          <MessageCircle className="size-3" />
                          WhatsApp
                        </a>
                        {booking.client.email ? (
                          <a
                            href={`mailto:${booking.client.email}`}
                            className="inline-flex min-w-0 items-center gap-1 text-ink-600 hover:text-ink-900"
                          >
                            <Mail className="size-3 shrink-0" />
                            <span className="truncate">Email</span>
                          </a>
                        ) : null}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-caption font-medium">
                        <Link
                          to={`/bookings/${booking.id}`}
                          className="text-brand-700 hover:text-brand-800"
                        >
                          Detail booking
                        </Link>
                        {booking.invoiceCount > 0 ? (
                          <Link
                            to={`/invoices?q=${encodeURIComponent(booking.client.phone)}`}
                            className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-800"
                          >
                            <ReceiptText className="size-3" />
                            Invoice ({booking.invoiceCount})
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {summary.total > 0 ? (
            <div className="mt-4 space-y-1.5 border-t border-ink-100 pt-3 text-caption">
              {(Object.keys(BOOKING_STATUS_META) as BookingStatus[]).map((status) =>
                summary.byStatus[status] > 0 ? (
                  <div key={status} className="flex items-baseline justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-ink-500">
                      <span
                        className={cn('size-2 rounded-full', BOOKING_STATUS_META[status].dotClass)}
                      />
                      {BOOKING_STATUS_META[status].label}
                    </span>
                    <span className="tabular-nums text-ink-700">{summary.byStatus[status]}</span>
                  </div>
                ) : null,
              )}
            </div>
          ) : null}

          <div className="mt-4">
            {createBookingLocked ? (
              <span
                title="Booking baru terkunci sampai langganan diperpanjang. Data lama tetap bisa dibaca."
                className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-ink-100 px-3 py-2 text-meta font-medium text-ink-400"
              >
                <Lock className="size-3.5" />
                Booking baru
              </span>
            ) : (
              <ButtonLink to="/bookings/new" size="sm" variant="secondary" className="w-full">
                <CalendarPlus className="size-3.5" />
                Booking baru
              </ButtonLink>
            )}
          </div>
        </aside>
      </div>

      {selectedDate && selectedBookings.length === 0 ? null : selectedDate ? null : (
        <CardBody className="border-t border-ink-100">
          <Badge>Pilih tanggal untuk melihat detail acara</Badge>
        </CardBody>
      )}
    </Card>
  )
}

function CalendarDay({
  cell,
  selected,
  isPast,
  blocked,
  onClick,
}: {
  cell: CalendarCell
  selected: boolean
  isPast: boolean
  blocked: BlockedDate | null
  onClick: () => void
}) {
  const count = cell.bookings.length
  const primary = cell.bookings[0]
  const status = primary ? BOOKING_STATUS_META[primary.status] : null
  const isBlocked = Boolean(blocked)

  const label = count > 0 ? `${count} acara` : isBlocked ? 'diblokir' : 'kosong'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${cell.date}, ${label}`}
      title={blocked?.reason ?? undefined}
      className={cn(
        'flex min-h-[3.5rem] flex-col items-start gap-1 rounded-lg border px-1.5 py-1.5 text-left transition-colors',
        selected
          ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-100'
          : count > 0
            ? 'border-ink-200 bg-white hover:border-ink-300'
            : isBlocked
              ? 'border-ink-300 border-dashed bg-ink-100/70 hover:border-ink-400'
              : 'border-transparent bg-ink-50/60 hover:border-ink-200 hover:bg-white',
        /*
         * Tanggal lampau ditandai dengan warna teks yang lebih redup, BUKAN
         * `opacity-60`. Opacity mengomposit seluruh sel dengan latar, sehingga
         * teks ink-600 6.67:1 turun jadi 2.70:1 — angka tanggal praktis tidak
         * terbaca, padahal tanggal lampau tetap informasi yang sah.
         * `text-ink-500` (#5b636f) memberi 6.07:1 dan tetap terlihat lebih
         * redup daripada tanggal aktif yang memakai ink-600.
         */
        isPast && count === 0 && !isBlocked && 'text-ink-500',
      )}
    >
      <span className="flex w-full items-center justify-between gap-1">
        <span
          className={cn(
            'flex size-5 items-center justify-center rounded-full text-caption font-medium tabular-nums',
            cell.isToday ? 'bg-ink-900 text-white' : 'text-ink-600',
          )}
        >
          {cell.day}
        </span>
        {isBlocked ? <Lock className="size-2.5 shrink-0 text-ink-400" aria-hidden /> : null}
      </span>

      {count > 0 ? (
        <span className="flex w-full flex-col gap-0.5">
          <span className="flex items-center gap-1">
            <span className={cn('size-1.5 shrink-0 rounded-full', status?.dotClass)} />
            <span className="truncate text-2xs font-medium text-ink-700">
              {primary.client.name}
            </span>
          </span>
          {count > 1 ? (
            /*
             * Sel kalender hanya ~35px di 375px. "+2 acara lain" butuh ~35px pada
             * 10px, jadi mentok. Dipersingkat jadi "+2 acara" dan dipaksa satu
             * baris — informasinya tetap utuh tanpa meluber ke sel sebelah.
             */
            <span className="truncate whitespace-nowrap text-2xs text-ink-400">
              +{count - 1} acara
            </span>
          ) : primary.eventTime ? (
            <span className="text-2xs tabular-nums text-ink-400">
              {formatTime(primary.eventTime)}
            </span>
          ) : null}
        </span>
      ) : isBlocked ? (
        <span className="w-full truncate text-2xs font-medium text-ink-500">
          {blocked?.reason ?? 'Diblokir'}
        </span>
      ) : null}
    </button>
  )
}

function formatSelectedDate(isoDate: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${isoDate}T00:00:00`))
}

/** Avatar + nama dipakai bila kalender ditempatkan dalam daftar. */
export function CalendarBookingAvatar({ booking }: { booking: Booking }) {
  return (
    <span className="flex size-6 items-center justify-center rounded-full bg-ink-200 text-2xs font-semibold text-ink-700">
      {initials(booking.client.name)}
    </span>
  )
}
