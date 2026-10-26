import { LoaderCircle, ShieldCheck, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clearAuthRole, readAuthRole, saveAuthRole, type AuthRole } from '@/lib/auth-session'
import { GoogleMark } from '@/components/auth/GoogleMark'

/**
 * Halaman masuk (`/login`) — pintu satu-satunya ke aplikasi.
 *
 * PRD: masuk hanya lewat akun Google (satu klik), tanpa registrasi publik.
 * Setelah OAuth, backend menentukan arah peran: vendor → dashboard, admin →
 * panel admin.
 *
 * Fase frontend: klik tombol memutar simulasi "menghubungkan ke Google" lalu
 * masuk sesuai peran. Baris kecil "Simulasi alur" menyediakan skenario gagal
 * (akun belum terdaftar) agar state error bisa diuji tanpa backend — baris ini
 * dihapus saat integrasi OAuth nyata.
 */

type LoginStatus = 'idle' | 'connecting'

const CONNECT_DELAY = 900
const FAILURE_MESSAGE =
  'Akun Google ini belum terdaftar. Minta admin platform menambahkan vendor terlebih dahulu.'

export function LoginPage() {
  const navigate = useNavigate()
  const [sessionRole, setSessionRole] = useState<AuthRole | null>(() => readAuthRole())
  const [status, setStatus] = useState<LoginStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const connected = useRef(true)

  useEffect(() => {
    connected.current = true
    return () => {
      connected.current = false
    }
  }, [])

  const connecting = status === 'connecting'

  /** Selesaikan simulasi login untuk satu peran. */
  function finishLogin(role: AuthRole) {
    saveAuthRole(role)
    setSessionRole(role)
    navigate(role === 'admin' ? '/admin' : '/dashboard')
  }

  /** Alur sukses: tunggu sebentar seolah OAuth, lalu masuk. */
  async function handleGoogle(role: AuthRole) {
    setStatus('connecting')
    setError(null)
    await delay(CONNECT_DELAY)

    if (!connected.current) return
    finishLogin(role)
  }

  /** Alur gagal: akun Google belum terdaftar sebagai vendor/admin. */
  async function handleSimulateFailure() {
    setStatus('connecting')
    setError(null)
    await delay(CONNECT_DELAY)

    if (!connected.current) return
    clearAuthRole()
    setSessionRole(null)
    setStatus('idle')
    setError(FAILURE_MESSAGE)
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
          <span className="inline-flex size-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            BV
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink-900">
            Booking Vendor
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
            Satu tempat mencatat booking, mengelola jadwal, dan menagih klien —
            khusus vendor pernikahan.
          </p>
        </div>

        {sessionRole !== null ? (
          <div className="mb-4 mt-6 flex items-center justify-between gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-[12px]">
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
              <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-rose-800">{error}</p>
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

          <button
            type="button"
            disabled={connecting}
            onClick={() => void handleGoogle('vendor')}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-ink-200 bg-white text-sm font-medium text-ink-800 shadow-sm transition-colors hover:bg-ink-50 disabled:cursor-wait disabled:opacity-70"
          >
            {connecting ? (
              <>
                <LoaderCircle className="size-4 shrink-0 animate-spin text-ink-400" />
                Menghubungkan ke Google…
              </>
            ) : (
              <>
                <GoogleMark />
                Masuk dengan Google
              </>
            )}
          </button>

          <p className="mt-4 text-center text-[11.5px] leading-relaxed text-ink-400">
            Tidak ada registrasi publik. Akun vendor & admin disiapkan admin —
            cukup masuk lewat akun Google yang terdaftar.
          </p>

          <SimulationRow
            disabled={connecting}
            onVendor={() => void handleGoogle('vendor')}
            onAdmin={() => void handleGoogle('admin')}
            onFail={() => void handleSimulateFailure()}
          />        </div>

        <p className="mt-6 text-center text-[12px] text-ink-400">
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

/**
 * Baris simulasi alur (khusus fase frontend).
 *
 * Tiga skenario: sukses vendor, sukses admin, dan gagal. Saat integrasi OAuth
 * nyata, baris ini tidak lagi dirender.
 */
function SimulationRow({
  disabled,
  onVendor,
  onAdmin,
  onFail,
}: {
  disabled: boolean
  onVendor: () => void
  onAdmin: () => void
  onFail: () => void
}) {
  return (
    <div className="mt-4 border-t border-dashed border-ink-200 pt-3">
      <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-ink-300">
        Simulasi alur (uji frontend)
      </p>
      <div className="mt-2 flex items-center justify-center gap-1.5">
        <SimulationButton label="Sukses · Vendor" disabled={disabled} onClick={onVendor} />
        <SimulationButton label="Sukses · Admin" disabled={disabled} onClick={onAdmin} />
        <SimulationButton label="Gagal" disabled={disabled} onClick={onFail} />
      </div>
    </div>
  )
}

function SimulationButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md px-2 py-1 text-[11px] font-medium text-ink-500 ring-1 ring-ink-200 transition-colors hover:bg-ink-50 hover:text-ink-800 disabled:opacity-50"
    >
      {label}
    </button>
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
