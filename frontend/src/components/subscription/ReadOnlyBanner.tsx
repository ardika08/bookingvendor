import { ArrowRight, BookOpenCheck, Lock } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import {
  readOnlyDescription,
  readOnlyHeadline,
  type AccessState,
} from '@/lib/subscription-access'

/**
 * Banner mode baca-saja di atas halaman vendor.
 *
 * Muncul saat langganan berakhir. Menjelaskan bahwa data lama masih bisa
 * dibaca/diekspor (sesuai PRD) dan memberi satu jalan keluar: perpanjang paket.
 * Diletakkan sebelum konten supaya vendor paham kenapa tombol pembuatan data
 * tidak bisa dipakai — bukan sekadar tombol mati tanpa alasan.
 */
export function ReadOnlyBanner({ access }: { access: AccessState }) {
  if (!access.readOnly || !access.reason) return null

  return (
    <section
      aria-label="Mode baca saja"
      className="rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3.5"
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <Lock className="size-3.5" />
          </span>
          <div>
            <p className="text-body font-semibold text-rose-900">
              {readOnlyHeadline(access.reason)}
            </p>
            <p className="mt-0.5 max-w-2xl text-meta leading-relaxed text-rose-800">
              {readOnlyDescription(access.reason)}
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-caption font-medium text-rose-700">
              <BookOpenCheck className="size-3.5" />
              Riwayat, filter, kalender, dan unduh PDF tetap berjalan normal.
            </p>
          </div>
        </div>
        <ButtonLink to="/upgrade" size="sm" className="shrink-0">
          Perpanjang paket <ArrowRight className="size-3.5" />
        </ButtonLink>
      </div>
    </section>
  )
}

/**
 * Pengganti tombol pembuatan data saat mode baca-saja.
 *
 * Tetap terlihat (bukan disembunyikan) agar vendor tahu fitur itu ada dan apa
 * syaratnya, tetapi tidak bisa diklik dan menjelaskan alasannya lewat `title`.
 */
export function ReadOnlyActionHint({ label }: { label: string }) {
  return (
    <span
      title={`${label} terkunci sampai langganan diperpanjang.`}
      className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-lg bg-ink-100 px-4 text-body font-medium text-ink-400"
    >
      <Lock className="size-4" />
      {label}
    </span>
  )
}
