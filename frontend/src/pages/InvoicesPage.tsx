import { AlertTriangle, ReceiptText, RefreshCw, SearchX } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { InvoiceFiltersBar } from '@/components/invoices/InvoiceFiltersBar'
import { InvoiceTable } from '@/components/invoices/InvoiceTable'
import { SubscriptionBar } from '@/components/layout/SubscriptionBar'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { useInvoiceList } from '@/hooks/useInvoiceList'
import { ApiError } from '@/lib/api/client'
import { INVOICE_STATUS_DISPLAY_ORDER, INVOICE_STATUS_META } from '@/lib/invoice-status'
import { buildInvoiceFilterQuery, hasActiveInvoiceFilters, parseInvoiceFilters } from '@/lib/invoice-query'
import { formatCurrency } from '@/lib/format'
import type { SubscriptionSummary } from '@/types/booking'
import type { InvoiceFilters } from '@/types/invoice'

/**
 * Halaman daftar invoice vendor (`/invoices`).
 *
 * Data & filter dikelola `useInvoiceList` (debounce pencarian + pembatalan
 * request usang) dan disinkronkan ke query string supaya refresh / back browser
 * tidak kehilangan konteks. Angka ringkasan dihitung dari seluruh hasil filter
 * (bukan hanya halaman ini), jadi vendor melihat total piutang yang sebenarnya.
 *
 * Fase ini masih memakai data tiruan (`USE_MOCK_DATA`); pembuatan invoice dari
 * booking, halaman detail, dan link publik menyusul di task berikutnya.
 */
export function InvoicesPage({ subscription }: { subscription: SubscriptionSummary }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlFilters = useMemo(() => parseInvoiceFilters(searchParams), [searchParams])

  const {
    result,
    loading,
    initialLoading,
    error,
    filters,
    page,
    totalPages,
    setFilters,
    setPage,
    reload,
  } = useInvoiceList(
    { status: urlFilters.status, type: urlFilters.type, search: urlFilters.search },
    urlFilters.page,
  )

  /** Dorong filter + halaman ke URL (replace agar tidak menumpuk riwayat). */
  useEffect(() => {
    const next = buildInvoiceFilterQuery(filters, page, new URLSearchParams(searchParams))
    if (next !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
    // searchParams sengaja tidak di dependency agar tidak loop menulis ulang URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page])

  const hasFilter = hasActiveInvoiceFilters(filters)
  const { summary } = result

  return (
    <div className="space-y-4">
      <SubscriptionBar subscription={subscription} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">Daftar Invoice</h2>
          <p className="mt-0.5 text-[13px] text-ink-500">
            Semua tagihan booking kamu — DP, pelunasan, dan sisa yang belum masuk.
          </p>
        </div>
        <ButtonLink to="/bookings" variant="secondary" className="shrink-0">
          <ReceiptText className="size-4" />
          Buat dari booking
        </ButtonLink>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Total ditagihkan" value={formatCurrency(summary.billed)} />
        <StatTile label="Sudah dibayar" value={formatCurrency(summary.paid)} tone="emerald" />
        <StatTile
          label="Belum masuk"
          value={formatCurrency(summary.outstanding)}
          tone={summary.outstanding > 0 ? 'amber' : 'neutral'}
        />
        <StatTile
          label="Lewat jatuh tempo"
          value={`${summary.overdueCount} invoice`}
          tone={summary.overdueCount > 0 ? 'rose' : 'neutral'}
        />
      </div>

      <Card className="overflow-hidden">
        <InvoiceFiltersBar filters={filters} onChange={setFilters} resultCount={result.total} />

        <div className="border-t border-ink-100 px-4 py-2.5 sm:px-5">
          <StatusFilterPills
            active={filters.status}
            onSelect={(status) => setFilters({ ...filters, status })}
          />
        </div>

        <div className="border-t border-ink-100">
          {initialLoading ? (
            <TableSkeleton rows={5} columns={6} />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : result.items.length === 0 ? (
            hasFilter ? (
              <EmptyState
                icon={<SearchX className="size-5" />}
                title="Tidak ada invoice yang cocok"
                description="Coba ubah kata kunci, status, atau jenis tagihan untuk melihat hasil lain."
                action={
                  <button
                    type="button"
                    onClick={() => setFilters({ status: 'all', type: 'all', search: '' })}
                    className="text-[13px] font-medium text-brand-700 hover:underline"
                  >
                    Reset semua filter
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={<ReceiptText className="size-5" />}
                title="Belum ada invoice"
                description="Invoice dibuat dari data booking — pilih booking yang sudah fix, lalu terbitkan DP atau pelunasan."
                action={
                  <ButtonLink to="/bookings" size="sm">
                    Buka daftar booking
                  </ButtonLink>
                }
              />
            )
          ) : (
            <InvoiceTable invoices={result.items} />
          )}
        </div>

        {result.items.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-ink-100 px-4 py-2.5 text-[12px] text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <span>
              Menampilkan {(page - 1) * (result.perPage || result.items.length) + 1}–
              {(page - 1) * (result.perPage || result.items.length) + result.items.length} dari{' '}
              {result.total} invoice
              {loading ? ' · memuat…' : ''}
            </span>
            <div className="flex items-center gap-2">
              {hasFilter ? (
                <button
                  type="button"
                  onClick={() => setFilters({ status: 'all', type: 'all', search: '' })}
                  className="font-medium text-ink-600 hover:text-ink-900"
                >
                  Reset filter
                </button>
              ) : null}
              {totalPages > 1 ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1 || loading}
                    className="rounded-md px-2 py-1 font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900 disabled:cursor-not-allowed disabled:text-ink-300 disabled:hover:bg-transparent"
                  >
                    Sebelumnya
                  </button>
                  <span className="tabular-nums text-ink-500">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages || loading}
                    className="rounded-md px-2 py-1 font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900 disabled:cursor-not-allowed disabled:text-ink-300 disabled:hover:bg-transparent"
                  >
                    Berikutnya
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  )
}

/**
 * Pill filter status cepat. Jumlah per status belum disertakan karena angka itu
 * butuh agregat dari server; cukup label + status aktif agar tetap ringkas.
 */
function StatusFilterPills({
  active,
  onSelect,
}: {
  active: InvoiceFilters['status']
  onSelect: (status: InvoiceFilters['status']) => void
}) {
  const options: { value: InvoiceFilters['status']; label: string }[] = [
    { value: 'all', label: 'Semua' },
    ...INVOICE_STATUS_DISPLAY_ORDER.map((status) => ({
      value: status as InvoiceFilters['status'],
      label: INVOICE_STATUS_META[status].label,
    })),
  ]

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          aria-pressed={active === option.value}
          className={
            active === option.value
              ? 'rounded-full bg-ink-900 px-2.5 py-1 text-[12px] font-medium text-white'
              : 'rounded-full px-2.5 py-1 text-[12px] font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-800'
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: ApiError | Error; onRetry: () => void }) {
  const unauthorized = error instanceof ApiError && error.isUnauthorized
  return (
    <EmptyState
      icon={<AlertTriangle className="size-5" />}
      title={unauthorized ? 'Sesi kamu berakhir' : 'Gagal memuat daftar invoice'}
      description={
        unauthorized
          ? 'Masuk kembali dengan akun Google untuk melanjutkan.'
          : error.message || 'Periksa koneksi internet lalu coba lagi.'
      }
      action={
        unauthorized ? (
          <ButtonLink to="/login" size="sm">
            Masuk dengan Google
          </ButtonLink>
        ) : (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            <RefreshCw className="size-3.5" />
            Coba lagi
          </Button>
        )
      }
    />
  )
}

const TONE_CLASS = {
  neutral: 'text-ink-900',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  rose: 'text-rose-700',
} as const

function StatTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: keyof typeof TONE_CLASS
}) {
  return (
    <div className="rounded-xl border border-ink-200/80 bg-white px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 text-[15px] font-semibold tabular-nums ${TONE_CLASS[tone]}`}>{value}</p>
    </div>
  )
}
