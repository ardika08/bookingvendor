import { useCallback, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import {
  PackageCard,
  PackageEditorDialog,
  PackageEmptyState,
  PackageErrorState,
  PackageFiltersBar,
  PackageGrid,
  PackageListHeader,
} from '@/components/packages/PackageList'
import { usePackageList } from '@/hooks/usePackageList'
import {
  createPackage,
  deletePackage,
  updatePackage,
} from '@/lib/api/vendor-packages'
import { useToast } from '@/components/ui/Toast'
import {
  toPackagePayload,
  type PackagePayload,
  type VendorPackageDetail,
} from '@/lib/vendor-packages'

/**
 * Halaman katalog paket layanan vendor (`/packages`).
 *
 * Paket adalah sumber harga yang dipakai ulang saat membuat booking, jadi
 * perubahan di sini langsung memengaruhi pilihan di form booking berikutnya.
 *
 * Perilaku penting:
 * - Paket yang sudah dipakai booking tidak dihapus, hanya dinonaktifkan, supaya
 *   riwayat booking & invoice tetap mengacu ke harga yang benar.
 * - Simpan / hapus memperbarui state lokal tanpa fetch ulang seluruh daftar.
 */
export function PackagesPage() {
  const {
    packages,
    loading,
    initialLoading,
    error,
    filters,
    setFilters,
    replacePackage,
    removePackage,
    appendPackage,
    hasFilter,
    reload,
  } = usePackageList()
  const { notify } = useToast()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<VendorPackageDetail | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const openCreate = useCallback(() => {
    setEditing(null)
    setEditorOpen(true)
  }, [])

  const openEdit = useCallback((pkg: VendorPackageDetail) => {
    setEditing(pkg)
    setEditorOpen(true)
  }, [])

  const handleSave = useCallback(
    async (payload: PackagePayload, id?: string) => {
      if (id) {
        const updated = await updatePackage(id, payload)
        replacePackage(updated)
        notify(`Paket "${updated.name}" diperbarui.`, { tone: 'success' })
        return
      }
      const created = await createPackage(payload)
      appendPackage(created)
      notify(`Paket "${created.name}" ditambahkan.`, { tone: 'success' })
    },
    [appendPackage, notify, replacePackage],
  )

  const handleToggleActive = useCallback(
    async (pkg: VendorPackageDetail) => {
      setBusyId(pkg.id)
      try {
        const updated = await updatePackage(pkg.id, {
          ...toPackagePayload({
            name: pkg.name,
            price: String(pkg.price),
            durationHours: pkg.durationHours ? String(pkg.durationHours) : '',
            description: pkg.description ?? '',
            active: !pkg.active,
          }),
        })
        replacePackage(updated)
        notify(
          updated.active ? `Paket "${updated.name}" diaktifkan.` : `Paket "${updated.name}" dinonaktifkan.`,
          { tone: 'success' },
        )
      } catch {
        notify('Gagal mengubah status paket. Coba lagi.', { tone: 'error' })
      } finally {
        setBusyId(null)
      }
    },
    [notify, replacePackage],
  )

  const handleDelete = useCallback(
    async (pkg: VendorPackageDetail) => {
      setBusyId(pkg.id)
      try {
        await deletePackage(pkg.id)
        removePackage(pkg.id)
        notify(`Paket "${pkg.name}" dihapus.`, { tone: 'success' })
      } catch {
        notify('Gagal menghapus paket. Coba lagi.', { tone: 'error' })
      } finally {
        setBusyId(null)
      }
    },
    [notify, removePackage],
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-title tracking-tight text-ink-900">Paket Layanan</h1>
        <p className="mt-0.5 text-body text-ink-500">
          Tetapkan paket &amp; harga sekali, lalu pilih saat membuat booking.
        </p>
      </div>

      <Card className="overflow-hidden">
        <PackageListHeader onCreate={openCreate} />
        <div className="border-t border-ink-100">
          <PackageFiltersBar filters={filters} onChange={setFilters} resultCount={packages.length} />
        </div>

        <div className="border-t border-ink-100">
          {initialLoading ? (
            <TableSkeleton rows={3} columns={4} />
          ) : error ? (
            <PackageErrorState error={error} onRetry={reload} />
          ) : packages.length === 0 ? (
            <PackageEmptyState
              hasFilter={hasFilter}
              onCreate={openCreate}
              onReset={() => setFilters({ active: 'all', search: '' })}
            />
          ) : (
            <PackageGrid>
              {packages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  busy={busyId === pkg.id || loading}
                  onEdit={() => openEdit(pkg)}
                  onToggleActive={() => void handleToggleActive(pkg)}
                  onDelete={() => void handleDelete(pkg)}
                />
              ))}
            </PackageGrid>
          )}
        </div>
      </Card>

      <PackageEditorDialog
        key={editing?.id ?? 'new'}
        open={editorOpen}
        editing={editing}
        onClose={() => setEditorOpen(false)}
        onSubmit={handleSave}
      />
    </div>
  )
}
