import { CreditCard, Plus, X, Pencil, Trash2, AlertTriangle, Info } from '@/components/ui/icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PlanCard } from '@/components/subscription/PlanCard'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field, inputClass } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import {
  createAdminPlan,
  deleteAdminPlan,
  fetchAdminPlans,
  updateAdminPlan,
  type AdminPlan,
} from '@/lib/api/admin-plans'
import { formatCurrency } from '@/lib/format'
import { formatThousands } from '@/lib/vendor-packages'
import { cn } from '@/lib/cn'

/**
 * Katalog paket langganan (`/admin/plans`).
 *
 * Admin bisa menambah, mengedit (termasuk nama), dan menghapus paket.
 *
 * Istilah harga mengikuti pemilik produk:
 * - **Harga normal** = harga sebelum diskon, ditampilkan DICORET.
 * - **Harga coret**  = harga promo yang benar-benar DIBAYAR vendor.
 *
 * Karena itu kolom `price` di database (yang dipakai logika pembayaran) berisi
 * harga coret, dan `normal_price` hanya referensi visual.
 */
export function PlanConfigPage() {
  const { notify } = useToast()
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [editing, setEditing] = useState<AdminPlan | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<AdminPlan | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true)
    return fetchAdminPlans(signal)
      .then((result) => {
        setPlans(result)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof Error ? cause : new Error('Gagal memuat paket.'))
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  function handleSaved(plan: AdminPlan, isNew: boolean) {
    setPlans((prev) =>
      isNew
        ? [...prev, plan].sort((a, b) => a.durationMonths - b.durationMonths)
        : prev.map((item) => (item.id === plan.id ? plan : item)),
    )
    notify(
      isNew ? `Paket "${plan.name}" ditambahkan.` : `Paket "${plan.name}" diperbarui.`,
      { tone: 'success' },
    )
    setEditing(null)
    setCreating(false)
  }

  async function handleDelete() {
    if (!confirmDelete) return

    setDeleting(true)
    try {
      await deleteAdminPlan(confirmDelete.id)
      setPlans((prev) => prev.filter((item) => item.id !== confirmDelete.id))
      notify(`Paket "${confirmDelete.name}" dihapus.`, { tone: 'success' })
      setConfirmDelete(null)
    } catch (cause) {
      /*
       * Paket yang sudah dipakai vendor tidak boleh dihapus — backend
       * mengembalikan 409 dengan pesan penjelasan. Pesan itu diteruskan apa
       * adanya supaya admin tahu harus menonaktifkan, bukan menghapus.
       */
      notify(cause instanceof Error ? cause.message : 'Gagal menghapus paket.', {
        tone: 'error',
      })
      setConfirmDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-title tracking-tight text-ink-900">Paket Langganan</h1>
          <p className="mt-0.5 text-body text-ink-500">
            Katalog paket untuk vendor. Harga normal tampil dicoret, harga coret yang dibayar.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="shrink-0">
          <Plus className="size-4" />
          Tambah Paket
        </Button>
      </div>

      {error ? (
        <Card>
          <div className="px-5 py-12 text-center">
            <p className="text-meta font-medium text-ink-700">Gagal memuat paket</p>
            <p className="mx-auto mt-1 max-w-sm text-caption text-ink-500">{error.message}</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => load()}>
              Coba lagi
            </Button>
          </div>
        </Card>
      ) : loading && plans.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-white" aria-hidden />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CreditCard className="size-5" />}
            title="Belum ada paket"
            description="Tambahkan paket pertama untuk mulai berjualan langganan."
            action={
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-3.5" />
                Tambah paket pertama
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={{
                ...plan,
                // Paket 12 bulan disorot sebagai pilihan paling hemat.
                highlight: plan.durationMonths >= 12,
              }}
              inactive={!plan.isActive}
              action={
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setEditing(plan)}
                    aria-label={`Edit ${plan.name}`}
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    className="flex-1"
                    onClick={() => setConfirmDelete(plan)}
                    aria-label={`Hapus ${plan.name}`}
                  >
                    <Trash2 className="size-3.5" />
                    Hapus
                  </Button>
                </div>
              }
            />
          ))}
        </div>
      )}

      {creating || editing ? (
        <PlanDialog
          plan={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={handleSaved}
        />
      ) : null}

      {confirmDelete ? (
        <DeleteDialog
          plan={confirmDelete}
          busy={deleting}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
      ) : null}
    </div>
  )
}

interface PlanFormValues {
  name: string
  durationMonths: string
  normalPrice: string
  price: string
  description: string
}

type PlanFormErrors = Partial<Record<keyof PlanFormValues, string>>

/**
 * Dialog tambah/edit paket.
 *
 * Field sesuai permintaan: nama paket, masa aktif, harga normal, harga coret,
 * deskripsi singkat — ditambah pratinjau harga supaya admin melihat persis
 * seperti apa katalog akan menampilkannya.
 */
function PlanDialog({
  plan,
  onClose,
  onSaved,
}: {
  plan: AdminPlan | null
  onClose: () => void
  onSaved: (plan: AdminPlan, isNew: boolean) => void
}) {
  const isNew = plan === null
  const dialogRef = useRef<HTMLDivElement>(null)

  const [values, setValues] = useState<PlanFormValues>(() => ({
    name: plan?.name ?? '',
    durationMonths: String(plan?.durationMonths ?? 1),
    normalPrice: plan?.normalPrice !== null && plan?.normalPrice !== undefined
      ? formatThousands(plan.normalPrice)
      : '',
    price: plan?.price !== null && plan?.price !== undefined ? formatThousands(plan.price) : '',
    description: plan?.description ?? '',
  }))
  const [errors, setErrors] = useState<PlanFormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [saving, onClose])

  function update<K extends keyof PlanFormValues>(key: K, value: string) {
    const next = { ...values, [key]: value }
    setValues(next)
    if (submitted) setErrors(validate(next))
  }

  function validate(v: PlanFormValues): PlanFormErrors {
    const next: PlanFormErrors = {}

    if (!v.name.trim()) next.name = 'Nama paket wajib diisi.'
    else if (v.name.trim().length < 2) next.name = 'Nama paket terlalu pendek.'

    const months = Number.parseInt(v.durationMonths, 10)
    if (!v.durationMonths.trim() || Number.isNaN(months)) {
      next.durationMonths = 'Masa aktif wajib diisi.'
    } else if (months < 1) {
      next.durationMonths = 'Masa aktif minimal 1 bulan.'
    } else if (months > 60) {
      next.durationMonths = 'Masa aktif maksimal 60 bulan.'
    }

    const price = digitsOnly(v.price)
    const normal = digitsOnly(v.normalPrice)

    if (normal !== null && price !== null && normal < price) {
      next.normalPrice = 'Harga normal harus lebih besar dari harga coret.'
    }

    return next
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    setSubmitError(null)

    const nextErrors = validate(values)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      const first = Object.keys(nextErrors)[0]
      dialogRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus()
      return
    }

    const payload = {
      name: values.name.trim(),
      duration_months: Number.parseInt(values.durationMonths, 10),
      price: digitsOnly(values.price),
      normal_price: digitsOnly(values.normalPrice),
      description: values.description.trim() || null,
    }

    setSaving(true)
    try {
      const saved = isNew
        ? await createAdminPlan(payload)
        : await updateAdminPlan(plan.id, payload)

      onSaved(saved, isNew)
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'Gagal menyimpan paket.')
    } finally {
      setSaving(false)
    }
  }

  // Pratinjau mengikuti tampilan kartu: harga coret besar, harga normal dicoret.
  const previewPrice = digitsOnly(values.price)
  const previewNormal = digitsOnly(values.normalPrice)
  const previewHasDiscount =
    previewNormal !== null && previewPrice !== null && previewNormal > previewPrice

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Tutup"
        onClick={saving ? undefined : onClose}
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-dialog-title"
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start gap-2 border-b border-ink-100 px-5 py-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <CreditCard className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="plan-dialog-title" className="text-lead font-semibold text-ink-900">
              {isNew ? 'Tambah paket' : `Edit paket — ${plan.name}`}
            </h2>
            <p className="text-meta text-ink-500">
              Harga normal tampil dicoret, harga coret yang dibayar vendor.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-50"
            aria-label="Tutup dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
            <Field id="planName" label="Nama paket" required error={errors.name}>
              <input
                id="planName"
                data-field="name"
                value={values.name}
                onChange={(event) => update('name', event.target.value)}
                placeholder="Contoh: Paket Hemat"
                className={inputClass(Boolean(errors.name))}
              />
            </Field>

            <Field
              id="planDuration"
              label="Masa aktif (bulan)"
              required
              error={errors.durationMonths}
              hint="Menentukan berapa lama langganan berlaku setelah dibayar."
            >
              <input
                id="planDuration"
                data-field="durationMonths"
                value={values.durationMonths}
                onChange={(event) =>
                  update('durationMonths', event.target.value.replace(/[^\d]/g, ''))
                }
                inputMode="numeric"
                placeholder="1"
                className={cn(inputClass(Boolean(errors.durationMonths)), 'tabular-nums')}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                id="planNormalPrice"
                label="Harga normal"
                error={errors.normalPrice}
                hint="Ditampilkan dicoret."
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-ink-400">
                    Rp
                  </span>
                  <input
                    id="planNormalPrice"
                    data-field="normalPrice"
                    value={values.normalPrice}
                    onChange={(event) => update('normalPrice', formatPriceInput(event.target.value))}
                    inputMode="numeric"
                    placeholder="0"
                    className={cn(inputClass(Boolean(errors.normalPrice)), 'pl-9 tabular-nums')}
                  />
                </div>
              </Field>

              <Field
                id="planPrice"
                label="Harga coret"
                error={errors.price}
                hint="Angka yang dibayar."
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-ink-400">
                    Rp
                  </span>
                  <input
                    id="planPrice"
                    data-field="price"
                    value={values.price}
                    onChange={(event) => update('price', formatPriceInput(event.target.value))}
                    inputMode="numeric"
                    placeholder="0"
                    className={cn(inputClass(Boolean(errors.price)), 'pl-9 tabular-nums')}
                  />
                </div>
              </Field>
            </div>

            <Field
              id="planDescription"
              label="Deskripsi singkat"
              error={errors.description}
              hint="Maksimal 200 karakter."
            >
              <textarea
                id="planDescription"
                data-field="description"
                value={values.description}
                onChange={(event) => update('description', event.target.value.slice(0, 200))}
                rows={2}
                placeholder="Contoh: Cocok untuk vendor yang baru mulai."
                className={cn(inputClass(Boolean(errors.description)), 'resize-none')}
              />
            </Field>

            {/* Pratinjau harga — memperlihatkan hasil akhir ke admin. */}
            <div className="rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2.5">
              <p className="text-caption font-medium uppercase tracking-wide text-ink-400">
                Pratinjau harga
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                <span className="text-lead font-semibold tabular-nums text-ink-900">
                  {previewPrice === null ? 'Segera' : formatCurrency(previewPrice)}
                </span>
                {previewHasDiscount ? (
                  <span className="text-meta tabular-nums text-ink-400 line-through">
                    {formatCurrency(previewNormal!)}
                  </span>
                ) : null}
              </div>
              {previewPrice !== null && previewHasDiscount ? (
                <p className="mt-0.5 text-caption text-emerald-700">
                  Vendor hemat {formatCurrency(previewNormal! - previewPrice)} dari harga normal.
                </p>
              ) : null}
            </div>

            {submitError ? (
              <p
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-meta text-rose-800"
              >
                {submitError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 border-t border-ink-100 px-5 py-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Menyimpan…' : isNew ? 'Tambah paket' : 'Simpan perubahan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteDialog({
  plan,
  busy,
  onCancel,
  onConfirm,
}: {
  plan: AdminPlan
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
        aria-labelledby="plan-delete-title"
        aria-describedby="plan-delete-desc"
        className="relative w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start gap-2 border-b border-ink-100 px-5 py-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertTriangle className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="plan-delete-title" className="text-lead font-semibold text-ink-900">
              Hapus paket?
            </h2>
            <p id="plan-delete-desc" className="text-meta text-ink-500">
              {plan.name}
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
          <p>Paket ini akan hilang dari katalog vendor.</p>
          <p className="flex items-start gap-1.5 rounded-lg bg-ink-50 px-3 py-2 text-meta text-ink-600">
            <Info className="mt-0.5 size-3.5 shrink-0 text-ink-400" />
            <span>
              Paket yang sudah pernah dipakai vendor tidak bisa dihapus — nonaktifkan saja agar
              riwayat pembayaran tetap utuh.
            </span>
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
            {busy ? 'Menghapus…' : 'Ya, hapus'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** "1.500.000" -> 1500000; kosong -> null. */
function digitsOnly(input: string): number | null {
  const digits = input.replace(/[^\d]/g, '')
  return digits === '' ? null : Number.parseInt(digits, 10)
}

function formatPriceInput(raw: string): string {
  const value = digitsOnly(raw)
  return value === null ? '' : formatThousands(value)
}
