import { Plus, Search, Users, X, Pencil, Trash2, AlertTriangle } from '@/components/ui/icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import {
  EMPTY_ADMIN_VENDOR_FILTERS,
  fetchAdminVendors,
  setAdminVendorActive,
  type AdminSubscriptionStatus,
  type AdminVendorFilters,
  type AdminVendorSummary,
} from '@/lib/api/admin-vendors'
import { formatShortDate } from '@/lib/format'
import { useRestoreFocus } from '@/lib/use-restore-focus'
import { cn } from '@/lib/cn'

/**
 * Daftar vendor untuk admin (`/admin/vendors`).
 *
 * Admin mengelola akun, bukan operasional: kartu menampilkan identitas usaha,
 * akun pemilik, status langganan, dan status akun.
 *
 * Tombol aksi per vendor:
 * - **Edit** → membuka form edit vendor.
 * - **Hapus** → menonaktifkan akun, bukan menghapus baris database. Vendor
 *   tidak bisa masuk lagi, tetapi booking, klien, dan invoice miliknya tetap
 *   utuh dan bisa diaktifkan kembali. Ini disengaja: menghapus permanen akan
 *   ikut menghapus seluruh data klien lewat cascade, dan itu tidak bisa
 *   dibatalkan.
 *
 * Data diambil dari API nyata (`/api/admin/vendors`), bukan data contoh.
 */

const SUBSCRIPTION_META: Record<
  AdminSubscriptionStatus,
  { label: string; badgeClass: string }
> = {
  trial: { label: 'Trial', badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200' },
  active: { label: 'Aktif', badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  grace: { label: 'Tenggang', badgeClass: 'bg-sky-50 text-sky-700 ring-sky-200' },
  expired: { label: 'Berakhir', badgeClass: 'bg-rose-50 text-rose-700 ring-rose-200' },
}

export function ManageVendorsPage() {
  const { notify } = useToast()
  const [vendors, setVendors] = useState<AdminVendorSummary[]>([])
  const [filters, setFilters] = useState<AdminVendorFilters>(EMPTY_ADMIN_VENDOR_FILTERS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<AdminVendorSummary | null>(null)
  /** Fokus kembali ke tombol Nonaktifkan pada kartu vendor yang bersangkutan. */
  const captureFocus = useRestoreFocus(confirmTarget !== null)

  /*
   * Filter dikerjakan server. Pencarian ditahan ~300ms supaya tidak
   * menembak request pada setiap ketukan tombol.
   */
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300)
    return () => clearTimeout(timer)
  }, [filters.search])

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true)
      return fetchAdminVendors(
        {
          search: debouncedSearch,
          subscription: filters.subscription,
          account: filters.account,
        },
        signal,
      )
        .then((result) => {
          setVendors(result)
          setError(null)
        })
        .catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === 'AbortError') return
          setError(cause instanceof Error ? cause : new Error('Gagal memuat daftar vendor.'))
        })
        .finally(() => setLoading(false))
    },
    [debouncedSearch, filters.subscription, filters.account],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  async function confirmDeactivate() {
    const target = confirmTarget
    if (!target) return

    setPendingId(target.id)
    try {
      const updated = await setAdminVendorActive(target.id, false)
      setVendors((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      notify(
        `"${target.name}" dinonaktifkan — vendor tidak bisa masuk, data tetap utuh.`,
        { tone: 'success' },
      )
      setConfirmTarget(null)
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal menonaktifkan vendor.', {
        tone: 'error',
      })
    } finally {
      setPendingId(null)
    }
  }

  async function reactivate(vendor: AdminVendorSummary) {
    setPendingId(vendor.id)
    try {
      const updated = await setAdminVendorActive(vendor.id, true)
      setVendors((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      notify(`"${vendor.name}" diaktifkan kembali.`, { tone: 'success' })
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal mengaktifkan vendor.', {
        tone: 'error',
      })
    } finally {
      setPendingId(null)
    }
  }

  const hasFilter =
    filters.search !== '' || filters.subscription !== 'all' || filters.account !== 'all'

  const activeCount = vendors.filter((vendor) => vendor.isActive).length
  const activeSubscription = vendors.filter(
    (vendor) => vendor.subscription.status === 'active',
  ).length
  const trialCount = vendors.filter((vendor) => vendor.subscription.status === 'trial').length

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-title tracking-tight text-ink-900">Kelola Vendor</h1>
          <p className="mt-0.5 text-body text-ink-500">
            Tambah, edit, aktif/nonaktifkan, dan pantau langganan vendor.
          </p>
        </div>
        <ButtonLink to="/admin/vendors/new" className="shrink-0">
          <Plus className="size-4" />
          Tambah Vendor
        </ButtonLink>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Total vendor" value={vendors.length} />
        <StatTile label="Akun aktif" value={activeCount} tone="emerald" />
        <StatTile label="Langganan aktif" value={activeSubscription} tone="emerald" />
        <StatTile label="Masa trial" value={trialCount} tone="amber" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 px-4 py-3 sm:px-5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="Cari nama usaha, pemilik, email, atau kota…"
              aria-label="Cari vendor"
              className="h-10 w-full rounded-lg border border-ink-200 bg-white pl-9 pr-9 text-body text-ink-800 placeholder:text-ink-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            {filters.search ? (
              <button
                type="button"
                onClick={() => setFilters({ ...filters, search: '' })}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
                aria-label="Hapus kata kunci"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filters.subscription}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  subscription: event.target.value as AdminVendorFilters['subscription'],
                })
              }
              aria-label="Filter langganan"
              className="h-10 rounded-lg border border-ink-200 bg-white px-3 text-body text-ink-700 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <option value="all">Semua langganan</option>
              <option value="trial">Trial</option>
              <option value="active">Aktif</option>
              <option value="grace">Tenggang</option>
              <option value="expired">Berakhir</option>
            </select>

            <select
              value={filters.account}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  account: event.target.value as AdminVendorFilters['account'],
                })
              }
              aria-label="Filter status akun"
              className="h-10 rounded-lg border border-ink-200 bg-white px-3 text-body text-ink-700 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <option value="all">Semua akun</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>

            {hasFilter ? (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_ADMIN_VENDOR_FILTERS)}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-body font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-800"
              >
                <X className="size-3.5" /> Reset
              </button>
            ) : null}
          </div>

          <p className="text-meta text-ink-500 lg:ml-1 lg:shrink-0">
            {loading ? 'Memuat…' : `${vendors.length} vendor`}
          </p>
        </div>

        <div className="border-t border-ink-100">
          {error ? (
            <div className="px-5 py-12 text-center">
              <p className="text-meta font-medium text-ink-700">Gagal memuat vendor</p>
              <p className="mx-auto mt-1 max-w-sm text-caption text-ink-500">{error.message}</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => load()}>
                Coba lagi
              </Button>
            </div>
          ) : loading && vendors.length === 0 ? (
            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-xl bg-ink-50" aria-hidden />
              ))}
            </div>
          ) : vendors.length === 0 ? (
            hasFilter ? (
              <EmptyState
                icon={<Search className="size-5" />}
                title="Tidak ada vendor yang cocok"
                description="Coba ubah kata kunci atau filter status."
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setFilters(EMPTY_ADMIN_VENDOR_FILTERS)}
                  >
                    Reset filter
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Users className="size-5" />}
                title="Belum ada vendor"
                description="Undang vendor pertama — mereka langsung dapat masa uji 30 hari dengan semua fitur terbuka."
                action={
                  <ButtonLink to="/admin/vendors/new" size="sm">
                    <Plus className="size-3.5" />
                    Tambah vendor pertama
                  </ButtonLink>
                }
              />
            )
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
              {vendors.map((vendor) => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  busy={pendingId === vendor.id}
                  onRequestDeactivate={captureFocus(() => setConfirmTarget(vendor))}
                  onReactivate={() => reactivate(vendor)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      {confirmTarget ? (
        <DeactivateDialog
          vendor={confirmTarget}
          busy={pendingId === confirmTarget.id}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={confirmDeactivate}
        />
      ) : null}
    </div>
  )
}

function VendorCard({
  vendor,
  busy,
  onRequestDeactivate,
  onReactivate,
}: {
  vendor: AdminVendorSummary
  busy: boolean
  onRequestDeactivate: () => void
  onReactivate: () => void
}) {
  const subscription = SUBSCRIPTION_META[vendor.subscription.status]

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border bg-white p-4',
        vendor.isActive ? 'border-ink-200/80' : 'border-dashed border-ink-300 bg-ink-50/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/admin/vendors/${vendor.id}`}
            className="block truncate text-lead font-semibold text-ink-900 hover:text-brand-700"
          >
            {vendor.name}
          </Link>
          <p className="mt-0.5 truncate text-meta text-ink-500">
            {[vendor.category, vendor.city].filter(Boolean).join(' • ') || 'Kategori belum diisi'}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-caption font-medium ring-1 ring-inset',
            subscription.badgeClass,
          )}
        >
          {subscription.label}
        </span>
      </div>

      <div className="mt-2 min-w-0 text-meta text-ink-600">
        <p className="truncate">{vendor.ownerName}</p>
        <p className="truncate text-ink-500">{vendor.email}</p>
      </div>

      <p className="mt-2 text-caption text-ink-400">
        {vendor.bookingsCount} booking · {vendor.invoicesCount} invoice
        {vendor.createdAt ? ` · bergabung ${formatShortDate(vendor.createdAt)}` : ''}
      </p>

      <div className="mt-2 flex items-center gap-1.5">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium',
            vendor.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500',
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              vendor.isActive ? 'bg-emerald-500' : 'bg-ink-400',
            )}
            aria-hidden
          />
          Akun {vendor.isActive ? 'aktif' : 'nonaktif'}
        </span>
      </div>

      <div className="mt-auto flex items-center justify-end gap-1 pt-3">
        {vendor.isActive ? (
          <>
            <ButtonLink
              to={`/admin/vendors/${vendor.id}/edit`}
              size="sm"
              variant="secondary"
              aria-label={`Edit ${vendor.name}`}
            >
              <Pencil className="size-3.5" />
              Edit
            </ButtonLink>
            <Button
              size="sm"
              variant="danger"
              onClick={onRequestDeactivate}
              disabled={busy}
              aria-label={`Hapus ${vendor.name}`}
            >
              <Trash2 className="size-3.5" />
              Hapus
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={onReactivate}
            disabled={busy}
            aria-label={`Aktifkan ${vendor.name}`}
          >
            {busy ? 'Menyimpan…' : 'Aktifkan'}
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Dialog konfirmasi nonaktifkan vendor.
 *
 * Sengaja menjelaskan bahwa data TIDAK dihapus, supaya admin tidak ragu dan
 * tidak mengira ini tindakan permanen.
 */
function DeactivateDialog({
  vendor,
  busy,
  onCancel,
  onConfirm,
}: {
  vendor: AdminVendorSummary
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'

    // Fokus ke tombol batal agar Enter tidak langsung menghapus.
    dialogRef.current?.querySelector<HTMLButtonElement>('[data-autofocus]')?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [busy, onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Tutup"
        onClick={busy ? undefined : onCancel}
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deactivate-dialog-title"
        aria-describedby="deactivate-dialog-desc"
        className="relative w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start gap-2 border-b border-ink-100 px-5 py-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertTriangle className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="deactivate-dialog-title" className="text-lead font-semibold text-ink-900">
              Nonaktifkan vendor?
            </h2>
            <p id="deactivate-dialog-desc" className="text-meta text-ink-500">
              {vendor.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-50"
            aria-label="Tutup dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-2 px-5 py-4 text-body text-ink-600">
          <p>
            Vendor ini tidak bisa masuk lagi, dan halaman publiknya tidak menampilkan jadwal.
          </p>
          <p className="rounded-lg bg-ink-50 px-3 py-2 text-meta text-ink-600">
            <strong className="font-medium text-ink-800">Data tetap aman.</strong>{' '}
            {vendor.bookingsCount} booking dan {vendor.invoicesCount} invoice tidak dihapus, dan
            vendor bisa diaktifkan kembali kapan saja.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-3">
          <Button variant="ghost" onClick={onCancel} disabled={busy} data-autofocus>
            Batal
          </Button>
          <Button
            onClick={onConfirm}
            disabled={busy}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {busy ? 'Menonaktifkan…' : 'Ya, nonaktifkan'}
          </Button>
        </div>
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
  tone = 'neutral',
}: {
  label: string
  value: number
  tone?: keyof typeof TONE_CLASS
}) {
  return (
    <div className="rounded-xl border border-ink-200/80 bg-white px-3.5 py-3">
      <p className="text-caption font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={cn('mt-1 text-lead font-semibold tabular-nums', TONE_CLASS[tone])}>{value}</p>
    </div>
  )
}
