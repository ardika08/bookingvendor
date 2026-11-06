import { Mail, Pencil, Phone, Search, Trash2, Users } from '@/components/ui/icons'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field, inputClass, textareaClass } from '@/components/ui/Field'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { useToast } from '@/components/ui/Toast'
import { useClientList } from '@/hooks/useClientList'
import type { ClientSort, ClientSummary } from '@/lib/api/clients'
import { deleteClient, updateClient } from '@/lib/api/clients'
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
  const [editing, setEditing] = useState<ClientSummary | null>(null)
  const [deleting, setDeleting] = useState<ClientSummary | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { notify } = useToast()

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  function openDetail(event: React.MouseEvent, client: ClientSummary) {
    // Jangan buka dialog detail saat tombol aksi di baris yang sama diklik.
    if ((event.target as HTMLElement).closest('[data-row-action]')) return
    setSelected(client)
  }

  function handleSaved(updated: ClientSummary) {
    setEditing(null)
    setSelected((prev) => (prev && prev.id === updated.id ? updated : prev))
    reload()
    notify('Data klien tersimpan.', { tone: 'success' })
  }

  function handleDeleted(client: ClientSummary, deletedBookings: number) {
    setDeleting(null)
    setSelected((prev) => (prev && prev.id === client.id ? null : prev))
    reload()
    notify(
      deletedBookings > 0
        ? `${client.name} dan ${deletedBookings} booking dihapus.`
        : `${client.name} dihapus.`,
      { tone: 'success' },
    )
  }
  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1
  const rangeEnd = Math.min(page * perPage, total)

  return (
    <div className="space-y-4">
      {/*
        Halaman ini sebelumnya hanya punya `CardHeader` (h2 15px) tanpa judul
        dokumen sama sekali — satu-satunya halaman tanpa `<h1>`. Judul halaman
        sekarang dipisahkan dari kartu agar tingkatnya benar dan tidak
        bergantung pada komponen kartu. Tombol "Muat ulang" ikut pindah ke
        baris judul supaya tidak ada header kartu yang mengulang judul yang sama.
      */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-title tracking-tight text-ink-900">Klien</h1>
          <p className="mt-0.5 text-body text-ink-500">
            Kontak yang pernah booking. Dibuat otomatis dari form booking.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={reload}
          disabled={loading}
          className="shrink-0"
        >
          Muat ulang
        </Button>
      </div>

      <Card>
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
              <p className="text-meta text-rose-800">{error}</p>
              <Button variant="secondary" size="sm" className="mt-2" onClick={reload}>
                Coba lagi
              </Button>
            </div>
          ) : null}

          {initialLoading ? (
            <TableSkeleton rows={6} columns={6} />
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
                    <tr className="border-b border-ink-100 text-caption uppercase tracking-wide text-ink-400">
                      <th className="py-2 pr-3 font-medium">Klien</th>
                      <th className="py-2 pr-3 font-medium">Kontak</th>
                      <th className="py-2 pr-3 text-right font-medium">Booking</th>
                      <th className="py-2 pr-3 text-right font-medium">Nilai</th>
                      <th className="py-2 text-right font-medium">Terakhir</th>
                      <th className="py-2 text-right font-medium">
                        <span className="sr-only">Aksi</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr
                        key={client.id}
                        onClick={(event) => openDetail(event, client)}
                        className="cursor-pointer border-b border-ink-50 transition-colors last:border-0 hover:bg-ink-50/60"
                      >
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-caption font-semibold text-brand-700">
                              {initials(client.name)}
                            </span>
                            <span className="truncate text-body font-medium text-ink-800">
                              {client.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          <p className="text-meta tabular-nums text-ink-600">{client.phone}</p>
                          {client.email ? (
                            <p className="truncate text-caption text-ink-400">{client.email}</p>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-meta tabular-nums text-ink-700">
                          {client.bookingCount}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-meta tabular-nums text-ink-800">
                          {client.totalValue > 0 ? formatCurrency(client.totalValue) : '—'}
                        </td>
                        <td className="py-2.5 text-right text-meta text-ink-500">
                          {client.lastEventDate ? formatDate(client.lastEventDate) : '—'}
                        </td>
                        <td className="py-2.5 pl-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              data-row-action
                              onClick={() => setEditing(client)}
                              aria-label={`Edit ${client.name}`}
                              title="Edit"
                              className="inline-flex size-8 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              data-row-action
                              onClick={() => setDeleting(client)}
                              aria-label={`Hapus ${client.name}`}
                              title="Hapus"
                              className="inline-flex size-8 items-center justify-center rounded-lg text-ink-500 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-2 border-t border-ink-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-caption text-ink-500">
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
                  <span className="text-caption tabular-nums text-ink-500">
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

      {editing ? (
        <ClientEditDialog
          client={editing}
          busy={busyId === editing.id}
          onBusyChange={(busy) => setBusyId(busy ? editing.id : null)}
          onCancel={() => setEditing(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {deleting ? (
        <ClientDeleteDialog
          client={deleting}
          busy={busyId === deleting.id}
          onBusyChange={(busy) => setBusyId(busy ? deleting.id : null)}
          onCancel={() => setDeleting(null)}
          onDeleted={handleDeleted}
        />
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
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-meta font-semibold text-brand-700">
            {initials(client.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lead font-semibold text-ink-900">{client.name}</h3>
            <p className="text-meta text-ink-500">Klien sejak {formatDate(client.createdAt ?? '')}</p>
          </div>
        </div>

        <dl className="mt-4 space-y-2 border-t border-ink-100 pt-3 text-meta">
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
          <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-meta leading-relaxed text-ink-600">
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

/**
 * Dialog ubah data kontak klien.
 *
 * Semua field bebas diedit — vendor yang paling tahu kontak mana yang benar.
 * Klien milik vendor lain tidak bisa dijangkau karena endpoint memfilter
 * `vendor_id` dari sesi login.
 */
function ClientEditDialog({
  client,
  busy,
  onBusyChange,
  onCancel,
  onSaved,
}: {
  client: ClientSummary
  busy: boolean
  onBusyChange: (busy: boolean) => void
  onCancel: () => void
  onSaved: (client: ClientSummary) => void
}) {
  const [name, setName] = useState(client.name)
  const [phone, setPhone] = useState(client.phone)
  const [email, setEmail] = useState(client.email ?? '')
  const [address, setAddress] = useState(client.address ?? '')
  const [notes, setNotes] = useState(client.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Nama klien wajib diisi.'
    if (!phone.trim()) next.phone = 'Nomor telepon wajib diisi.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validate() || busy) return

    onBusyChange(true)
    setErrors({})
    try {
      const updated = await updateClient(client.id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      })
      onSaved(updated)
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Gagal menyimpan data klien.' })
    } finally {
      onBusyChange(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Edit klien ${client.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
      onClick={onCancel}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lead font-semibold text-ink-900">Edit klien</h3>
        <p className="mt-0.5 text-meta text-ink-500">
          Perubahan berlaku untuk semua booking klien ini.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <Field id="editName" label="Nama" required error={errors.name}>
            <input
              id="editName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={cn(inputClass(Boolean(errors.name)))}
            />
          </Field>
          <Field id="editPhone" label="No. WhatsApp" required error={errors.phone}>
            <input
              id="editPhone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              className={cn(inputClass(Boolean(errors.phone)))}
            />
          </Field>
          <Field id="editEmail" label="Email (opsional)" error={errors.email}>
            <input
              id="editEmail"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className={inputClass(Boolean(errors.email))}
            />
          </Field>
          <Field id="editAddress" label="Alamat (opsional)">
            <input
              id="editAddress"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className={inputClass()}
            />
          </Field>
          <Field id="editNotes" label="Catatan (opsional)">
            <textarea
              id="editNotes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={textareaClass()}
            />
          </Field>

          {errors.form ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-meta text-rose-700">{errors.form}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * Konfirmasi hapus klien.
 *
 * Klien dipilih dihapus bersama seluruh booking-nya (cascade di DB). Jumlah
 * booking ditampilkan eksplisit — perintah ini tidak bisa dibatalkan.
 */
function ClientDeleteDialog({
  client,
  busy,
  onBusyChange,
  onCancel,
  onDeleted,
}: {
  client: ClientSummary
  busy: boolean
  onBusyChange: (busy: boolean) => void
  onCancel: () => void
  onDeleted: (client: ClientSummary, deletedBookings: number) => void
}) {
  const [confirmText, setConfirmText] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const expected = client.bookingCount > 0 ? String(client.bookingCount) : ''

  async function handleConfirm() {
    if (busy) return
    if (expected && confirmText.trim() !== expected) {
      setErrors({ confirm: `Ketik ${expected} untuk konfirmasi.` })
      return
    }

    onBusyChange(true)
    setErrors({})
    try {
      const result = await deleteClient(client.id)
      onDeleted(client, result.deletedBookings)
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Gagal menghapus klien.' })
    } finally {
      onBusyChange(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Hapus klien ${client.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lead font-semibold text-ink-900">Hapus klien?</h3>
        <p className="mt-1 text-meta leading-relaxed text-ink-600">
          {client.name} dan seluruh datanya akan dihapus permanen.
          {client.bookingCount > 0 ? (
            <>
              {' '}Ini mencakup <strong>{client.bookingCount} booking</strong> beserta invoice
              dan addon di dalamnya.
            </>
          ) : null}
        </p>

        {client.bookingCount > 0 ? (
          <Field
            id="deleteConfirm"
            label={`Ketik ${expected} untuk konfirmasi`}
            className="mt-3"
            error={errors.confirm}
          >
            <input
              id="deleteConfirm"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              inputMode="numeric"
              className={inputClass(Boolean(errors.confirm))}
            />
          </Field>
        ) : null}

        {errors.form ? (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-meta text-rose-700">{errors.form}</p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={busy || (client.bookingCount > 0 && confirmText.trim() !== expected)}
            className="bg-rose-600 hover:bg-rose-700 focus-visible:outline-rose-600"
          >
            {busy ? 'Menghapus…' : 'Hapus permanen'}
          </Button>
        </div>
      </div>
    </div>
  )
}
