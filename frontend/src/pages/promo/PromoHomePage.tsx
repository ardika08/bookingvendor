import {
  CalendarCheck,
  ReceiptText,
  ShieldCheck,
  Ticket,
} from '@/components/ui/icons'
import { Link } from 'react-router-dom'
import { SignUpCta } from '@/components/promo/SignUpCta'
import { BenefitHighlights } from '@/components/promo/BenefitHighlights'
import { WorkflowSteps } from '@/components/promo/WorkflowSteps'
import { PricingSection } from '@/components/promo/PricingSection'
import { FaqSection } from '@/components/promo/FaqSection'
import { HeroCalendarMockup } from '@/components/promo/HeroCalendarMockup'

/**
 * Isi halaman promosi (`/`).
 *
 * Pesan utama: alat operasional vendor pernikahan, uji coba 30 hari dengan
 * semua fitur terbuka, dan pendaftaran mandiri.
 *
 * CTA utama mengarah ke `/daftar`, bukan `/login`. Sebelumnya hanya ada
 * "Masuk dengan Google" (sekarang diganti email+sandi), sehingga calon vendor yang belum punya akun harus
 * menemukan sendiri tautan kecil di halaman masuk — padahal justru pendaftaran
 * yang perlu ditonjolkan saat produk sedang mencari pengguna baru.
 */
export function PromoHomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(216,90,69,0.10),transparent_70%)]"
        />
        {/*
          Dua kolom: teks di kiri, mockup kalender di kanan.
          Sebelumnya hero center-aligned tanpa visual — calon vendor harus
          membayangkan sendiri bentuk produknya. Mockup kalender memperlihatkan
          inti nilai jual (tanggal terisi, detail klien, anti bentrok) dalam
          sekali lihat, tanpa perlu scroll.

          Di bawah `lg` kedua kolom ditumpuk: teks dulu, kalender menyusul.
          Urutan itu disengaja — pesan jualan tetap yang pertama terbaca di
          layar sempit.
        */}
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.18fr)] lg:items-center lg:gap-14 lg:pb-20 lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-caption font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
              <Ticket className="size-3.5" />
              Gratis 30 hari, semua fitur terbuka
            </span>

            <h1 className="mt-5 text-[1.9375rem] leading-[1.15] tracking-tight text-ink-900 sm:text-[2.375rem] sm:leading-[1.12] lg:text-[2.625rem] lg:leading-[1.1]">
              Kelola booking vendor pernikahan
              <span className="text-brand-700"> tanpa bentrok jadwal.</span>
            </h1>

            <p className="mt-4 max-w-xl text-lead leading-relaxed text-ink-600">
              Satu kalender untuk semua acara — tanggal terisi langsung terlihat, detail klien
              menempel di tanggalnya, dan invoice terbit dari data yang sama.
            </p>

            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <SignUpCta size="lg" className="w-full sm:w-auto" />
              <a
                href="#harga"
                className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-white px-5 text-body font-medium text-ink-700 shadow-sm ring-1 ring-ink-200 transition-colors hover:bg-ink-50 sm:w-auto"
              >
                Lihat paket
              </a>
            </div>

            <p className="mt-3 text-caption text-ink-400">
              Tanpa kartu kredit · Akun aktif langsung setelah daftar
            </p>
          </div>

          <HeroCalendarMockup />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
          <ul className="grid gap-3 sm:grid-cols-3">
            <Highlight
              icon={<CalendarCheck className="size-4" />}
              title="Kalender & anti bentrok"
              note="Tanggal terpakai terlihat jelas; tanggal bisa diblokir manual."
            />
            <Highlight
              icon={<ReceiptText className="size-4" />}
              title="Invoice otomatis"
              note="DP & pelunasan dari data booking, dengan link publik untuk klien."
            />
            <Highlight
              icon={<ShieldCheck className="size-4" />}
              title="Masuk satu klik"
              note="Masuk dengan email dan kata sandi — tanpa perlu akun Google."
            />
          </ul>
        </div>
      </section>

      <BenefitHighlights />
      <WorkflowSteps />

      <PricingSection />

      <FaqSection />

      {/* CTA penutup */}
      <section className="border-t border-ink-200/70 bg-ink-900">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <h2 className="text-heading tracking-tight text-white sm:text-display">
            Siap menata jadwal vendor lebih rapi?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-body leading-relaxed text-ink-300">
            Daftar gratis dan pakai semua fitur selama 30 hari. Setelah itu pilih paket yang
            paling pas — atau berhenti, tanpa biaya apa pun.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <SignUpCta size="lg" className="w-full sm:w-auto" />
            {/*
              Tombol polos, bukan `GoogleSignInCta variant="ghost"`: varian itu
              membawa `text-ink-700` yang gelap dan tidak terbaca di atas latar
              `ink-900`. Menambahkan `text-ink-300` tidak menolong karena Tailwind
              memilih berdasarkan urutan stylesheet, bukan urutan class — warna
              gelapnya tetap menang dan kontrasnya jatuh ke 1.86:1.
            */}
            <Link
              to="/login"
              className="inline-flex h-11 w-full items-center justify-center rounded-lg px-5 text-body font-medium text-ink-300 ring-1 ring-white/20 transition-colors hover:bg-white/10 hover:text-white sm:w-auto"
            >
              Sudah punya akun
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

function Highlight({
  icon,
  title,
  note,
}: {
  icon: React.ReactNode
  title: string
  note: string
}) {
  return (
    <li className="rounded-xl border border-ink-200/80 bg-white px-4 py-3.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        {icon}
      </span>
      <p className="mt-2.5 text-body font-semibold text-ink-900">{title}</p>
      <p className="mt-0.5 text-meta leading-relaxed text-ink-500">{note}</p>
    </li>
  )
}
