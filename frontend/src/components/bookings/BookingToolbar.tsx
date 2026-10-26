import { ArrowUpDown, CalendarDays, Check, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { formatMonthYear } from '@/lib/format'
import { BOOKING_STATUS_META } from '@/lib/booking-status'
import { BOOKING_SORTS, BOOKING_STATUSES, type BookingFilters, type BookingSort } from '@/types/booking'

/**
 * Toolbar daftar booking: pencarian, filter status, filter bulan, urutan.
 *
 * Bentuknya mengikuti acuan desain — pill putih ber-border untuk kontrol
 * sekunder, satu tombol oranye untuk aksi utama. Kontrol yang tidak punya
 * padanan nyata di backend tidak ditampilkan; setiap tombol di sini benar-benar
 * mengubah query.
 */

const SORT_LABEL: Record<BookingSort, string> = {
  event_date: 'Acara terdekat',
  event_date_desc: 'Acara terjauh',
  price_desc: 'Nilai tertinggi',
  created_desc: 'Terbaru dibuat',
}

export function BookingToolbar({
  filters,
  onChange,
  resultCount,
  onCreate,
}: {
  filters: BookingFilters
  onChange: (next: BookingFilters) => void
  resultCount: number
  /** Aksi utama (tombol Booking Baru) — dirender di ujung kanan toolbar. */
  onCreate?: React.ReactNode
}) {
  const hasFilter =
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    filters.month !== '' ||
    (filters.sort !== undefined && filters.sort !== 'event_date')

  return (
    <div className="flex flex-col gap-2.5 px-4 py-3 sm:px-5 lg:flex-row lg:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Cari nama klien atau nomor WA…"
          className="h-9 w-full rounded-full border border-ink-200 bg-white pl-9 pr-9 text-[13px] text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          aria-label="Cari booking"
        />
        {filters.search ? (
          <button
            type="button"
            onClick={() => onChange({ ...filters, search: '' })}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
            aria-label="Hapus kata kunci"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusFilterPill
          value={filters.status}
          onChange={(status) => onChange({ ...filters, status })}
        />
        <MonthFilterPill
          value={filters.month}
          onChange={(month) => onChange({ ...filters, month })}
        />
        <SortPill
          value={filters.sort ?? 'event_date'}
          onChange={(sort) => onChange({ ...filters, sort })}
        />

        {hasFilter ? (
          <button
            type="button"
            onClick={() =>
              onChange({ month: '', status: 'all', search: '', sort: 'event_date' })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
          >
            <X className="size-3.5" />
            Reset
          </button>
        ) : null}

        <span className="hidden text-[12px] text-ink-400 xl:inline">{resultCount} booking</span>

        {onCreate}
      </div>
    </div>
  )
}

/** Pill filter status dengan dropdown bercentang. */
function StatusFilterPill({
  value,
  onChange,
}: {
  value: BookingFilters['status']
  onChange: (next: BookingFilters['status']) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const isDefault = value === 'all'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
          isDefault
            ? 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
            : 'border-brand-200 bg-brand-50 text-brand-700',
        )}
      >
        <SlidersHorizontal className="size-3.5" />
        {isDefault ? 'Status' : BOOKING_STATUS_META[value].label}
        <ChevronDown className="size-3" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-1 w-44 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-lg"
        >
          <MenuOption
            label="Semua status"
            active={value === 'all'}
            onClick={() => {
              onChange('all')
              setOpen(false)
            }}
          />
          {BOOKING_STATUSES.map((status) => (
            <MenuOption
              key={status}
              label={BOOKING_STATUS_META[status].label}
              active={value === status}
              dotClass={BOOKING_STATUS_META[status].dotClass}
              onClick={() => {
                onChange(status)
                setOpen(false)
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Pill filter bulan.
 *
 * Sebelumnya memakai `<input type="month">` native; pada Chrome kontrol itu
 * hanya menampilkan placeholder bergaris ("-------- --") sampai diklik,
 * sehingga di toolbar tampak seperti field rusak. Dropdown biasa lebih jelas
 * dan bisa memuat pintasan "Semua bulan".
 */
function MonthFilterPill({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  /* Bulan berjalan ±2 bulan — cukup untuk navigasi operasional harian. */
  const options = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 5 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() + index - 2, 1)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    })
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
          value
            ? 'border-brand-200 bg-brand-50 text-brand-700'
            : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50',
        )}
      >
        <CalendarDays className="size-3.5" />
        {value ? formatMonthYear(value) : 'Semua bulan'}
        <ChevronDown className="size-3" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-1 w-48 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-lg"
        >
          <MenuOption
            label="Semua bulan"
            active={value === ''}
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
          />
          {options.map((month) => (
            <MenuOption
              key={month}
              label={formatMonthYear(month)}
              active={value === month}
              onClick={() => {
                onChange(month)
                setOpen(false)
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Pill urutan; nilai dipetakan ke allowlist backend. */
function SortPill({ value, onChange }: { value: BookingSort; onChange: (next: BookingSort) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 text-[12.5px] font-medium text-ink-600 transition-colors hover:bg-ink-50"
      >
        <ArrowUpDown className="size-3.5" />
        <span className="hidden sm:inline">{SORT_LABEL[value]}</span>
        <span className="sm:hidden">Urut</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-lg"
        >
          {BOOKING_SORTS.map((sort) => (
            <MenuOption
              key={sort}
              label={SORT_LABEL[sort]}
              active={value === sort}
              onClick={() => {
                onChange(sort)
                setOpen(false)
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function MenuOption({
  label,
  active,
  dotClass,
  onClick,
}: {
  label: string
  active: boolean
  dotClass?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-ink-700 hover:bg-ink-50"
    >
      {dotClass ? <span className={cn('size-2 rounded-full', dotClass)} aria-hidden /> : null}
      <span className="flex-1">{label}</span>
      {active ? <Check className="size-3.5 text-brand-600" /> : null}
    </button>
  )
}
