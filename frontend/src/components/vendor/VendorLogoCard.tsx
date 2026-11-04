import { useId, useRef, useState } from 'react'
import { LoaderCircle, Plus, Trash2 } from '@/components/ui/icons'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import {
  VENDOR_LOGO_MAX_BYTES,
  VENDOR_LOGO_TYPES,
  deleteVendorLogo,
  logoUrlFromPath,
  uploadVendorLogo,
} from '@/lib/api/vendor-logo'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

/**
 * Kartu unggah logo usaha.
 *
 * Dipakai di halaman Pengaturan (profil usaha), terpisah dari form profil
 * karena bentuk request-nya berbeda: profil mengirim JSON lewat satu
 * `handleSubmit`, sedangkan logo butuh `multipart/form-data` dan punya
 * state unggah sendiri (berjalan / gagal). Menyatu dengan form profil hanya
 * membuat satu tombol "Simpan" menanggung dua kegagalan yang tak berhubungan.
 *
 * Logo yang tampil di kepala invoice (web dan PDF) berasal dari berkas ini.
 */
export function VendorLogoCard({
  logoPath,
  businessName,
  onSaved,
}: {
  /** Path relatif dari API, bukan URL. */
  logoPath: string | null
  businessName: string
  /** Dipanggil setelah path logo berubah, supaya induk ikut menyegarkan data. */
  onSaved: (path: string | null) => void
}) {
  const { notify } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const [busy, setBusy] = useState(false)

  const logoUrl = logoUrlFromPath(logoPath)

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    // Reset nilai input supaya memilih berkas yang sama tetap memicu onChange.
    event.target.value = ''

    if (!VENDOR_LOGO_TYPES.includes(file.type)) {
      notify('Logo harus PNG, JPG, atau WebP.', { tone: 'error' })
      return
    }
    if (file.size > VENDOR_LOGO_MAX_BYTES) {
      notify('Ukuran logo maksimal 2 MB.', { tone: 'error' })
      return
    }

    setBusy(true)
    try {
      const path = await uploadVendorLogo(file)
      onSaved(path)
      notify('Logo tersimpan.', { tone: 'success' })
    } catch {
      notify('Logo gagal diunggah. Coba lagi.', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    setBusy(true)
    try {
      await deleteVendorLogo()
      onSaved(null)
      notify('Logo dihapus.', { tone: 'success' })
    } catch {
      notify('Logo gagal dihapus. Coba lagi.', { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Logo Usaha"
        description="Muncul di kepala invoice yang kamu kirim ke klien. PNG, JPG, atau WebP — maksimal 2 MB."
      />
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span
          className={cn(
            'flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl',
            'border border-ink-200 bg-white',
          )}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" className="size-full object-contain" />
          ) : (
            <span className="text-lead font-semibold text-ink-400">
              {initials(businessName)}
            </span>
          )}
        </span>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? <LoaderCircle className="size-3.5" /> : <Plus className="size-3.5" />}
              {logoUrl ? 'Ganti logo' : 'Unggah logo'}
            </Button>

            {logoUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={handleRemove}
              >
                <Trash2 className="size-3.5" />
                Hapus
              </Button>
            ) : null}
          </div>

          <p className="text-caption text-ink-400">
            Kalau belum diisi, invoice memakai inisial nama usaha.
          </p>
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={VENDOR_LOGO_TYPES.join(',')}
          className="sr-only"
          onChange={handleFile}
          tabIndex={-1}
          aria-hidden="true"
        />
      </CardBody>
    </Card>
  )
}
