import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  SearchX,
  WifiOff,
} from '@/components/ui/icons'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookingDateGrid } from '@/components/bookings/BookingDateGrid'
import { BookingSummaryTiles } from '@/components/bookings/BookingSummaryTiles'
import { BookingTable } from '@/components/bookings/BookingTable'
import { BookingToolbar } from '@/components/bookings/BookingToolbar'
import { SubscriptionBar } from '@/components/layout/SubscriptionBar'
import { ReadOnlyActionHint, ReadOnlyBanner } from '@/components/subscription/ReadOnlyBanner'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { useBookingList } from '@/hooks/useBookingList'
import { useBookingSummary } from '@/hooks/useBookingSummary'
import { useOptimisticBookingStatus } from '@/hooks/useBookingStatusChange'
import { ApiError } from '@/lib/api/client'
import { buildFilterQuery, parseFilters, type BookingsView } from '@/lib/booking-query'
import { resolveAccess } from '@/lib/subscription-access'
import { currentMonthKey, formatMonthYear, toIsoDate } from '@/lib/format'
import { VendorCalendar } from '@/components/calendar/VendorCalendar'
import { cn } from '@/lib/cn'
import { useToast } from '@/components/ui/Toast'
import {
  createBlockedDate,
  deleteBlockedDate,
  fetchBlockedDates,
} from '@/lib/api/blocked-dates'
import type { BlockedDate } from '@/lib/vendor-availability'
import type { BookingStatus, SubscriptionSummary } from '@/types/booking'

/**
 * Halaman daftar booking vendor (`/bookings`).
 *
 * Tata letak mengikuti acuan desain: panel status tanggal (kiri) berdampingan
 * dengan kartu ringkasan (kanan), lalu tabel booking selebar konten di
 * bawahnya. Tujuannya agar vendor bisa menilai kondisi jadwal sekilas sebelum
 * membaca daftar rinci.
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
      sort: urlFilters.sort,
    },
    urlFilters.page,
  )

  const { summary, loading: summaryLoading } = useBookingSummary(filters)

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
    if (filters.sort && filters.sort !== 'event_date') params.set('sort', filters.sort)
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

  /** Pindah halaman tabel tanpa kehilangan filter aktif. */
  function setPage(nextPage: number) {
    const params = new URLSearchParams(searchParams)
    if (nextPage > 1) params.set('page', String(nextPage))
    else params.delete('page')
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

  const hasFilter =
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    filters.month !== '' ||
    (filters.sort !== undefined && filters.sort !== 'event_date')
  /** Langganan berakhir → data lama tetap tampil, tombol pembuatan data direm. */
  const access = resolveAccess(subscription)

  /** Bulan yang ditampilkan grid: bulan filter, atau bulan berjalan. */
  const gridMonth = filters.month || currentMonthKey()
  const totalPages = Math.max(1, Math.ceil(result.total / (result.perPage || 10)))

  /** Klik tanggal di grid → filter daftar ke bulan itu (pindah view tabel). */
  function focusMonth(next: string) {
    setFilters({ ...filters, month: next })
    if (view === 'calendar') setCalendarMonth(next)
  }

  function selectStatus(status: BookingStatus | 'all') {
    setFilters({ ...filters, status })
  }

  const createAction = access.readOnly ? (
    <ReadOnlyActionHint label="Booking Baru" />
  ) : (
    <ButtonLink to="/bookings/new" className="h-9 shrink-0 rounded-full px-4 text-body">
      <CalendarPlus className="size-4" />
      Booking Baru
    </ButtonLink>
  )

  return (
    <div className="space-y-4">
      <SubscriptionBar subscription={subscription} />
      <ReadOnlyBanner access={access} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-title tracking-tight text-ink-900">
            {view === 'calendar' ? 'Jadwal Booking' : 'Daftar Booking'}
          </h1>
          <p className="mt-0.5 text-meta text-ink-500">
            {view === 'calendar'
              ? 'Lihat tanggal terisi sekilas — klik tanggal untuk detail acara.'
              : 'Kelola reservasi, pembatalan, dan aktivitas booking.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full bg-ink-100 p-0.5">
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
                  'rounded-full px-3 py-1.5 text-meta font-medium transition-colors',
                  view === option.value
                    ? 'bg-white text-ink-900 shadow-sm'
                    : 'text-ink-500 hover:text-ink-800',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'calendar' ? (
        <VendorCalendar
          bookings={visibleBookings}
          blocked={blocked}
          monthKey={calendarMonth}
          onMonthChange={setCalendarMonth}
          onToggleBlocked={access.readOnly ? undefined : handleToggleBlocked}
          createBookingLocked={access.readOnly}
        />
      ) : (
        <>
          {/* Panel atas: status tanggal + kartu ringkasan */}
          <div className="grid gap-3 lg:grid-cols-[1.55fr_1fr]">
            <section className="rounded-2xl border border-ink-200/70 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lead font-semibold text-ink-900">Status Tanggal</h2>
                  {/*
                   * Subjudul dibuat dinamis. Tanpa ini grid (satu bulan) tampil
                   * berdampingan dengan Ringkasan (seluruh periode) seolah bisa
                   * dibandingkan, padahal cakupannya berbeda.
                   */}
                  <p className="text-caption text-ink-400">
                    {filters.month
                      ? `Sebaran acara ${formatMonthYear(filters.month)}.`
                      : 'Bulan berjalan — pilih bulan untuk memfilter tabel.'}
                  </p>
                </div>
                {filters.month ? (
                  <button
                    type="button"
                    onClick={() => setFilters({ ...filters, month: '' })}
                    className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-caption font-medium text-brand-700 hover:bg-brand-100"
                  >
                    {formatMonthYear(filters.month)} ✕
                  </button>
                ) : null}
              </div>
              <BookingDateGrid
                bookings={visibleBookings}
                blocked={blocked}
                monthKey={gridMonth}
                onMonthChange={focusMonth}
                onSelectDate={focusMonth}
              />
            </section>

            <section className="rounded-2xl border border-ink-200/70 bg-white p-4">
              <div className="mb-3">
                <h2 className="text-lead font-semibold text-ink-900">Ringkasan</h2>
                <p className="text-caption text-ink-400">
                  {filters.month ? formatMonthYear(filters.month) : 'Seluruh periode'}
                  {filters.search ? ' · hasil pencarian' : ''}
                </p>
              </div>
              <BookingSummaryTiles
                summary={summary}
                loading={summaryLoading}
                activeStatus={filters.status}
                onSelectStatus={selectStatus}
              />
              <p className="mt-3 border-t border-ink-100 pt-2.5 text-caption leading-relaxed text-ink-400">
                Nilai kontrak hanya menghitung booking terkonfirmasi dan selesai. Klik
                kartu untuk memfilter tabel.
              </p>
            </section>
          </div>

          {/* Tabel booking */}
          <section className="overflow-hidden rounded-2xl border border-ink-200/70 bg-white">
            <div className="flex flex-col gap-2 border-b border-ink-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0">
                <h2 className="text-lead font-semibold text-ink-900">Semua booking</h2>
                <p className="text-caption text-ink-400">
                  {result.total} booking
                  {filters.month ? ` · ${formatMonthYear(filters.month)}` : ''}
                  {loading ? ' · memuat…' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:hidden">{createAction}</div>
            </div>

            <BookingToolbar
              filters={filters}
              onChange={setFilters}
              resultCount={result.total}
              onCreate={<span className="hidden sm:inline-flex">{createAction}</span>}
            />

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
                        onClick={() =>
                          setFilters({ month: '', status: 'all', search: '', sort: 'event_date' })
                        }
                        className="text-body font-medium text-brand-700 hover:underline"
                      >
                        Reset semua filter
                      </button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={<CalendarPlus className="size-5" />}
                    title={access.readOnly ? 'Belum ada data tersimpan' : 'Belum ada booking'}
                    description={
                      access.readOnly
                        ? 'Belum ada data tersimpan. Booking baru bisa dibuat setelah langganan diperpanjang.'
                        : 'Catat acara pertama kamu supaya jadwal dan invoice bisa dilacak dari satu tempat.'
                    }
                    action={
                      access.readOnly ? (
                        <ButtonLink to="/upgrade" size="sm">
                          Perpanjang paket
                        </ButtonLink>
                      ) : (
                        <ButtonLink to="/bookings/new" size="sm">
                          <CalendarPlus className="size-3.5" />
                          Buat booking pertama
                        </ButtonLink>
                      )
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
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-4 py-2.5 text-meta text-ink-500 sm:px-5">
                <span>
                  Menampilkan {result.items.length} dari {result.total} booking
                  {hasFilter ? ' · filter aktif' : ''}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={urlFilters.page <= 1 || loading}
                    onClick={() => setPage(urlFilters.page - 1)}
                    className="inline-flex size-7 items-center justify-center rounded-full text-ink-600 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Halaman sebelumnya"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <span className="tabular-nums text-caption">
                    {urlFilters.page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={urlFilters.page >= totalPages || loading}
                    onClick={() => setPage(urlFilters.page + 1)}
                    className="inline-flex size-7 items-center justify-center rounded-full text-ink-600 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Halaman berikutnya"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </>
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
