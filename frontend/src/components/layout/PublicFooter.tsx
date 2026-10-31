import { COMPANY, copyrightLine } from '@/lib/company'

/**
 * Footer ringkas untuk halaman publik (masuk & daftar).
 *
 * Menampilkan identitas badan usaha, kontak, dan alamat. Dipakai untuk
 * verifikasi merchant payment gateway: verifikator membuka halaman publik dan
 * perlu memastikan pemilik situs bisa dihubungi serta badan usahanya jelas.
 *
 * Diletakkan di halaman masuk & daftar karena keduanya halaman publik yang
 * paling mungkin dibuka saat peninjauan — bukan hanya halaman utama.
 */
export function PublicFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`border-t border-ink-200/70 px-4 py-6 text-center ${className}`}>
      <div className="mx-auto max-w-xl space-y-2">
        <p className="text-caption text-ink-500">
          <a
            href={`mailto:${COMPANY.email}`}
            className="hover:text-ink-800"
          >
            {COMPANY.email}
          </a>
          <span className="mx-1.5 text-ink-300">·</span>
          <a
            href={`https://wa.me/${COMPANY.phoneWa}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink-800"
          >
            {COMPANY.phoneDisplay}
          </a>
        </p>

        <p className="text-caption leading-relaxed text-ink-400">
          {COMPANY.address.street}
          <br />
          {COMPANY.address.village}
          <br />
          {COMPANY.address.city}
        </p>

        <p className="pt-1 text-caption text-ink-400">{copyrightLine()}</p>
      </div>
    </footer>
  )
}
