import { Mail, Phone, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { inputClass } from '@/components/ui/Field'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { useClientList } from '@/hooks/useClientList'
import type { ClientSort, ClientSummary } from '@/lib/api/clients'
import { formatCurrency, formatDate, initials } from '@/lib/format'
import { cn } from '@/lib/cn'

const SORT_OPTIONS: { value: ClientSort; label: string }[] = [
  { value: 'recent', label: 'Aktivitas terbaru' },
  { value: 'name', label: 'Nama A–Z' },
  { value: 'value', label: 'Nilai tertinggi' },
  { value: 'bookings', label: 'Booking terbanyak' },
]

/**
 * Halaman daftar klien (`/clients`).
 *
 * Klien tidak dibuat di sini — mereka muncul otomatis saat booking disimpan.
 * Karena itu halaman ini bersifat baca saja dan tidak punya tombol "Tambah
 * klien": klien tanpa booking hanya akan menggantung tanpa konteks acara.
 *
 * Angka "nilai" adalah jumlah total_price booking yang tidak dibatalkan,
 * dihitung di server.
 */
export function ClientsPage() {
  const {
    clients,
    total,
    page,
    perPage,
    filters,
    setFilters,
    loading,
    initialLoading,
    error,
    setPage,
    reload,
    hasFilter,
  } = useClientList()

  const [selected, setSelected] = useState<ClientSummary | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1
  const rangeEnd = Math.min(page * perPage, total)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Klien"
          description="Kontak yang pernah booking. Dibuat otomatis dari form booking."
          action={
            <Button variant="secondary" size="sm" onClick={reload} disabled={loading}>
              Muat ulang
            </Button>
          }
        />

        <CardBody className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={filters.search}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, search: event.target.value }))
                }
                placeholder="Cari nama, nomor telepon, atau email…"
                aria-label="Cari klien"
                className={cn(inputClass(), 'pl-9')}
              />
            </div>
            <select
              value={filters.sort}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, sort: event.target.value as ClientSort }))
              }
              aria-label="Urutkan klien"
              className={cn(inputClass(), 'sm:w-56')}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
              <p className="text-[12.5px] text-rose-800">{error}</p>
              <Button variant="secondary" size="sm" className="mt-2" onClick={reload}>
                Coba lagi
              </Button>
            </div>
          ) : null}

          {initialLoading ? (
            <TableSkeleton rows={6} columns={4} />
          ) : clients.length === 0 ? (
            hasFilter ? (
              <EmptyState
                icon={<Search className="size-5" />}
                title="Tidak ada klien yang cocok"
                description="Coba kata kunci lain, atau ubah urutan daftar."
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setFilters({ search: '', sort: 'recent' })}
                  >
                    Hapus filter
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Users className="size-5" />}
                title="Belum ada klien"
                description="Klien akan muncul di sini setelah kamu menyimpan booking pertama."
              />
            )
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-400">
                      <th className="py-2 pr-3 font-medium">Klien</th>
                      <th className="py-2 pr-3 font-medium">Kontak</th>
                      <th className="py-2 pr-3 text-right font-medium">Booking</th>
                      <th className="py-2 pr-3 text-right font-medium">Nilai</th>
                      <th className="py-2 text-right font-medium">Terakhir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr
                        key={client.id}
                        onClick={() => setSelected(client)}
                        className="cursor-pointer border-b border-ink-50 transition-colors last:border-0 hover:bg-ink-50/60"
                      >
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-700">
                              {initials(client.name)}
                            </span>
                            <span className="truncate text-[13px] font-medium text-ink-800">
                              {client.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          <p className="text-[12px] tabular-nums text-ink-600">{client.phone}</p>
                          {client.email ? (
                            <p className="truncate text-[11px] text-ink-400">{client.email}</p>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-[12.5px] tabular-nums text-ink-700">
                          {client.bookingCount}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-[12.5px] tabular-nums text-ink-800">
                          {client.totalValue > 0 ? formatCurrency(client.totalValue) : '—'}
                        </td>
                        <td className="py-2.5 text-right text-[12px] text-ink-500">
                          {client.lastEventDate ? formatDate(client.lastEventDate) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-2 border-t border-ink-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11.5px] text-ink-500">
                  Menampilkan {rangeStart}–{rangeEnd} dari {total} klien
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage(page - 1)}
                  >
                    Sebelumnya
                  </Button>
                  <span className="text-[11.5px] tabular-nums text-ink-500">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage(page + 1)}
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {selected ? (
        <ClientDetailDialog client={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  )
}

/**
 * Ringkasan satu klien.
 *
 * Data diambil dari baris yang sudah dimuat, bukan permintaan baru — isinya
 * sama dengan `GET /api/clients/{id}` karena kolomnya dihitung dengan query
 * yang sama. Ini menghindari kedipan saat dialog dibuka.
 */
function ClientDetailDialog({
  client,
  onClose,
}: {
  client: ClientSummary
  onClose: () => void
}) {
  const lastLabel = useMemo(() => {
    if (!client.lastEventDate) return 'Belum pernah booking'
    return formatDate(client.lastEventDate)
  }, [client.lastEventDate])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Detail klien ${client.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[12px] font-semibold text-brand-700">
            {initials(client.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold text-ink-900">{client.name}</h3>
            <p className="text-[12px] text-ink-500">Klien sejak {formatDate(client.createdAt ?? '')}</p>
          </div>
        </div>

        <dl className="mt-4 space-y-2 border-t border-ink-100 pt-3 text-[12.5px]">
          <div className="flex items-center gap-2 text-ink-700">
            <Phone className="size-3.5 shrink-0 text-ink-400" />
            <span className="tabular-nums">{client.phone}</span>
          </div>
          {client.email ? (
            <div className="flex items-center gap-2 text-ink-700">
              <Mail className="size-3.5 shrink-0 text-ink-400" />
              <span className="truncate">{client.email}</span>
            </div>
          ) : null}
          {client.address ? (
            <div className="text-ink-500">{client.address}</div>
          ) : null}
          <div className="flex items-baseline justify-between gap-3 pt-1">
            <dt className="text-ink-500">Jumlah booking</dt>
            <dd className="tabular-nums text-ink-800">{client.bookingCount}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-500">Total nilai</dt>
            <dd className="tabular-nums text-ink-800">
              {client.totalValue > 0 ? formatCurrency(client.totalValue) : '—'}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-500">Acara terakhir</dt>
            <dd className="text-ink-800">{lastLabel}</dd>
          </div>
        </dl>

        {client.notes ? (
          <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-[12px] leading-relaxed text-ink-600">
            {client.notes}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </div>
  )
}
