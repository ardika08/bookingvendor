import {
  CalendarCheck2,
  CalendarDays,
  Crown,
  Package,
  ReceiptText,
  Store,
  Users,
  Wallet,
  type IconComponent,
} from '@/components/ui/icons'

/**
 * Section "Untuk siapa" (`#untuk-siapa`).
 *
 * Menjawab pertanyaan yang muncul SETELAH orang mengerti produknya: "apakah
 * ini untuk saya?" Dua lapis:
 *
 * 1. Ciri pekerjaan (chip) — bukan profesi, tapi kondisi kerja. Ini yang
 *    membuat pembaca merasa "oh, ini saya". Daftar profesi saja tidak cukup:
 *    vendor yang baru mulai dengan 1 acara/bulan butuh diyakinkan bahwa
 *    sistem ini tidak kemahalan untuk skala kecil.
 * 2. Kategori vendor — memakai kategori yang benar-benar ada di database
 *    (lihat `CategorySeeder`), bukan daftar karangan. Kalau nanti kategori
 *    berubah, section ini harus ikut disesuaikan.
 *
 * TIDAK ada section "sudah dipakai oleh N vendor". Bukti sosial hanya boleh
 * ditampilkan bila vendor-nya benar-benar ada dan sudah menyetujui namanya
 * dipajang di halaman publik. Menampilkan nama fiktif sebagai "sudah dipakai"
 * menyesatkan calon pelanggan dan berisiko saat verifikasi payment gateway.
 */

interface Fit {
  icon: IconComponent
  title: string
  description: string
}

/**
 * Kategori mengikuti `CategorySeeder` (7 inti) + satu kartu penutup untuk
 * kategori tambahan (MC, entertainment, souvenir, wedding cake).
 */
const CATEGORIES: Fit[] = [
  {
    icon: CalendarCheck2,
    title: 'Wedding Organizer',
    description: 'Banyak acara, banyak vendor. Satu kalender mencegah bentrok tanggal.',
  },
  {
    icon: ReceiptText,
    title: 'Fotografer / Videografer',
    description: 'Tanggal acara jadi patokan. Booking dan pelunasan tercatat rapi.',
  },
  {
    icon: Store,
    title: 'Venue',
    description: 'Satu tanggal hanya untuk satu acara. Blokir tanggal yang sudah penuh.',
  },
  {
    icon: Crown,
    title: 'Dekorasi',
    description: 'Jadwal pemasangan dan bongkar ikut tercatat, tidak bertabrakan.',
  },
  {
    icon: Users,
    title: 'MUA',
    description: 'Jam mulai dan lokasi jelas. Klien tahu kapan gilirannya.',
  },
  {
    icon: Wallet,
    title: 'Catering',
    description: 'Jumlah tamu dan tanggal bisa berubah. Perubahannya tercatat.',
  },
  {
    icon: Package,
    title: 'Seserahan',
    description: 'Pesanan per pasangan, dengan tenggat sebelum hari-H.',
  },
  {
    icon: CalendarDays,
    title: 'Dan lainnya',
    description: 'MC, entertainment, souvenir, wedding cake — semua bisa pakai.',
  },
]

/** Ciri pekerjaan — yang membuat pembaca mengenali dirinya. */
const TRAITS = ['1–3 acara per bulan', 'Kerja sendiri atau tim kecil', 'Klien pernikahan']

export function AudienceSection() {
  return (
    <section id="untuk-siapa" className="scroll-mt-20 border-t border-ink-200/70 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-caption font-semibold uppercase tracking-wider text-brand-700">
            Untuk siapa
          </p>
          <h2 className="mt-2 text-heading tracking-tight text-ink-900 sm:text-display">
            Satu sistem, dipakai lintas jenis vendor pernikahan
          </h2>
          <p className="mt-3 text-body leading-relaxed text-ink-500">
            Kalau pekerjaan Anda berhubungan dengan tanggal acara, klien, dan tagihan — VendorKit
            dirancang untuk itu. Tidak perlu software berbeda per profesi.
          </p>

          {/*
            Chip ditumpuk vertikal di bawah `sm`, baru sebaris di atasnya.
            Dengan flex-wrap saja, di 375px chip pertama melayang sendiri di
            baris pertama dan chip ketiga mepet tepi kanan — terlihat berdesakan.
            Ditumpuk, tiap chip punya lebar penuh sendiri dan terbaca tenang.
          */}
          <ul className="mx-auto mt-5 flex max-w-md flex-col items-stretch gap-2 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
            {TRAITS.map((trait) => (
              <li
                key={trait}
                className="rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-center text-meta font-medium text-ink-700"
              >
                {trait}
              </li>
            ))}
          </ul>
        </div>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((fit) => (
            <FitCard key={fit.title} fit={fit} />
          ))}
        </ul>
      </div>
    </section>
  )
}

function FitCard({ fit }: { fit: Fit }) {
  const Icon = fit.icon

  return (
    <li className="group flex flex-col rounded-xl border border-ink-200/80 bg-white p-5 transition-colors hover:border-brand-200 hover:bg-brand-50/30">
      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
        <Icon className="size-4" />
      </span>
      <h3 className="mt-3 text-lead font-semibold leading-snug text-ink-900">{fit.title}</h3>
      <p className="mt-1.5 text-meta leading-relaxed text-ink-500">{fit.description}</p>
    </li>
  )
}
