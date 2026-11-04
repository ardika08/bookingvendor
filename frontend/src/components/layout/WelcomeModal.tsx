import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check } from '@/components/ui/icons'
import { Button } from '@/components/ui/Button'
import { useRestoreFocus } from '@/lib/use-restore-focus'

/**
 * Modal sambutan untuk vendor yang baru pertama kali masuk dashboard.
 *
 * Muncul SEKALI per akun: penanda "sudah pernah lihat" disimpan di
 * localStorage dengan kunci yang memuat id user, jadi akun lain di browser
 * yang sama tetap mendapat sambutannya sendiri. Membersihkan data browser
 * membuat modal muncul lagi — itu bisa diterima untuk pesan sekali-lihat.
 *
 * Isinya menjawab tiga pertanyaan vendor baru: masa testing ini bebas
 * sampai kapan, apa saja yang bisa dicoba, dan ke mana melapor bila
 * menemukan bug atau ingin minta fitur.
 */
export function WelcomeModal({
  user,
  trialDaysLeft,
  supportUrl,
}: {
  user: { id: string; name: string; businessName: string | null }
  trialDaysLeft: number | null
  supportUrl: string
}) {
  const [open, setOpen] = useState(false)
  const captureFocus = useRestoreFocus(open)
  const dialogRef = useRef<HTMLDivElement>(null)

  const storageKey = `vendorkit.welcome-seen.${user.id}`

  useEffect(() => {
    // Tunda satu tick agar layout dashboard selesai dirender lebih dulu —
    // modal yang muncul di frame pertama terasa "melompat".
    const t = window.setTimeout(() => {
      try {
        if (window.localStorage.getItem(storageKey) === null) setOpen(true)
      } catch {
        // localStorage bisa diblokir (mode privat). Modal tetap tampil:
        // lebih baik sapaan muncul tiap login daripada tidak pernah.
        setOpen(true)
      }
    }, 300)
    return () => window.clearTimeout(t)
  }, [storageKey])

  useEffect(() => {
    if (!open) return
    dialogRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey, new Date().toISOString())
    } catch {
      // Gagal menyimpan: modal akan muncul lagi di login berikutnya. Tidak
      // fatal — jangan sampai tombol "Mengerti" terasa mati.
    }
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        tabIndex={-1}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-xl focus:outline-none sm:rounded-2xl"
      >
        <div className="border-b border-ink-100 px-5 py-4">
          <p className="text-caption font-medium text-brand-700">
            Selamat datang di VendorKit
          </p>
          <h2 id="welcome-title" className="mt-0.5 text-lead font-semibold text-ink-900">
            Hai{user.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
          </h2>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-body leading-relaxed text-ink-700">
            VendorKit sedang masa testing — dan kamu bisa{' '}
            <span className="font-semibold text-ink-900">pakai semua fitur gratis</span>
            {typeof trialDaysLeft === 'number'
              ? ` (sisa ${trialDaysLeft} hari masa uji kamu)`
              : ''}
            .
          </p>
          <ul className="space-y-1.5 text-meta leading-relaxed text-ink-600">
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />
              Buat booking &amp; invoice tanpa batas
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />
              Halaman jadwal publik untuk klien
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />
              Semua fitur lain yang ada di menu
            </li>
          </ul>
          <div className="rounded-lg border border-brand-200 bg-brand-50/60 px-3.5 py-3">
            <p className="text-meta leading-relaxed text-ink-700">
              <span className="font-semibold text-ink-900">Menemukan bug atau mau minta fitur?</span>{' '}
              Kabari kami lewat grup Telegram — kamu dibantu langsung.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-ink-100 px-5 py-4 sm:flex-row-reverse">
          <Button onClick={captureFocus(dismiss)} className="w-full sm:w-auto">
            <Check className="size-3.5" />
            Mengerti, mulai pakai
          </Button>
          {supportUrl !== '' ? (
            <a
              href={supportUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-body font-medium text-ink-700 ring-1 ring-ink-200 transition-colors hover:bg-ink-50 sm:w-auto"
            >
              <AlertCircle className="size-3.5" />
              Grup Telegram
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
