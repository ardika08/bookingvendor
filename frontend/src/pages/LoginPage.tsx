import { LoaderCircle, ShieldCheck, X } from '@/components/ui/icons'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { clearAuthRole, readAuthRole, saveAuthRole, type AuthRole } from '@/lib/auth-session'
import { GoogleMark } from '@/components/auth/GoogleMark'

/**
 * Halaman masuk (`/login`) — pintu satu-satunya ke aplikasi.
 *
 * PRD: masuk hanya lewat akun Google (satu klik), tanpa registrasi publik.
 * Tombol "Masuk dengan Google" mengarah ke `/auth/google/redirect` yang
 * ditangani server (redirect flow). Setelah OAuth, server mengalihkan ke
 * `/dashboard` atau `/admin` sesuai peran.
 *
 * Saat APP_ENV=local, baris "Dev login" muncul untuk mengetes alur SPA tanpa
 * kredensial Google — server langsung membuat sesi sebagai vendor pertama.
 */

export function LoginPage() {
  const [sessionRole, setSessionRole] = useState<AuthRole | null>(() => readAuthRole())
  const [error, setError] = useState<string | null>(null)
  const connected = useRef(true)

  useEffect(() => {
    connected.current = true
    return () => {
      connected.current = false
    }
  }, [])

  /** Pesan error dari redirect OAuth (?error=…). */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('error')
    if (!code) return

    const messages: Record<string, string> = {
      oauth_failed: 'Gagal menghubungkan ke Google. Coba lagi.',
      account_not_registered:
        'Akun Google ini belum terdaftar. Minta admin platform menambahkan vendor terlebih dahulu.',
      account_inactive: 'Akun ini dinonaktifkan. Hubungi admin platform.',
      // Akun vendor ada, tetapi baris `vendors` belum dibuat. Biasanya berarti
      // database belum di-seed, bukan akun yang salah.
      vendor_profile_missing:
        'Akun vendor ini belum punya profil usaha. Jalankan `php artisan db:seed` untuk membuat profil contoh.',
    }
    setError(messages[code] ?? 'Terjadi kesalahan saat masuk.')
    window.history.replaceState(null, '', '/login')
  }, [])

  /** Login dev: langsung redirect ke /auth/dev-login (server membuat sesi). */
  function handleDevLogin() {
    window.location.href = '/auth/dev-login'
  }

  /** Hapus sesi aktif lalu segarkan tampilan halaman masuk. */
  function handleClearSession() {
    clearAuthRole()
    setSessionRole(null)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-xl bg-brand-400 text-lead text-ink-900">
            BV
          </span>
          <h1 className="mt-4 text-heading tracking-tight text-ink-900">
            Booking Vendor
          </h1>
          <p className="mt-1.5 text-body leading-relaxed text-ink-500">
            Satu tempat mencatat booking, mengelola jadwal, dan menagih klien —
            khusus vendor pernikahan.
          </p>
        </div>

        {sessionRole !== null ? (
          <div className="mb-4 mt-6 flex items-center justify-between gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-meta">
            <span className="min-w-0 truncate text-ink-600">
              Sesi aktif:{' '}
              <span className="font-medium text-ink-800">
                {sessionRole === 'admin' ? 'Admin' : 'Vendor'}
              </span>
            </span>
            <button
              type="button"
              onClick={handleClearSession}
              className="shrink-0 font-medium text-brand-700 hover:underline"
            >
              Keluar
            </button>
          </div>
        ) : null}

        <div className={sessionRole !== null ? 'rounded-2xl border border-ink-200/80 bg-white p-6 shadow-sm' : 'mt-6 rounded-2xl border border-ink-200/80 bg-white p-6 shadow-sm'}>
          {error ? (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5"
            >
              <p className="min-w-0 flex-1 text-meta leading-relaxed text-rose-800">{error}</p>
              <button
                type="button"
                onClick={() => setError(null)}
                className="rounded p-0.5 text-rose-400 hover:bg-rose-100 hover:text-rose-700"
                aria-label="Tutup pesan"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : null}

          <a
            href="/auth/google/redirect"
            className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-ink-200 bg-white text-body font-medium text-ink-800 shadow-sm transition-colors hover:bg-ink-50"
          >
            <GoogleMark />
            Masuk dengan Google
          </a>

          <p className="mt-4 text-center text-caption leading-relaxed text-ink-400">
            Tidak ada registrasi publik. Akun vendor &amp; admin disiapkan admin —
            cukup masuk lewat akun Google yang terdaftar.
          </p>

          {/* Dev bypass: hanya muncul saat APP_ENV=local. Server mengembalikan
              404 untuk endpoint ini di environment lain, jadi tombol ini
              aman untuk dibiarkan di kode. */}
          <div className="mt-4 border-t border-dashed border-ink-200 pt-3">
            <p className="text-center text-2xs font-semibold uppercase tracking-wider text-ink-500">
              Dev login (tanpa Google)
            </p>
            <button
              type="button"
              onClick={handleDevLogin}
              className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-ink-100 text-meta font-medium text-ink-700 transition-colors hover:bg-ink-200"
            >
              <LoaderCircle className="size-3.5" />
              Masuk sebagai vendor uji
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-meta text-ink-400">
          Mengelola platform?{' '}
          <Link
            to="/admin"
            onClick={() => saveAuthRole('admin')}
            className="inline-flex items-center gap-1 font-medium text-ink-600 hover:text-ink-900"
          >
            <ShieldCheck className="size-3.5" />
            Panel admin
          </Link>
        </p>
      </div>
    </div>
  )
}
