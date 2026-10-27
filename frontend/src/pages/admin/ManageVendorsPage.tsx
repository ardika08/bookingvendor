import { Plus, Search, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { setMockAdminVendorActive, listMockAdminVendors } from '@/lib/mock/admin'
import {
  EMPTY_ADMIN_VENDOR_FILTERS,
  filterAdminVendors,
  hasActiveAdminVendorFilters,
  summarizeAdminVendors,
  type AdminSubscriptionStatus,
  type AdminVendorFilters,
  type AdminVendorSummary,
} from '@/lib/admin-vendors'
import { formatShortDate } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Daftar vendor untuk admin (`/admin/vendors`).
 *
 * Admin mengelola akun, bukan operasional: kartu menampilkan identitas usaha,
 * akun pemilik, status langganan, dan status akun. Nonaktif/aktifkan di sini
 * hanya menyentuh akses vendor — data booking & invoice tidak tersentuh.
 *
 * Fase frontend: data contoh dari `lib/mock/admin`; begitu API admin tersedia,
 * ganti sumber datanya tanpa mengubah struktur halaman.
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
  const [vendors, setVendors] = useState<AdminVendorSummary[]>(() => listMockAdminVendors())
  const [filters, setFilters] = useState<AdminVendorFilters>(EMPTY_ADMIN_VENDOR_FILTERS)

  const filtered = useMemo(() => filterAdminVendors(vendors, filters), [vendors, filters])
  const summary = useMemo(() => summarizeAdminVendors(vendors), [vendors])
  const hasFilter = hasActiveAdminVendorFilters(filters)

  function toggleActive(vendor: AdminVendorSummary) {
    const next = !vendor.isActive
    setMockAdminVendorActive(vendor.id, next)
    setVendors((prev) =>
      prev.map((item) => (item.id === vendor.id ? { ...item, isActive: next } : item)),
    )
    notify(
      next
        ? `"${vendor.name}" diaktifkan kembali.`
        : `"${vendor.name}" dinonaktifkan — vendor tidak bisa masuk sementara data tetap utuh.`,
      { tone: 'success' },
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-title tracking-tight text-ink-900">Kelola Vendor</h1>
          <p className="mt-0.5 text-body text-ink-500">
            Tambah, aktif/nonaktifkan, dan pantau langganan vendor.
          </p>
        </div>
        <ButtonLink to="/admin/vendors/new" className="shrink-0">
          <Plus className="size-4" />
          Tambah Vendor
        </ButtonLink>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Total vendor" value={summary.total} />
        <StatTile label="Akun aktif" value={summary.active} tone="emerald" />
        <StatTile label="Langganan aktif" value={summary.activeSubscription} tone="emerald" />
        <StatTile label="Masa trial" value={summary.trial} tone="amber" />
      </div>

      <Card className="overflow-hidden">
        {/* Bar filter: pencarian + status langganan + status akun. */}
        <div className="flex flex-col gap-3 px-4 py-3 sm:px-5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="Cari nama usaha, pemilik, email, atau kota…"
              aria-label="Cari vendor"
              className="h-10 w-full rounded-lg border border-ink-200 bg-white pl-9 pr-9 text-body text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
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
              className="h-10 rounded-lg border border-ink-200 bg-white px-3 text-body text-ink-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
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
              className="h-10 rounded-lg border border-ink-200 bg-white px-3 text-body text-ink-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
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

          <p className="text-meta text-ink-500 lg:ml-1 lg:shrink-0">{filtered.length} vendor</p>
        </div>

        <div className="border-t border-ink-100">
          {filtered.length === 0 ? (
            vendors.length === 0 ? (
              <EmptyState
                icon={<Users className="size-5" />}
                title="Belum ada vendor"
                description="Undang vendor pertama — mereka langsung dapat masa trial 2 booking + 2 invoice."
                action={
                  <ButtonLink to="/admin/vendors/new" size="sm">
                    <Plus className="size-3.5" />
                    Tambah vendor pertama
                  </ButtonLink>
                }
              />
            ) : (
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
            )
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
              {filtered.map((vendor) => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  onToggleActive={() => toggleActive(vendor)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function VendorCard({
  vendor,
  onToggleActive,
}: {
  vendor: AdminVendorSummary
  onToggleActive: () => void
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
        {vendor.bookingsCount} booking · {vendor.invoicesCount} invoice · bergabung{' '}
        {formatShortDate(vendor.createdAt)}
      </p>

      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <Badge className={vendor.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500'}>
          {vendor.isActive ? 'Aktif' : 'Nonaktif'}
        </Badge>
        <Button size="sm" variant="ghost" onClick={onToggleActive}>
          {vendor.isActive ? 'Nonaktifkan' : 'Aktifkan'}
        </Button>
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
