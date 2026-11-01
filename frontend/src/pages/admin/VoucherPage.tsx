import { Ticket, Plus, Pencil, Ban, CircleCheck, Search, Info } from '@/components/ui/icons'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field, inputClass } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { useRestoreFocus } from '@/lib/use-restore-focus'
import {
  VOUCHER_STATUS_LABEL,
  VOUCHER_STATUS_TONE,
  createAdminVoucher,
  fetchAdminVouchers,
  formatVoucherDate,
  setAdminVoucherActive,
  updateAdminVoucher,
  type AdminVoucher,
  type DiscountKind,
  type VoucherPayload,
  type VoucherStatus,
  type VoucherType,
} from '@/lib/api/admin-vouchers'
import { fetchAdminPlans, type AdminPlan } from '@/lib/api/admin-plans'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Kelola voucher (`/admin/vouchers`).
 *
 * Admin membuat kode yang bisa dibagikan ke vendor. Dua tipe:
 * - **Gratis N bulan** — vendor klaim di halaman Langganan, masa aktif langsung
 *   bertambah tanpa pembayaran.
 * - **Potongan harga** — dipakai saat checkout, memotong total tagihan.
 *
 * Voucher tidak bisa dihapus, hanya dinonaktifkan. Alasannya: riwayat pemakaian
 * harus tetap ada supaya admin bisa menjawab "kode ini dipakai vendor mana saja".
 */
export function VoucherPage() {
  const { notify } = useToast()

  const [vouchers, setVouchers] = useState<AdminVoucher[]>([])
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<VoucherStatus | ''>('')

  const [editing, setEditing] = useState<AdminVoucher | null>(null)
  const [creating, setCreating] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const captureFormFocus = useRestoreFocus(editing !== null || creating)

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true)
    return fetchAdminVouchers({}, signal)
      .then((result) => {
        setVouchers(result)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof Error ? cause : new Error('Gagal memuat voucher.'))
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  useEffect(() => {
    const controller = new AbortController()
    fetchAdminPlans(controller.signal)
      .then(setPlans)
      .catch(() => {
        /* Daftar paket hanya dipakai untuk pilihan opsional; kegagalannya
           tidak boleh menghalangi pengelolaan voucher. */
      })
    return () => controller.abort()
  }, [])

  /*
   * Filter dilakukan di klien, bukan lewat query ke server.
   *
   * Alasannya: `status` adalah nilai turunan (gabungan is_active, tanggal, dan
   * kuota). Menyaring di server menuntut logika tanggal yang sama ditulis dua
   * kali — di SQL dan di PHP — dan keduanya bisa berbeda. Jumlah voucher di
   * satu platform kecil, jadi menyaring di klien tidak membebani apa pun.
   */
  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase()

    return vouchers.filter((v) => {
      if (statusFilter && v.status !== statusFilter) return false
      if (q === '') return true
      return (
        v.code.toUpperCase().includes(q) ||
        (v.description ?? '').toUpperCase().includes(q)
      )
    })
  }, [vouchers, query, statusFilter])

  function handleSaved(voucher: AdminVoucher, isNew: boolean) {
    setVouchers((prev) =>
      isNew ? [voucher, ...prev] : prev.map((item) => (item.id === voucher.id ? voucher : item)),
    )
    notify(
      isNew ? `Voucher "${voucher.code}" dibuat.` : `Voucher "${voucher.code}" diperbarui.`,
      { tone: 'success' },
    )
    setEditing(null)
    setCreating(false)
  }

  async function handleToggle(voucher: AdminVoucher) {
    setTogglingId(voucher.id)
    try {
      const updated = await setAdminVoucherActive(voucher.id, !voucher.is_active)
      setVouchers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      notify(
        updated.is_active
          ? `Voucher "${updated.code}" diaktifkan.`
          : `Voucher "${updated.code}" dinonaktifkan.`,
        { tone: 'success' },
      )
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal mengubah status voucher.', {
        tone: 'error',
      })
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-title tracking-tight text-ink-900">Voucher</h1>
          <p className="mt-0.5 text-body text-ink-500">
            Kode yang bisa dibagikan ke vendor. Voucher gratis diklaim vendor sendiri; voucher
            potongan dipakai saat checkout.
          </p>
        </div>
        <Button onClick={captureFormFocus(() => setCreating(true))} className="shrink-0">
          <Plus className="size-4" />
          Buat Voucher
        </Button>
      </div>

      {/* Filter */}
      <Card>
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="voucher-search" className="mb-1 block text-caption font-medium text-ink-600">
              Cari kode
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
              <input
                id="voucher-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Mis. GRATIS1BULAN"
                className={cn(inputClass(), 'pl-9')}
              />
            </div>
          </div>
          <div className="sm:w-52">
            <label htmlFor="voucher-status" className="mb-1 block text-caption font-medium text-ink-600">
              Status
            </label>
            <select
              id="voucher-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as VoucherStatus | '')}
              className={inputClass()}
            >
              <option value="">Semua status</option>
              {(Object.keys(VOUCHER_STATUS_LABEL) as VoucherStatus[]).map((key) => (
                <option key={key} value={key}>
                  {VOUCHER_STATUS_LABEL[key]}
                </option>
              ))}
            </select>
          </div>
        </CardBody>
      </Card>

      {error ? (
        <Card>
          <div className="px-5 py-12 text-center">
            <p className="text-meta font-medium text-ink-700">Gagal memuat voucher</p>
            <p className="mx-auto mt-1 max-w-sm text-caption text-ink-500">{error.message}</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => load()}>
              Coba lagi
            </Button>
          </div>
        </Card>
      ) : loading && vouchers.length === 0 ? (
        <Card>
          <CardBody className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-ink-50" aria-hidden />
            ))}
          </CardBody>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Ticket className="size-5" />}
            title={vouchers.length === 0 ? 'Belum ada voucher' : 'Tidak ada yang cocok'}
            description={
              vouchers.length === 0
                ? 'Buat kode pertama untuk dibagikan ke vendor, misalnya 1 bulan gratis untuk pelanggan awal.'
                : 'Coba ubah kata kunci atau filter status.'
            }
            action={
              vouchers.length === 0 ? (
                <Button size="sm" onClick={captureFormFocus(() => setCreating(true))}>
                  <Plus className="size-4" />
                  Buat Voucher
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={`${filtered.length} voucher`}
            description="Voucher tidak bisa dihapus supaya riwayat pemakaian tetap utuh. Nonaktifkan untuk menghentikannya."
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-ink-100">
              {filtered.map((v) => (
                <li key={v.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-ink-100 px-2 py-0.5 font-mono text-meta font-semibold tracking-wide text-ink-900">
                        {v.code}
                      </code>
                      <Badge className={VOUCHER_STATUS_TONE[v.status]}>
                        {VOUCHER_STATUS_LABEL[v.status]}
                      </Badge>
                      <span className="text-caption text-ink-500">{v.discount_label}</span>
                    </div>
                    {v.description && (
                      <p className="mt-1 truncate text-caption text-ink-500">{v.description}</p>
                    )}
                    <p className="mt-1 text-caption text-ink-400">
                      Dipakai {v.used_count}
                      {v.max_uses !== null ? ` dari ${v.max_uses}` : ' kali (tanpa batas)'}
                      {v.expires_at ? ` · berlaku sampai ${formatVoucherDate(v.expires_at)}` : ''}
                      {v.plan_name ? ` · paket ${v.plan_name}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={captureFormFocus(() => setEditing(v))}
                    >
                      <Pencil className="size-3.5" />
                      Ubah
                    </Button>
                    <Button
                      size="sm"
                      variant={v.is_active ? 'danger' : 'secondary'}
                      onClick={() => handleToggle(v)}
                      disabled={togglingId === v.id}
                    >
                      {v.is_active ? <Ban className="size-3.5" /> : <CircleCheck className="size-3.5" />}
                      {v.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {(creating || editing) && (
        <VoucherFormDialog
          voucher={editing}
          plans={plans}
          onClose={() => {
            setEditing(null)
            setCreating(false)
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

/** Dialog buat/ubah voucher. */
function VoucherFormDialog({
  voucher,
  plans,
  onClose,
  onSaved,
}: {
  voucher: AdminVoucher | null
  plans: AdminPlan[]
  onClose: () => void
  onSaved: (voucher: AdminVoucher, isNew: boolean) => void
}) {
  const { notify } = useToast()
  const isNew = voucher === null

  const idBase = useId()
  const codeId = `${idBase}-code`
  const descId = `${idBase}-desc`
  const typeId = `${idBase}-type`
  const monthsId = `${idBase}-months`
  const planId = `${idBase}-plan`
  const kindId = `${idBase}-kind`
  const amountId = `${idBase}-amount`
  const percentId = `${idBase}-percent`
  const maxUsesId = `${idBase}-max`
  const expiresId = `${idBase}-expires`

  const [code, setCode] = useState(voucher?.code ?? '')
  const [description, setDescription] = useState(voucher?.description ?? '')
  const [type, setType] = useState<VoucherType>(voucher?.type ?? 'free_months')
  const [freeMonths, setFreeMonths] = useState(String(voucher?.free_months ?? 1))
  const [selectedPlan, setSelectedPlan] = useState(String(voucher?.plan_id ?? ''))
  const [discountKind, setDiscountKind] = useState<DiscountKind>(voucher?.discount_kind ?? 'percent')
  const [discountAmount, setDiscountAmount] = useState(
    voucher?.discount_amount ? String(Math.round(Number(voucher.discount_amount))) : '',
  )
  const [discountPercent, setDiscountPercent] = useState(
    String(voucher?.discount_percent ?? 50),
  )
  const [maxUses, setMaxUses] = useState(voucher?.max_uses ? String(voucher.max_uses) : '')
  const [expiresAt, setExpiresAt] = useState(
    voucher?.expires_at ? voucher.expires_at.slice(0, 10) : '',
  )

  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Esc menutup dialog. Fokus dikembalikan oleh `useRestoreFocus` di pemanggil.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFieldErrors({})

    const payload: VoucherPayload = {
      code: code.trim().toUpperCase(),
      description: description.trim() || null,
      type,
      max_uses: maxUses.trim() === '' ? null : Number(maxUses),
      expires_at: expiresAt.trim() === '' ? null : `${expiresAt}T23:59:59`,
    }

    if (type === 'free_months') {
      payload.free_months = Number(freeMonths)
      payload.plan_id = selectedPlan === '' ? null : Number(selectedPlan)
    } else {
      payload.discount_kind = discountKind
      if (discountKind === 'percent') {
        payload.discount_percent = Number(discountPercent)
      } else {
        payload.discount_amount = Number(discountAmount)
      }
    }

    try {
      const saved = isNew
        ? await createAdminVoucher(payload)
        : await updateAdminVoucher(voucher.id, payload)
      onSaved(saved, isNew)
    } catch (cause) {
      if (cause instanceof Error && 'fieldErrors' in cause) {
        const fe = (cause as { fieldErrors?: Record<string, string> }).fieldErrors
        if (fe && Object.keys(fe).length > 0) {
          setFieldErrors(fe)
          setSaving(false)
          return
        }
      }
      notify(cause instanceof Error ? cause.message : 'Gagal menyimpan voucher.', {
        tone: 'error',
      })
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${idBase}-title`}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        <form onSubmit={handleSubmit}>
          <div className="border-b border-ink-100 px-5 py-4">
            <h2 id={`${idBase}-title`} className="text-lead font-semibold text-ink-900">
              {isNew ? 'Buat voucher' : `Ubah ${voucher.code}`}
            </h2>
            <p className="mt-0.5 text-caption text-ink-500">
              Kode otomatis disimpan dalam huruf besar.
            </p>
          </div>

          <div className="space-y-4 px-5 py-4">
            <Field id={codeId} label="Kode voucher" required error={fieldErrors.code}>
              <input
                id={codeId}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="GRATIS1BULAN"
                className={cn(inputClass(Boolean(fieldErrors.code)), 'font-mono tracking-wide')}
                required
                minLength={3}
                maxLength={40}
              />
            </Field>

            <Field
              id={descId}
              label="Keterangan"
              hint="Hanya terlihat admin — untuk menandai voucher ini untuk apa."
              error={fieldErrors.description}
            >
              <input
                id={descId}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Promo pelanggan awal"
                className={inputClass(Boolean(fieldErrors.description))}
                maxLength={255}
              />
            </Field>

            <Field id={typeId} label="Jenis voucher" required error={fieldErrors.type}>
              <select
                id={typeId}
                value={type}
                onChange={(e) => setType(e.target.value as VoucherType)}
                className={inputClass(Boolean(fieldErrors.type))}
              >
                <option value="free_months">Gratis N bulan</option>
                <option value="discount">Potongan harga</option>
              </select>
            </Field>

            {type === 'free_months' ? (
              <>
                <Field
                  id={monthsId}
                  label="Jumlah bulan gratis"
                  required
                  error={fieldErrors.free_months}
                >
                  <input
                    id={monthsId}
                    type="number"
                    min={1}
                    max={24}
                    value={freeMonths}
                    onChange={(e) => setFreeMonths(e.target.value)}
                    className={inputClass(Boolean(fieldErrors.free_months))}
                    required
                  />
                </Field>

                <Field
                  id={planId}
                  label="Paket yang diberikan"
                  hint="Kosongkan untuk memakai paket termurah yang aktif."
                  error={fieldErrors.plan_id}
                >
                  <select
                    id={planId}
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value)}
                    className={inputClass(Boolean(fieldErrors.plan_id))}
                  >
                    <option value="">Paket termurah (otomatis)</option>
                    {plans
                      .filter((p) => p.isActive)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.price !== null ? ` — ${formatCurrency(p.price)}` : ''}
                        </option>
                      ))}
                  </select>
                </Field>
              </>
            ) : (
              <>
                <Field id={kindId} label="Bentuk potongan" required error={fieldErrors.discount_kind}>
                  <select
                    id={kindId}
                    value={discountKind}
                    onChange={(e) => setDiscountKind(e.target.value as DiscountKind)}
                    className={inputClass(Boolean(fieldErrors.discount_kind))}
                  >
                    <option value="percent">Persen (%)</option>
                    <option value="amount">Nominal (Rp)</option>
                  </select>
                </Field>

                {discountKind === 'percent' ? (
                  <Field
                    id={percentId}
                    label="Besar potongan (%)"
                    required
                    error={fieldErrors.discount_percent}
                  >
                    <input
                      id={percentId}
                      type="number"
                      min={1}
                      max={100}
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      className={inputClass(Boolean(fieldErrors.discount_percent))}
                      required
                    />
                  </Field>
                ) : (
                  <Field
                    id={amountId}
                    label="Nominal potongan (Rp)"
                    required
                    error={fieldErrors.discount_amount}
                  >
                    <input
                      id={amountId}
                      type="number"
                      min={1}
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      placeholder="20000"
                      className={inputClass(Boolean(fieldErrors.discount_amount))}
                      required
                    />
                  </Field>
                )}
              </>
            )}

            <Field
              id={maxUsesId}
              label="Batas total pemakaian"
              hint="Kosongkan untuk tanpa batas. Tiap vendor tetap hanya bisa memakai sekali."
              error={fieldErrors.max_uses}
            >
              <input
                id={maxUsesId}
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Tanpa batas"
                className={inputClass(Boolean(fieldErrors.max_uses))}
              />
            </Field>

            <Field
              id={expiresId}
              label="Berlaku sampai"
              hint="Kosongkan bila tidak ada batas waktu."
              error={fieldErrors.expires_at}
            >
              <input
                id={expiresId}
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className={inputClass(Boolean(fieldErrors.expires_at))}
              />
            </Field>

            {type === 'discount' && (
              <div className="flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2.5">
                <Info className="mt-0.5 size-4 shrink-0 text-brand-700" />
                <p className="text-caption leading-snug text-brand-800">
                  Voucher potongan dipakai saat vendor memilih paket di halaman checkout, bukan
                  diklaim di halaman Langganan.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-3.5">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Menyimpan…' : isNew ? 'Buat voucher' : 'Simpan perubahan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
