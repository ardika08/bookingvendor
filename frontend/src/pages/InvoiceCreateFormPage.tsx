import { AlertTriangle, ArrowLeft, CalendarDays, FileText, Info, Lock, Receipt } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SubmitErrorBanner } from '@/components/bookings/SubmitErrorBanner'
import { UpgradeModal } from '@/components/upgrade/UpgradeModal'
import { useTrialUpgradeGate } from '@/hooks/useTrialUpgradeGate'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card'
import { Field, inputClass } from '@/components/ui/Field'
import { ApiError } from '@/lib/api/client'
import {
  initialInvoiceForm,
  invoiceAmountBreakdown,
  mapInvoiceServerErrors,
  remainingToBill,
  splitInvoiceAmount,
  suggestedAmount,
  toInvoicePayload,
  validateInvoiceForm,
  type InvoiceFormErrors,
  type InvoiceFormValues,
  type InvoicePayload,
} from '@/lib/invoice-form'
import { formatCurrencyInput } from '@/lib/booking-form'
import { formatCurrency, formatLongDate, formatShortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { INVOICE_TYPE_META } from '@/lib/invoice-status'
import { toIsoDate } from '@/lib/format'
import { INVOICE_TYPES, type Invoice, type InvoiceType } from '@/types/invoice'
import type { Booking } from '@/types/booking'

/**
 * Formulir pembuatan invoice dari booking (`/bookings/:id/invoice/new`).
 *
 * Invoice selalu terikat ke satu booking, jadi klien, acara, dan nilai kontrak
 * ditampilkan sebagai konteks baca-saja — vendor hanya memilih jenis tagihan,
 * nominal, dan tanggal. Nominal awal mengikuti sisa kontrak yang belum
 * ditagihkan; memilih DP/Pelunasan mengisi ulang nominal sesuai pembagian 40/60.
 *
 * Alur submit mengikuti form booking: validasi lokal (fokus ke field pertama
 * yang salah) → `POST /api/bookings/{id}/invoices` → `trial_limit_reached`
 * membuka `UpgradeModal` tanpa menghapus isian, error lain masuk banner.
 */
export function InvoiceCreateFormPage({
  booking,
  existingInvoices = [],
  invoicesUsed = 0,
  invoicesLimit = null,
  onSubmit,
}: {
  booking: Booking
  /** Invoice yang sudah terbit untuk booking ini (dasar perhitungan sisa). */
  existingInvoices?: Invoice[]
  /** Jumlah invoice trial yang sudah terpakai (0 bila sudah berlangganan). */
  invoicesUsed?: number
  /** Batas invoice trial; null = tanpa batas (langganan aktif). */
  invoicesLimit?: number | null
  onSubmit?: (payload: InvoicePayload) => Promise<Invoice | void>
}) {
  const navigate = useNavigate()
  const trialExhausted = invoicesLimit !== null && invoicesUsed >= invoicesLimit
  const trialLeft = invoicesLimit === null ? null : Math.max(invoicesLimit - invoicesUsed, 0)
  const billedAmounts = useMemo(
    () => existingInvoices.filter((item) => item.status !== 'void').map((item) => item.amount),
    [existingInvoices],
  )
  const remaining = remainingToBill(booking, billedAmounts)

  const [values, setValues] = useState<InvoiceFormValues>(() =>
    initialInvoiceForm(booking, toIsoDate(new Date()), billedAmounts),
  )
  const [errors, setErrors] = useState<InvoiceFormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<ApiError | Error | null>(null)
  const trialGate = useTrialUpgradeGate(trialExhausted)
  const formRef = useRef<HTMLFormElement>(null)

  const amount = useMemo(
    () => Number.parseInt(values.amount.replace(/[^\d]/g, '') || '0', 10),
    [values.amount],
  )
  const breakdown = useMemo(
    () => invoiceAmountBreakdown(booking, billedAmounts, amount),
    [booking, billedAmounts, amount],
  )

  function update<K extends keyof InvoiceFormValues>(key: K, value: InvoiceFormValues[K]) {
    const next = { ...values, [key]: value }
    setValues(next)
    if (submitted) setErrors(validateInvoiceForm(next, booking, billedAmounts))
  }

  /** Pilih jenis tagihan → nominal otomatis mengikuti kalkulasi sisa kontrak. */
  function selectType(type: InvoiceType) {
    setValues((prev) => {
      const next = {
        ...prev,
        type,
        amount: formatCurrencyInput(suggestedAmount(booking, type, billedAmounts)),
      }
      if (submitted) setErrors(validateInvoiceForm(next, booking, billedAmounts))
      return next
    })
  }

  function handleAmountChange(raw: string) {
    const digits = raw.replace(/[^\d]/g, '')
    update('amount', digits ? new Intl.NumberFormat('id-ID').format(Number.parseInt(digits, 10)) : '')
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    setSubmitError(null)

    const nextErrors = validateInvoiceForm(values, booking, billedAmounts)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      const first = Object.keys(nextErrors)[0] as keyof InvoiceFormValues
      formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus()
      return
    }

    setSaving(true)
    try {
      const created = await onSubmit?.(toInvoicePayload(values))
      setNotice(`Invoice ${created?.number ?? ''} terbit — membuka rincian…`.trim())
      window.setTimeout(
        () => navigate(created?.id ? `/invoices/${created.id}` : '/invoices'),
        700,
      )
    } catch (error) {
      handleSubmitError(error)
    } finally {
      setSaving(false)
    }
  }

  function handleSubmitError(error: unknown) {
    if (error instanceof ApiError) {
      if (trialGate.handleSubmitError(error)) return
      if (Object.keys(error.fieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...mapInvoiceServerErrors(error.fieldErrors) }))
      }
      setSubmitError(error)
      return
    }
    setSubmitError(error instanceof Error ? error : new Error('Terjadi kesalahan tak terduga.'))
  }

  const errorCount = Object.keys(errors).length

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to={`/bookings/${booking.id}`}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 hover:text-ink-800"
          >
            <ArrowLeft className="size-3.5" />
            Detail booking
          </Link>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink-900">Buat Invoice</h2>
          <p className="text-[13px] text-ink-500">
            {booking.client.name} · {formatLongDate(booking.eventDate)}
          </p>
        </div>
      </div>

      {notice ? (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12.5px] text-emerald-800">
          <Receipt className="mt-0.5 size-4 shrink-0" />
          {notice}
        </div>
      ) : null}

      {trialLeft !== null ? (
        trialExhausted ? (
          <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-amber-900">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <span className="font-semibold">Jatah trial invoice habis.</span> Form tetap bisa
                diisi, tetapi penerbitan ditolak server sampai kamu berlangganan.
              </span>
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={trialGate.reopen}
              className="shrink-0"
            >
              Lihat paket
            </Button>
          </div>
        ) : trialLeft <= 1 ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-[12.5px] text-amber-900">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <span className="font-semibold">Sisa {trialLeft} invoice trial.</span> Setelah jatah
              habis, penerbitan invoice butuh langganan aktif.
            </span>
          </div>
        ) : null
      ) : null}

      {submitted && errorCount > 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
          <p className="text-[12.5px] text-rose-800">
            {errorCount} isian perlu diperbaiki sebelum invoice bisa diterbitkan.
          </p>
        </div>
      ) : null}

      <SubmitErrorBanner error={submitError} onDismiss={() => setSubmitError(null)} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Jenis Tagihan"
              description="DP biasanya 40% dari kontrak, pelunasan menutup sisanya."
            />
            <CardBody>
              <div className="grid gap-2 sm:grid-cols-2">
                {INVOICE_TYPES.map((type) => {
                  const active = values.type === type
                  const meta = INVOICE_TYPE_META[type]
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => selectType(type)}
                      aria-pressed={active}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-left transition-colors',
                        active
                          ? 'border-brand-300 bg-brand-50'
                          : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50',
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-900">
                        <FileText className="size-3.5" />
                        {meta.label}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-500">
                        {meta.description}
                      </span>
                      <span className="mt-1 block text-[11.5px] tabular-nums text-ink-600">
                        Default {formatCurrency(splitInvoiceAmount(booking.totalPrice, type))}
                      </span>
                    </button>
                  )
                })}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Nominal & Tanggal" />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <Field
                id="invoiceAmount"
                label="Nominal tagihan"
                required
                error={errors.amount}
                hint={`Sisa kontrak yang belum ditagihkan: ${formatCurrency(remaining)}`}
                className="sm:col-span-2"
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-400">
                    Rp
                  </span>
                  <input
                    id="invoiceAmount"
                    data-field="amount"
                    value={values.amount}
                    onChange={(event) => handleAmountChange(event.target.value)}
                    inputMode="numeric"
                    placeholder="6.000.000"
                    className={cn(inputClass(Boolean(errors.amount)), 'pl-9 tabular-nums')}
                  />
                </div>
              </Field>

              <Field id="invoiceIssuedAt" label="Tanggal terbit" required error={errors.issuedAt}>
                <input
                  id="invoiceIssuedAt"
                  data-field="issuedAt"
                  type="date"
                  value={values.issuedAt}
                  onChange={(event) => update('issuedAt', event.target.value)}
                  className={inputClass(Boolean(errors.issuedAt))}
                />
              </Field>

              <Field id="invoiceDueAt" label="Jatuh tempo" required error={errors.dueAt}>
                <input
                  id="invoiceDueAt"
                  data-field="dueAt"
                  type="date"
                  value={values.dueAt}
                  onChange={(event) => update('dueAt', event.target.value)}
                  className={inputClass(Boolean(errors.dueAt))}
                />
              </Field>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border border-ink-200/80 bg-white p-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-400">
              Ringkasan invoice
            </h3>
            <dl className="mt-3 space-y-2 text-[12.5px]">
              <SummaryRow label="Klien" value={booking.client.name} />
              <SummaryRow
                label="Acara"
                value={formatShortDate(booking.eventDate)}
                mono
              />
              <SummaryRow label="Paket" value={booking.packageName ?? 'Tanpa paket'} />
              <SummaryRow label="Nilai kontrak" value={formatCurrency(booking.totalPrice)} />
              <SummaryRow
                label="Jenis"
                value={INVOICE_TYPE_META[values.type].label}
              />
              <SummaryRow label="Nominal" value={formatCurrency(amount)} strong mono />
              {values.dueAt ? (
                <SummaryRow
                  label="Jatuh tempo"
                  value={formatShortDate(values.dueAt)}
                  mono
                />
              ) : null}
            </dl>

            <div className="mt-3 space-y-1.5 border-t border-ink-100 pt-3 text-[11.5px]">
              <BreakdownRow label="Sudah ditagihkan" value={formatCurrency(breakdown.billed)} />
              <BreakdownRow label="Sisa kontrak" value={formatCurrency(breakdown.remaining)} />
              <BreakdownRow
                label="Sisa setelah invoice ini"
                value={formatCurrency(breakdown.afterThis)}
                tone={breakdown.afterThis > 0 ? 'amber' : 'emerald'}
              />
            </div>
          </div>

          {existingInvoices.length > 0 ? (
            <div className="rounded-xl border border-ink-200/80 bg-white p-4">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-400">
                Invoice sebelumnya
              </h3>
              <ul className="mt-2 space-y-1.5">
                {existingInvoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex items-baseline justify-between gap-2 text-[12px]"
                  >
                    <span className="truncate text-ink-600">
                      {INVOICE_TYPE_META[invoice.type].label}
                    </span>
                    <span className="shrink-0 tabular-nums text-ink-700">
                      {formatCurrency(invoice.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
            <Info className="mt-0.5 size-3.5 shrink-0 text-sky-600" />
            <p className="text-[11.5px] leading-relaxed text-sky-900">
              Invoice diterbitkan langsung dengan nomor urut otomatis. Tautan pembayaran untuk klien
              dibuat pada tahap berikutnya.
            </p>
          </div>
        </aside>
      </div>

      <Card>
        <CardFooter className="sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/bookings/${booking.id}`)}
          >
            Batal
          </Button>
          <Button type="submit" disabled={saving}>
            <CalendarDays className="size-3.5" />
            {saving ? 'Menerbitkan…' : 'Terbitkan invoice'}
          </Button>
        </CardFooter>
      </Card>

      <UpgradeModal
        open={trialGate.open}
        onClose={trialGate.close}
        resource="invoice"
        trialUsage={{ invoicesUsed, invoicesLimit: invoicesLimit ?? undefined }}
      />
    </form>
  )
}

function SummaryRow({
  label,
  value,
  strong,
  mono,
}: {
  label: string
  value: string
  strong?: boolean
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd
        className={cn(
          'truncate text-right',
          strong ? 'font-semibold text-ink-900' : 'text-ink-800',
          mono && 'tabular-nums',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

/** Baris kecil rincian kalkulasi nominal (sudah ditagihkan → sisa). */
function BreakdownRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'amber' | 'emerald'
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <span
        className={cn(
          'shrink-0 tabular-nums',
          tone === 'amber'
            ? 'font-medium text-amber-700'
            : tone === 'emerald'
              ? 'font-medium text-emerald-700'
              : 'text-ink-700',
        )}
      >
        {value}
      </span>
    </div>
  )
}
