import { AlertTriangle, ArrowLeft, Info, Lock } from '@/components/ui/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookingFormSidebar } from '@/components/bookings/BookingFormSidebar'
import { ClientLookup, type ClientSelection } from '@/components/bookings/ClientLookup'
import { SubmitErrorBanner } from '@/components/bookings/SubmitErrorBanner'
import { UpgradeModal, type TrialUsage } from '@/components/upgrade/UpgradeModal'
import { useTrialUpgradeGate } from '@/hooks/useTrialUpgradeGate'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardFooter } from '@/components/ui/Card'
import { Field, FormSection, inputClass, textareaClass } from '@/components/ui/Field'
import { ApiError } from '@/lib/api/client'
import { mapServerErrors } from '@/lib/api/field-errors'
import {
  EMPTY_BOOKING_FORM,
  formatCurrencyInput,
  parseCurrencyInput,
  toBookingPayload,
  validateBookingForm,
  type BookingFormErrors,
  type BookingFormValues,
} from '@/lib/booking-form'
import { BOOKING_STATUS_META } from '@/lib/booking-status'
import type { ClientSummary } from '@/lib/clients'
import { cn } from '@/lib/cn'
import { BOOKING_STATUSES, type VendorPackage } from '@/types/booking'

/**
 * Form booking vendor (`/bookings/new`).
 *
 * Satu layar, dua kelompok isian (klien & acara) plus panel ringkasan. Validasi
 * berjalan di klien mengikuti aturan server: nama + no. WA wajib, tanggal acara
 * wajib dan tidak boleh sudah terisi booking lain, harga berupa angka.
 *
 * Alur submit (sesuai PRD):
 * 1. validasi klien → fokus field pertama yang salah;
 * 2. `onSubmit` memanggil `POST /api/bookings`;
 * 3. bila server menolak dengan `trial_limit_reached` → `UpgradeModal` tampil
 *    dan isian form tidak disentuh;
 * 4. error lain (422 field, jaringan) ditampilkan di `SubmitErrorBanner`.
 */
export function BookingFormPage({
  packages,
  takenDates,
  clients = [],
  trialExhausted = false,
  trialUsage,
  onSubmit,
}: {
  packages: VendorPackage[]
  takenDates: string[]
  clients?: ClientSummary[]
  onSubmit?: (payload: ReturnType<typeof toBookingPayload>) => Promise<void>
  /** Kuota trial sudah habis sebelum form dibuka → modal tampil otomatis. */
  trialExhausted?: boolean
  /** Pemakaian trial untuk konteks di dalam modal upgrade. */
  trialUsage?: TrialUsage
}) {
  const navigate = useNavigate()
  const [values, setValues] = useState<BookingFormValues>(EMPTY_BOOKING_FORM)
  const [clientSelection, setClientSelection] = useState<ClientSelection>({
    clientId: null,
    name: '',
    phone: '',
    email: '',
  })
  const [errors, setErrors] = useState<BookingFormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<ApiError | Error | null>(null)
  const trialGate = useTrialUpgradeGate(trialExhausted)
  const summaryRef = useRef<HTMLDivElement>(null)

  const totalPrice = useMemo(() => parseCurrencyInput(values.totalPrice), [values.totalPrice])

  /**
   * Data klien hidup di `clientSelection`, tetapi validasi form bekerja pada
   * `BookingFormValues` — jadi keduanya disinkronkan sebelum divalidasi/dikirim.
   */
  const mergedValues = useMemo<BookingFormValues>(
    () => ({
      ...values,
      clientName: clientSelection.name,
      clientPhone: clientSelection.phone,
      clientEmail: clientSelection.email,
    }),
    [values, clientSelection],
  )

  /** Setelah submit gagal, error ikut diperbarui saat pengguna mengetik. */
  useEffect(() => {
    if (submitted) setErrors(validateBookingForm(mergedValues, takenDates))
  }, [mergedValues, takenDates, submitted])

  const dateConflict = Boolean(values.eventDate) && takenDates.includes(values.eventDate)

  function update<K extends keyof BookingFormValues>(key: K, value: BookingFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleClientChange(next: ClientSelection) {
    setClientSelection(next)
    // Klien yang dipilih membawa data kontak lengkap; sinkronkan ke state form.
    setValues((prev) => ({
      ...prev,
      clientName: next.name,
      clientPhone: next.phone,
      clientEmail: next.email,
    }))
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

    const nextErrors = validateBookingForm(mergedValues, takenDates)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      const first = Object.keys(nextErrors)[0]
      summaryRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus()
      return
    }

    setSaving(true)
    try {
      await onSubmit?.(toBookingPayload(mergedValues))
      setNotice('Booking tersimpan — mengalihkan ke daftar booking…')
      window.setTimeout(() => navigate('/bookings'), 700)
    } catch (error) {
      handleSubmitError(error)
    } finally {
      setSaving(false)
    }
  }

  /** Petakan error API ke UI tanpa kehilangan isian form. */
  function handleSubmitError(error: unknown) {
    if (error instanceof ApiError) {
      // Jatah trial habis ? modal upgrade, form tetap utuh.
      if (trialGate.handleSubmitError(error)) return
      // Validasi server: tampilkan pesan per field di bawah input terkait.
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
      <div className="flex flex-col gap-1">
        <Link
          to="/bookings"
          className="inline-flex w-fit items-center gap-1.5 text-meta font-medium text-ink-500 hover:text-ink-800"
        >
          <ArrowLeft className="size-3.5" />
          Daftar booking
        </Link>
        <h1 className="text-title tracking-tight text-ink-900">Booking Baru</h1>
        <p className="text-body text-ink-500">
          Catat kesepakatan dengan klien. Nama &amp; nomor WA otomatis tersimpan sebagai data klien.
        </p>
      </div>

      {submitted && errorCount > 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
          <p className="text-meta leading-relaxed text-rose-800">
            Ada {errorCount} isian yang perlu diperbaiki sebelum booking bisa disimpan.
          </p>
        </div>
      ) : null}

      {notice ? (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <p className="text-meta text-emerald-800">{notice}</p>
        </div>
      ) : null}
      {trialGate.blocked ? (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-meta leading-relaxed text-amber-900">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <span className="font-semibold">Jatah trial habis.</span> Isian form tetap
              tersimpan — berlangganan untuk menyimpan booking ini.
            </span>
          </p>
          <Button type="button" size="sm" variant="secondary" onClick={trialGate.reopen} className="shrink-0">
            Lihat paket
          </Button>
        </div>
      ) : null}

      {submitError ? (
        <SubmitErrorBanner
          error={submitError}
          onRetry={() => summaryRef.current?.closest('form')?.requestSubmit()}
          onDismiss={() => setSubmitError(null)}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div ref={summaryRef} className="space-y-4">
          <Card>
            <CardBody className="space-y-4">
              <FormSection title="Data Klien" description="Dipakai ulang saat membuat invoice.">
                <div className="space-y-3">
                  <Field
                    id="clientLookup"
                    label="Klien"
                    required
                    error={errors.clientName ?? errors.clientPhone}
                    hint="Pilih dari daftar klien lama, atau isi manual untuk klien baru."
                  >
                    <div data-field="clientName">
                      <ClientLookup
                        clients={clients}
                        value={clientSelection}
                        onChange={handleClientChange}
                        error={errors.clientName ?? errors.clientPhone}
                        autoFocus
                      />
                    </div>
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      id="clientNameInput"
                      label="Nama klien / pasangan"
                      required
                      error={errors.clientName}
                    >
                      <input
                        id="clientNameInput"
                        value={clientSelection.name}
                        onChange={(event) =>
                          handleClientChange({
                            ...clientSelection,
                            clientId: null,
                            name: event.target.value,
                          })
                        }
                        placeholder="Rani & Bagas"
                        autoComplete="name"
                        className={inputClass(Boolean(errors.clientName))}
                      />
                    </Field>

                    <Field
                      id="clientPhone"
                      label="No. WhatsApp"
                      required
                      hint="Contoh: 0812-3456-7890"
                      error={errors.clientPhone}
                    >
                      <input
                        id="clientPhone"
                        data-field="clientPhone"
                        value={clientSelection.phone}
                        onChange={(event) =>
                          handleClientChange({
                            ...clientSelection,
                            clientId: null,
                            phone: event.target.value,
                          })
                        }
                        inputMode="tel"
                        placeholder="08123456789"
                        autoComplete="tel"
                        className={inputClass(Boolean(errors.clientPhone))}
                      />
                    </Field>

                    <Field
                      id="clientEmail"
                      label="Email (opsional)"
                      error={errors.clientEmail}
                      className="sm:col-span-2"
                    >
                      <input
                        id="clientEmail"
                        data-field="clientEmail"
                        value={clientSelection.email}
                        onChange={(event) =>
                          handleClientChange({
                            ...clientSelection,
                            clientId: null,
                            email: event.target.value,
                          })
                        }
                        type="email"
                        placeholder="klien@email.com"
                        autoComplete="email"
                        className={inputClass(Boolean(errors.clientEmail))}
                      />
                    </Field>
                  </div>
                </div>
              </FormSection>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4">
              <FormSection title="Detail Acara" description="Tanggal terisi otomatis muncul di kalender.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    id="eventDate"
                    label="Tanggal acara"
                    required
                    error={errors.eventDate}
                    hint={dateConflict ? undefined : 'Peringatan muncul jika tanggal sudah ditempati booking aktif.'}
                  >
                    <input
                      id="eventDate"
                      data-field="eventDate"
                      type="date"
                      value={values.eventDate}
                      onChange={(event) => update('eventDate', event.target.value)}
                      className={cn(
                        inputClass(Boolean(errors.eventDate)),
                        dateConflict && 'border-amber-300 focus:border-amber-400 focus:ring-amber-100',
                      )}
                    />
                    {dateConflict && !errors.eventDate ? (
                      <p
                        role="alert"
                        className="mt-1.5 flex items-start gap-1.5 text-meta leading-relaxed text-amber-800"
                      >
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        Tanggal ini sudah memiliki booking aktif. Pilih tanggal lain agar tidak
                        terjadi bentrok.
                      </p>
                    ) : null}
                  </Field>

                  <Field id="eventTime" label="Jam acara (opsional)" error={errors.eventTime}>
                    <input
                      id="eventTime"
                      data-field="eventTime"
                      type="time"
                      value={values.eventTime}
                      onChange={(event) => update('eventTime', event.target.value)}
                      className={inputClass(Boolean(errors.eventTime))}
                    />
                  </Field>

                  <Field
                    id="eventLocation"
                    label="Lokasi acara"
                    className="sm:col-span-2"
                    hint="Gedung, kota, atau alamat singkat."
                  >
                    <input
                      id="eventLocation"
                      data-field="eventLocation"
                      value={values.eventLocation}
                      onChange={(event) => update('eventLocation', event.target.value)}
                      placeholder="Gedung Balai Kartini, Jakarta Selatan"
                      className={inputClass()}
                    />
                  </Field>

                  <Field id="packageId" label="Paket layanan">
                    <select
                      id="packageId"
                      data-field="packageId"
                      value={values.packageId}
                      onChange={(event) => selectPackage(event.target.value)}
                      className={cn(inputClass(), 'pr-8')}
                    >
                      <option value="">Tanpa paket / manual</option>
                      {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    id="totalPrice"
                    label="Nilai kontrak (Rp)"
                    required
                    error={errors.totalPrice}
                  >
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-ink-400">
                        Rp
                      </span>
                      <input
                        id="totalPrice"
                        data-field="totalPrice"
                        value={values.totalPrice}
                        onChange={(event) =>
                          update('totalPrice', formatCurrencyInput(parseCurrencyInput(event.target.value)))
                        }
                        inputMode="numeric"
                        placeholder="15.000.000"
                        className={cn(inputClass(Boolean(errors.totalPrice)), 'pl-9 tabular-nums')}
                      />
                    </div>
                  </Field>

                  <Field id="status" label="Status awal" className="sm:col-span-2">
                    <div className="flex flex-wrap gap-1.5">
                      {BOOKING_STATUSES.filter((status) => status !== 'cancelled').map((status) => {
                        const active = values.status === status
                        const meta = BOOKING_STATUS_META[status]
                        return (
                          <button
                            key={status}
                            type="button"
                            data-field="status"
                            onClick={() => update('status', status)}
                            aria-pressed={active}
                            className={cn(
                              'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-meta font-medium ring-1 transition',
                              active
                                ? `${meta.badgeClass} ring-2`
                                : 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-50',
                            )}
                          >
                            <span className={cn('size-1.5 rounded-full', meta.dotClass)} />
                            {meta.label}
                          </button>
                        )
                      })}
                    </div>
                  </Field>

                  <Field
                    id="notes"
                    label="Catatan internal (opsional)"
                    className="sm:col-span-2"
                    hint="Hanya dilihat vendor, tidak tampil di link publik."
                  >
                    <textarea
                      id="notes"
                      data-field="notes"
                      value={values.notes}
                      onChange={(event) => update('notes', event.target.value)}
                      placeholder="Kebutuhan khusus, permintaan klien, atau pengingat."
                      className={textareaClass()}
                    />
                  </Field>
                </div>
              </FormSection>
            </CardBody>
          </Card>
        </div>

        <BookingFormSidebar
          packages={packages}
          selectedPackageId={values.packageId}
          onSelectPackage={selectPackage}
          clientName={clientSelection.name}
          eventDate={values.eventDate}
          eventTime={values.eventTime}
          totalPrice={totalPrice}
          takenDates={takenDates}
        />
      </div>

      <Card>
        <CardFooter className="sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => navigate('/bookings')}>
            Batal
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan booking'}
          </Button>
        </CardFooter>
      </Card>

      <UpgradeModal
        open={trialGate.open}
        onClose={trialGate.close}
        resource="booking"
        trialUsage={trialUsage}
      />
    </form>
  )
}
