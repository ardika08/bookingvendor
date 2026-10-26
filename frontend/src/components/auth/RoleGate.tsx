import { Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  clearAuthRole,
  fetchCurrentUser,
  isAuthError,
  readAuthRole,
  saveAuthRole,
  type AuthRole,
} from '@/lib/auth-session'

/**
 * Gerbang peran untuk area dashboard.
 *
 * Saat mount, menanyakan `GET /api/me` untuk memastikan sesi server masih
 * valid dan peran cocok dengan route yang dibuka:
 * - belum login → `/login`;
 * - login sebagai vendor tapi membuka `/admin` → diarahkan ke `/dashboard`;
 * - login sebagai admin tapi membuka `/dashboard` → diarahkan ke `/admin`.
 *
 * Sebelum /me selesai, RoleGate memakai role yang di-cache di localStorage
 * agar tidak ada kedipan redirect ke /login saat halaman baru dimuat.
 */
export function RoleGate({ role, children }: { role: AuthRole; children: ReactNode }) {
  const cached = readAuthRole()
  const [verified, setVerified] = useState<AuthRole | null>(cached)
  const [loading, setLoading] = useState(cached === null)

  useEffect(() => {
    let cancelled = false

    fetchCurrentUser()
      .then((user) => {
        if (cancelled) return
        const serverRole: AuthRole = user.role === 'admin' ? 'admin' : 'vendor'
        saveAuthRole(serverRole)
        setVerified(serverRole)
      })
      .catch((error) => {
        if (cancelled) return
        if (isAuthError(error)) {
          clearAuthRole()
          setVerified(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    // Skeleton ringan saat /me sedang dimuat.
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-50">
        <div className="size-6 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600" />
      </div>
    )
  }

  if (verified === null) {
    return <Navigate to="/login" replace />
  }

  if (verified !== role) {
    return <Navigate to={verified === 'admin' ? '/admin' : '/dashboard'} replace />
  }

  return <>{children}</>
}
