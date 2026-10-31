import { Menu, X } from '@/components/ui/icons'
import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { SignUpCta } from '@/components/promo/SignUpCta'
import { COMPANY, copyrightLine } from '@/lib/company'

/**
 * Kerangka halaman promosi publik (`/`).
 *
 * Salespage sederhana—clean, modern, minimalis (PRD). Fokus utama tombol
 * "Daftar gratis 30 hari" untuk vendor. Header memuat anchor ke bagian
 * halaman (#fitur, #harga, #faq) agar navigasi ringan tanpa halaman tambahan,
 * dan footer menyediakan tautan masuk serta panel admin.
 *
 * Bagian isi dirender lewat `Outlet`; section pemasaran ditambahkan oleh
 * task-task berikutnya tanpa mengubah layout ini.
 */

const NAV_LINKS = [
  { label: 'Fitur', href: '#fitur' },
  { label: 'Harga', href: '#harga' },
  { label: 'FAQ', href: '#faq' },
] as const

export function PromoLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-dvh scroll-smooth bg-white text-ink-800">
      <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-400 text-body font-bold text-ink-900">
              VK
            </span>
            <span className="text-lead font-semibold text-ink-900">VendorKit</span>
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Navigasi halaman">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-body font-medium text-ink-600 transition-colors hover:text-ink-900"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              to="/login"
              className="rounded-lg px-3 py-2 text-body font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
            >
              Masuk
            </Link>
            <SignUpCta size="md" />
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex size-9 items-center justify-center rounded-lg text-ink-600 hover:bg-ink-100 md:hidden"
            aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {menuOpen ? (
          <div className="border-t border-ink-100 bg-white px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Navigasi halaman (mobile)">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-2.5 py-2 text-body font-medium text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-3 flex flex-col gap-2 border-t border-ink-100 pt-3">
              <SignUpCta block />
            </div>
          </div>
        ) : null}
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="border-t border-ink-200/70 bg-ink-50/60">
        {/*
          Empat kolom: brand, kontak, alamat, produk.
          Kolom "Akun" (Masuk / Panel admin) sudah dihapus atas permintaan —
          tautan masuk cukup tersedia lewat tombol di header, dan "Panel admin"
          tidak perlu ditonjolkan di halaman publik.

          Jumlah kolom di grid HARUS sama dengan jumlah anak. Bila kurang, anak
          terakhir turun ke baris kedua dan menyisakan ruang kosong lebar di
          kanan — persis masalah yang ingin dihindari.
        */}
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1.2fr_0.8fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-brand-400 text-body font-bold text-ink-900">
                VK
              </span>
              <span className="text-lead font-semibold text-ink-900">VendorKit</span>
            </div>
            <p className="mt-3 max-w-xs text-meta leading-relaxed text-ink-500">
              Alat operasional internal untuk vendor pernikahan — catat booking, atur jadwal,
              dan terbitkan invoice dari satu dashboard.
            </p>
          </div>

          <FooterColumn
            title="Kontak"
            links={[
              { label: COMPANY.email, href: `mailto:${COMPANY.email}` },
              {
                label: `${COMPANY.phoneDisplay} (WhatsApp)`,
                href: `https://wa.me/${COMPANY.phoneWa}`,
                external: true,
              },
            ]}
          />

          <div>
            <p className="text-caption font-semibold uppercase tracking-wider text-ink-400">
              Alamat
            </p>
            <address className="mt-3 text-meta not-italic leading-relaxed text-ink-600">
              {COMPANY.address.street}
              <br />
              {COMPANY.address.village}
              <br />
              {COMPANY.address.city}
            </address>
          </div>

          <div>
            <p className="text-caption font-semibold uppercase tracking-wider text-ink-400">
              Produk
            </p>
            <ul className="mt-3 space-y-2 text-meta">
              <li>
                <a href="#fitur" className="text-ink-600 hover:text-ink-900">
                  Fitur
                </a>
              </li>
              <li>
                <a href="#harga" className="text-ink-600 hover:text-ink-900">
                  Harga
                </a>
              </li>
              <li>
                <a href="#faq" className="text-ink-600 hover:text-ink-900">
                  FAQ
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-ink-200/70">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-caption text-ink-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>{copyrightLine()}</p>
            <p>Dibuat untuk vendor pernikahan di Indonesia.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: ReadonlyArray<{ label: string; href: string; external?: boolean }>
}) {
  return (
    <div>
      <p className="text-caption font-semibold uppercase tracking-wider text-ink-400">{title}</p>
      <ul className="mt-3 space-y-2 text-meta">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className="break-words text-ink-600 hover:text-ink-900"
              {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
