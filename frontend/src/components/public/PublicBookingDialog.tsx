import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, inputClass } from '@/components/ui/Field'
import { X } from '@/components/ui/icons'
import { createPublicBooking, calculatePublicTotal } from '@/lib/api/public-bookings'
import type { PublicSchedulePackage } from '@/lib/api/public-schedule'
import { formatLongDate } from '@/lib/format'

/**
 * Modal booking publik.
 *
 * Muncul saat calon klien mengklik tanggal tersedia di kalender jadwal publik.
 * Klien mengisi data diri + memilih paket dan addon. Harga pakai perhitungan
 * server — klien TIDAK bisa mengetik harga.
 */

interface Props {
  open: boolean
  slug: string
  date: string | null
  packages: PublicSchedulePackage[]
  onClose: () => void
  onSuccess: (date: string) => void
}

interface FormValues {
  name: string
  phone: string
  email: string
  time: string
  location: string
  packageId: string
  selectedAddonIds: string[]
  notes: string
}

const emptyForm = (packageId: string): FormValues => ({
  name: '',
  phone: '',
  email: '',
  time: '',
  location: '',
  packageId,
  selectedAddonIds: [],
  notes: '',
})

const PHONE_PATTERN = /^(\+62|62|0)8[1-9][0-9]{6,11}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function PublicBookingDialog({ open, slug, date, packages, onClose, onSuccess }: Props) {
  const [values, setValues] = useState<FormValues>(() => emptyForm(''))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // Reset saat modal dibuka/ditutup atau tanggal berganti.
  useEffect(() => {
    if (open) {
      setValues(emptyForm(''))
      setErrors({})
      setSubmitted(false)
      setError('')
    }
  }, [open, date])

  if (!open) return null

  const selectedPackage = packages.find((pkg) => pkg.id === values.packageId) ?? null
  const availableAddons = selectedPackage?.addons ?? []
  const total = selectedPackage
    ? calculatePublicTotal(selectedPackage.price, availableAddons, values.selectedAddonIds)
    : 0

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function handlePackageChange(packageId: string) {
    // Ganti paket berarti daftar addon ikut berubah — reset pilihan addon.
    setValues((current) => ({ ...current, packageId, selectedAddonIds: [] }))
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    const phone = values.phone.replace(/[\s\-().]/g, '')
    if (!values.name.trim()) next.name = 'Nama wajib diisi.'
    else if (values.name.trim().length < 2) next.name = 'Nama terlalu pendek.'
    if (!values.phone.trim()) next.phone = 'Nomor WhatsApp wajib diisi.'
    else if (!PHONE_PATTERN.test(phone)) next.phone = 'Format nomor tidak valid. Contoh: 08123456789.'
    if (values.email.trim() && !EMAIL_PATTERN.test(values.email.trim())) next.email = 'Format email tidak valid.'
    if (!values.packageId) next.packageId = 'Pilih paket layanan.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!validate() || !date) return
    setSubmitting(true)
    setError('')
    try {
      await createPublicBooking({
        slug,
        client: { name: values.name.trim(), phone: values.phone.trim(), email: values.email.trim() || null },
        event_date: date,
        event_time: values.time || null,
        event_location: values.location.trim() || null,
        package_id: values.packageId,
        addon_ids: values.selectedAddonIds,
        notes: values.notes.trim() || null,
      })
      setSubmitted(true)
      onSuccess(date)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal mengirim booking. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  const buttonLabel = submitting ? 'Mengirim…' : 'Kirim booking'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Tutup" onClick={onClose} className="absolute inset-0" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-booking-title"
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 id="public-booking-title" className="text-lead font-semibold text-ink-900">
              {submitted ? 'Booking terkirim' : 'Buat booking'}
            </h2>
            {date ? (
              <p className="text-meta text-ink-500">{formatLongDate(date)}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded p-2 text-ink-500 hover:bg-ink-100"
          >
            <X className="size-4" />
          </button>
        </div>

        {submitted ? (
          <div className="py-6 text-center">
            <p className="text-body leading-relaxed text-ink-600">
              Terima kasih! Data booking kamu sudah terkirim.
              Vendor akan menghubungi kamu lewat WhatsApp untuk konfirmasi.
            </p>
            <Button type="button" className="mt-4" onClick={onClose}>
              Tutup
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <Field id="pb-name" label="Nama" required error={errors.name}>
              <input
                id="pb-name"
                value={values.name}
                onChange={(e) => update('name', e.target.value)}
                className={inputClass(Boolean(errors.name))}
                placeholder="Nama kamu"
                autoComplete="name"
              />
            </Field>
            <Field id="pb-phone" label="No. WhatsApp" required error={errors.phone}>
              <input
                id="pb-phone"
                value={values.phone}
                onChange={(e) => update('phone', e.target.value)}
                className={inputClass(Boolean(errors.phone))}
                placeholder="08123456789"
                inputMode="tel"
                autoComplete="tel"
              />
            </Field>
            <Field id="pb-email" label="Email (opsional)" error={errors.email}>
              <input
                id="pb-email"
                type="email"
                value={values.email}
                onChange={(e) => update('email', e.target.value)}
                className={inputClass(Boolean(errors.email))}
                placeholder="nama@email.com"
                autoComplete="email"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="pb-time" label="Jam acara (opsional)">
                <input
                  id="pb-time"
                  type="time"
                  value={values.time}
                  onChange={(e) => update('time', e.target.value)}
                  className={inputClass(false)}
                />
              </Field>
              <Field id="pb-location" label="Lokasi (opsional)">
                <input
                  id="pb-location"
                  value={values.location}
                  onChange={(e) => update('location', e.target.value)}
                  className={inputClass(false)}
                  placeholder="Nama gedung / kota"
                />
              </Field>
            </div>

            <fieldset>
              <legend className="text-meta font-medium text-ink-700">
                Paket layanan <span className="text-rose-600">*</span>
              </legend>
              <div className="mt-1.5 space-y-2">
                {packages.map((pkg) => {
                  const checked = values.packageId === pkg.id
                  return (
                    <label
                      key={pkg.id}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                        checked ? 'border-brand-700 bg-brand-50' : 'border-ink-200 bg-white'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="public-package"
                          checked={checked}
                          onChange={() => handlePackageChange(pkg.id)}
                          className="size-4 accent-brand-700"
                        />
                        <span className="text-body font-medium text-ink-800">{pkg.name}</span>
                      </span>
                      <span className="shrink-0 text-body font-semibold tabular-nums text-brand-700">
                        {formatRupiah(pkg.price)}
                      </span>
                    </label>
                  )
                })}
              </div>
              {errors.packageId ? (
                <p className="mt-1 text-meta text-rose-600">{errors.packageId}</p>
              ) : null}
            </fieldset>

            {selectedPackage && availableAddons.length > 0 ? (
              <fieldset>
                <legend className="text-meta font-medium text-ink-700">Addon tambahan</legend>
                <div className="mt-1.5 space-y-2">
                  {availableAddons.map((addon) => {
                    const checked = values.selectedAddonIds.includes(addon.id)
                    return (
                      <label
                        key={addon.id}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2.5"
                      >
                        <span className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const ids = e.target.checked
                                ? [...values.selectedAddonIds, addon.id]
                                : values.selectedAddonIds.filter((id) => id !== addon.id)
                              update('selectedAddonIds', ids)
                            }}
                            className="size-4 accent-brand-700"
                          />
                          <span className="text-body text-ink-700">{addon.name}</span>
                        </span>
                        <span className="shrink-0 text-meta font-medium tabular-nums text-ink-600">
                          {formatRupiah(addon.price)}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            ) : null}

            <Field id="pb-notes" label="Catatan (opsional)">
              <textarea
                id="pb-notes"
                value={values.notes}
                onChange={(e) => update('notes', e.target.value)}
                className={inputClass(false)}
                rows={2}
                placeholder="Tolong dokumentasi lengkap…"
              />
            </Field>

            <div className="rounded-xl bg-ink-50 px-3 py-2.5">
              <span className="text-meta text-ink-500">Total (dihitung otomatis)</span>
              <p className="text-lead font-semibold tabular-nums text-ink-900">
                {formatRupiah(total)}
              </p>
            </div>

            {error ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-meta text-rose-700">{error}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {buttonLabel}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}
