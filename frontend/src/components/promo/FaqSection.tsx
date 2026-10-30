import { ChevronDown } from '@/components/ui/icons'

/**
 * FAQ halaman promosi (`#faq`).
 *
 * Memakai `<details>` native agar bisa dibuka-tutup tanpa JavaScript dan tetap
 * ramah aksesibilitas. Pertanyaan mengikuti hal yang paling sering ditanyakan
 * vendor baru: akun, trial, langganan, dan keamanan jadwal.
 */

const FAQS = [
  {
    question: 'Apakah klien saya perlu membuat akun?',
    answer:
      'Tidak. Klien tidak punya akun dan tidak pernah masuk ke aplikasi. Mereka hanya membuka link jadwal atau invoice yang kamu bagikan.',
  },
  {
    question: 'Bagaimana cara mulai memakai aplikasi?',
    answer:
      'Daftar sendiri lewat halaman pendaftaran dengan email dan kata sandi — akun langsung aktif dan bisa dipakai, tanpa menunggu persetujuan. Masuk berikutnya cukup dengan email dan kata sandi tersebut.',
  },
  {
    question: 'Apa yang terjadi saat masa uji 30 hari habis?',
    answer:
      'Semua data tetap bisa dibuka dan diunduh — booking, invoice, dan riwayat klien tidak terkunci. Yang berhenti hanya pembuatan booking dan invoice baru. Begitu berlangganan, keduanya kembali tanpa batas.',
  },
  {
    question: 'Apakah ada batas jumlah booking selama masa uji?',
    answer:
      'Tidak ada. Selama 30 hari masa uji, semua fitur terbuka tanpa batas jumlah booking maupun invoice — supaya kamu bisa mencoba alur lengkap dari pesanan sampai pelunasan.',
  },
  {
    question: 'Bagaimana mencegah jadwal bentrok?',
    answer:
      'Tanggal yang sudah terpakai otomatis tertandai di kalender dan form booking. Kamu juga bisa memblokir tanggal libur secara manual.',
  },
  {
    question: 'Apakah data hilang bila akun dinonaktifkan?',
    answer:
      'Tidak. Menonaktifkan akun hanya menutup akses sementara; booking, invoice, dan riwayat klien tetap utuh dan bisa aktif kembali.',
  },
  {
    question: 'Apakah aplikasi ini marketplace untuk calon pengantin?',
    answer:
      'Bukan. Ini alat operasional internal untuk vendor. Komunikasi dan negosiasi tetap berjalan di luar aplikasi seperti biasa.',
  },
]

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-ink-200/70 bg-white">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="text-center">
          <p className="text-caption font-semibold uppercase tracking-wider text-brand-700">FAQ</p>
          <h2 className="mt-2 text-heading tracking-tight text-ink-900 sm:text-display">
            Pertanyaan yang sering muncul
          </h2>
        </div>

        <div className="mt-8 space-y-2.5">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-xl border border-ink-200/80 bg-white px-4 py-3 open:border-brand-200 open:bg-brand-50/20"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-body font-medium text-ink-900 [&::-webkit-details-marker]:hidden">
                {faq.question}
                <ChevronDown
                  className="size-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="mt-2 text-meta leading-relaxed text-ink-500">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
