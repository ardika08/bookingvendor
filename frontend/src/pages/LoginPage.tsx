import { LoaderCircle, ShieldCheck } from '@/components/ui/icons'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { saveAuthRole } from '@/lib/auth-session'
import { loginWithEmail } from '@/lib/api/login'
import { Field, inputClass } from '@/components/ui/Field'
import { ApiError } from '@/lib/api/client'

/**
 * Halaman masuk (`/login`) — pintu satu-satunya ke aplikasi.
 *
 * Sebelumnya masuk lewat Google (OAuth). Sekarang pakai email + kata sandi:
 * vendor mendaftar sendiri dengan kredensial tersebut, admin ditambahkan lewat
 * tinker dengan password yang di-hash.
 *
 * Setelah berhasil, pengguna diarahkan ke `/dashboard` (vendor) atau `/admin`
 * (admin) sesuai role dari respons server.
 */
export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const connected = useRef(true)

  useEffect(() => {
    connected.current = true
    return () => {
      connected.current = false
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await loginWithEmail(email.trim().toLowerCase(), password, remember)
      saveAuthRole(result.role)

      if (!connected.current) return
      navigate(result.role === 'admin' ? '/admin' : '/dashboard', { replace: true })
    } catch (err) {
      if (!connected.current) return
      if (err instanceof ApiError && err.isUnauthorized) {
        setError('Email atau kata sandi salah.')
      } else if (err instanceof ApiError && err.fieldErrors?.email) {
        setError(err.fieldErrors.email)
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.')
      }
    } finally {
      if (connected.current) setLoading(false)
    }
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

        {error ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-meta leading-relaxed text-red-800">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <Field id="email" label="Email" required>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
              placeholder="nama@email.com"
              className={inputClass(false)}
            />
          </Field>

          <Field id="password" label="Kata sandi" required>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              minLength={8}
              placeholder="••••••••"
              className={inputClass(false)}
            />
          </Field>

          <label className="flex items-center gap-2 text-meta text-ink-600">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            Ingat saya
          </label>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-400 px-4 text-body font-medium text-ink-900 shadow-sm transition-colors hover:bg-brand-500 active:bg-brand-600 disabled:opacity-60"
          >
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <div className="mt-6 space-y-3">
          <p className="text-center text-meta text-ink-500">
            Belum punya akun?{' '}
            <Link to="/daftar" className="font-medium text-brand-700 hover:text-brand-800">
              Daftar gratis 30 hari
            </Link>
          </p>
          <p className="flex items-center justify-center gap-1.5 text-caption text-ink-400">
            <ShieldCheck className="size-3.5" />
            Email dan kata sandi kamu aman — dienkripsi di server.
          </p>
        </div>
      </div>
    </div>
  )
}
