import { ChevronLeft, ChevronRight } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

/**
 * Mockup kalender untuk hero salespage.
 *
 * BUKAN kalender sungguhan — tidak ada state, tidak ada fetch, tidak ada
 * interaksi. Tujuannya hanya memperlihatkan bentuk produk kepada calon vendor
 * dalam sekali lihat: tanggal terisi, tanggal tersedia, tanggal diblokir, dan
 * bagaimana detail klien menempel pada tanggalnya.
 *
 * Semua data di sini FIKTIF dan sengaja begitu — salespage bisa diakses publik,
 * jadi nama klien sungguhan tidak boleh muncul di sini.
 *
 * TATA LETAK
 * Kartu detail klien diposisikan absolut di kanan bawah, menimpa tepi kartu
 * kalender saja. Versi pertama wireframe menaruhnya di kiri bawah dan menutupi
 * tanggal 23–27 — grid tanggal harus tetap terbaca utuh.
 *
 * RESPONSIF
 * - < lg (mobile & tablet): kalender dan kartu detail ditumpuk vertikal,
 *   kartu detail jadi blok biasa di bawah (bukan melayang) agar tidak menutupi
 *   apa pun di layar sempit.
 * - ≥ lg: dua kolom, kartu detail melayang di kanan bawah.
 * Ukuran sel tanggal memakai `aspect-square` supaya proporsinya tetap enak
 * dilihat dari 320px sampai 1440px tanpa perlu media query tambahan.
 */

type DayState = 'empty' | 'free' | 'booked' | 'selected' | 'blocked'

interface Day {
  /** Tanggal; null untuk sel kosong di awal grid. */
  date: number | null
  state: DayState
  /** Nama klien — hanya untuk `booked` dan `selected`. */
  client?: string
  /**
   * Nama pendek untuk layar sempit.
   *
   * Sel tanggal di 375px hanya ~44px; "Rina & Bagus" akan terpotong jadi
   * "Rin…" yang tidak terbaca. Nama depan saja tetap jelas, dan versi lengkap
   * muncul di kartu detail klien tepat di bawahnya.
   */
  clientShort?: string
  /** Akhir pekan: angka tanggal dibuat lebih redup. */
  weekend?: boolean
}

/**
 * November 2026 — 1 November jatuh pada hari Minggu.
 *
 * Grid dimulai Senin, jadi ada 6 sel kosong sebelum tanggal 1.
 */
const DAYS: Day[] = [
  { date: null, state: 'empty' },
  { date: null, state: 'empty' },
  { date: null, state: 'empty' },
  { date: null, state: 'empty' },
  { date: null, state: 'empty' },
  { date: null, state: 'empty' },
  { date: 1, state: 'free', weekend: true },

  { date: 2, state: 'free' },
  { date: 3, state: 'free' },
  { date: 4, state: 'free' },
  { date: 5, state: 'free' },
  { date: 6, state: 'free' },
  { date: 7, state: 'selected', client: 'Rina & Bagus', clientShort: 'Rina' },
  { date: 8, state: 'booked', client: 'Nadia & Reza', clientShort: 'Nadia', weekend: true },

  { date: 9, state: 'free' },
  { date: 10, state: 'free' },
  { date: 11, state: 'free' },
  { date: 12, state: 'free' },
  { date: 13, state: 'free' },
  { date: 14, state: 'booked', client: 'Dewi & Aldi', clientShort: 'Dewi' },
  { date: 15, state: 'free', weekend: true },

  { date: 16, state: 'free' },
  { date: 17, state: 'free' },
  { date: 18, state: 'free' },
  { date: 19, state: 'free' },
  { date: 20, state: 'free' },
  { date: 21, state: 'booked', client: 'Sari & Yoga', clientShort: 'Sari' },
  { date: 22, state: 'free', weekend: true },

  { date: 23, state: 'free' },
  { date: 24, state: 'free' },
  { date: 25, state: 'blocked' },
  { date: 26, state: 'blocked' },
  { date: 27, state: 'free' },
  { date: 28, state: 'booked', client: 'Maya & Fikri', clientShort: 'Maya' },
  { date: 29, state: 'free', weekend: true },

  { date: 30, state: 'free' },
]

const DOW = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

export function HeroCalendarMockup() {
  return (
    /*
     * STRUKTUR
     * Flex column: kartu kalender, lalu kartu detail klien. Kartu detail
     * ditarik naik dengan margin negatif (`lg:-mt-7`) dan diratakan ke kanan
     * (`lg:self-end`) sehingga hanya menimpa tepi bawah kalender.
     *
     * Kenapa bukan `position: absolute` seperti sebelumnya: dengan absolute,
     * offset `-bottom-*` diukur dari padding box wadah. Setiap kali padding
     * bawah wadah diubah (untuk memberi ruang kartu), posisi kartu ikut
     * bergeser dan hasilnya berubah-ubah — kartu sempat menggantung 96px keluar
     * wadah. Dalam alur normal, kartu selalu menempel tepi bawah kalender
     * tanpa bisa lepas, dan tata letaknya tetap benar di semua lebar.
     *
     * LEBAR
     * `max-w` di bawah `lg`: tanpa batas ini kartu kalender memakai seluruh
     * lebar kontainer saat layout satu kolom (tablet), dan karena sel memakai
     * `aspect-square`, selnya membesar jadi 96x96 — kalender setinggi 755px,
     * terlalu panjang untuk hero. Dengan batas 27rem, sel tetap ~55px.
     * Desktop dibatasi 31rem agar sel ~60px.
     */
    <div className="relative mx-auto flex w-full max-w-[27rem] flex-col lg:max-w-[31rem]">
      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-[0_22px_48px_-18px_rgba(27,32,39,0.26),0_4px_12px_-4px_rgba(27,32,39,0.08)]">
        {/* Bar jendela aplikasi */}
        <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50 px-3.5 py-2.5">
          <span aria-hidden className="flex gap-1.5">
            <i className="block size-2 rounded-full bg-ink-300" />
            <i className="block size-2 rounded-full bg-ink-300" />
            <i className="block size-2 rounded-full bg-ink-300" />
          </span>
          <span className="ml-1 text-caption font-semibold text-ink-600">Kalender Acara</span>
          <span className="ml-auto rounded-md border border-brand-200 bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800">
            Vendor
          </span>
        </div>

        {/* Judul bulan */}
        <div className="flex items-center justify-between gap-2 px-3.5 pb-2 pt-3">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <b className="text-lead font-semibold tracking-tight text-ink-900">November 2026</b>
            <span className="text-caption text-ink-400">4 terisi · 2 diblokir</span>
          </div>
          <div aria-hidden className="flex shrink-0 gap-1">
            <span className="grid size-6 place-items-center rounded-md border border-ink-200 text-ink-500">
              <ChevronLeft className="size-3.5" />
            </span>
            <span className="grid size-6 place-items-center rounded-md border border-ink-200 text-ink-500">
              <ChevronRight className="size-3.5" />
            </span>
          </div>
        </div>

        {/* Grid tanggal */}
        <div className="px-2.5 pb-2.5">
          <div className="grid grid-cols-7 gap-1 pb-1.5">
            {DOW.map((d) => (
              <span
                key={d}
                className="text-center text-[9.5px] font-semibold uppercase tracking-wider text-ink-400"
              >
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((day, i) => (
              <DayCell key={day.date ?? `empty-${i}`} day={day} />
            ))}
          </div>
        </div>

        {/*
          Legenda di BAWAH grid, sesuai wireframe yang disetujui.
          Sisi kanannya diberi ruang kosong selebar kartu detail
          (`lg:pr-[15rem]`) sehingga item legenda membungkus ke kiri dan tidak
          pernah berada di bawah kartu. Karena `pr` memakai rem, ruang itu ikut
          membesar saat teks diperbesar — legenda tetap tidak tertimpa pada
          text zoom 200%.
        */}
        <div className="flex flex-nowrap items-center gap-x-2.5 border-t border-ink-100 px-3.5 py-2 lg:gap-x-2 lg:pr-[15.5rem]">
          <Legend swatch="border border-ink-200 bg-white" label="Tersedia" />
          <Legend swatch="bg-brand-400" label="Terisi" />
          <Legend swatch="bg-ink-900" label="Dipilih" />
          <Legend swatch="bg-ink-200" label="Diblokir" />
        </div>

      </div>

      {/* Kartu detail klien */}
      <ClientCard />
    </div>
  )
}

function DayCell({ day }: { day: Day }) {
  if (day.state === 'empty') {
    return <div aria-hidden className="aspect-square" />
  }

  const booked = day.state === 'booked'
  const selected = day.state === 'selected'
  const blocked = day.state === 'blocked'

  return (
    <div
      className={cn(
        // `aspect-square` menjaga sel tetap proporsional di semua lebar.
        // `min-h-0` + overflow-hidden mencegah nama klien yang panjang
        // mendorong lebar kolom grid.
        'flex aspect-square min-h-0 flex-col gap-0.5 overflow-hidden rounded-md border p-[3px] sm:p-1',
        day.state === 'free' && 'border-ink-100 bg-white',
        booked && 'border-brand-200 bg-brand-50',
        selected && 'border-ink-900 bg-ink-900 shadow-[0_6px_14px_-6px_rgba(27,32,39,0.55)]',
        blocked &&
          'border-ink-200 bg-ink-100 bg-[repeating-linear-gradient(135deg,transparent,transparent_4px,rgba(182,189,198,0.35)_4px,rgba(182,189,198,0.35)_5px)]',
      )}
    >
      <span
        className={cn(
          'text-[11px] font-medium leading-none',
          selected ? 'font-semibold text-white' : 'text-ink-700',
          booked && 'font-semibold text-brand-800',
          blocked && 'text-ink-400',
          day.weekend && !selected && !booked && 'text-ink-400',
        )}
      >
        {day.date}
      </span>

      {day.client ? (
        <span
          className={cn(
            /*
             * `truncate` mencegah nama panjang melebarkan sel. Nama depan saja
             * dipakai di layar sempit (sel ~44px di 375px) supaya tidak
             * terpotong jadi "Rin…"; nama lengkap muncul di kartu detail klien
             * tepat di bawah kalender.
             */
            /* px-[3px] di layar sempit: dengan padding sel 4px + px-1 chip 4px,
               "Nadia" dan "Maya" masih terpotong jadi "Na…"/"Ma…" di 375px.
               Padding tipis + font 7px memberi ruang cukup untuk 5 huruf. */
            'truncate rounded-[3px] px-[3px] py-[1px] text-[7px] font-semibold leading-tight sm:px-1 sm:text-[8px]',
            selected ? 'bg-brand-400 text-ink-900' : 'bg-brand-200 text-brand-900',
          )}
        >
          <span className="sm:hidden">{day.clientShort ?? day.client}</span>
          <span className="hidden sm:inline">{day.client}</span>
        </span>
      ) : null}

      {blocked ? (
        /*
         * Label dibuat `truncate` dan hurufnya lebih kecil di layar sempit.
         * Di 320px sel hanya ~34px; teks "Tutup" 8px masih meluber 2px dan
         * terlihat terpotong separuh. `truncate` membuatnya terpotong rapi
         * dengan elipsis alih-alih menembus tepi sel, dan ukuran 7px di bawah
         * `sm` cukup untuk memuat kata utuh.
         */
        <span className="truncate text-[7px] font-semibold leading-tight text-ink-500 sm:text-[8px]">
          Tutup
        </span>
      ) : null}
    </div>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] text-ink-500 sm:gap-1.5 sm:text-caption lg:gap-1 lg:text-[10px]">
      <i aria-hidden className={cn('block size-2 shrink-0 rounded-[3px] sm:size-2.5 lg:size-2', swatch)} />
      {label}
    </span>
  )
}

function ClientCard() {
  return (
    <div
      className={cn(
        // Mobile & tablet: blok biasa di bawah kalender.
        'mt-4 rounded-xl border border-ink-200 bg-white p-3.5',
        'shadow-[0_18px_36px_-14px_rgba(27,32,39,0.28),0_2px_8px_-2px_rgba(27,32,39,0.08)]',
        // Desktop: melayang di kanan bawah, hanya menimpa tepi kartu kalender.
        /* Digeser keluar kartu kalender (bukan ke dalam) supaya tanggal 28 dan
           label "Tutup" 25–26 tetap terbaca. `-bottom-6` membuatnya hanya
           menimpa tepi bawah, bukan baris tanggal terakhir. */
        /*
         * Alur normal + tarik naik + geser kanan.
         *
         * `lg:-mt-14` (56px): menaikkan kartu sampai menimpa baris terakhir
         * grid. Baris terakhir hanya berisi tanggal 30 di kolom Senin, jadi
         * area kanannya kosong — kartu tidak menutupi tanggal mana pun.
         *
         * `lg:-mr-4` (16px) / `xl:-mr-6` (24px): menggeser kartu sedikit
         * keluar tepi kanan kalender agar terlihat menumpuk, bukan tertahan di
         * dalam. Nilainya dibatasi 16-24px karena di 1024px sisa ruang kanan
         * hanya ~34px; lebih dari itu kartu keluar viewport.
         *
         * Tidak memakai `position: absolute`: offset negatif pada absolute
         * diukur dari padding box wadah, sehingga posisi kartu berubah setiap
         * padding diubah dan bisa terpotong pada text zoom 200% (WCAG 1.4.4).
         */
        'mt-4 w-full lg:-mt-14 lg:-mr-4 lg:w-[14rem] lg:self-end xl:-mr-6',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-brand-200 bg-brand-100 text-caption font-bold text-brand-800">
          RB
        </span>
        <div className="min-w-0">
          <p className="truncate text-meta font-semibold leading-tight text-ink-900">
            Rina &amp; Bagus
          </p>
          <p className="mt-0.5 text-[10px] text-ink-400">Sab, 7 Nov 2026</p>
        </div>
        <span className="ml-auto shrink-0 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[8.5px] font-bold tracking-wide text-emerald-700">
          DP LUNAS
        </span>
      </div>

      <dl className="mt-2.5 grid gap-1.5">
        <DetailRow label="Layanan" value="Akad + Resepsi" />
        <DetailRow label="Paket" value="Gold · 300 tamu" />
        <DetailRow label="Lokasi" value="Gedung Alam Sutera" />
      </dl>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-ink-100 pt-2.5">
        <span className="text-meta font-bold tracking-tight text-ink-900">
          Rp 42.500.000
          <small className="block text-[8.5px] font-medium tracking-normal text-ink-400">
            Sisa Rp 21.250.000
          </small>
        </span>
        <span className="whitespace-nowrap rounded-md bg-brand-400 px-2 py-1 text-[9.5px] font-semibold text-ink-900">
          Lihat invoice
        </span>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-[10.5px]">
      <dt className="shrink-0 text-ink-400">{label}</dt>
      <dd className="truncate text-right font-medium leading-snug text-ink-800">{value}</dd>
    </div>
  )
}
