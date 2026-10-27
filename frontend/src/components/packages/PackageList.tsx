import { Package, Plus, RefreshCw, Search, X } from '@/components/ui/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CardHeader } from '@/components/ui/Card'
import { Field, inputClass } from '@/components/ui/Field'
import { ApiError } from '@/lib/api/client'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'
import {
  EMPTY_PACKAGE_FORM,
  EMPTY_PACKAGE_FILTERS,
  formatThousands,
  mapPackageServerErrors,
  packageToFormValues,
  parseThousands,
  toPackagePayload,
  validatePackageForm,
  type PackageFilters,
  type PackageFormErrors,
  type PackageFormValues,
  type PackagePayload,
  type VendorPackageDetail,
} from '@/lib/vendor-packages'

/**
 * Kartu katalog paket layanan.
 *
 * Menampilkan paket sebagai kartu (bukan tabel) karena vendor membandingkan
 * paket berdasarkan nama + harga + isi, bukan baris data panjang. Paket yang
 * sudah dipakai booking tidak bisa dihapus (hanya dinonaktifkan) supaya riwayat
 * booking & invoice tetap utuh.
 */
export function PackageCard({
  pkg,
  onEdit,
  onToggleActive,
  onDelete,
  busy,
}: {
  pkg: VendorPackageDetail
  onEdit: () => void
  onToggleActive: () => void
  onDelete: () => void
  busy?: boolean
}) {
  const used = pkg.usageCount > 0

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border bg-white p-4',
        pkg.active ? 'border-ink-200/80' : 'border-dashed border-ink-300 bg-ink-50/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-lead font-semibold text-ink-900">{pkg.name}</h3>
          <p className="mt-0.5 text-meta text-ink-500">
            {pkg.durationHours ? `${pkg.durationHours} jam` : 'Durasi tidak disebutkan'}
          </p>
        </div>
        {pkg.active ? null : (
          <Badge className="shrink-0 bg-ink-100 text-ink-500">Nonaktif</Badge>
        )}
      </div>

      <p className="mt-2 text-lead font-semibold tabular-nums text-ink-900">
        {formatCurrency(pkg.price)}
      </p>

      {pkg.description ? (
        <p className="mt-1.5 line-clamp-3 text-meta leading-relaxed text-ink-500">
          {pkg.description}
        </p>
      ) : (
        <p className="mt-1.5 text-meta italic text-ink-400">Belum ada deskripsi.</p>
      )}

      <div className="mt-auto pt-3">
        <p className="mb-2 text-caption text-ink-400">
          {used ? `Dipakai ${pkg.usageCount} booking` : 'Belum pernah dipakai'}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="secondary" onClick={onEdit} disabled={busy}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={onToggleActive} disabled={busy}>
            {pkg.active ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>
          {used ? (
            <span className="ml-auto text-caption text-ink-400" title="Paket sudah dipakai booking">
              Arsipkan saja
            </span>
          ) : (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="ml-auto rounded px-1.5 py-1 text-caption font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              Hapus
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Bar filter daftar paket: status aktif + pencarian nama. */
export function PackageFiltersBar({
  filters,
  onChange,
  resultCount,
}: {
  filters: PackageFilters
  onChange: (next: PackageFilters) => void
  resultCount: number
}) {
  const hasFilter = filters.active !== 'all' || filters.search.trim() !== ''

  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:px-5 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Cari nama paket…"
          aria-label="Cari paket"
          className="h-10 w-full rounded-lg border border-ink-200 bg-white pl-9 pr-9 text-body text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
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

      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            { value: 'all', label: 'Semua' },
            { value: 'active', label: 'Aktif' },
            { value: 'inactive', label: 'Nonaktif' },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange({ ...filters, active: option.value })}
            aria-pressed={filters.active === option.value}
            className={
              filters.active === option.value
                ? 'rounded-full bg-ink-900 px-2.5 py-1 text-meta font-medium text-white'
                : 'rounded-full px-2.5 py-1 text-meta font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-800'
            }
          >
            {option.label}
          </button>
        ))}
        {hasFilter ? (
          <button
            type="button"
            onClick={() => onChange(EMPTY_PACKAGE_FILTERS)}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-meta font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-800"
          >
            <X className="size-3" /> Reset
          </button>
        ) : null}
      </div>

      <p className="text-meta text-ink-500 lg:ml-1 lg:shrink-0">{resultCount} paket</p>
    </div>
  )
}

/**
 * Form tambah/edit paket di dalam dialog ringan.
 *
 * Memakai pola yang sama dengan form lain: validasi lokal, pemetaan error 422
 * server, dan isian dipertahankan saat simpan gagal.
 */
export function PackageEditorDialog({
  open,
  editing,
  onClose,
  onSubmit,
}: {
  open: boolean
  /** null = mode tambah. */
  editing: VendorPackageDetail | null
  onClose: () => void
  onSubmit: (payload: PackagePayload, id?: string) => Promise<void>
}) {
  const initial = useMemo<PackageFormValues>(
    () => (editing ? packageToFormValues(editing) : EMPTY_PACKAGE_FORM),
    [editing],
  )
  const [values, setValues] = useState<PackageFormValues>(initial)
  const [errors, setErrors] = useState<PackageFormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<ApiError | Error | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  function update<K extends keyof PackageFormValues>(key: K, value: PackageFormValues[K]) {
    const next = { ...values, [key]: value }
    setValues(next)
    if (submitted) setErrors(validatePackageForm(next))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    setSubmitError(null)

    const nextErrors = validatePackageForm(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      const first = Object.keys(nextErrors)[0]
      formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus()
      return
    }

    setSaving(true)
    try {
      await onSubmit(toPackagePayload(values), editing?.id)
      onClose()
    } catch (error) {
      if (error instanceof ApiError) {
        if (Object.keys(error.fieldErrors).length > 0) {
          setErrors((prev) => ({ ...prev, ...mapPackageServerErrors(error.fieldErrors) }))
        }
        setSubmitError(error)
      } else {
        setSubmitError(error instanceof Error ? error : new Error('Gagal menyimpan paket.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const price = parseThousands(values.price)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="package-dialog-title"
        className="relative w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start gap-2 border-b border-ink-100 px-5 py-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <Package className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="package-dialog-title" className="text-lead font-semibold text-ink-900">
              {editing ? 'Edit paket' : 'Paket baru'}
            </h2>
            <p className="text-meta text-ink-500">
              Paket dipakai ulang saat membuat booking.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            aria-label="Tutup dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <div className="space-y-3 px-5 py-4">
            <Field id="packageName" label="Nama paket" required error={errors.name}>
              <input
                id="packageName"
                data-field="name"
                value={values.name}
                onChange={(event) => update('name', event.target.value)}
                placeholder="Paket Gold — Full Day"
                className={inputClass(Boolean(errors.name))}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="packagePrice" label="Harga" required error={errors.price}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-ink-400">
                    Rp
                  </span>
                  <input
                    id="packagePrice"
                    data-field="price"
                    value={values.price}
                    onChange={(event) => update('price', formatThousands(parseThousands(event.target.value)))}
                    inputMode="numeric"
                    placeholder="15.000.000"
                    className={cn(inputClass(Boolean(errors.price)), 'pl-9 tabular-nums')}
                  />
                </div>
              </Field>

              <Field
                id="packageDuration"
                label="Durasi (jam)"
                error={errors.durationHours}
                hint="Opsional, 1–48 jam."
              >
                <input
                  id="packageDuration"
                  data-field="durationHours"
                  value={values.durationHours}
                  onChange={(event) => update('durationHours', event.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric"
                  placeholder="8"
                  className={inputClass(Boolean(errors.durationHours))}
                />
              </Field>
            </div>

            <Field
              id="packageDescription"
              label="Isi paket"
              error={errors.description}
              hint="Apa saja yang didapat klien."
            >
              <textarea
                id="packageDescription"
                data-field="description"
                value={values.description}
                onChange={(event) => update('description', event.target.value)}
                rows={3}
                placeholder="2 fotografer, liputan 10 jam, album 20 halaman."
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-body leading-relaxed text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </Field>

            <label className="flex items-start gap-2.5 rounded-lg border border-ink-200 px-3 py-2.5">
              <input
                type="checkbox"
                checked={values.active}
                onChange={(event) => update('active', event.target.checked)}
                className="mt-0.5 size-4 accent-brand-600"
              />
              <span className="text-meta">
                <span className="block font-medium text-ink-800">Paket aktif</span>
                <span className="block text-caption text-ink-500">
                  Paket nonaktif tidak muncul di pilihan form booking.
                </span>
              </span>
            </label>

            {price > 0 ? (
              <p className="text-caption text-ink-500">
                Harga tampil: <span className="font-medium text-ink-800">{formatCurrency(price)}</span>
              </p>
            ) : null}
          </div>

          {submitError ? (
            <p className="mx-5 mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-meta text-rose-800">
              {submitError.message}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-ink-100 px-5 py-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Tambah paket'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** Layar error daftar paket (401 vs gangguan jaringan). */
export function PackageErrorState({
  error,
  onRetry,
}: {
  error: ApiError | Error
  onRetry: () => void
}) {
  const unauthorized = error instanceof ApiError && error.isUnauthorized
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="text-lead font-semibold text-ink-800">
        {unauthorized ? 'Sesi kamu berakhir' : 'Gagal memuat paket'}
      </p>
      <p className="mt-1 max-w-sm text-body leading-relaxed text-ink-500">
        {unauthorized
          ? 'Masuk kembali dengan akun Google untuk melanjutkan.'
          : error.message || 'Periksa koneksi internet lalu coba lagi.'}
      </p>
      {!unauthorized ? (
        <Button size="sm" variant="secondary" className="mt-4" onClick={onRetry}>
          <RefreshCw className="size-3.5" /> Coba lagi
        </Button>
      ) : null}
    </div>
  )
}

/** Kepala kartu daftar paket dengan tombol tambah. */
export function PackageListHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <CardHeader
      title="Katalog paket"
      description="Paket & harga yang bisa dipilih saat membuat booking."
      action={
        <Button size="sm" onClick={onCreate}>
          <Plus className="size-3.5" />
          Paket baru
        </Button>
      }
    />
  )
}

/** Bungkus kartu daftar kosong (belum ada paket vs filter tidak cocok). */
export function PackageEmptyState({
  hasFilter,
  onCreate,
  onReset,
}: {
  hasFilter: boolean
  onCreate: () => void
  onReset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-ink-100 text-ink-500">
        <Package className="size-5" />
      </div>
      <p className="text-lead font-semibold text-ink-800">
        {hasFilter ? 'Tidak ada paket yang cocok' : 'Belum ada paket layanan'}
      </p>
      <p className="mt-1 max-w-sm text-body leading-relaxed text-ink-500">
        {hasFilter
          ? 'Coba ubah kata kunci atau filter status.'
          : 'Tambahkan paket supaya saat membuat booking kamu cukup memilih harga, tanpa mengetik ulang.'}
      </p>
      <div className="mt-4">
        {hasFilter ? (
          <Button size="sm" variant="secondary" onClick={onReset}>
            Reset filter
          </Button>
        ) : (
          <Button size="sm" onClick={onCreate}>
            <Plus className="size-3.5" />
            Tambah paket pertama
          </Button>
        )}
      </div>
    </div>
  )
}

/** Kontainer kartu — kartu `Card` dipakai agar konsisten dengan halaman lain. */
export function PackageGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">{children}</div>
}

/** Ekspor ulang untuk kenyamanan impor di halaman route. */
export type { VendorPackageDetail, PackagePayload }
