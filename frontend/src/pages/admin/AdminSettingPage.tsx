import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, History, RefreshCw, ShieldCheck } from '@/components/ui/icons'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { ApiError } from '@/lib/api/client'
import {
  fetchPlatformSettings,
  updatePlatformSettings,
  type PlatformSettingField,
  type PlatformSettingHistoryEntry,
  type PlatformSettingValues,
  type PlatformSettingsResponse,
} from '@/lib/api/admin-settings'
import { formatDateTime } from '@/lib/format'
import { useRestoreFocus } from '@/lib/use-restore-focus'
import { cn } from '@/lib/cn'

/**
 * Pengaturan platform (`/admin/settings`).
 *
 * Isinya ATURAN yang berlaku untuk semua vendor — bukan profil admin (itu di
 * `/admin/akun`). Tiga nilai yang bisa diubah:
 *
 * 1. Masa tenggang langganan — berapa hari vendor masih bisa memakai aplikasi
 *    setelah langganannya berakhir.
 * 2. Kuota booking saat trial.
 * 3. Kuota invoice saat trial.
 *
 * Sebelumnya ketiganya hanya bisa diubah dengan menyunting `.env` dan
 * menjalankan ulang server. Sekarang tersimpan di database dan langsung
 * berlaku, termasuk untuk vendor yang sedang dalam masa tenggang.
 *
 * Setiap perubahan dicatat di riwayat beserta admin yang melakukannya.
 */

/** Label & penjelasan tiap aturan, dipakai form dan riwayat. */
const FIELDS: Array<{
  field: PlatformSettingField
  label: string
  unit: string
  hint: string
}> = [
  {
    field: 'graceDays',
    label: 'Masa tenggang langganan',
    unit: 'hari',
    hint: 'Setelah tanggal berakhir, vendor masih bisa membuat booking & invoice selama masa ini. Setelah lewat, akses ditolak sampai langganan diperpanjang.',
  },
  {
    field: 'trialDays',
    label: 'Durasi masa uji',
    unit: 'hari',
    hint: 'Lama akses penuh untuk vendor baru sejak mendaftar. Selama masa ini semua fitur terbuka tanpa batas jumlah booking maupun invoice.',
  },
]

const FIELD_LABEL = new Map(FIELDS.map((item) => [item.field, item.label]))

export function AdminSettingPage() {
  const [data, setData] = useState<PlatformSettingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  /** Nilai yang sedang diisi di form (string agar input bisa kosong sementara). */
  const [draft, setDraft] = useState<Record<PlatformSettingField, string>>({
    graceDays: '',
    trialDays: '',
  })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PlatformSettingField, string>>>({})
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  /** Fokus kembali ke tombol Simpan setelah dialog konfirmasi ditutup. */
  const captureFocus = useRestoreFocus(confirming)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    setLoading(true)
    setError(null)

    fetchPlatformSettings(controller.signal)
      .then((response) => {
        if (!active) return
        setData(response)
        setDraft({
          graceDays: String(response.settings.graceDays),
          trialDays: String(response.settings.trialDays),
        })
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Gagal memuat pengaturan. Periksa koneksi lalu coba lagi.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [reloadToken])

  /** Nilai yang benar-benar berubah dibanding yang tersimpan. */
  const pendingChanges = useMemo(() => {
    if (data === null) return {} as Partial<PlatformSettingValues>

    const changes: Partial<PlatformSettingValues> = {}
    for (const { field } of FIELDS) {
      const raw = draft[field].trim()
      if (raw === '') continue
      const value = Number(raw)
      if (!Number.isFinite(value)) continue
      if (value !== data.settings[field]) {
        changes[field] = value
      }
    }

    return changes
  }, [data, draft])

  const hasChanges = Object.keys(pendingChanges).length > 0

  /**
   * Peringatan dampak. Memperpendek masa tenggang bisa langsung memutus akses
   * vendor yang sedang dalam tenggang, jadi jumlahnya ditampilkan sebelum
   * admin menyimpan — bukan sesudah.
   */
  const shortensGrace =
    pendingChanges.graceDays !== undefined &&
    data !== null &&
    pendingChanges.graceDays < data.settings.graceDays

  const affectedVendors = data?.impact.vendorsInGrace ?? 0

  function onFieldChange(field: PlatformSettingField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setSaved(false)
  }

  /** Validasi lokal memakai batas dari server, bukan angka yang ditulis ulang. */
  function validate(): boolean {
    if (data === null) return false

    const errors: Partial<Record<PlatformSettingField, string>> = {}

    for (const { field } of FIELDS) {
      const raw = draft[field].trim()
      const rule = data.rules[field]

      if (raw === '') {
        errors[field] = 'Wajib diisi.'
        continue
      }

      const value = Number(raw)
      if (!Number.isInteger(value)) {
        errors[field] = 'Harus bilangan bulat.'
        continue
      }

      if (value < rule.min || value > rule.max) {
        errors[field] = `Harus antara ${rule.min} dan ${rule.max}.`
      }
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  function requestSave() {
    if (!hasChanges) return
    if (!validate()) return
    setSaveError(null)
    setConfirming(true)
  }

  const confirmSave = useCallback(async () => {
    setSaving(true)
    setSaveError(null)

    try {
      const response = await updatePlatformSettings(pendingChanges)
      setData(response)
      setDraft({
        graceDays: String(response.settings.graceDays),
        trialDays: String(response.settings.trialDays),
      })
      setConfirming(false)
      setSaved(true)
    } catch (cause: unknown) {
      setConfirming(false)
      setSaveError(
        cause instanceof ApiError
          ? cause.message
          : 'Gagal menyimpan pengaturan. Coba lagi sebentar lagi.',
      )
    } finally {
      setSaving(false)
    }
  }, [pendingChanges])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-title tracking-tight text-ink-900">Pengaturan</h1>
        <p className="mt-0.5 text-body text-ink-500">
          Aturan platform yang berlaku untuk semua vendor.
        </p>
      </div>

      {error !== null ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3">
          <p className="text-meta text-rose-900">{error}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-meta font-medium text-ink-700 shadow-sm ring-1 ring-ink-200 hover:bg-ink-50"
          >
            <RefreshCw className="size-3.5" />
            Coba lagi
          </button>
        </div>
      ) : null}

      {loading && data === null ? (
        <div className="space-y-4">
          <div className="h-72 animate-pulse rounded-xl bg-white" />
          <div className="h-48 animate-pulse rounded-xl bg-white" />
        </div>
      ) : data === null ? null : (
        <>
          {/*
            Region status dipasang sejak awal (bukan saat ada pesan). Region
            live yang baru dibuat bersamaan dengan isinya sering tidak
            diumumkan pembaca layar karena perubahan sudah terjadi sebelum
            region terdaftar. Dengan wadah yang selalu ada, pesan yang
            muncul belakangan tetap dibacakan.
          */}
          <div role="status" aria-live="polite">
            {saved ? (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                <p className="text-meta text-emerald-900">
                  Pengaturan tersimpan dan langsung berlaku untuk semua vendor.
                </p>
              </div>
            ) : null}
          </div>

          {saveError !== null ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3">
              <p className="text-meta text-rose-900">{saveError}</p>
            </div>
          ) : null}

          <Card>
            <CardHeader
              title="Aturan Langganan & Trial"
              description="Perubahan langsung berlaku untuk semua vendor, termasuk yang sedang dalam masa tenggang."
            />
            <CardBody className="space-y-4">
              {FIELDS.map(({ field, label, unit, hint }) => (
                <div key={field}>
                  <Field
                    id={`setting-${field}`}
                    label={label}
                    hint={hint}
                    hintId={`setting-${field}-hint`}
                    error={fieldErrors[field]}
                    errorId={`setting-${field}-error`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        id={`setting-${field}`}
                        type="number"
                        inputMode="numeric"
                        min={data.rules[field].min}
                        max={data.rules[field].max}
                        value={draft[field]}
                        onChange={(event) => onFieldChange(field, event.target.value)}
                        aria-invalid={fieldErrors[field] !== undefined}
                        aria-describedby={
                          fieldErrors[field] !== undefined
                            ? `setting-${field}-error`
                            : `setting-${field}-hint`
                        }
                        className={cn(
                          'h-9 w-28 rounded-lg border bg-white px-2.5 text-body tabular-nums text-ink-900 shadow-sm transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-brand-800/20',
                          fieldErrors[field] !== undefined
                            ? 'border-rose-400 focus:border-rose-500'
                            : 'border-ink-200 focus:border-brand-800',
                        )}
                      />
                      <span className="text-meta text-ink-500">{unit}</span>
                      <span className="text-caption text-ink-400">
                        ({data.rules[field].min}–{data.rules[field].max})
                      </span>
                    </div>
                  </Field>
                </div>
              ))}

              {shortensGrace && affectedVendors > 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
                  <p className="text-meta leading-relaxed text-amber-900">
                    <span className="font-semibold">{affectedVendors} vendor</span> sedang dalam
                    masa tenggang. Memperpendek masa tenggang bisa langsung memutus akses mereka.
                  </p>
                </div>
              ) : null}
            </CardBody>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 px-4 py-3 sm:px-5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDraft({
                    graceDays: String(data.settings.graceDays),
                    trialDays: String(data.settings.trialDays),
                  })
                  setFieldErrors({})
                  setSaved(false)
                }}
                disabled={!hasChanges || saving}
              >
                Batalkan perubahan
              </Button>
              <Button
                size="sm"
                onClick={captureFocus(requestSave)}
                disabled={!hasChanges || saving}
              >
                <ShieldCheck className="size-3.5" />
                Simpan perubahan
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Riwayat perubahan"
              description="Catatan siapa mengubah apa dan kapan. Menyimpan nilai yang sama tidak dicatat."
            />
            {data.history.length === 0 ? (
              <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
                <History className="size-5 text-ink-300" />
                <p className="mt-1 text-body font-medium text-ink-700">Belum ada perubahan</p>
                <p className="text-caption text-ink-500">
                  Riwayat muncul setelah ada aturan yang diubah.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-ink-100">
                {data.history.map((entry, index) => (
                  <HistoryRow key={`${entry.field}-${entry.changedAt}-${index}`} entry={entry} />
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {confirming ? (
        <ConfirmDialog
          changes={pendingChanges}
          data={data}
          saving={saving}
          onCancel={() => setConfirming(false)}
          onConfirm={confirmSave}
        />
      ) : null}
    </div>
  )
}

function HistoryRow({ entry }: { entry: PlatformSettingHistoryEntry }) {
  return (
    <li className="flex items-start gap-3 px-4 py-2.5 sm:px-5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-500">
        <Clock3 className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body text-ink-800">
          <span className="font-medium">{FIELD_LABEL.get(entry.field as PlatformSettingField) ?? entry.field}</span>{' '}
          diubah dari{' '}
          <span className="tabular-nums text-ink-500">{entry.oldValue ?? '—'}</span> menjadi{' '}
          <span className="font-semibold tabular-nums text-ink-900">{entry.newValue}</span>
        </p>
        <p className="text-caption text-ink-500">
          {entry.actorName ?? 'Akun dihapus'} · {formatDateTime(entry.changedAt)}
        </p>
      </div>
    </li>
  )
}

/**
 * Dialog konfirmasi sebelum menyimpan.
 *
 * Perubahan di sini berdampak ke semua vendor sekaligus, jadi admin melihat
 * ringkasan "dari → menjadi" lebih dulu. Fokus awal ada di tombol Batal agar
 * Enter tidak menyimpan tanpa dibaca.
 */
function ConfirmDialog({
  changes,
  data,
  saving,
  onCancel,
  onConfirm,
}: {
  changes: Partial<PlatformSettingValues>
  data: PlatformSettingsResponse | null
  saving: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'

    dialogRef.current?.querySelector<HTMLButtonElement>('[data-autofocus]')?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
      /*
       * Fokus tidak dikembalikan di sini, melainkan oleh `useRestoreFocus` di
       * komponen induk: hanya induk yang tahu tombol mana yang membuka dialog
       * ini. Cleanup ini sengaja hanya melepas kunci scroll.
       */
    }
  }, [saving, onCancel])

  const entries = Object.entries(changes) as Array<[PlatformSettingField, number]>

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Tutup"
        onClick={saving ? undefined : onCancel}
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-setting-title"
        aria-describedby="confirm-setting-desc"
        className="relative w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start gap-2 border-b border-ink-100 px-5 py-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <ShieldCheck className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-setting-title" className="text-lead font-semibold text-ink-900">
              Simpan perubahan aturan?
            </h2>
            <p id="confirm-setting-desc" className="text-meta text-ink-500">
              Berlaku untuk semua vendor segera setelah disimpan.
            </p>
          </div>
        </div>

        <div className="px-5 py-4">
          <ul className="space-y-2">
            {entries.map(([field, value]) => (
              <li key={field} className="flex items-baseline justify-between gap-3 text-meta">
                <span className="text-ink-600">
                  {FIELD_LABEL.get(field) ?? field}
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="text-ink-400">{data?.settings[field] ?? '—'}</span>
                  <span aria-hidden="true" className="px-1 text-ink-300">
                    →
                  </span>
                  <span className="font-semibold text-ink-900">{value}</span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-caption leading-relaxed text-ink-500">
            Perubahan dicatat di riwayat beserta nama kamu.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving} data-autofocus>
            Batal
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={saving}>
            {saving ? 'Menyimpan…' : 'Ya, simpan'}
          </Button>
        </div>
      </div>
    </div>
  )
}
