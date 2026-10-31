import { Check } from '@/components/ui/icons'
import { SignUpCta } from '@/components/promo/SignUpCta'
import { formatCurrency } from '@/lib/format'
import { usePublicPlans } from '@/lib/api/public-plans'
import { cn } from '@/lib/cn'
import type { Plan } from '@/types/subscription'

/**
 * Section harga di halaman promosi (`#harga`).
 *
 * Harga diambil dari `GET /api/public/plans`, bukan data mock: mock lama
 * mengunci 3 Bulan & Tahunan pada harga `null` sehingga kartunya menampilkan
 * "Segera" beserta tombol mati, padahal admin sudah menetapkan harga.
 *
 * Tombol paket mengarah ke `/daftar` — calon vendor mendaftar dulu, lalu
 * memilih paket dari dalam aplikasi. Mengarahkannya ke `/login` akan membuang
 * calon pengguna yang belum punya akun.
 *
 * Bila katalog gagal dimuat, seluruh seksi disembunyikan. Menampilkan harga
 * contoh di halaman jualan lebih buruk daripada tidak menampilkan harga.
 */
export function PricingSection() {
  const { plans, failed } = usePublicPlans()

  if (failed || (plans !== null && plans.length === 0)) return null

  return (
    <section id="harga" className="scroll-mt-20 border-t border-ink-200/70 bg-ink-50/60">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-caption font-semibold uppercase tracking-wider text-brand-700">
            Harga
          </p>
          <h2 className="mt-2 text-heading tracking-tight text-ink-900 sm:text-display">
            Satu paket, semua fitur terbuka
          </h2>
          <p className="mt-3 text-body leading-relaxed text-ink-500">
            Coba semua fitur gratis 30 hari — tanpa kartu kredit. Setelah itu pilih paket
            yang paling pas; setiap paket membuka booking &amp; invoice tanpa batas.
          </p>
        </div>

        {plans === null ? (
          // Kerangka selama memuat: menjaga tata letak tidak melompat.
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-64 animate-pulse rounded-xl border border-ink-200/80 bg-white"
              />
            ))}
          </ul>
        ) : (
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <PricingCard key={plan.id} plan={plan} />
            ))}
          </ul>
        )}

        <p className="mt-6 text-center text-caption text-ink-400">
          Semua paket membuka booking &amp; invoice tanpa batas selama masa aktif.
        </p>
      </div>
    </section>
  )
}

function PricingCard({ plan }: { plan: Plan }) {
  const price = plan.price
  const normalPrice = plan.normalPrice ?? null
  // `price` null berarti admin belum menetapkan harga — paket tidak bisa dibeli.
  const available = price !== null

  return (
    <li
      className={cn(
        'relative flex flex-col rounded-xl border bg-white p-5',
        plan.highlight ? 'border-brand-300 ring-1 ring-brand-200' : 'border-ink-200/80',
      )}
    >
      {plan.highlight ? (
        <span className="absolute -top-2.5 left-5 rounded-full bg-brand-400 px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wide text-ink-900">
          Paling hemat
        </span>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lead font-semibold text-ink-900">{plan.name}</h3>
          <p className="mt-0.5 text-meta text-ink-500">Aktif {plan.durationMonths} bulan</p>
        </div>
        {available ? null : (
          <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-2xs font-medium text-ink-500">
            Segera
          </span>
        )}
      </div>

      {/*
        `flex-wrap` wajib: pada text zoom 200%, "Rp 480.000" + "Rp 720.000"
        tidak muat sebaris dan harga coret meluber keluar kartu (terukur
        scrollWidth 1309 vs viewport 1280). Dengan wrap, harga coret turun ke
        baris berikutnya alih-alih memaksa halaman melebar.
      */}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p
          className={cn(
            'text-heading font-semibold tabular-nums',
            available ? 'text-ink-900' : 'text-ink-400',
          )}
        >
          {available ? formatCurrency(price) : 'Segera'}
        </p>
        {/*
          Harga normal hanya ditampilkan bila lebih tinggi dari harga yang
          dibayar — kalau sama, mencoretnya berarti mengarang diskon.
        */}
        {available && normalPrice !== null ? (
          <p className="text-meta tabular-nums text-ink-400 line-through">
            {formatCurrency(normalPrice)}
          </p>
        ) : null}
      </div>
      <p className="mt-0.5 text-caption text-ink-400">
        {available ? 'per paket, sekali bayar' : 'Harga belum ditetapkan'}
      </p>

      <ul className="mt-4 space-y-2">
        {plan.benefits.map((benefit) => (
          <li key={benefit} className="flex items-start gap-2 text-meta text-ink-600">
            <Check className="mt-0.5 size-3.5 shrink-0 text-brand-700" aria-hidden />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-5">
        {available ? (
          <SignUpCta
            label="Daftar & pilih paket"
            size="md"
            block
            variant={plan.highlight ? 'primary' : 'secondary'}
          />
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center rounded-lg bg-ink-100 text-body font-medium text-ink-400"
          >
            Belum tersedia
          </button>
        )}
      </div>
    </li>
  )
}
