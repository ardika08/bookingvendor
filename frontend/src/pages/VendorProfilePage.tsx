import {
  AlertTriangle,
  Building2,
  CreditCard,
  Info,
  Mail,
  MapPin,
  Phone,
  Save,
  Sparkles,
  Store,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { SubmitErrorBanner } from '@/components/bookings/SubmitErrorBanner'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card'
import { Field, FormSection, inputClass, textareaClass } from '@/components/ui/Field'
import { PublicScheduleLinkCard } from '@/components/vendor/PublicScheduleLinkCard'
import { ApiError } from '@/lib/api/client'
import { initials } from '@/lib/format'
import { cn } from '@/lib/cn'
import {
  VENDOR_CATEGORIES,
  bankIncomplete,
  isProfileDirty,
  mapVendorServerErrors,
  profileToFormValues,
  toVendorProfilePayload,
  validateVendorProfile,
  type VendorProfileDetail,
  type VendorProfileFormErrors,
  type VendorProfileFormValues,
  type VendorProfilePayload,
} from '@/lib/vendor-profile'

/**
 * Halaman pengaturan profil vendor (`/settings`).
 *
 * Vendor mengisi identitas usaha dan rekening pembayaran yang dipakai di invoice.
 * Sesuai PRD tidak ada verifikasi/approval: perubahan langsung tersimpan dan
 * berlaku pada invoice berikutnya. Tombol simpan hanya aktif bila ada perubahan
 * agar tidak ada request tanpa isi.
 *
 * Alur submit mengikuti form lain: validasi lokal → `PUT /api/vendor/profile` →
 * error 422 dipetakan ke field, error jaringan masuk banner.
 */
export function VendorProfilePage({
  profile,
  onSave,
}: {
  profile: VendorProfileDetail
  onSave?: (payload: VendorProfilePayload) => Promise<VendorProfileDetail | void>
}) {
  const initial = useMemo(() => profileToFormValues(profile), [profile])
  const [values, setValues] = useState<VendorProfileFormValues>(initial)
  const [savedSnapshot, setSavedSnapshot] = useState<VendorProfileFormValues>(initial)
  const [errors, setErrors] = useState<VendorProfileFormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<ApiError | Error | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const dirty = isProfileDirty(savedSnapshot, values)
  const bankMissing = bankIncomplete(values)
  const slug = profile.slug

  function update<K extends keyof VendorProfileFormValues>(
    key: K,
    value: VendorProfileFormValues[K],
  ) {
    const next = { ...values, [key]: value }
    setValues(next)
    if (submitted) setErrors(validateVendorProfile(next))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    setSubmitError(null)
    setNotice(null)

    const nextErrors = validateVendorProfile(values)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      const first = Object.keys(nextErrors)[0]
      formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus()
      return
    }

    setSaving(true)
    try {
      await onSave?.(toVendorProfilePayload(values))
      setSavedSnapshot(values)
      setSubmitted(false)
      setErrors({})
      setNotice('Profil tersimpan. Perubahan berlaku pada invoice berikutnya.')
    } catch (error) {
      handleSubmitError(error)
    } finally {
      setSaving(false)
    }
  }

  function handleSubmitError(error: unknown) {
    if (error instanceof ApiError) {
      if (Object.keys(error.fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...mapVendorServerErrors(error.fieldErrors) }))
      }
      setSubmitError(error)
      return
    }
    setSubmitError(error instanceof Error ? error : new Error('Terjadi kesalahan tak terduga.'))
  }

  function reset() {
    setValues(initial)
    setErrors({})
    setSubmitted(false)
    setSubmitError(null)
    setNotice(null)
  }

  const errorCount = Object.keys(errors).length

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lead font-semibold text-brand-700">
              {initials(values.businessName || profile.businessName)}
            </span>
            <div className="min-w-0">
              <h2 className="text-title tracking-tight text-ink-900">
                {values.businessName || 'Nama usaha'}
              </h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-500">
                <span className="inline-flex items-center gap-1">
                  <Store className="size-3.5" />
                  {values.category || 'Kategori belum dipilih'}
                </span>
                {values.city ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {values.city}
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-caption text-ink-400">
                Tautan publik: <span className="font-medium text-ink-600">/{slug}</span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {dirty ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-caption font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                Ada perubahan belum disimpan
              </span>
            ) : (
              <span className="rounded-full bg-ink-100 px-2.5 py-1 text-caption font-medium text-ink-500">
                Tersimpan
              </span>
            )}
          </div>
        </CardBody>
      </Card>

      {notice ? (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-meta text-emerald-800">
          <Sparkles className="mt-0.5 size-4 shrink-0" />
          {notice}
        </div>
      ) : null}

      {submitted && errorCount > 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
          <p className="text-meta text-rose-800">
            {errorCount} isian perlu diperbaiki sebelum profil bisa disimpan.
          </p>
        </div>
      ) : null}

      <SubmitErrorBanner error={submitError} onDismiss={() => setSubmitError(null)} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Identitas Usaha"
              description="Nama dan kategori ini tampil di jadwal publik serta invoice."
            />
            <CardBody>
              <FormSection title="">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    id="businessName"
                    label="Nama usaha"
                    required
                    error={errors.businessName}
                    className="sm:col-span-2"
                  >
                    <input
                      id="businessName"
                      data-field="businessName"
                      value={values.businessName}
                      onChange={(event) => update('businessName', event.target.value)}
                      placeholder="Lumen Wedding Story"
                      className={inputClass(Boolean(errors.businessName))}
                    />
                  </Field>

                  <Field id="category" label="Kategori" error={errors.category}>
                    <select
                      id="category"
                      data-field="category"
                      value={values.category}
                      onChange={(event) => update('category', event.target.value)}
                      className={inputClass(Boolean(errors.category))}
                    >
                      <option value="">Belum dipilih</option>
                      {VENDOR_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field id="city" label="Kota / wilayah" error={errors.city}>
                    <input
                      id="city"
                      data-field="city"
                      value={values.city}
                      onChange={(event) => update('city', event.target.value)}
                      placeholder="Jakarta Selatan"
                      className={inputClass(Boolean(errors.city))}
                    />
                  </Field>

                  <Field
                    id="description"
                    label="Deskripsi singkat"
                    error={errors.description}
                    hint="Maksimal beberapa kalimat; membantu klien mengenali layananmu."
                    className="sm:col-span-2"
                  >
                    <textarea
                      id="description"
                      data-field="description"
                      value={values.description}
                      onChange={(event) => update('description', event.target.value)}
                      rows={3}
                      placeholder="Wedding organizer yang menangani konsep, koordinasi vendor, dan rundown acara."
                      className={textareaClass(Boolean(errors.description))}
                    />
                  </Field>
                </div>
              </FormSection>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Kontak"
              description="Dipakai vendor lain & klien untuk menghubungi usaha kamu."
            />
            <CardBody>
              <FormSection title="">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="contactPhone" label="Nomor WhatsApp" error={errors.contactPhone}>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
                      <input
                        id="contactPhone"
                        data-field="contactPhone"
                        value={values.contactPhone}
                        onChange={(event) => update('contactPhone', event.target.value)}
                        inputMode="tel"
                        placeholder="08123456789"
                        className={cn(inputClass(Boolean(errors.contactPhone)), 'pl-9')}
                      />
                    </div>
                  </Field>

                  <Field id="contactEmail" label="Email" error={errors.contactEmail}>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
                      <input
                        id="contactEmail"
                        data-field="contactEmail"
                        type="email"
                        value={values.contactEmail}
                        onChange={(event) => update('contactEmail', event.target.value)}
                        placeholder="hello@usaha.id"
                        className={cn(inputClass(Boolean(errors.contactEmail)), 'pl-9')}
                      />
                    </div>
                  </Field>
                </div>
              </FormSection>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Rekening Pembayaran"
              description="Tujuan transfer yang tercetak di invoice klien."
              action={
                bankMissing ? (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-caption font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                    Belum lengkap
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-caption font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    Lengkap
                  </span>
                )
              }
            />
            <CardBody>
              <FormSection title="">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="bankName" label="Nama bank" error={errors.bankName}>
                    <div className="relative">
                      <Building2 className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
                      <input
                        id="bankName"
                        data-field="bankName"
                        value={values.bankName}
                        onChange={(event) => update('bankName', event.target.value)}
                        placeholder="BCA"
                        className={cn(inputClass(Boolean(errors.bankName)), 'pl-9')}
                      />
                    </div>
                  </Field>

                  <Field
                    id="bankAccountNumber"
                    label="Nomor rekening"
                    error={errors.bankAccountNumber}
                  >
                    <div className="relative">
                      <CreditCard className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
                      <input
                        id="bankAccountNumber"
                        data-field="bankAccountNumber"
                        value={values.bankAccountNumber}
                        onChange={(event) =>
                          update('bankAccountNumber', event.target.value.replace(/[^\d]/g, ''))
                        }
                        inputMode="numeric"
                        placeholder="1234567890"
                        className={cn(
                          inputClass(Boolean(errors.bankAccountNumber)),
                          'pl-9 tabular-nums',
                        )}
                      />
                    </div>
                  </Field>

                  <Field
                    id="bankAccountHolder"
                    label="Pemilik rekening"
                    error={errors.bankAccountHolder}
                    className="sm:col-span-2"
                  >
                    <input
                      id="bankAccountHolder"
                      data-field="bankAccountHolder"
                      value={values.bankAccountHolder}
                      onChange={(event) => update('bankAccountHolder', event.target.value)}
                      placeholder="Lumen Wedding Story"
                      className={inputClass(Boolean(errors.bankAccountHolder))}
                    />
                  </Field>
                </div>
              </FormSection>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-ink-200/80 bg-white p-4">
            <h3 className="text-meta font-semibold uppercase tracking-wide text-ink-400">
              Ringkasan profil
            </h3>
            <dl className="mt-3 space-y-2 text-meta">
              <SummaryRow label="Nama usaha" value={values.businessName || '—'} />
              <SummaryRow label="Kategori" value={values.category || 'Belum dipilih'} />
              <SummaryRow label="Kota" value={values.city || '—'} />
              <SummaryRow label="WhatsApp" value={values.contactPhone || '—'} mono />
              <SummaryRow label="Email" value={values.contactEmail || '—'} />
              <SummaryRow
                label="Rekening"
                value={
                  bankMissing
                    ? 'Belum lengkap'
                    : `${values.bankName} · ${values.bankAccountNumber}`
                }
                mono={!bankMissing}
              />
            </dl>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
            <Info className="mt-0.5 size-3.5 shrink-0 text-sky-600" />
            <p className="text-caption leading-relaxed text-sky-900">
              Rekening dipakai saat vendor membuat instruksi transfer di invoice. Tanpa rekening,
              invoice tetap bisa diterbitkan tetapi tanpa instruksi pembayaran.
            </p>
          </div>

          <PublicScheduleLinkCard slug={slug} />
        </aside>
      </div>

      <Card>
        <CardFooter className="sm:justify-end">
          <Button type="button" variant="secondary" onClick={reset} disabled={!dirty || saving}>
            Batalkan perubahan
          </Button>
          <Button type="submit" disabled={!dirty || saving}>
            <Save className="size-3.5" />
            {saving ? 'Menyimpan…' : 'Simpan profil'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}

function SummaryRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd
        className={cn(
          'truncate text-right text-ink-800',
          mono && 'tabular-nums',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

/** Skeleton saat profil sedang dimuat. */
export function VendorProfileSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="h-24 animate-pulse rounded-xl bg-white" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <div className="h-56 animate-pulse rounded-xl bg-white" />
          <div className="h-36 animate-pulse rounded-xl bg-white" />
          <div className="h-48 animate-pulse rounded-xl bg-white" />
        </div>
        <div className="h-52 animate-pulse rounded-xl bg-white" />
      </div>
    </div>
  )
}
