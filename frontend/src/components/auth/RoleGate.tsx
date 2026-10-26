import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { readAuthRole, type AuthRole } from '@/lib/auth-session'

/**
 * Gerbang peran untuk area dashboard.
 *
 * Peran diset saat masuk (`/login`, mock OAuth) dan dicek ulang setiap kali
 * route area dirender:
 * - belum masuk → dilempar ke `/login`;
 * - masuk tanpa sesi cocok (mis. vendor membuka `/admin` lewat URL) →
 *   diarahkan ke dashboard miliknya sendiri, bukan ditolak dengan 403 —
 *   vendor tidak perlu tahu bahwa panel admin ada.
 *
 * Backend nanti menegakkan hal yang sama lewat middleware peran; gerbang ini
 * menjaga pengalaman UI tetap benar sejak fase frontend.
 */
export function RoleGate({ role, children }: { role: AuthRole; children: ReactNode }) {
  const current = readAuthRole()

  if (current === null) {
    return <Navigate to="/login" replace />
  }

  if (current !== role) {
    return <Navigate to={current === 'admin' ? '/admin' : '/dashboard'} replace />
  }

  return <>{children}</>
}
