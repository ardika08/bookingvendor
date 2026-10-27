import { Check, Search, UserPlus, X } from '@/components/ui/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { normalizeKey, searchClients, type ClientSummary } from '@/lib/clients'
import { formatShortDate, initials } from '@/lib/format'

/**
 * Combobox pencarian klien dengan dua jalur:
 *  - pilih klien yang sudah ada (nomor WA otomatis terisi, tidak perlu ketik ulang)
 *  - atau isi nama baru secara manual — klien akan dibuat saat booking disimpan
 *
 * Pencarian mencocokkan nama dan nomor telepon (0/62/+62 dianggap sama).
 * Komponen ini murni UI: nilai tetap dikendalikan parent lewat `value`.
 */

export interface ClientSelection {
  clientId: string | null
  name: string
  phone: string
  email: string
}

export function ClientLookup({
  clients,
  value,
  onChange,
  error,
  autoFocus,
}: {
  clients: ClientSummary[]
  value: ClientSelection
  onChange: (next: ClientSelection) => void
  error?: string
  autoFocus?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(
    () => clients.find((client) => client.id === value.clientId) ?? null,
    [clients, value.clientId],
  )
  const matches = useMemo(() => searchClients(clients, query), [clients, query])
  const isNew = value.clientId === null && value.name.trim().length > 0

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    setHighlight(0)
  }, [query])

  function pick(client: ClientSummary) {
    onChange({
      clientId: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email ?? '',
    })
    setQuery('')
    setOpen(false)
  }

  function clear() {
    onChange({ clientId: null, name: '', phone: '', email: '' })
    setQuery('')
    inputRef.current?.focus()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((prev) => Math.min(prev + 1, matches.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((prev) => Math.max(prev - 1, 0))
    } else if (event.key === 'Enter' && matches[highlight]) {
      event.preventDefault()
      pick(matches[highlight])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {selected || isNew ? (
        <SelectedClientCard
          name={value.name}
          phone={value.phone}
          email={value.email}
          meta={selected ? `${selected.bookingCount} booking sebelumnya` : 'Klien baru'}
          onClear={clear}
          hasError={Boolean(error)}
        />
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            autoFocus={autoFocus}
            placeholder="Cari klien lama… atau ketik nama baru di bawah"
            aria-label="Cari klien"
            aria-expanded={open}
            aria-controls="client-lookup-listbox"
            role="combobox"
            aria-autocomplete="list"
            className={cn(
              'h-10 w-full rounded-lg border bg-white pl-9 pr-3 text-body text-ink-800 placeholder:text-ink-400',
              'focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100',
              error ? 'border-rose-300' : 'border-ink-200',
            )}
          />
        </div>
      )}

      {open && query.trim().length >= 2 && !selected ? (
        <div
          id="client-lookup-listbox"
          role="listbox"
          className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg"
        >
          {matches.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto py-1">
              {matches.map((client, index) => (
                <li key={client.id} role="option" aria-selected={index === highlight}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => pick(client)}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2 text-left',
                      index === highlight ? 'bg-brand-50' : 'hover:bg-ink-50',
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xs font-semibold text-brand-700">
                      {initials(client.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink-800">
                        {client.name}
                      </span>
                      <span className="block text-caption text-ink-500">
                        {client.phone} · {client.bookingCount} booking
                        {client.lastEventDate ? ` · terakhir ${formatShortDate(client.lastEventDate)}` : ''}
                      </span>
                    </span>
                    {index === highlight ? <Check className="size-3.5 text-brand-600" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-start gap-2 px-3 py-3">
              <UserPlus className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
              <p className="text-meta leading-relaxed text-ink-600">
                Tidak ada klien dengan nama/nomor itu. Pakai tombol{' '}
                <span className="font-medium text-ink-800">Isi klien baru</span> untuk mengetik manual.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** Kartu identitas klien yang dipilih / sedang diisi manual. */
export function SelectedClientCard({
  name,
  phone,
  email,
  meta,
  onClear,
  hasError,
}: {
  name: string
  phone: string
  email?: string
  meta?: string
  onClear?: () => void
  hasError?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg border bg-white px-3 py-2',
        hasError ? 'border-rose-300' : 'border-ink-200',
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-caption font-semibold text-brand-700">
        {initials(name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-semibold text-ink-900">{name}</p>
        <p className="truncate text-caption text-ink-500">
          {[phone, email, meta].filter(Boolean).join(' · ')}
        </p>
      </div>
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          aria-label="Ganti klien"
          title="Ganti klien"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}

/** Tab pemilih mode: klien lama vs klien baru (mobile-friendly segmented control). */
export function ClientModeTabs({
  mode,
  onChange,
  counts,
}: {
  mode: 'existing' | 'new'
  onChange: (mode: 'existing' | 'new') => void
  counts?: { existing: number }
}) {
  return (
    <div className="inline-flex rounded-lg bg-ink-100 p-0.5">
      {(
        [
          { key: 'existing', label: counts ? `Klien lama (${counts.existing})` : 'Klien lama' },
          { key: 'new', label: 'Klien baru' },
        ] as const
      ).map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          aria-pressed={mode === tab.key}
          className={cn(
            'rounded-[7px] px-3 py-1.5 text-meta font-medium transition-colors',
            mode === tab.key
              ? 'bg-white text-ink-900 shadow-sm'
              : 'text-ink-500 hover:text-ink-800',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

/** Pencocokan nomor telepon lintas format (dipakai juga untuk dedupe saat submit). */
export const samePhone = (a: string, b: string) => normalizeKey(a) === normalizeKey(b)
