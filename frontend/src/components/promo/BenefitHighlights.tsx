import {
  CalendarCheck2,
  FileText,
  LayoutDashboard,
  Link2,
  Search,
  Sparkles,
  type IconComponent,
} from '@/components/ui/icons'

/**
 * Sorotan manfaat utama di halaman promosi (`#fitur`).
 *
 * Enam kemampuan inti yang membedakan aplikasi ini dari catatan manual —
 * semuanya berasal dari PRD: kalender anti bentrok, invoice dari booking,
 * pencarian klien lintas format nomor, link publik untuk klien tanpa akun,
 * dashboard ringkas, dan masa trial tanpa kartu kredit.
 */

interface Benefit {
  icon: IconComponent
  title: string
  description: string
}

const BENEFITS: Benefit[] = [
  {
    icon: CalendarCheck2,
    title: 'Kalender & anti bentrok',
    description:
      'Tanggal yang sudah terisi terlihat jelas. Tanggal libur bisa diblokir manual, jadi tidak ada jadwal ganda.',
  },
  {
    icon: FileText,
    title: 'Invoice otomatis dari booking',
    description:
      'Terbitkan DP dan pelunasan langsung dari data acara — nominal, jatuh tempo, dan status terhitung otomatis.',
  },
  {
    icon: Search,
    title: 'Cari klien lintas format',
    description:
      'Nomor 0812, 62812, atau +62 812 dianggap sama. Riwayat pesanan klien lama langsung ketemu.',
  },
  {
    icon: Link2,
    title: 'Link publik untuk klien',
    description:
      'Bagikan jadwal ketersediaan dan invoice lewat satu tautan. Klien melihat tanpa perlu membuat akun.',
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard operasional',
    description:
      'Pesanan masuk, jadwal terdekat, dan tagihan yang perlu ditindaklanjuti ada di satu layar.',
  },
  {
    icon: Sparkles,
    title: 'Trial tanpa kartu kredit',
    description:
      'Mulai dengan 2 booking + 2 invoice. Berlangganan hanya saat operasional sudah berjalan.',
  },
]

export function BenefitHighlights() {
  return (
    <section id="fitur" className="scroll-mt-20 border-t border-ink-200/70 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-caption font-semibold uppercase tracking-wider text-brand-700">
            Fitur
          </p>
          <h2 className="mt-2 text-heading tracking-tight text-ink-900 sm:text-display">
            Yang bikin operasional vendor lebih tenang
          </h2>
          <p className="mt-3 text-body leading-relaxed text-ink-500">
            Semua yang dibutuhkan untuk mencatat acara, menjaga jadwal, dan menagih klien —
            tanpa spreadsheet dan tanpa aplikasi tambahan.
          </p>
        </div>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <BenefitCard key={benefit.title} benefit={benefit} />
          ))}
        </ul>
      </div>
    </section>
  )
}

function BenefitCard({ benefit }: { benefit: Benefit }) {
  const Icon = benefit.icon

  return (
    <li className="group rounded-xl border border-ink-200/80 bg-white p-5 transition-colors hover:border-brand-200 hover:bg-brand-50/30">
      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
        <Icon className="size-4" />
      </span>
      <h3 className="mt-3 text-lead font-semibold text-ink-900">{benefit.title}</h3>
      <p className="mt-1.5 text-meta leading-relaxed text-ink-500">{benefit.description}</p>
    </li>
  )
}
