import { Check, ChevronDown } from '@/components/ui/icons'
import { useEffect, useRef, useState } from 'react'
import {
  BOOKING_STATUS_META,
  availableTransitions,
  isDateOccupying,
  transitionLabel,
} from '@/lib/booking-status'
import { cn } from '@/lib/cn'
import type { BookingStatus } from '@/types/booking'

/**
 * Badge status booking dengan ikon + label.
 *
 * Varian:
 *  - `badge` (default): untuk tabel & kartu, ringkas.
 *  - `pill`: lebih besar, dipakai di header detail booking.
 */
export function StatusBadge({
  status,
  variant = 'badge',
  className,
}: {
  status: BookingStatus
  variant?: 'badge' | 'pill'
  className?: string
}) {
  const meta = BOOKING_STATUS_META[status]
  const Icon = meta.icon

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium ring-1 ring-inset',
        variant === 'badge' ? 'gap-1.5 px-2 py-0.5 text-caption' : 'gap-1.5 px-2.5 py-1 text-meta',
        meta.badgeClass,
        className,
      )}
      title={meta.description}
    >
      <Icon className={variant === 'badge' ? 'size-3' : 'size-3.5'} aria-hidden />
      {meta.label}
    </span>
  )
}

/**
 * Menu ubah status untuk satu booking.
 *
 * Hanya menampilkan transisi yang diizinkan (mis. booking selesai tidak bisa
 * diubah lagi). `onChange` sementara hanya memperbarui state lokal; saat API
 * tersedia, panggil `PATCH /api/bookings/{id}` lalu refresh daftar.
 */
export function StatusMenu({
  status,
  onChange,
  disabled,
  hasInvoice,
}: {
  status: BookingStatus
  onChange: (next: BookingStatus) => void
  disabled?: boolean
  hasInvoice?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const options = availableTransitions(status)

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  if (options.length === 0) {
    return (
      <span className="text-caption text-ink-400" title="Acara selesai — data tersimpan sebagai riwayat">
        Final
      </span>
    )
  }

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'inline-flex h-7 items-center gap-1 rounded-md border border-ink-200 bg-white px-2 text-caption font-medium text-ink-600',
          'hover:border-ink-300 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        Ubah
        <ChevronDown className="size-3" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-lg border border-ink-200 bg-white py-1 shadow-lg"
        >
          {options.map((option) => {
            const meta = BOOKING_STATUS_META[option]
            const Icon = meta.icon
            const freesDate = !isDateOccupying(option) && isDateOccupying(status)
            return (
              <button
                key={option}
                type="button"
                role="menuitem"
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-ink-50"
              >
                <Icon className={cn('mt-0.5 size-3.5 shrink-0', option === 'cancelled' ? 'text-rose-500' : 'text-ink-400')} />
                <span className="min-w-0">
                  <span className="block text-meta font-medium text-ink-800">
                    {transitionLabel(status, option)}
                  </span>
                  <span className="block text-caption leading-snug text-ink-500">
                    {freesDate
                      ? 'Tanggal akan kosong lagi di kalender.'
                      : meta.description}
                  </span>
                  {option === 'cancelled' && hasInvoice ? (
                    <span className="mt-0.5 block text-caption font-medium text-rose-600">
                      Invoice terkait perlu ditinjau ulang.
                    </span>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/** Deretan pill status untuk header detail / legend: satu aktif, sisanya redup. */
export function StatusStepper({
  status,
  onChange,
}: {
  status: BookingStatus
  onChange?: (next: BookingStatus) => void
}) {
  const order: BookingStatus[] = ['tentative', 'confirmed', 'completed']

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {order.map((item, index) => {
        const meta = BOOKING_STATUS_META[item]
        const active = item === status
        const done =
          status !== 'cancelled' && order.indexOf(status as BookingStatus) > index && item !== 'completed'

        return (
          <button
            key={item}
            type="button"
            disabled={!onChange}
            onClick={() => onChange?.(item)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium ring-1 ring-inset transition',
              active
                ? meta.badgeClass
                : 'bg-white text-ink-500 ring-ink-200 hover:bg-ink-50 disabled:hover:bg-white',
            )}
          >
            {done ? (
              <Check className="size-3" />
            ) : (
              <span
                className={cn('size-1.5 rounded-full', active ? meta.dotClass : 'bg-ink-300')}
              />
            )}
            {meta.label}
          </button>
        )
      })}
      {status === 'cancelled' ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-caption font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
          Dibatalkan
        </span>
      ) : null}
    </div>
  )
}

/** Legenda kalender: hanya status yang menempati tanggal. */
export function StatusLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-500">
      {(['tentative', 'confirmed', 'completed'] as BookingStatus[]).map((status) => {
        const meta = BOOKING_STATUS_META[status]
        return (
          <li key={status} className="inline-flex items-center gap-1.5">
            <span className={cn('size-1.5 rounded-full', meta.dotClass)} />
            {meta.label}
          </li>
        )
      })}
      <li className="inline-flex items-center gap-1.5">
        <span className="size-1.5 rounded-full ring-1 ring-ink-300" />
        Kosong
      </li>
    </ul>
  )
}

/** Ringkasan jumlah per status, dipakai di header daftar booking. */
export function StatusCountPills({
  counts,
  active,
  onSelect,
}: {
  counts: Record<BookingStatus, number>
  active: BookingStatus | 'all'
  onSelect: (status: BookingStatus | 'all') => void
}) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0)
  const entries: Array<{ key: BookingStatus | 'all'; label: string; count: number }> = [
    { key: 'all', label: 'Semua', count: total },
    { key: 'tentative', label: BOOKING_STATUS_META.tentative.label, count: counts.tentative },
    { key: 'confirmed', label: BOOKING_STATUS_META.confirmed.label, count: counts.confirmed },
    { key: 'completed', label: BOOKING_STATUS_META.completed.label, count: counts.completed },
    { key: 'cancelled', label: BOOKING_STATUS_META.cancelled.label, count: counts.cancelled },
  ]

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map((entry) => {
        const isActive = active === entry.key
        return (
          <button
            key={entry.key}
            type="button"
            onClick={() => onSelect(entry.key)}
            aria-pressed={isActive}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium ring-1 transition',
              isActive
                ? 'bg-ink-900 text-white ring-ink-900'
                : 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-50',
            )}
          >
            {entry.label}
            <span
              className={cn(
                'rounded-full px-1 text-2xs tabular-nums',
                isActive ? 'bg-white/20' : 'bg-ink-100 text-ink-500',
              )}
            >
              {entry.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Ekspor untuk pemakaian eksternal (mis. filter di halaman daftar). */
export { isDateOccupying }
