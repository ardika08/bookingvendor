import { CalendarPlus, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { VendorCalendar } from '@/components/calendar/VendorCalendar'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { fetchBookings } from '@/lib/api/bookings'
import { ApiError } from '@/lib/api/client'
import { createBlockedDate, deleteBlockedDate, fetchBlockedDates } from '@/lib/api/blocked-dates'
import { buildMonthMatrix, summarizeMonth } from '@/lib/vendor-calendar'
import { currentMonthKey, toIsoDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Booking } from '@/types/booking'
import type { BlockedDate } from '@/lib/vendor-availability'

/**
 * Dashboard kalender vendor (`/calendar`).
 *
 * Kalender bulanan sebagai konten utama: tanggal terisi, tanggal diblokir, dan
 * ringkasan bulan. Tanggal bisa diblokir/dilepas langsung dari panel kanan —
 * perubahan memakai lapisan API sehingga backend tinggal menggantikan mock.
 *
 * Bulan aktif disimpan di query string (`?month=YYYY-MM`) agar refresh & back
 * browser tidak kehilangan konteks.
 */

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const monthParam = searchParams.get('month') ?? ''
  const monthKey = MONTH_PATTERN.test(monthParam) ? monthParam : currentMonthKey()

  const { notify } = useToast()
  const navigate = useNavigate()
  const [todayIso] = useState(() => toIsoDate(new Date()))
  const [bookings, setBookings] = useState<Booking[]>([])
  const [blocked, setBlocked] = useState<BlockedDate[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError(null)

    Promise.all([
      fetchBookings({ month: monthKey, status: 'all', search: '' }, 1, 200, controller.signal),
      fetchBlockedDates(controller.signal),
    ])
      .then(([result, dates]) => {
        if (!active) return
        setBookings(result.items)
        setBlocked(dates)
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof Error ? cause : new Error('Gagal memuat kalender.'))
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
        setInitialLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [monthKey, reloadToken])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  function changeMonth(nextMonthKey: string) {
    const params = new URLSearchParams(searchParams)
    params.set('month', nextMonthKey)
    setSearchParams(params, { replace: true })
  }

  const summary = useMemo(() => {
    const matrix = buildMonthMatrix(monthKey, bookings, todayIso)
    return summarizeMonth(matrix)
  }, [monthKey, bookings, todayIso])

  const blockedThisMonth = useMemo(
    () => blocked.filter((item) => item.date.startsWith(monthKey)).length,
    [blocked, monthKey],
  )

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
        cause instanceof ApiError ? cause.message : 'Gagal mengubah blokir tanggal. Coba lagi.',
        { tone: 'error' },
      )
      return false
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">Kalender</h2>
          <p className="mt-0.5 text-[13px] text-ink-500">
            Lihat tanggal terisi sekilas, blokir tanggal libur, dan buka detail acara.
          </p>
        </div>
        <ButtonLink to="/bookings/new" className="shrink-0">
          <CalendarPlus className="size-4" />
          Booking Baru
        </ButtonLink>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Acara bulan ini" value={summary.total} />
        <StatTile label="Tanggal terisi" value={summary.busyDays} tone="amber" />
        <StatTile label="Tanggal kosong" value={summary.freeDays} tone="emerald" />
        <StatTile label="Tanggal diblokir" value={blockedThisMonth} />
      </div>

      {initialLoading ? (
        <div className="space-y-3" aria-busy>
          <div className="h-16 animate-pulse rounded-xl bg-white" />
          <div className="h-[26rem] animate-pulse rounded-xl bg-white" />
        </div>
      ) : error ? (
        <Card>
          <EmptyState
            icon={<RefreshCw className="size-5" />}
            title="Gagal memuat kalender"
            description={error.message || 'Periksa koneksi internet lalu coba lagi.'}
            action={
              <Button size="sm" variant="secondary" onClick={reload}>
                <RefreshCw className="size-3.5" />
                Coba lagi
              </Button>
            }
          />
        </Card>
      ) : (
        <VendorCalendar
          bookings={bookings}
          blocked={blocked}
          monthKey={monthKey}
          onMonthChange={changeMonth}
          onCreateBooking={() => navigate('/bookings/new')}
          onToggleBlocked={handleToggleBlocked}
        />
      )}

      {loading && !initialLoading ? (
        <p className="text-center text-[11.5px] text-ink-400">Memuat ulang kalender…</p>
      ) : null}
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
  tone = 'neutral',
}: {
  label: string
  value: number
  tone?: keyof typeof TONE_CLASS
}) {
  return (
    <div className="rounded-xl border border-ink-200/80 bg-white px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={cn('mt-1 text-[17px] font-semibold tabular-nums', TONE_CLASS[tone])}>{value}</p>
    </div>
  )
}
