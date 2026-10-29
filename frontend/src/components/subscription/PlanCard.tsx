import type { ReactNode } from 'react'
import { Check, Clock3, Crown } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { formatCurrency } from '@/lib/format'

/**
 * Kartu paket langganan — dipakai BERSAMA oleh halaman vendor (`/upgrade`)
 * dan panel admin (`/admin/plans`).
 *
 * Kenapa satu komponen: admin perlu melihat persis seperti apa paket yang ia
 * atur akan tampil di katalog vendor. Kalau keduanya punya kartu sendiri,
 * pratinjau di panel admin bisa berbeda dari kenyataan tanpa ketahuan.
 *
 * Susunan mengikuti referensi pricing: harga hemat per bulan sebagai angka
 * utama, harga sebelum diskon dicoret + badge persen, baris "Bayar Rp X / N
 * bulan", deskripsi singkat, daftar manfaat bercentang, lalu aksi di bawah.
 *
 * Istilah harga mengikuti pemilik produk:
 * - `price`       = harga coret/promo, angka yang benar-benar DIBAYAR.
 * - `normalPrice` = harga sebelum diskon, ditampilkan DICORET.
 */
export interface PlanCardModel {
  id: string
  name: string
  durationMonths: number
  price: number | null
  /** Boleh undefined: API vendor hanya mengirim bila ada diskon. */
  normalPrice?: number | null
  description?: string | null
  benefits: string[]
  /** Paket sorotan — diberi border tebal + badge "Paling Hemat". */
  highlight?: boolean
}

interface PlanCardProps {
  plan: PlanCardModel
  /** Aksi di bawah kartu: tombol beli, tombol Edit/Hapus, atau status. */
  action: ReactNode
  /** Kartu ditandai sebagai paket yang sedang dipakai (vendor). */
  current?: boolean
  /** Paket nonaktif — diredupkan agar jelas tidak tayang di katalog. */
  inactive?: boolean
}

/**
 * Harga per bulan, dibulatkan ke RIBUAN terdekat.
 *
 * Membagi begitu saja menghasilkan angka seperti "Rp 66.667/bulan" yang
 * terlihat seperti salah hitung dan sulit dibaca. Membulatkan ke ribuan
 * membuatnya rapi ("Rp 67.000/bulan") tanpa mengubah arti secara berarti.
 */
export function monthlyPrice(total: number, months: number): number {
  if (months <= 0) return total
  return Math.round(total / months / 1000) * 1000
}

/**
 * Persen penghematan dari TOTAL, bukan dari harga per bulan.
 *
 * Persen harus dihitung dari total supaya cocok dengan baris "Hemat Rp X" yang
 * juga total. Kalau dihitung dari harga per bulan yang sudah dibulatkan,
 * angkanya bisa melenceng dari nominal hemat yang ditampilkan.
 */
export function discountPercent(price: number | null, normalPrice: number | null): number | null {
  if (price === null || normalPrice === null || normalPrice <= price) return null
  return Math.round(((normalPrice - price) / normalPrice) * 100)
}

export function PlanCard({ plan, action, current = false, inactive = false }: PlanCardProps) {
  const available = plan.price !== null
  const featured = plan.highlight === true && available

  const perMonth = plan.price === null ? null : monthlyPrice(plan.price, plan.durationMonths)
  // `?? null` menormalkan `undefined` (field opsional dari API vendor).
  const normalPrice = plan.normalPrice ?? null
  const normalPerMonth = normalPrice === null ? null : monthlyPrice(normalPrice, plan.durationMonths)
  /*
   * Persen dihitung dari angka PER BULAN yang benar-benar tampil, bukan dari
   * total. Dengan begitu badge "33% OFF" selalu cocok dengan dua angka yang
   * berdampingan di kartu — kalau dihitung dari total, hasilnya bisa berbeda
   * satu poin dari yang bisa dibaca pengguna.
   */
  const percent = discountPercent(perMonth, normalPerMonth)

  return (
    <article
      className={cn(
        'relative flex flex-col rounded-2xl bg-white p-5 transition-shadow',
        // Kartu unggulan: border tebal + bayangan, bukan sekadar warna lain.
        featured
          ? 'border-2 border-brand-400 shadow-md shadow-brand-400/10'
          : 'border border-ink-200/80 shadow-sm',
        current && 'ring-2 ring-emerald-300 ring-offset-2',
        inactive && 'opacity-70',
      )}
    >
      {/*
        Badge mengambang di atas garis border. `-top-3` butuh padding atas
        kartu cukup; teks 2xs uppercase supaya tidak bersaing dengan judul.
      */}
      {featured ? (
        <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-brand-400 px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide text-ink-900 shadow-sm">
          <Crown className="size-3.5" />
          Paling Hemat
        </span>
      ) : null}

      {current ? (
        /*
         * `emerald-700`, bukan `emerald-600`: teks putih di atas `emerald-600`
         * hanya 3.65:1, di bawah ambang 4.5:1 untuk teks 11px. `emerald-700`
         * memberi 5.03:1 tanpa mengubah kesan "aktif".
         */
        <span className="absolute -top-3 right-5 inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide text-white shadow-sm">
          Paketmu
        </span>
      ) : null}

      {/*
        Tanpa padding tambahan: badge mengambang di `-top-3` dan tingginya
        ~22px, jadi ujung bawahnya masih di area padding kartu (20px) dan
        tidak menabrak judul. Padding tambahan justru menggeser isi kartu
        unggulan ~7px sehingga daftar fiturnya tidak sejajar dengan kartu lain.
      */}
      <header>
        {/*
          `h2`, bukan `h3`: kartu ini berdiri langsung di bawah `<h1>` halaman
          (baik di `/upgrade` maupun `/admin/plans`), tanpa heading perantara.
          Melompat dari h1 ke h3 membuat pembaca layar kehilangan satu tingkat
          dan ditandai axe sebagai `heading-order`.
        */}
        <h2 className="text-lead font-semibold text-ink-900">{plan.name}</h2>
        <p className="mt-0.5 text-meta text-ink-500">
          Aktif {plan.durationMonths} bulan
        </p>
      </header>

      {/* Blok harga — inti kartu pricing. */}
      <div className="mt-3">
        {perMonth !== null ? (
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-heading font-semibold tabular-nums tracking-tight text-ink-900">
              {formatCurrency(perMonth)}
            </span>
            <span className="text-meta text-ink-500">/bulan</span>
          </div>
        ) : (
          <span className="text-heading font-semibold text-ink-300">Segera</span>
        )}

        {percent !== null && normalPerMonth !== null ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {/*
              Harga coret ditampilkan PER BULAN, sejajar dengan harga utama di
              atasnya. Menampilkan total di sini membuat dua angka berbeda
              satuan berdampingan ("Rp 45.000/bulan" vs "Rp 200.000") sehingga
              pembaca harus menebak mana total dan mana per bulan.
            */}
            <span className="text-meta tabular-nums text-ink-400 line-through">
              {formatCurrency(normalPerMonth)}/bulan
            </span>
            <span className="inline-flex items-center rounded-md bg-rose-50 px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-rose-700 ring-1 ring-inset ring-rose-200">
              {percent}% OFF
            </span>
          </div>
        ) : null}

        {plan.price !== null ? (
          <p className="mt-1.5 text-meta tabular-nums text-ink-600">
            Bayar{' '}
            <span className="font-semibold text-ink-800">{formatCurrency(plan.price)}</span>
            {' / '}
            {plan.durationMonths} bulan
          </p>
        ) : (
          <p className="mt-1.5 text-meta text-ink-500">
            Harga belum ditetapkan — belum bisa dibeli.
          </p>
        )}

        {/*
          Baris "Hemat Rp X" sengaja TIDAK ditampilkan: angka hemat total tidak
          bisa dicocokkan dengan harga per bulan di atasnya, dan badge persen
          sudah menyampaikan hal yang sama tanpa memaksa pembaca menghitung.
          Nominal total yang harus dibayar sudah ada di baris "Bayar".
        */}
      </div>

      {plan.description ? (
        <p className="mt-3 text-meta leading-relaxed text-ink-500">{plan.description}</p>
      ) : null}

      <hr className="mt-4 border-ink-100" />

      <ul className="mt-3 flex-1 space-y-2">
        {plan.benefits.map((benefit) => (
          <li key={benefit} className="flex items-start gap-2 text-meta text-ink-700">
            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            <span className="min-w-0">{benefit}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5">{action}</div>

      {!available ? (
        <p className="mt-2 flex items-center justify-center gap-1 text-caption text-ink-400">
          <Clock3 className="size-3.5" />
          Menunggu harga dari admin
        </p>
      ) : null}
    </article>
  )
}
