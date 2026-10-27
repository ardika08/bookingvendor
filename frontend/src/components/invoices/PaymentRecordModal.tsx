import { Banknote, CalendarDays, X } from '@/components/ui/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, inputClass, textareaClass } from '@/components/ui/Field'
import { ApiError } from '@/lib/api/client'
import { SubmitErrorBanner } from '@/components/bookings/SubmitErrorBanner'
import { formatCurrency, toIsoDate } from '@/lib/format'
import { remainingAmount } from '@/lib/invoice-status'
import { cn } from '@/lib/cn'
import type { Invoice } from '@/types/invoice'
import type { PaymentPayload } from '@/lib/payment-form'
import { validatePaymentForm, type PaymentFormErrors } from '@/lib/payment-form'

/**
 * Modal pencatatan pembayaran invoice.
 *
 * Vendor mencatat pembayaran yang benar-benar masuk (transfer/QRIS/tunai) untuk
 * satu invoice. Nominal awal = sisa tagihan sehingga aksi paling sering (pelunasan
 * penuh) cukup satu klik; nominal bisa diturunkan untuk pembayaran bertahap.
 *
 * Aturan validasi mengikuti API: nominal > 0, tidak melebihi sisa tagihan,
 * tanggal bayar wajib, metode wajib. Invoice `void`/`paid` tidak bisa dicatat.
 */
export function PaymentRecordModal({
  open,
  invoice,
  onClose,
  onSubmit,
}: {
  open: boolean
  invoice: Invoice
  onClose: () => void
  /** Simpan ke API; melempar error untuk ditampilkan di banner. */
  onSubmit?: (payload: PaymentPayload) => Promise<void>
}) {
  const remaining = remainingAmount(invoice)
  const [amount, setAmount] = useState(() => formatThousands(remaining))
  const [paidAt, setPaidAt] = useState(() => toIsoDate(new Date()))
  const [method, setMethod] = useState<PaymentPayload['method']>('transfer')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<PaymentFormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<ApiError | Error | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const values = useMemo(
    () => ({ invoiceId: invoice.id, amount, paidAt, method, note }),
    [invoice.id, amount, paidAt, method, note],
  )

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  function handleAmountChange(raw: string) {
    const digits = raw.replace(/[^\d]/g, '')
    setAmount(digits ? formatThousands(Number.parseInt(digits, 10)) : '')
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)

    const nextErrors = validatePaymentForm(values, invoice)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      const first = Object.keys(nextErrors)[0]
      formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus()
      return
    }

    setSubmitting(true)
    try {
      await onSubmit?.(toPaymentPayload(values))
      onClose()
    } catch (error) {
      setSubmitError(error instanceof Error ? error : new Error('Gagal menyimpan pembayaran.'))
    } finally {
      setSubmitting(false)
    }
  }

  const isPaid = invoice.status === 'paid'
  const isVoid = invoice.status === 'void'
  const blocked = isPaid || isVoid

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-title"
        className="relative w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start gap-2 border-b border-ink-100 px-5 py-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Banknote className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="payment-title" className="text-lead font-semibold text-ink-900">
              Catat pembayaran
            </h2>
            <p className="truncate text-meta text-ink-500">
              {invoice.number} · {invoice.clientName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            aria-label="Tutup modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {blocked ? (
          <div className="px-5 py-5">
            <p className="text-body leading-relaxed text-ink-600">
              {isPaid
                ? 'Invoice ini sudah lunas — tidak ada sisa yang perlu dicatat.'
                : 'Invoice ini dibatalkan, jadi pembayaran tidak bisa dicatat.'}
            </p>
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={onClose}>
                Tutup
              </Button>
            </div>
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} noValidate>
            <div className="space-y-3 px-5 py-4">
              <div className="rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2 text-meta">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-ink-500">Sisa tagihan</span>
                  <span className="font-semibold tabular-nums text-ink-900">
                    {formatCurrency(remaining)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-3">
                  <span className="text-ink-500">Nilai invoice</span>
                  <span className="tabular-nums text-ink-600">
                    {formatCurrency(invoice.amount)}
                  </span>
                </div>
              </div>

              <SubmitErrorBanner error={submitError} onDismiss={() => setSubmitError(null)} />

              <Field
                id="paymentAmount"
                label="Nominal diterima"
                required
                error={errors.amount}
                hint="Kurangi bila klien membayar sebagian."
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-ink-400">
                    Rp
                  </span>
                  <input
                    id="paymentAmount"
                    data-field="amount"
                    value={amount}
                    onChange={(event) => handleAmountChange(event.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                    className={cn(inputClass(Boolean(errors.amount)), 'pl-9 tabular-nums')}
                  />
                </div>
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="paymentDate" label="Tanggal bayar" required error={errors.paidAt}>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
                    <input
                      id="paymentDate"
                      data-field="paidAt"
                      type="date"
                      value={paidAt}
                      onChange={(event) => setPaidAt(event.target.value)}
                      className={inputClass(Boolean(errors.paidAt))}
                    />
                  </div>
                </Field>

                <Field id="paymentMethod" label="Metode" required error={errors.method}>
                  <select
                    id="paymentMethod"
                    data-field="method"
                    value={method}
                    onChange={(event) => setMethod(event.target.value as PaymentPayload['method'])}
                    className={inputClass(Boolean(errors.method))}
                  >
                    <option value="transfer">Transfer bank</option>
                    <option value="qris">QRIS</option>
                    <option value="cash">Tunai</option>
                    <option value="other">Lainnya</option>
                  </select>
                </Field>
              </div>

              <Field
                id="paymentNote"
                label="Catatan (opsional)"
                error={errors.note}
                hint="Mis. nama pengirim atau nomor referensi transfer."
              >
                <textarea
                  id="paymentNote"
                  data-field="note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  placeholder="Transfer dari rekening a.n. Rani"
                  className={textareaClass(Boolean(errors.note))}
                />
              </Field>
            </div>

            <div className="flex flex-col gap-2 border-t border-ink-100 px-5 py-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={onClose}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Menyimpan…' : 'Simpan pembayaran'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

/** `6000000` → `6.000.000` untuk input teks. */
function formatThousands(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  return new Intl.NumberFormat('id-ID').format(value)
}

/** Bentuk payload disimpan di `lib/payment-form` agar bisa dipakai ulang API layer. */
function toPaymentPayload(values: {
  invoiceId: string
  amount: string
  paidAt: string
  method: PaymentPayload['method']
  note: string
}): PaymentPayload {
  const digits = values.amount.replace(/[^\d]/g, '')
  return {
    invoice_id: values.invoiceId,
    amount: digits ? Number.parseInt(digits, 10) : 0,
    paid_at: values.paidAt,
    method: values.method,
    note: values.note.trim() || null,
  }
}
