import { Ticket, LoaderCircle, CircleCheck } from '@/components/ui/icons'
import { useCallback, useEffect, useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Field, inputClass } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import {
  claimVoucher,
  fetchVoucherHistory,
  type VoucherHistoryItem,
} from '@/lib/api/voucher-claim'
import { cn } from '@/lib/cn'

/**
 * Kolom klaim voucher di halaman Langganan.
 *
 * Hanya menangani voucher "gratis N bulan" — klaim langsung menambah masa
 * aktif. Voucher potongan harga tidak muncul di sini karena baru berlaku saat
 * checkout; menampilkannya di sini akan membuat vendor mengira potongan
 * langsung diberikan.
 *
 * Riwayat ditampilkan supaya vendor tahu kode apa saja yang sudah dipakai dan
 * tidak mencoba kode yang sama berulang kali.
 */
export function VoucherClaimCard({ onClaimed }: { onClaimed?: () => void }) {
  const { notify } = useToast()
  const idBase = useId()
  const codeId = `${idBase}-code`
  const errorId = `${idBase}-error`

  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<VoucherHistoryItem[]>([])
  const [justClaimed, setJustClaimed] = useState<string | null>(null)

  const loadHistory = useCallback((signal?: AbortSignal) => {
    return fetchVoucherHistory(signal)
      .then(setHistory)
      .catch(() => {
        /* Riwayat bersifat informasi; kegagalannya tidak boleh mengganggu
           form klaim. */
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadHistory(controller.signal)
    return () => controller.abort()
  }, [loadHistory])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const trimmed = code.trim()
    if (trimmed === '') {
      setError('Masukkan kode voucher dulu.')
      return
    }

    setSubmitting(true)
    setError(null)
    setJustClaimed(null)

    try {
      const result = await claimVoucher(trimmed)
      const months = result.granted_months

      notify(
        months
          ? `Voucher ${result.code} berhasil. Masa aktif bertambah ${months} bulan.`
          : `Voucher ${result.code} berhasil dipakai.`,
        { tone: 'success' },
      )

      setCode('')
      setJustClaimed(result.code)
      await loadHistory()
      onClaimed?.()
    } catch (cause) {
      /*
       * Pesan dari backend sudah spesifik ("sudah pernah dipakai", "kuota
       * habis", "kedaluwarsa"). Diteruskan apa adanya — pesan generik
       * "kode tidak valid" akan membuat vendor mencoba berulang kali tanpa
       * tahu apa yang salah.
       */
      const message =
        cause instanceof Error && 'fieldErrors' in cause
          ? ((cause as { fieldErrors?: Record<string, string> }).fieldErrors?.code ??
            cause.message)
          : cause instanceof Error
            ? cause.message
            : 'Gagal memakai voucher.'

      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Punya kode voucher?"
        description="Masukkan kode dari admin. Masa aktif langsung bertambah tanpa pembayaran."
      />
      <CardBody className="space-y-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Field
              id={codeId}
              label="Kode voucher"
              error={error ?? undefined}
              errorId={errorId}
            >
              <input
                id={codeId}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase())
                  if (error) setError(null)
                }}
                placeholder="GRATIS1BULAN"
                className={cn(inputClass(Boolean(error)), 'font-mono tracking-wide')}
                aria-describedby={error ? errorId : undefined}
                aria-invalid={error ? true : undefined}
                autoComplete="off"
                spellCheck={false}
                disabled={submitting}
              />
            </Field>
          </div>
          <div className="sm:pt-[1.375rem]">
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Memeriksa…
                </>
              ) : (
                <>
                  <Ticket className="size-4" />
                  Pakai kode
                </>
              )}
            </Button>
          </div>
        </form>

        {justClaimed && (
          <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <p className="text-caption leading-snug text-emerald-900">
              Voucher <strong>{justClaimed}</strong> berhasil dipakai. Masa aktif kamu sudah
              bertambah.
            </p>
          </div>
        )}

        {history.length > 0 && (
          <div>
            <p className="mb-1.5 text-caption font-medium text-ink-600">Voucher yang sudah dipakai</p>
            <ul className="space-y-1">
              {history.map((item, i) => (
                <li
                  key={`${item.code}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-ink-50 px-3 py-2"
                >
                  <code className="font-mono text-caption font-semibold text-ink-700">
                    {item.code}
                  </code>
                  <span className="text-caption text-ink-500">
                    {item.granted_months ? `+${item.granted_months} bulan` : 'Potongan harga'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
