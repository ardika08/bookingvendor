import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarPlus, ChevronRight, Clock, RefreshCw, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusBadge, StatusMenu } from '@/components/bookings/StatusControls'
import { VendorStatusCard } from '@/components/subscription/VendorStatusCard'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { useDashboardUser } from '@/pages/DashboardHomePage'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { ApiError } from '@/lib/api/client'
import { fetchAllBookings } from '@/lib/api/bookings'
import { fetchInvoices } from '@/lib/api/invoices'
import { useOptimisticBookingStatus } from '@/hooks/useBookingStatusChange'
import {
  buildDashboardSummary,
  firstName,
  greetingFor,
  isIncomingOrder,
  topClients,
  type DashboardSummary,
} from '@/lib/dashboard-summary'
import { BOOKING_STATUS_META } from '@/lib/booking-status'
import { INVOICE_STATUS_META, remainingAmount } from '@/lib/invoice-status'
import {
  formatCurrency,
  formatShortDate,
  formatTime,
  initials,
  toIsoDate,
} from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Booking, BookingStatus } from '@/types/booking'
import type { Invoice } from '@/types/invoice'

const EMPTY_SUMMARY: DashboardSummary = {
  counts: { pending: 0, confirmed: 0, completed: 0, cancelled: 0, total: 0 },
  money: { contractValue: 0, billed: 0, paid: 0, outstanding: 0, potentialValue: 0 },
  upcoming: [],
  overdueInvoices: [],
  recentInvoices: [],
  today: '',
}

/**
 * Dashboard vendor (`/dashboard`).
 *
 * Tiga blok utama sesuai kebutuhan harian vendor:
 * 1. Ringkasan angka — pesanan masuk, jadwal terdekat, uang yang sudah masuk.
 * 2. Pesanan masuk — booking `tentative` yang perlu dikonfirmasi/dibatalkan.
 * 3. Jadwal terdekat + tagihan yang perlu ditagih.
 *
 * Data diambil paralel (booking + invoice) lalu diringkas di `dashboard-summary`
 * supaya perhitungannya bisa diuji terpisah dari UI.
 */
export function DashboardPage() {
  const user = useDashboardUser()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [todayIso] = useState(() => toIsoDate(new Date()))
  const [greeting] = useState(() => greetingFor(new Date()))

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)

    Promise.all([
      fetchAllBookings(controller.signal),
      fetchInvoices({ status: 'all', type: 'all', search: '' }, 1, 500, controller.signal),
    ])
      .then(([bookingList, invoiceResult]) => {
        if (!active) return
        setBookings(bookingList)
        setInvoices(invoiceResult.items)
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof Error ? cause : new Error('Gagal memuat dashboard.'))
      })
      .finally(() => {
        if (!active) return
        setInitialLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [reloadToken])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])
  const { changeStatus, applyOverrides, pendingIds } = useOptimisticBookingStatus(reload)

  const visibleBookings = useMemo(
    () => applyOverrides(bookings),
    [applyOverrides, bookings],
  )

  const summary = useMemo(
    () =>
      todayIso
        ? buildDashboardSummary(visibleBookings, invoices, todayIso)
        : EMPTY_SUMMARY,
    [visibleBookings, invoices, todayIso],
  )

  const incoming = useMemo(
    () => visibleBookings.filter(isIncomingOrder).sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
    [visibleBookings],
  )

  const clients = useMemo(() => topClients(visibleBookings), [visibleBookings])

  async function handleChangeStatus(booking: Booking, next: BookingStatus) {
    await changeStatus(booking, next)
  }

  if (initialLoading) {
    return (
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-xl bg-white" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl bg-white" />
          ))}
        </div>
        <div className="rounded-xl border border-ink-200/80 bg-white">
          <TableSkeleton rows={4} columns={4} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Card>
          <EmptyState
            icon={null}
            title={
              error instanceof ApiError && error.isUnauthorized
                ? 'Sesi kamu berakhir'
                : 'Gagal memuat dashboard'
            }
            description={
              error instanceof ApiError && error.isUnauthorized
                ? 'Masuk kembali dengan akun Google untuk melanjutkan.'
                : error.message || 'Periksa koneksi internet lalu coba lagi.'
            }
            action={
              error instanceof ApiError && error.isUnauthorized ? (
                <ButtonLink to="/login" size="sm">
                  Masuk dengan Google
                </ButtonLink>
              ) : (
                <button
                  type="button"
                  onClick={reload}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[13px] font-medium text-white hover:bg-brand-700"
                >
                  <RefreshCw className="size-3.5" />
                  Coba lagi
                </button>
              )
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <VendorStatusCard subscription={user.subscription} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">
            {greeting}, {firstName(user)}
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-500">
            {summary.counts.pending > 0
              ? `${summary.counts.pending} pesanan menunggu konfirmasi, ${summary.upcoming.length} jadwal terdekat.`
              : 'Semua pesanan sudah ditindaklanjuti. Jadwal terdekat ada di bawah.'}
          </p>
        </div>
        <ButtonLink to="/bookings/new" className="shrink-0">
          <CalendarPlus className="size-4" />
          Booking Baru
        </ButtonLink>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile
          label="Pesanan masuk"
          value={String(summary.counts.pending)}
          hint="Menunggu konfirmasi"
          tone={summary.counts.pending > 0 ? 'amber' : 'neutral'}
        />
        <StatTile
          label="Terkonfirmasi"
          value={String(summary.counts.confirmed)}
          hint="Acara fix berjalan"
          tone="emerald"
        />
        <StatTile
          label="Uang masuk"
          value={formatCurrency(summary.money.paid)}
          hint={`dari ${formatCurrency(summary.money.billed)} ditagihkan`}
          tone="emerald"
        />
        <StatTile
          label="Belum masuk"
          value={formatCurrency(summary.money.outstanding)}
          hint={`${summary.overdueInvoices.length} lewat jatuh tempo`}
          tone={summary.money.outstanding > 0 ? 'amber' : 'neutral'}
        />
      </div>

      <RevenueChart />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Pesanan masuk"
              description={
                incoming.length > 0
                  ? 'Booking tentatif — konfirmasi atau batalkan supaya tanggal jelas.'
                  : 'Tidak ada pesanan yang menunggu konfirmasi.'
              }
              action={
                <Link
                  to="/bookings?status=tentative"
                  className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-700 hover:underline"
                >
                  Semua booking
                  <ChevronRight className="size-3.5" />
                </Link>
              }
            />
            {incoming.length === 0 ? (
              <EmptyState
                icon={<Clock className="size-5" />}
                title="Tidak ada pesanan masuk"
                description="Booking baru akan muncul di sini berstatus tentatif hingga kamu konfirmasi."
                action={
                  <ButtonLink to="/bookings/new" size="sm" variant="secondary">
                    Catat pesanan
                  </ButtonLink>
                }
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {incoming.slice(0, 5).map((booking) => (
                  <li key={booking.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-700">
                      {initials(booking.client.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/bookings/${booking.id}`}
                        className="block truncate text-[13.5px] font-semibold text-ink-900 hover:underline"
                      >
                        {booking.client.name}
                      </Link>
                      <p className="mt-0.5 text-[12px] text-ink-500">
                        {formatShortDate(booking.eventDate)}
                        {booking.eventTime ? ` · ${formatTime(booking.eventTime)}` : ''} ·{' '}
                        {booking.packageName ?? 'Tanpa paket'}
                      </p>
                      <p className="text-[12px] font-medium tabular-nums text-ink-700">
                        {formatCurrency(booking.totalPrice)}
                      </p>
                    </div>
                    <StatusMenu
                      status={booking.status}
                      hasInvoice={booking.invoiceCount > 0}
                      disabled={pendingIds.has(booking.id)}
                      onChange={(next) => void handleChangeStatus(booking, next)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Jadwal terdekat"
              description="Acara tentatif & terkonfirmasi yang belum lewat."
              action={
                <Link
                  to="/bookings?view=calendar"
                  className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-700 hover:underline"
                >
                  Lihat kalender
                  <ChevronRight className="size-3.5" />
                </Link>
              }
            />
            {summary.upcoming.length === 0 ? (
              <EmptyState
                icon={<CalendarPlus className="size-5" />}
                title="Belum ada jadwal mendatang"
                description="Tambahkan booking supaya jadwal acara mulai terisi."
                action={
                  <ButtonLink to="/bookings/new" size="sm">
                    Booking baru
                  </ButtonLink>
                }
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {summary.upcoming.map((booking) => (
                  <li key={booking.id} className="px-4 py-3 sm:px-5">
                    <Link
                      to={`/bookings/${booking.id}`}
                      className="flex items-start justify-between gap-3 hover:opacity-80"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink-900">
                          {booking.client.name}
                        </p>
                        <p className="mt-0.5 text-[12px] text-ink-500">
                          {formatShortDate(booking.eventDate)}
                          {booking.eventTime ? ` · ${formatTime(booking.eventTime)}` : ''}
                        </p>
                        <p className="truncate text-[11.5px] text-ink-400">
                          {booking.eventLocation ?? 'Lokasi belum diisi'}
                        </p>
                      </div>
                      <StatusBadge status={booking.status} className="shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader title="Perlu ditagih" description="Invoice lewat jatuh tempo." />
            {summary.overdueInvoices.length === 0 ? (
              <CardBody>
                <p className="text-[12.5px] text-ink-500">
                  Tidak ada tagihan terlambat. Semua invoice masih dalam tenggat.
                </p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-ink-100">
                {summary.overdueInvoices.map((invoice) => (
                  <li key={invoice.id}>
                    <Link
                      to={`/invoices/${invoice.id}`}
                      className="block px-4 py-2.5 hover:bg-ink-50/60 sm:px-5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-[12.5px] font-medium text-ink-800">
                          {invoice.clientName}
                        </p>
                        <span className="shrink-0 text-[11px] text-rose-600">
                          {INVOICE_STATUS_META[invoice.status].label}
                        </span>
                      </div>
                      <p className="text-[11.5px] tabular-nums text-ink-500">
                        sisa {formatCurrency(remainingAmount(invoice))} · jatuh tempo{' '}
                        {formatShortDate(invoice.dueAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Ringkasan" />
            <CardBody className="space-y-1.5 text-[12.5px]">
              <SummaryRow label="Nilai kontrak" value={formatCurrency(summary.money.contractValue)} />
              <SummaryRow
                label="Potensi (tentatif)"
                value={formatCurrency(summary.money.potentialValue)}
              />
              <SummaryRow label="Total ditagihkan" value={formatCurrency(summary.money.billed)} />
              <SummaryRow label="Sudah dibayar" value={formatCurrency(summary.money.paid)} strong />
            </CardBody>
          </Card>

          {clients.length > 0 ? (
            <Card>
              <CardHeader title="Klien teratas" />
              <CardBody className="space-y-1.5 text-[12.5px]">
                {clients.map((client) => (
                  <div key={client.name} className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-ink-600">{client.name}</span>
                    <span className="shrink-0 tabular-nums text-ink-700">
                      {client.count} booking
                    </span>
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}

          <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
            <Wallet className="mt-0.5 size-3.5 shrink-0 text-sky-600" />
            <p className="text-[11.5px] leading-relaxed text-sky-900">
              Angka uang dihitung dari invoice yang sudah terbit. Tagihan baru bisa dibuat dari
              halaman detail booking.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

const TONE_CLASS = {
  neutral: 'text-ink-900',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
} as const

function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  tone?: keyof typeof TONE_CLASS
}) {
  return (
    <div className="rounded-xl border border-ink-200/80 bg-white px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={cn('mt-1 text-[16px] font-semibold tabular-nums', TONE_CLASS[tone])}>{value}</p>
      {hint ? <p className="mt-0.5 truncate text-[10.5px] text-ink-400">{hint}</p> : null}
    </div>
  )
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <span
        className={cn(
          'shrink-0 tabular-nums',
          strong ? 'font-semibold text-ink-900' : 'text-ink-700',
        )}
      >
        {value}
      </span>
    </div>
  )
}

/** Badge opsional untuk status non-aktif (dipakai bila dashboard menampilkan arsip). */
export function DashboardBookingStatus({ status }: { status: BookingStatus }) {
  return <StatusBadge status={status} className={BOOKING_STATUS_META[status].badgeClass} />
}
