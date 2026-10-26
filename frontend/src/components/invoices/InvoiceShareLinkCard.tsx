import { useState } from 'react'
import { Ban, Check, Copy, ExternalLink, Link2, LoaderCircle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import {
  createPublicInvoiceLink,
  disablePublicInvoiceLink,
  resetPublicInvoiceLink,
} from '@/lib/api/public-invoices'

type LinkAction = 'reset' | 'disable'

export function InvoiceShareLinkCard({ invoiceId }: { invoiceId: string }) {
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [savingAction, setSavingAction] = useState(false)
  const [pendingAction, setPendingAction] = useState<LinkAction | null>(null)
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function createLink() {
    setCreating(true)
    setError(null)
    setNotice(null)
    setCopied(false)
    try {
      setPublicUrl(await createPublicInvoiceLink(invoiceId, window.location.origin))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Link invoice gagal dibuat.')
    } finally {
      setCreating(false)
    }
  }

  async function copyLink() {
    if (!publicUrl) return
    setError(null)
    setNotice(null)
    try {
      await copyToClipboard(publicUrl)
      setCopied(true)
    } catch {
      setCopied(false)
      setError('Link siap dibagikan, tetapi gagal disalin. Silakan salin dari kolom link.')
    }
  }

  async function confirmLinkAction() {
    if (!pendingAction) return
    setSavingAction(true)
    setError(null)
    setNotice(null)
    setCopied(false)

    try {
      if (pendingAction === 'reset') {
        setPublicUrl(await resetPublicInvoiceLink(invoiceId, window.location.origin))
        setNotice('Link berhasil direset. Link lama sudah tidak berlaku.')
      } else {
        await disablePublicInvoiceLink(invoiceId)
        setPublicUrl(null)
        setNotice('Link invoice berhasil dinonaktifkan.')
      }
      setPendingAction(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Perubahan link invoice gagal disimpan.')
    } finally {
      setSavingAction(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Link invoice publik"
        description="Bagikan rincian tagihan ini kepada klien."
      />
      <CardBody className="space-y-3">
        {publicUrl ? (
          <>
            <label htmlFor="public-invoice-url" className="sr-only">
              Link invoice publik
            </label>
            <input
              id="public-invoice-url"
              type="url"
              readOnly
              value={publicUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="h-9 w-full rounded-lg border border-ink-200 bg-ink-50 px-3 text-[11px] text-ink-700 outline-none focus:border-brand-400"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={copyLink} disabled={savingAction}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? 'Tersalin' : 'Salin link'}
              </Button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium text-brand-700 hover:bg-brand-50"
              >
                <ExternalLink className="size-3.5" />
                Buka
              </a>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-ink-100 pt-2">
              <button
                type="button"
                onClick={() => setPendingAction('reset')}
                disabled={savingAction}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-500 hover:text-ink-800 disabled:opacity-50"
              >
                <RotateCw className="size-3" />
                Reset link
              </button>
              <button
                type="button"
                onClick={() => setPendingAction('disable')}
                disabled={savingAction}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 hover:text-rose-800 disabled:opacity-50"
              >
                <Ban className="size-3" />
                Nonaktifkan link
              </button>
            </div>
          </>
        ) : (
          <Button type="button" variant="secondary" size="sm" onClick={createLink} disabled={creating}>
            {creating ? <LoaderCircle className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
            {creating ? 'Menyiapkan link…' : 'Buat link publik'}
          </Button>
        )}

        {pendingAction ? (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-[12px] font-semibold text-amber-900">
              {pendingAction === 'reset' ? 'Reset link invoice?' : 'Nonaktifkan link invoice?'}
            </p>
            <p className="text-[11px] leading-relaxed text-amber-800">
              {pendingAction === 'reset'
                ? 'Link saat ini akan langsung tidak berlaku dan diganti dengan link baru.'
                : 'Klien tidak dapat lagi membuka invoice melalui link ini.'}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant={pendingAction === 'disable' ? 'secondary' : 'primary'}
                onClick={confirmLinkAction}
                disabled={savingAction}
                className={pendingAction === 'disable' ? 'text-rose-700 ring-rose-200 hover:bg-rose-50 hover:text-rose-800' : ''}
              >
                {savingAction ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
                {savingAction ? 'Menyimpan…' : pendingAction === 'reset' ? 'Ya, reset link' : 'Ya, nonaktifkan'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setPendingAction(null)}
                disabled={savingAction}
              >
                Batal
              </Button>
            </div>
          </div>
        ) : null}

        <p className="text-[11px] leading-relaxed text-ink-400">
          Klien hanya dapat melihat rincian invoice dan informasi pembayaran yang dibagikan.
        </p>
        {notice ? <p role="status" className="text-[11px] text-emerald-700">{notice}</p> : null}
        {error ? <p role="alert" className="text-[11px] leading-relaxed text-rose-700">{error}</p> : null}
        {copied ? <p role="status" className="text-[11px] text-emerald-700">Link invoice berhasil disalin.</p> : null}
      </CardBody>
    </Card>
  )
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const input = document.createElement('textarea')
  input.value = value
  input.setAttribute('readonly', '')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.append(input)
  input.select()
  const copied = document.execCommand('copy')
  input.remove()
  if (!copied) throw new Error('Clipboard tidak tersedia.')
}
