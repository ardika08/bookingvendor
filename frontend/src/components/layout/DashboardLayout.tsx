import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { mockUser } from '@/lib/mock/bookings'
import type { CurrentUser } from '@/types/booking'

/**
 * Kerangka dashboard vendor.
 *
 * Layout dua kolom: sidebar tetap di desktop (≥lg) dan drawer di mobile.
 * Judul topbar diturunkan dari route agar setiap halaman tidak perlu
 * mengirim props navigasi sendiri.
 */

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/bookings': 'Booking',
  '/calendar': 'Kalender',
  '/bookings/new': 'Booking Baru',
  '/settings/akun': 'Akun Saya',
}

/** Judul topbar untuk route bersarang (`/bookings/:id`, `/bookings/:id/edit`). */
function resolveTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname]
  if (/^\/bookings\/[^/]+\/edit$/.test(pathname)) return 'Edit Booking'
  if (/^\/bookings\/[^/]+$/.test(pathname)) return 'Detail Booking'
  return 'Dashboard'
}

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const user: CurrentUser = mockUser

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const title = resolveTitle(location.pathname)

  return (
    <div className="min-h-dvh bg-ink-50">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-ink-200/80 lg:block">
        <Sidebar />
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink-900/40"
            aria-label="Tutup menu"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 border-r border-ink-200 bg-white shadow-xl">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-60">
        <Topbar user={user} title={title} onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  )
}
