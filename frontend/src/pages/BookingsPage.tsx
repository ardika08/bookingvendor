import { CalendarPlus, RefreshCw, SearchX, WifiOff } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookingFiltersBar } from '@/components/bookings/BookingFiltersBar'
import { BookingTable } from '@/components/bookings/BookingTable'
import { StatusCountPills } from '@/components/bookings/StatusControls'
import { SubscriptionBar } from '@/components/layout/SubscriptionBar'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { useBookingList } from '@/hooks/useBookingList'
import { useOptimisticBookingStatus } from '@/hooks/useBookingStatusChange'
import { ApiError } from '@/lib/api/client'
import { buildFilterQuery, parseFilters, type BookingsView } from '@/lib/booking-query'
import { countStatuses } from '@/lib/booking-status-optimistic'
import { formatMonthYear, toIsoDate } from '@/lib/format'
import { VendorCalendar } from '@/components/calendar/VendorCalendar'
import { cn } from '@/lib/cn'
import { useToast } from '@/components/ui/Toast'
import {
  createBlockedDate,
  deleteBlockedDate,
  fetchBlockedDates,
} from '@/lib/api/blocked-dates'
import type { BlockedDate } from '@/lib/vendor-availability'
import type { SubscriptionSummary } from '@/types/booking'

/**
 * Halaman daftar booking vendor (`/bookings`).
 *
 * Data & filter dikelola `useBookingList` (request ke API, debounce pencarian,
 * pembatalan request usang) dan disinkronkan ke query string supaya refresh /
 * back browser tidak kehilangan konteks.
 */
export function BookingsPage({ subscription }: { subscription: SubscriptionSummary }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlFilters = useMemo(() => parseFilters(searchParams), [searchParams])
  const view: BookingsView = urlFilters.view
  const [calendarMonth, setCalendarMonth] = useState(
    () => urlFilters.month || toIsoDate(new Date()).slice(0, 7),
  )

  const { result, loading, initialLoading, error, filters, setFilters, reload } = useBookingList(
    {
      month: view === 'calendar' ? calendarMonth : urlFilters.month,
      status: urlFilters.status,
      search: urlFilters.search,
    },
    urlFilters.page,
  )

  /** Dorong filter ke URL (replace agar tidak menumpuk riwayat di tiap ketikan). */
  useEffect(() => {
    const base = buildFilterQuery(
      { ...filters, month: view === 'calendar' ? calendarMonth : filters.month },
      1,
      new URLSearchParams(searchParams),
    )
    const params = new URLSearchParams(base)
    if (view === 'calendar') params.set('view', 'calendar')
    else params.delete('view')
    const next = params.toString()

    if (next !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
    // searchParams sengaja tidak di dependency agar tidak loop menulis ulang URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, calendarMonth, view])

  function setView(nextView: BookingsView) {
    const params = new URLSearchParams(searchParams)
    if (nextView === 'calendar') params.set('view', 'calendar')
    else params.delete('view')
    setSearchParams(params, { replace: true })
  }

  const { notify } = useToast()
  const [blocked, setBlocked] = useState<BlockedDate[]>([])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    fetchBlockedDates(controller.signal)
      .then((data) => {
        if (active) setBlocked(data)
      })
      .catch(() => {
        if (active) setBlocked([])
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [])

  /** Blokir / lepas blokir satu tanggal dari panel kalender. */
  async function handleToggleBlocked(date: string, reason: string | null): Promise<boolean> {
    const existing = blocked.find((item) => item.date === date)
    try {
      if (existing) {
        await deleteBlockedDate(existing.id)
        setBlocked((prev) => prev.filter((item) => item.id !== existing.id))
        notify(`Blokir ${date} dilepas.`, { tone: 'success' })
        return true
      }
      const created = await createBlockedDate({ date, reason })
      setBlocked((prev) => [...prev, created])
      notify(`Tanggal ${date} diblokir.`, { tone: 'success' })
      return true
    } catch (cause) {
      notify(
        cause instanceof ApiError
          ? cause.message
          : 'Gagal mengubah blokir tanggal. Coba lagi.',
        { tone: 'error' },
      )
      return false
    }
  }

  const { changeStatus, applyOverrides, pendingIds } = useOptimisticBookingStatus(reload)
  /** Daftar final = hasil server + override optimistis yang masih berjalan. */
  const visibleBookings = useMemo(() => applyOverrides(result.items), [applyOverrides, result.items])

  const counts = useMemo(() => countStatuses(visibleBookings), [visibleBookings])
  const hasFilter =
    filters.search.trim() !== '' || filters.status !== 'all' || filters.month !== ''

  return (
    <div className="space-y-4">
      <SubscriptionBar subscription={subscription} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">
            {view === 'calendar' ? 'Jadwal Booking' : 'Daftar Booking'}
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-500">
            {view === 'calendar'
              ? 'Lihat tanggal terisi sekilas — klik tanggal untuk detail acara.'
              : 'Semua acara yang kamu bukukan, lengkap dengan status dan nilai kontrak.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-ink-100 p-0.5">
            {(
              [
                { value: 'list', label: 'Daftar' },
                { value: 'calendar', label: 'Kalender' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setView(option.value)}
                aria-pressed={view === option.value}
                className={cn(
                  'rounded-[7px] px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                  view === option.value
                    ? 'bg-white text-ink-900 shadow-sm'
                    : 'text-ink-500 hover:text-ink-800',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <ButtonLink to="/bookings/new" className="shrink-0">
            <CalendarPlus className="size-4" />
            Booking Baru
          </ButtonLink>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Total" value={result.total} />
        <StatTile label="Terkonfirmasi" value={counts.confirmed} tone="emerald" />
        <StatTile label="Tentatif" value={counts.tentative} tone="amber" />
        <StatTile
          label={view === 'calendar' ? 'Bulan ini' : 'Halaman ini'}
          value={result.items.length}
        />
      </div>

      {view === 'calendar' ? (
        <VendorCalendar
          bookings={visibleBookings}
          blocked={blocked}
          monthKey={calendarMonth}
          onMonthChange={setCalendarMonth}
          onToggleBlocked={handleToggleBlocked}
        />
      ) : (
        <Card className="overflow-hidden">
        <BookingFiltersBar filters={filters} onChange={setFilters} resultCount={result.total} />

        <div className="border-t border-ink-100 px-4 py-2.5 sm:px-5">
          <StatusCountPills
            counts={counts}
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
                title="Tidak ada booking yang cocok"
                description="Coba ubah kata kunci, bulan, atau status filter untuk melihat hasil lain."
                action={
                  <button
                    type="button"
                    onClick={() => setFilters({ month: '', status: 'all', search: '' })}
                    className="text-[13px] font-medium text-brand-700 hover:underline"
                  >
                    Reset semua filter
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={<CalendarPlus className="size-5" />}
                title="Belum ada booking"
                description="Catat acara pertama kamu supaya jadwal dan invoice bisa dilacak dari satu tempat."
                action={
                  <ButtonLink to="/bookings/new" size="sm">
                    <CalendarPlus className="size-3.5" />
                    Buat booking pertama
                  </ButtonLink>
                }
              />
            )
          ) : (
            <BookingTable
              bookings={visibleBookings}
              pendingIds={pendingIds}
              onChangeStatus={(booking, next) => void changeStatus(booking, next)}
            />
          )}
        </div>

        {result.items.length > 0 ? (
          <div className="flex items-center justify-between gap-2 border-t border-ink-100 px-4 py-2.5 text-[12px] text-ink-500 sm:px-5">
            <span>
              Menampilkan {result.items.length} dari {result.total} booking
              {filters.month ? ` · ${formatMonthYear(filters.month)}` : ''}
              {loading ? ' · memuat…' : ''}
            </span>
            {hasFilter ? (
              <button
                type="button"
                onClick={() => setFilters({ month: '', status: 'all', search: '' })}
                className="font-medium text-ink-600 hover:text-ink-900"
              >
                Reset filter
              </button>
            ) : null}
          </div>
        ) : null}
        </Card>
      )}
    </div>
  )
}

/** Error state dengan perbedaan pesan untuk sesi berakhir vs gangguan jaringan. */
function ErrorState({ error, onRetry }: { error: ApiError | Error; onRetry: () => void }) {
  const unauthorized = error instanceof ApiError && error.isUnauthorized

  return (
    <EmptyState
      icon={<WifiOff className="size-5" />}
      title={unauthorized ? 'Sesi kamu berakhir' : 'Gagal memuat daftar booking'}
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
  brand: 'text-brand-700',
} as const

function StatTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number
  tone?: keyof typeof TONE_CLASS
}) {
  return (
    <div className="rounded-xl border border-ink-200/80 bg-white px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 text-[17px] font-semibold tabular-nums ${TONE_CLASS[tone]}`}>{value}</p>
    </div>
  )
}
