import { useState } from 'react'
import { Check, Copy, ExternalLink, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'

/**
 * Kartu berbagi link jadwal publik vendor.
 *
 * Calon klien membuka `/jadwal/:slug` tanpa perlu akun. Kartu ini menyediakan
 * link lengkap (bukan hanya slug) supaya vendor bisa langsung menyalinnya ke
 * WhatsApp atau Instagram.
 *
 * Link bersifat publik dan permanen selama slug tidak diubah, jadi tidak ada
 * tombol reset seperti pada link invoice.
 */
export function PublicScheduleLinkCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const url = slug ? `${window.location.origin}/jadwal/${encodeURIComponent(slug)}` : ''

  async function copyLink() {
    if (!url) return
    setError(null)

    const ok = await copyToClipboard(url)

    if (ok) {
      setCopied(true)
      return
    }

    // Gagal menyalin bukan kesalahan aplikasi: kolom di atas tetap bisa
    // diseleksi manual, jadi pesannya mengarahkan ke sana. Teks di kolom
    // sekalian dipilih agar pengguna cukup menekan Ctrl+C / ⌘+C.
    setCopied(false)
    setError('Gagal menyalin otomatis. Silakan salin manual dari kolom di atas.')
    const field = document.getElementById('public-schedule-url') as HTMLInputElement | null
    field?.focus()
    field?.select()
  }

  return (
    <Card>
      <CardHeader
        title="Link jadwal publik"
        description="Bagikan tautan ini agar calon klien bisa melihat tanggal yang masih tersedia."
      />
      <CardBody className="space-y-3">
        {slug ? (
          <>
            <label htmlFor="public-schedule-url" className="sr-only">
              Link jadwal publik
            </label>
            <input
              id="public-schedule-url"
              type="url"
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              className="h-9 w-full rounded-lg border border-ink-200 bg-ink-50 px-3 text-caption text-ink-700 outline-none focus:border-brand-400"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={copyLink}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? 'Tersalin' : 'Salin link'}
              </Button>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-meta font-medium text-brand-700 hover:bg-brand-50"
              >
                <ExternalLink className="size-3.5" />
                Buka
              </a>
            </div>
            <p className="border-t border-ink-100 pt-2 text-caption leading-relaxed text-ink-400">
              Kalender menandai tanggal yang sudah terisi, sehingga calon klien tahu sisa
              tanggal yang tersedia. Nama, kontak, dan nilai transaksi klien tidak pernah
              ditampilkan.
            </p>
          </>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-caption text-ink-500">
            <Link2 className="size-3.5" aria-hidden="true" />
            Tautan publik belum tersedia. Lengkapi profil vendor terlebih dahulu.
          </p>
        )}

        {error ? <p className="text-caption text-rose-700">{error}</p> : null}
      </CardBody>
    </Card>
  )
}

/**
 * Menyalin teks ke clipboard.
 *
 * `navigator.clipboard` hanya tersedia pada konteks aman (HTTPS atau
 * localhost). Saat diakses lewat IP biasa, API itu tidak ada sehingga dipakai
 * `document.execCommand` sebagai cadangan.
 *
 * Nilai balik: `true` bila berhasil. Pemanggil yang menentukan pesan galatnya,
 * karena kegagalan di sini bukan kesalahan aplikasi — pengguna tetap bisa
 * menyalin manual dari kolom teks.
 */
async function copyToClipboard(value: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // lanjut ke cara lama
    }
  }

  const helper = document.createElement('textarea')
  helper.value = value
  helper.setAttribute('readonly', '')
  helper.style.position = 'fixed'
  helper.style.top = '0'
  helper.style.left = '0'
  helper.style.opacity = '0'
  document.body.appendChild(helper)

  // iOS butuh selection range eksplisit.
  helper.focus()
  helper.select()
  helper.setSelectionRange(0, value.length)

  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }

  document.body.removeChild(helper)

  return ok
}
