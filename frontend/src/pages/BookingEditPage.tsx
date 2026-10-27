import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookingFormSidebar } from '@/components/bookings/BookingFormSidebar'
import { StatusStepper } from '@/components/bookings/StatusControls'
import { SubmitErrorBanner } from '@/components/bookings/SubmitErrorBanner'
import { UpgradeModal } from '@/components/upgrade/UpgradeModal'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardFooter } from '@/components/ui/Card'
import { Field, FormSection, inputClass, textareaClass } from '@/components/ui/Field'
import {
  formatCurrencyInput,
  parseCurrencyInput,
  toBookingPayload,
  validateBookingForm,
  type BookingFormErrors,
  type BookingFormValues,
} from '@/lib/booking-form'
import { changedFieldLabels } from '@/lib/booking-mapper'
import { BOOKING_STATUS_META } from '@/lib/booking-status'
import { ApiError } from '@/lib/api/client'
import { mapServerErrors } from '@/lib/api/field-errors'
import { cn } from '@/lib/cn'
import type { Booking, BookingStatus, VendorPackage } from '@/types/booking'

/**
 * Form edit booking (`/bookings/:id/edit`).
 *
 * Sama seperti form create, tetapi sudah terisi data booking. Perubahan dihitung
 * terus-menerus (`changedFields`) sehingga tombol simpan bisa menampilkan jumlah
 * perubahan dan vendor sadar apa yang akan dikirim ke server.
 *
 * Perubahan tanggal memakai `takenDates` yang mengecualikan booking ini sendiri,
 * supaya reschedule ke tanggalnya sendiri tidak dianggap bentrok.
 */
export function BookingEditForm({
  booking,
  packages,
  takenDates,
  onSave,
}: {
  booking: Booking
  packages: VendorPackage[]
  takenDates: string[]
  onSave?: (payload: ReturnType<typeof toBookingPayload>, status: BookingStatus) => Promise<void>
}) {
  const navigate = useNavigate()
  const initial = useMemo<BookingFormValues>(
    () => ({
      clientName: booking.client.name,
      clientPhone: booking.client.phone,
      clientEmail: booking.client.email ?? '',
      eventDate: booking.eventDate,
      eventTime: booking.eventTime ?? '',
      eventLocation: booking.eventLocation ?? '',
      packageId: booking.packageId ?? '',
      totalPrice: formatCurrencyInput(booking.totalPrice),
      status: booking.status,
      notes: booking.notes ?? '',
    }),
    [booking],
  )

  const [values, setValues] = useState<BookingFormValues>(initial)
  const [errors, setErrors] = useState<BookingFormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<ApiError | Error | null>(null)
  const [trialLimitOpen, setTrialLimitOpen] = useState(false)

  const changes = useMemo(() => changedFieldLabels(initial, values), [initial, values])
  const dirty = changes.length > 0
  const totalPrice = useMemo(() => parseCurrencyInput(values.totalPrice), [values.totalPrice])
  const dateConflict = Boolean(values.eventDate) && takenDates.includes(values.eventDate)

  function update<K extends keyof BookingFormValues>(key: K, value: BookingFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    if (submitted) {
      setErrors(validateBookingForm({ ...values, [key]: value }, takenDates))
    }
  }

  function selectPackage(packageId: string) {
    const pkg = packages.find((item) => item.id === packageId)
    setValues((prev) => ({
      ...prev,
      packageId,
      totalPrice: pkg ? formatCurrencyInput(pkg.price) : prev.totalPrice,
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    setSubmitError(null)

    const nextErrors = validateBookingForm(values, takenDates)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    try {
      await onSave?.(toBookingPayload(values), values.status)
      setSavedAt(new Date().toISOString())
      window.setTimeout(() => navigate(`/bookings/${booking.id}`), 600)
    } catch (error) {
      handleSubmitError(error)
    } finally {
      setSaving(false)
    }
  }

  /**
   * Error dari `PUT /api/bookings/{id}`.
   *
   * Perubahan tanggal yang bentrok dikembalikan server sebagai 422 pada
   * `event_date` — pesannya ditempel ke input tanggal, bukan sekadar banner.
   * Penolakan karena langganan kedaluwarsa memunculkan modal upgrade.
   */
  function handleSubmitError(error: unknown) {
    if (error instanceof ApiError) {
      if (error.isTrialLimit) {
        setTrialLimitOpen(true)
        return
      }
      if (Object.keys(error.fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...mapServerErrors(error.fieldErrors) }))
      }
      setSubmitError(error)
      return
    }
    setSubmitError(error instanceof Error ? error : new Error('Terjadi kesalahan tak terduga.'))
  }

  const errorCount = Object.keys(errors).length

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-title tracking-tight text-ink-900">Edit Booking</h1>
          <p className="text-body text-ink-500">
            {booking.client.name} · {BOOKING_STATUS_META[booking.status].label}
          </p>
        </div>
        <StatusStepper
          status={values.status}
          onChange={(status) => update('status', status)}
        />
      </div>

      {submitted && errorCount > 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
          <p className="text-meta text-rose-800">
            {errorCount} isian perlu diperbaiki sebelum perubahan disimpan.
          </p>
        </div>
      ) : null}

      {savedAt ? (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <p className="text-meta text-emerald-800">
            Perubahan tersimpan — mengalihkan ke detail booking…
          </p>
        </div>
      ) : null}

      {submitError ? (
        <SubmitErrorBanner error={submitError} onDismiss={() => setSubmitError(null)} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          <Card>
            <CardBody>
              <FormSection title="Data Klien" description="Mengubah data di sini ikut memperbarui data klien.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="editClientName" label="Nama klien" required error={errors.clientName}>
                    <input
                      id="editClientName"
                      value={values.clientName}
                      onChange={(event) => update('clientName', event.target.value)}
                      className={inputClass(Boolean(errors.clientName))}
                    />
                  </Field>
                  <Field id="editClientPhone" label="No. WhatsApp" required error={errors.clientPhone}>
                    <input
                      id="editClientPhone"
                      value={values.clientPhone}
                      onChange={(event) => update('clientPhone', event.target.value)}
                      inputMode="tel"
                      className={inputClass(Boolean(errors.clientPhone))}
                    />
                  </Field>
                  <Field id="editClientEmail" label="Email (opsional)" error={errors.clientEmail} className="sm:col-span-2">
                    <input
                      id="editClientEmail"
                      type="email"
                      value={values.clientEmail}
                      onChange={(event) => update('clientEmail', event.target.value)}
                      className={inputClass(Boolean(errors.clientEmail))}
                    />
                  </Field>
                </div>
              </FormSection>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <FormSection title="Detail Acara" description="Reschedule tanggal akan memindahkan penanda kalender.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="editEventDate" label="Tanggal acara" required error={errors.eventDate}>
                    <input
                      id="editEventDate"
                      type="date"
                      value={values.eventDate}
                      onChange={(event) => update('eventDate', event.target.value)}
                      className={cn(
                        inputClass(Boolean(errors.eventDate)),
                        dateConflict && 'border-amber-300 focus:border-amber-400 focus:ring-amber-100',
                      )}
                    />
                  </Field>
                  <Field id="editEventTime" label="Jam acara" error={errors.eventTime}>
                    <input
                      id="editEventTime"
                      type="time"
                      value={values.eventTime}
                      onChange={(event) => update('eventTime', event.target.value)}
                      className={inputClass(Boolean(errors.eventTime))}
                    />
                  </Field>
                  <Field id="editEventLocation" label="Lokasi acara" className="sm:col-span-2">
                    <input
                      id="editEventLocation"
                      value={values.eventLocation}
                      onChange={(event) => update('eventLocation', event.target.value)}
                      className={inputClass()}
                    />
                  </Field>
                  <Field id="editPackageId" label="Paket layanan">
                    <select
                      id="editPackageId"
                      value={values.packageId}
                      onChange={(event) => selectPackage(event.target.value)}
                      className={inputClass()}
                    >
                      <option value="">Tanpa paket / manual</option>
                      {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="editTotalPrice" label="Nilai kontrak (Rp)" required error={errors.totalPrice}>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-ink-400">
                        Rp
                      </span>
                      <input
                        id="editTotalPrice"
                        value={values.totalPrice}
                        onChange={(event) =>
                          update(
                            'totalPrice',
                            formatCurrencyInput(parseCurrencyInput(event.target.value)),
                          )
                        }
                        inputMode="numeric"
                        className={cn(inputClass(Boolean(errors.totalPrice)), 'pl-9 tabular-nums')}
                      />
                    </div>
                  </Field>
                  <Field id="editNotes" label="Catatan internal" className="sm:col-span-2">
                    <textarea
                      id="editNotes"
                      value={values.notes}
                      onChange={(event) => update('notes', event.target.value)}
                      className={textareaClass()}
                    />
                  </Field>
                </div>
              </FormSection>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-3">
          <BookingFormSidebar
            packages={packages}
            selectedPackageId={values.packageId}
            onSelectPackage={selectPackage}
            clientName={values.clientName}
            eventDate={values.eventDate}
            eventTime={values.eventTime}
            totalPrice={totalPrice}
            takenDates={takenDates}
          />

          {dirty ? (
            <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-4 lg:sticky lg:top-20">
              <h3 className="text-meta font-semibold uppercase tracking-wide text-brand-700">
                {changes.length} perubahan belum disimpan
              </h3>
              <ul className="mt-2 space-y-1">
                {changes.slice(0, 5).map((change) => (
                  <li key={change.key} className="text-caption text-brand-900">
                    <span className="font-medium">{change.label}:</span> {change.from} → {change.to}
                  </li>
                ))}
                {changes.length > 5 ? (
                  <li className="text-caption text-brand-700">+{changes.length - 5} lainnya</li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <Card>
        <CardFooter className="sm:justify-between">
          <p className="text-meta text-ink-500">
            {dirty ? `${changes.length} perubahan siap disimpan.` : 'Belum ada perubahan.'}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate(`/bookings/${booking.id}`)}>
              Batal
            </Button>
            <Button type="submit" disabled={saving || !dirty}>
              {saving ? 'Menyimpan…' : 'Simpan perubahan'}
            </Button>
          </div>
        </CardFooter>
      </Card>

      <UpgradeModal
        open={trialLimitOpen}
        onClose={() => setTrialLimitOpen(false)}
        resource="booking"
      />
    </form>
  )
}
