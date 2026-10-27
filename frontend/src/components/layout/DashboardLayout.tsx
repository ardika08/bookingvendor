import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { fetchCurrentUser } from '@/lib/auth-session'
import type { CurrentUser } from '@/types/booking'

/**
 * Kerangka dashboard vendor.
 *
 * Layout dua kolom: sidebar tetap di desktop (≥lg) dan drawer di mobile.
 * Judul topbar diturunkan dari route agar setiap halaman tidak perlu
 * mengirim props navigasi sendiri.
 *
 * User dimuat dari `GET /api/me` — RoleGate sudah memastikan sesi valid
 * sebelum layout ini dirender, jadi di sini error hanya terjadi bila sesi
 * berakhir di tengah navigasi.
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
  const [user, setUser] = useState<CurrentUser | null>(null)
  const location = useLocation()

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    let cancelled = false
    fetchCurrentUser()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch(() => {
        // RoleGate menangani redirect ke /login bila sesi tidak valid.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const title = resolveTitle(location.pathname)

  // Skeleton ringan sebelum data user tersedia.
  if (user === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-50">
        <div className="size-6 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-ink-50">
      {/* Landmark diberi nama karena ada dua <aside> (desktop + drawer mobile);
          tanpa aria-label keduanya tidak terbedakan saat berpindah landmark
          (WCAG 1.3.1, axe: landmark-unique). */}
      <aside
        aria-label="Navigasi utama"
        className="fixed inset-y-0 left-0 hidden w-60 border-r border-ink-200/80 lg:block"
      >
        <Sidebar />
      </aside>

      <div className="lg:pl-60">
        <Topbar
          user={user}
          title={title}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        {/*
          * Lebar konten dibuat lebar (bukan max-w-5xl) karena halaman booking
          * memakai tata letak dua kolom: panel status tanggal + kartu ringkasan.
          * Pada 5xl keduanya saling menghimpit dan tabel mulai terpotong.
          */}
        <main className="mx-auto max-w-[86rem] px-4 py-5 sm:px-6">
          <Outlet context={{ user }} />
        </main>
      </div>

      {/* Drawer sidebar untuk mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-900/40"
            onClick={() => setSidebarOpen(false)}
          />
              <aside
            aria-label="Navigasi utama (menu seluler)"
            className="absolute inset-y-0 left-0 w-64 border-r border-ink-200 bg-white"
          >
            <Sidebar />
          </aside>
        </div>
      )}
    </div>
  )
}
