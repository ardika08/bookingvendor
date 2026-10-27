import { ChevronDown, Search, X } from '@/components/ui/icons'
import { BOOKING_STATUS_META } from '@/lib/booking-status'
import { cn } from '@/lib/cn'
import { currentMonthKey } from '@/lib/format'
import { BOOKING_STATUSES, type BookingFilters } from '@/types/booking'

/**
 * Bar filter daftar booking: pencarian nama/no. HP, filter bulan acara, dan
 * filter status. Nilai disimpan dalam bentuk yang sama dengan query API
 * (`month=YYYY-MM`, `status=enum`, `q=...`).
 */
export function BookingFiltersBar({
  filters,
  onChange,
  resultCount,
}: {
  filters: BookingFilters
  onChange: (next: BookingFilters) => void
  resultCount: number
}) {
  const hasFilter =
    filters.search.trim() !== '' || filters.status !== 'all' || filters.month !== ''

  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:px-5 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Cari nama klien atau nomor WA…"
          className="h-10 w-full rounded-lg border border-ink-200 bg-white pl-9 pr-9 text-body text-ink-800 placeholder:text-ink-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
          aria-label="Cari booking"
        />
        {filters.search ? (
          <button
            type="button"
            onClick={() => onChange({ ...filters, search: '' })}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
            aria-label="Hapus kata kunci"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <input
            type="month"
            value={filters.month}
            onChange={(event) => onChange({ ...filters, month: event.target.value })}
            className="h-10 w-[9.5rem] rounded-lg border border-ink-200 bg-white px-3 text-body text-ink-700 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
            aria-label="Filter bulan acara"
            placeholder="Semua bulan"
          />
        </div>

        <div className="relative">
          <select
            value={filters.status}
            onChange={(event) =>
              onChange({ ...filters, status: event.target.value as BookingFilters['status'] })
            }
            className="h-10 appearance-none rounded-lg border border-ink-200 bg-white pl-3 pr-8 text-body text-ink-700 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
            aria-label="Filter status booking"
          >
            <option value="all">Semua status</option>
            {BOOKING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {BOOKING_STATUS_META[status].label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
        </div>

        {hasFilter ? (
          <button
            type="button"
            onClick={() => onChange({ search: '', status: 'all', month: '' })}
            className={cn(
              'inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-body font-medium',
              'text-ink-500 hover:bg-ink-100 hover:text-ink-800',
            )}
          >
            <X className="size-3.5" /> Reset
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onChange({ ...filters, month: currentMonthKey() })}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-body font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-800"
          >
            Bulan ini
          </button>
        )}
      </div>

      <p className="text-meta text-ink-500 lg:ml-1 lg:shrink-0">
        {resultCount} booking
      </p>
    </div>
  )
}
