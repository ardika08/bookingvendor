import { Navigate } from 'react-router-dom'
import { useDashboardUser } from '@/pages/DashboardHomePage'
import { resolveAccess } from '@/lib/subscription-access'

/**
 * Gerbang untuk halaman yang **hanya** berisi pembuatan data baru
 * (`/bookings/new`, `/bookings/:id/invoice/new`).
 *
 * Menyembunyikan tombol saja tidak cukup: URL bisa diketik langsung atau
 * di-bookmark. Saat langganan berakhir, vendor dialihkan ke halaman upgrade
 * dengan penanda `?from=expired` supaya alasan pengalihan bisa dijelaskan.
 * Data lama tidak terpengaruh — halaman baca (daftar, detail, kalender,
 * invoice) tetap bisa dibuka.
 */
export function RequireWriteAccess({ children }: { children: React.ReactNode }) {
  const access = resolveAccess(useDashboardUser().subscription)
  if (access.readOnly) return <Navigate to="/upgrade?from=expired" replace />
  return <>{children}</>
}
