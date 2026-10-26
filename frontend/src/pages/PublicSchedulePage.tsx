import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ApiError } from '@/lib/api/client'
import { fetchPublicSchedule, type PublicScheduleData } from '@/lib/api/public-schedule'
import { currentMonthKey, formatLongDate, toIsoDate } from '@/lib/format'
import {
  buildMonthMatrix,
  CALENDAR_WEEKDAYS,
  formatMonthLabel,
  isPastDate,
  shiftMonthKey,
  type MonthMatrix,
} from '@/lib/vendor-calendar'

export function PublicSchedulePage({ slug }: { slug: string }) {
  const [monthKey, setMonthKey] = useState(currentMonthKey)
  const [todayIso] = useState(() => toIsoDate(new Date()))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [requestState, setRequestState] = useState<
    | { key: string; data: PublicScheduleData }
    | { key: string; error: Error }
    | null
  >(null)
  const [reloadToken, setReloadToken] = useState(0)
  const requestKey = `${slug}:${monthKey}:${reloadToken}`
  const currentRequest = requestState?.key === requestKey ? requestState : null
  const data = currentRequest && 'data' in currentRequest ? currentRequest.data : null
  const error = currentRequest && 'error' in currentRequest ? currentRequest.error : null
  const loading = currentRequest === null

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    fetchPublicSchedule(slug, monthKey, controller.signal)
      .then((result) => {
        if (active) setRequestState({ key: requestKey, data: result })
      })
      .catch((cause: unknown) => {
        if (!active || (cause instanceof DOMException && cause.name === 'AbortError')) return
        setRequestState({
          key: requestKey,
          error: cause instanceof Error ? cause : new Error('Gagal memuat jadwal.'),
        })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [slug, monthKey, reloadToken, requestKey])

  const matrix = useMemo(
    () => buildMonthMatrix(monthKey, [], todayIso),
    [monthKey, todayIso],
  )
  const unavailableDates = useMemo(
    () => new Set(data?.month === monthKey ? data.unavailableDates : []),
    [data, monthKey],
  )
  const busyCount = [...unavailableDates].filter((date) => date >= todayIso).length

  return (
    <main className="min-h-screen bg-ink-50 px-4 py-7 sm:py-12">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200 bg-white px-5 py-4 shadow-sm sm:px-6">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
              Jadwal publik
            </p>
            <h1 className="truncate text-[15px] font-semibold text-ink-900 sm:text-base">
              {data?.vendor.businessName ?? 'Jadwal vendor'}
            </h1>
            {data?.vendor.category ? (
              <p className="mt-0.5 text-[11.5px] text-ink-500">{data.vendor.category}</p>
            ) : null}
          </div>
        </header>

        <section className="space-y-1 px-1">
          <h2 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
            Cek ketersediaan tanggal
          </h2>
          <p className="text-[13px] leading-relaxed text-ink-500">
            Pilih bulan untuk melihat tanggal yang masih tersedia untuk acara Anda.
          </p>
        </section>

        <Card>
          <div className="flex flex-col gap-4 border-b border-ink-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
                <CalendarDays className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-[14px] font-semibold capitalize text-ink-900">
                  {formatMonthLabel(monthKey)}
                </h3>
                <p className="text-[11px] text-ink-400">
                  {loading ? 'Memuat ketersediaan…' : `${busyCount} tanggal sudah terisi`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label="Bulan sebelumnya"
                onClick={() => {
                  setSelectedDate(null)
                  setMonthKey((current) => shiftMonthKey(current, -1))
                }}
                disabled={loading}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label="Bulan berikutnya"
                onClick={() => {
                  setSelectedDate(null)
                  setMonthKey((current) => shiftMonthKey(current, 1))
                }}
                disabled={loading}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="px-3 py-4 sm:px-5 sm:py-5">
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-ink-500" aria-label="Legenda kalender">
              <span className="inline-flex items-center gap-1.5">
                <CircleCheck className="size-3.5 text-emerald-600" aria-hidden="true" />
                Tersedia
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CircleX className="size-3.5 text-rose-600" aria-hidden="true" />
                Sudah terisi
              </span>
            </div>

            {loading ? (
              <div className="space-y-2" aria-busy="true" aria-label="Memuat kalender">
                <div className="grid grid-cols-7 gap-1.5">
                  {CALENDAR_WEEKDAYS.map((weekday) => (
                    <div key={weekday} className="py-2 text-center text-[10px] font-semibold text-ink-400">
                      {weekday}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 35 }, (_, index) => (
                    <div key={index} className="min-h-14 animate-pulse rounded-lg bg-ink-100 sm:min-h-16" />
                  ))}
                </div>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-8 text-center">
                <p className="text-[14px] font-semibold text-ink-900">
                  {error instanceof ApiError && error.status === 404
                    ? 'Jadwal tidak ditemukan'
                    : 'Jadwal belum dapat dimuat'}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-ink-500">
                  {error instanceof ApiError && error.status === 404
                    ? 'Link mungkin sudah tidak aktif. Minta vendor membagikan link jadwal yang terbaru.'
                    : error.message || 'Periksa koneksi internet lalu coba lagi.'}
                </p>
                {!(error instanceof ApiError && error.status === 404) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="mt-4"
                    onClick={() => setReloadToken((current) => current + 1)}
                  >
                    <RefreshCw className="size-3.5" />
                    Coba lagi
                  </Button>
                ) : null}
              </div>
            ) : (
              <PublicScheduleCalendar
                matrix={matrix}
                todayIso={todayIso}
                unavailableDates={unavailableDates}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            )}
          </div>
        </Card>

        <footer className="px-2 pb-2 text-center text-[11px] leading-relaxed text-ink-400">
          Kalender ini hanya menampilkan status ketersediaan tanggal. Informasi pribadi klien tidak ditampilkan.
        </footer>
      </div>
    </main>
  )
}

export function PublicScheduleCalendar({
  matrix,
  todayIso,
  unavailableDates,
  selectedDate,
  onSelectDate,
}: {
  matrix: MonthMatrix
  todayIso: string
  unavailableDates: Set<string>
  selectedDate: string | null
  onSelectDate: (date: string) => void
}) {
  const selectedUnavailable = selectedDate ? unavailableDates.has(selectedDate) : false
  const selectedPast = selectedDate ? isPastDate(selectedDate, todayIso) : false

  return (
    <div className="space-y-1.5" aria-label={`Kalender ${matrix.label}`}>
      <div className="grid grid-cols-7 gap-1.5">
        {CALENDAR_WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-400 sm:text-[11px]"
          >
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5" role="list" aria-label={`Tanggal di ${matrix.label}`}>
        {matrix.cells.map((cell, index) => {
          if (!cell.date || !cell.day) {
            return <div key={`empty-${index}`} className="min-h-14 sm:min-h-16" aria-hidden="true" />
          }

          const unavailable = unavailableDates.has(cell.date)
          const past = isPastDate(cell.date, todayIso)
          const label = past ? 'Lewat' : unavailable ? 'Terisi' : 'Tersedia'
          const tone = past
            ? 'border-ink-100 bg-ink-50 text-ink-300'
            : unavailable
              ? 'border-rose-100 bg-rose-50 text-rose-800 hover:bg-rose-100'
              : 'border-emerald-100 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
          const selected = selectedDate === cell.date

          return (
            <div key={cell.date} role="listitem" className="min-w-0">
              <button
                type="button"
                disabled={past}
                aria-pressed={selected}
                aria-current={cell.isToday ? 'date' : undefined}
                aria-label={`${formatLongDate(cell.date)} — ${label}`}
                onClick={() => onSelectDate(cell.date!)}
                className={`flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-lg border text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:min-h-16 ${tone} ${past ? 'cursor-not-allowed' : 'cursor-pointer'} ${selected || (cell.isToday && !selectedDate) ? 'ring-2 ring-brand-400 ring-offset-1' : ''}`}
              >
                <time dateTime={cell.date} className="text-[12px] font-semibold tabular-nums sm:text-[13px]">
                  {cell.day}
                </time>
                {!past ? (
                  <span className="text-[8px] font-medium leading-none sm:text-[9px]">{label}</span>
                ) : null}
              </button>
            </div>
          )
        })}
      </div>

      {selectedDate ? (
        <div
          role="status"
          aria-live="polite"
          className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-3 ${selectedUnavailable ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}
        >
          {selectedUnavailable ? (
            <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          <div>
            <p className="text-[12px] font-semibold">{formatLongDate(selectedDate)}</p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed">
              {selectedPast
                ? 'Tanggal ini sudah berlalu.'
                : selectedUnavailable
                  ? 'Maaf, tanggal ini sudah terisi. Silakan pilih tanggal lain yang bertanda Tersedia.'
                  : 'Tanggal ini masih tersedia.'}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-center text-[11.5px] text-ink-400">
          Pilih tanggal untuk melihat ketersediaannya.
        </p>
      )}
    </div>
  )
}
