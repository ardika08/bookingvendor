import { CalendarCheck, ReceiptText, ShieldCheck, Sparkles } from '@/components/ui/icons'
import { GoogleSignInCta } from '@/components/promo/GoogleSignInCta'
import { BenefitHighlights } from '@/components/promo/BenefitHighlights'
import { WorkflowSteps } from '@/components/promo/WorkflowSteps'
import { PricingSection } from '@/components/promo/PricingSection'
import { FaqSection } from '@/components/promo/FaqSection'

/**
 * Isi halaman promosi (`/`).
 *
 * Kerangka isi: hero ringkas dengan CTA utama "Masuk dengan Google" dan
 * penanda bagian yang akan diisi task berikutnya (#fitur, #harga, #faq).
 * Fokus pesan sesuai PRD: alat operasional vendor pernikahan, trial 2 booking +
 * 2 invoice, tanpa registrasi publik.
 */
export function PromoHomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(216,90,69,0.10),transparent_70%)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-24">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-caption font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
              <Sparkles className="size-3.5" />
              Trial 2 booking + 2 invoice — tanpa kartu kredit
            </span>

            <h1 className="mt-5 text-display leading-tight tracking-tight text-ink-900 sm:text-[2.625rem] sm:leading-[1.1]">
              Kelola booking vendor pernikahan
              <span className="text-brand-600"> tanpa bentrok jadwal.</span>
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-lead leading-relaxed text-ink-600">
              Catat pesanan, pantau kalender acara, dan terbitkan invoice dari satu dashboard.
              Dibuat khusus vendor pernikahan — bukan marketplace.
            </p>

            <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <GoogleSignInCta size="lg" className="w-full sm:w-auto" />
              <a
                href="#harga"
                className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-white px-5 text-body font-medium text-ink-700 shadow-sm ring-1 ring-ink-200 transition-colors hover:bg-ink-50 sm:w-auto"
              >
                Lihat paket
              </a>
            </div>

            <p className="mt-3 text-caption text-ink-400">
              Tidak ada registrasi publik — akun vendor disiapkan admin.
            </p>
          </div>

          <ul className="mx-auto mt-12 grid max-w-3xl gap-3 sm:grid-cols-3">
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
              note="Cukup akun Google yang sudah terdaftar sebagai vendor."
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
            Masuk dengan akun Google yang sudah terdaftar, atau minta admin menambahkan vendor
            kamu. Masa trial langsung aktif tanpa kartu kredit.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <GoogleSignInCta size="lg" className="w-full sm:w-auto" />
            <a
              href="#harga"
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-white/10 px-5 text-body font-medium text-white ring-1 ring-white/20 transition-colors hover:bg-white/15 sm:w-auto"
            >
              Bandingkan paket
            </a>
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


