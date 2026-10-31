import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from '@/components/ui/icons'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { COMPANY } from '@/lib/company'
import { LEGAL_DOCUMENTS, LEGAL_UPDATED_AT, type LegalDocument } from '@/lib/legal'

/**
 * Halaman dokumen legal publik: `/syarat-ketentuan` dan `/kebijakan-privasi`.
 *
 * Dibuat untuk verifikasi merchant payment gateway, yang umumnya mensyaratkan
 * halaman Syarat & Ketentuan serta Kebijakan Privasi dapat diakses publik.
 * Isinya diambil dari `lib/legal.ts` yang disusun dari inventaris data nyata
 * aplikasi — bukan template generik.
 *
 * Tata letak: satu kolom dengan measure terbatas (~68 karakter) agar nyaman
 * dibaca, header ringkas untuk kembali, dan footer identitas badan usaha.
 */
export function LegalPage({ slug }: { slug: string }) {
  /*
   * `slug` datang sebagai prop dari rute, bukan `useParams()`.
   *
   * Dua percobaan sebelumnya gagal: rute statis tanpa `:slug` membuat
   * `useParams()` kosong (kedua URL menampilkan dokumen yang sama), sedangkan
   * `/:slug` terlalu luas dan menangkap semua path. Prop eksplisit membuat
   * pemetaan rute → dokumen terbaca langsung di App.tsx.
   */
  const doc = LEGAL_DOCUMENTS.find((d) => d.slug === slug) ?? LEGAL_DOCUMENTS[0]

  // Judul tab mengikuti dokumen yang dibuka.
  useEffect(() => {
    document.title = `${doc.title} — ${COMPANY.brand}`
  }, [doc.title])

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="border-b border-ink-200/70">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-400 text-body font-bold text-ink-900">
              VK
            </span>
            <span className="text-lead font-semibold text-ink-900">{COMPANY.brand}</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-meta font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
          >
            <ArrowLeft className="size-3.5" />
            Kembali
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-caption font-semibold uppercase tracking-wider text-brand-700">
            Dokumen legal
          </p>
          <h1 className="mt-2 text-heading tracking-tight text-ink-900 sm:text-display">
            {doc.title}
          </h1>
          <p className="mt-2 text-caption text-ink-400">Terakhir diperbarui: {LEGAL_UPDATED_AT}</p>

          <p className="mt-6 text-body leading-relaxed text-ink-600">{doc.intro}</p>

          {/* Daftar isi membantu dokumen panjang tetap bisa dipindai. */}
          <nav aria-label="Daftar isi" className="mt-8 rounded-xl border border-ink-200/80 bg-ink-50/60 p-4">
            <p className="text-caption font-semibold uppercase tracking-wider text-ink-500">
              Daftar isi
            </p>
            <ol className="mt-2 grid gap-1.5 text-meta text-ink-600 sm:grid-cols-2">
              {doc.sections.map((section) => (
                <li key={section.heading}>
                  <a href={`#${anchorOf(section.heading)}`} className="hover:text-ink-900 hover:underline">
                    {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-10 space-y-8">
            {doc.sections.map((section) => (
              <section key={section.heading} id={anchorOf(section.heading)} className="scroll-mt-20">
                <h2 className="text-lead font-semibold tracking-tight text-ink-900">
                  {section.heading}
                </h2>

                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-2.5 text-body leading-relaxed text-ink-600">
                    {paragraph}
                  </p>
                ))}

                {section.bullets ? (
                  <ul className="mt-3 space-y-2">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2.5 text-body leading-relaxed text-ink-600">
                        <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-400" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <RelatedDocuments current={doc} />
        </article>
      </main>

      <PublicFooter />
    </div>
  )
}

/** Tautan ke dokumen legal lain, supaya keduanya mudah ditemukan. */
function RelatedDocuments({ current }: { current: LegalDocument }) {
  const others = LEGAL_DOCUMENTS.filter((d) => d.slug !== current.slug)

  return (
    <aside className="mt-12 rounded-xl border border-ink-200/80 bg-white p-4">
      <p className="text-caption font-semibold uppercase tracking-wider text-ink-500">
        Dokumen lainnya
      </p>
      <ul className="mt-2 space-y-1">
        {others.map((doc) => (
          <li key={doc.slug}>
            <Link
              to={`/${doc.slug}`}
              className="inline-block py-1 text-body font-medium text-brand-700 hover:text-brand-800 hover:underline"
            >
              {doc.title}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  )
}

/** `1. Definisi` → `definisi`; dipakai untuk id bagian dan tautan daftar isi. */
function anchorOf(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/^\d+\.\s*/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
