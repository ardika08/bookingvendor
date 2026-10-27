import { ChevronDown, Search, X } from 'lucide-react'
import { INVOICE_STATUS_DISPLAY_ORDER, INVOICE_STATUS_META, INVOICE_TYPE_META } from '@/lib/invoice-status'
import { cn } from '@/lib/cn'
import { INVOICE_TYPES, type InvoiceFilters } from '@/types/invoice'

/**
 * Bar filter daftar invoice: pencarian nomor/nama/WA, filter status pembayaran,
 * dan filter jenis tagihan. Nilai memakai bentuk yang sama dengan query API
 * (`status=enum`, `type=dp|pelunasan`, `q=...`).
 */
export function InvoiceFiltersBar({
  filters,
  onChange,
  resultCount,
}: {
  filters: InvoiceFilters
  onChange: (next: InvoiceFilters) => void
  resultCount: number
}) {
  const hasFilter =
    filters.search.trim() !== '' || filters.status !== 'all' || filters.type !== 'all'

  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:px-5 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Cari nomor invoice, nama klien, atau nomor WA…"
          className="h-10 w-full rounded-lg border border-ink-200 bg-white pl-9 pr-9 text-body text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          aria-label="Cari invoice"
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
          <select
            value={filters.status}
            onChange={(event) =>
              onChange({ ...filters, status: event.target.value as InvoiceFilters['status'] })
            }
            className="h-10 appearance-none rounded-lg border border-ink-200 bg-white pl-3 pr-8 text-body text-ink-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            aria-label="Filter status invoice"
          >
            <option value="all">Semua status</option>
            {INVOICE_STATUS_DISPLAY_ORDER.map((status) => (
              <option key={status} value={status}>
                {INVOICE_STATUS_META[status].label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
        </div>

        <div className="relative">
          <select
            value={filters.type}
            onChange={(event) =>
              onChange({ ...filters, type: event.target.value as InvoiceFilters['type'] })
            }
            className="h-10 appearance-none rounded-lg border border-ink-200 bg-white pl-3 pr-8 text-body text-ink-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            aria-label="Filter jenis invoice"
          >
            <option value="all">Semua jenis</option>
            {INVOICE_TYPES.map((type) => (
              <option key={type} value={type}>
                {INVOICE_TYPE_META[type].label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
        </div>

        {hasFilter ? (
          <button
            type="button"
            onClick={() => onChange({ status: 'all', type: 'all', search: '' })}
            className={cn(
              'inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-body font-medium',
              'text-ink-500 hover:bg-ink-100 hover:text-ink-800',
            )}
          >
            <X className="size-3.5" /> Reset
          </button>
        ) : null}
      </div>

      <p className="text-meta text-ink-500 lg:ml-1 lg:shrink-0">{resultCount} invoice</p>
    </div>
  )
}
