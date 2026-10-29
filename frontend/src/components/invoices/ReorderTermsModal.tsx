import { useEffect, useRef, useState } from 'react'
import { ArrowUpDown, Check } from '@/components/ui/icons'
import { Button } from '@/components/ui/Button'
import { inputClass } from '@/components/ui/Field'
import { useRestoreFocus } from '@/lib/use-restore-focus'
import { INVOICE_TYPE_META } from '@/lib/invoice-status'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'
import { reorderInvoiceTerms } from '@/lib/api/invoices'
import { ApiError } from '@/lib/api/client'
import type { Invoice } from '@/types/invoice'

/**
 * Dialog susun ulang nomor term invoice pada satu booking.
 *
 * Vendor bisa menukar urutan term kapan saja — misalnya kalau pelunasan
 * diterbitkan lebih dulu dan seharusnya menjadi term 3, bukan term 1. Nomor
 * term harus unik dalam satu booking; duplikat ditolak sebelum dikirim.
 */
export function ReorderTermsModal({
  open,
  onClose,
  bookingId,
  invoices,
  onReordered,
}: {
  open: boolean
  onClose: () => void
  bookingId: string
  invoices: Invoice[]
  onReordered: (invoices: Invoice[]) => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  const [terms, setTerms] = useState<{ id: string; termNumber: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTerms(
        [...invoices]
          .sort((a, b) => (a.term?.term ?? 1) - (b.term?.term ?? 1))
          .map((inv) => ({
            id: inv.id,
            termNumber: String(inv.term?.term ?? 1),
          })),
      )
      setError(null)
    }
  }, [open, invoices])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  /** Nomor term yang sudah dipakai — untuk deteksi duplikat sebelum submit. */
  const numbers = terms.map((t) => Number.parseInt(t.termNumber, 10))
  const duplicates = numbers.filter(
    (n, i) => Number.isFinite(n) && numbers.indexOf(n) !== i,
  )
  const hasDuplicate = duplicates.length > 0
  const hasInvalid = numbers.some((n) => !Number.isFinite(n) || n < 1 || n > 50)

  function updateTerm(id: string, value: string) {
    setTerms((prev) => prev.map((t) => (t.id === id ? { ...t, termNumber: value } : t)))
  }

  async function handleSave() {
    if (hasDuplicate) {
      setError('Nomor term tidak boleh sama dalam satu booking.')
      return
    }
    if (hasInvalid) {
      setError('Nomor term harus angka 1–50.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const reordered = await reorderInvoiceTerms(
        bookingId,
        terms.map((t) => ({ id: t.id, term_number: Number.parseInt(t.termNumber, 10) })),
      )
      onReordered(reordered)
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Terjadi kesalahan tak terduga.')
      }
    } finally {
      setSaving(false)
    }
  }

  const sortedInvoices = [...invoices].sort(
    (a, b) => (a.term?.term ?? 1) - (b.term?.term ?? 1),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reorder-terms-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl bg-white shadow-xl outline-none"
      >
        <div className="border-b border-ink-100 px-5 py-4">
          <h2 id="reorder-terms-title" className="text-lead font-semibold text-ink-900">
            Atur urutan term
          </h2>
          <p className="mt-0.5 text-meta text-ink-500">
            Tukar urutan term tanpa mengubah nominal atau status pembayaran.
          </p>
        </div>

        <div className="space-y-2.5 px-5 py-4">
          {sortedInvoices.map((inv, index) => {
            const row = terms[index]
            if (!row) return null
            const num = Number.parseInt(row.termNumber, 10)
            const isDup = Number.isFinite(num) && duplicates.includes(num)

            return (
              <div key={inv.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-meta font-medium text-ink-800">
                    {INVOICE_TYPE_META[inv.type].label}
                  </p>
                  <p className="truncate text-caption text-ink-400">
                    {inv.number} · {formatCurrency(inv.amount)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-caption text-ink-400">Term</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    step={1}
                    value={row.termNumber}
                    onChange={(e) => updateTerm(row.id, e.target.value)}
                    aria-label={`Nomor term untuk ${INVOICE_TYPE_META[inv.type].label} ${inv.number}`}
                    className={cn(
                      inputClass(Boolean(isDup || (row.termNumber && (!Number.isFinite(num) || num < 1 || num > 50)))),
                      'w-16 text-center tabular-nums',
                    )}
                  />
                </div>
              </div>
            )
          })}

          {error ? (
            <p className="text-meta text-rose-700">{error}</p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || hasDuplicate || hasInvalid}>
            <Check className="size-3.5" />
            {saving ? 'Menyimpan…' : 'Simpan urutan'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Tombol pemicu dialog reorder. */
export function ReorderTermsButton({
  bookingId,
  invoices,
  onReordered,
}: {
  bookingId: string
  invoices: Invoice[]
  onReordered: (invoices: Invoice[]) => void
}) {
  const [open, setOpen] = useState(false)
  const captureFocus = useRestoreFocus(open)

  if (invoices.length < 2) return null

  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={captureFocus(() => setOpen(true))}>
        <ArrowUpDown className="size-3.5" />
        Atur urutan term
      </Button>
      <ReorderTermsModal
        open={open}
        onClose={() => setOpen(false)}
        bookingId={bookingId}
        invoices={invoices}
        onReordered={onReordered}
      />
    </>
  )
}
