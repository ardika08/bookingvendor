import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Settings2,
  UserRound,
  Users,
  ShieldCheck,
  type IconComponent,
} from '@/components/ui/icons'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { Topbar } from '@/components/layout/Topbar'
import { fetchCurrentUser } from '@/lib/auth-session'
import { cn } from '@/lib/cn'
import type { CurrentUser } from '@/types/booking'

/**
 * Kerangka dashboard admin (`/admin`).
 *
 * Terpisah dari dashboard vendor: nav dan brand berbeda, dan topbar tidak
 * menampilkan badge langganan (admin tidak berlangganan). Konteks outlet
 * menyediakan akun admin untuk halaman-halaman di dalamnya.
 *
 * Nav mengikuti cakupan PRD: admin hanya mengelola vendor & langganan, bukan
 * membaca booking vendor.
 *
 * Gaya visual disamakan dengan dashboard vendor: logo BV memakai `brand-400`
 * (gold), item nav aktif memakai `brand-50`/`brand-700`, tinggi baris `h-9`,
 * dan lebar konten `max-w-[86rem]`. Sebelumnya admin memakai `bg-ink-900`
 * (hitam) yang membuat panel terasa dingin dan tidak konsisten dengan identitas
 * merek.
 *
 * Data user dimuat dari `GET /api/me` — sama seperti `DashboardLayout`.
 * Sebelumnya memakai `mockAdminUser` statis, sehingga Topbar selalu menampilkan
 * "Admin Booking Vendor" walaupun yang login adalah admin lain.
 */

interface AdminNavItem {
  label: string
  to: string
  icon: IconComponent
  soon?: boolean
}

const ADMIN_NAV: AdminNavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard },
  { label: 'Kelola Vendor', to: '/admin/vendors', icon: Users },
  { label: 'Paket Langganan', to: '/admin/plans', icon: CreditCard },
  { label: 'Laporan', to: '/admin/reports', icon: BarChart3 },
  { label: 'Akun Saya', to: '/admin/akun', icon: UserRound },
  { label: 'Pengaturan', to: '/admin/settings', icon: Settings2, soon: true },
]

/** Judul topbar untuk route admin. */
function resolveTitle(pathname: string): string {
  if (pathname === '/admin') return 'Dashboard'
  if (/^\/admin\/vendors(\/|$)/.test(pathname)) {
    if (pathname === '/admin/vendors/new') return 'Tambah Vendor'
    if (/^\/admin\/vendors\/[^/]+\/edit$/.test(pathname)) return 'Edit Vendor'
    if (/^\/admin\/vendors\/[^/]+$/.test(pathname)) return 'Detail Vendor'
    return 'Kelola Vendor'
  }
  if (/^\/admin\/plans(\/|$)/.test(pathname)) return 'Konfigurasi Paket'
  if (/^\/admin\/reports(\/|$)/.test(pathname)) return 'Laporan'
  if (/^\/admin\/akun(\/|$)/.test(pathname)) return 'Akun Saya'
  return 'Dashboard Admin'
}

export function AdminLayout() {
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

  // Skeleton ringan sebelum data user tersedia — sama seperti DashboardLayout.
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
        aria-label="Navigasi admin"
        className="fixed inset-y-0 left-0 hidden w-60 border-r border-ink-200/80 lg:block"
      >
        <AdminSidebar />
      </aside>

      <div className="lg:pl-60">
        <Topbar user={user} title={title} onOpenSidebar={() => setSidebarOpen(true)} />
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
            aria-label="Navigasi admin (menu seluler)"
            className="absolute inset-y-0 left-0 w-64 border-r border-ink-200 bg-white"
          >
            <AdminSidebar onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  )
}

/** Context dari AdminLayout: akun admin yang sedang login. */
export function useAdminUser(): CurrentUser {
  return useOutletContext<{ user: CurrentUser }>().user
}

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-16 items-center gap-2.5 px-5">
        {/* Logo BV: brand-400 (gold) + teks gelap, sama seperti sidebar vendor. */}
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-400 text-body font-bold text-ink-900">
          BV
        </span>
        <div className="leading-tight">
          <p className="text-body font-semibold text-ink-900">Booking Vendor</p>
          <p className="inline-flex items-center gap-1 text-caption text-ink-400">
            {/* 14px: di bawah ini ikon perisai terlihat kabur (garis < 1px). */}
            <ShieldCheck className="size-3.5" />
            Panel Admin
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <p className="px-2 pb-1.5 pt-2 text-2xs font-semibold uppercase leading-4 tracking-wider text-ink-400">
          Manajemen
        </p>
        <ul className="space-y-0.5">
          {ADMIN_NAV.map((item) => (
            <AdminNavRow key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </ul>
      </nav>

      <div className="border-t border-ink-100 p-3">
        <div className="rounded-lg bg-ink-50 p-3">
          <p className="flex items-center gap-1.5 text-meta font-semibold text-ink-800">
            <LifeBuoy className="size-3.5 text-ink-400" />
            Perlu cek data?
          </p>
          <p className="mt-1 text-caption leading-relaxed text-ink-500">
            Aktif/nonaktifkan vendor dan kelola masa langganannya dari daftar vendor.
          </p>
        </div>
      </div>
    </div>
  )
}

function AdminNavRow({
  item,
  onNavigate,
}: {
  item: AdminNavItem
  onNavigate?: () => void
}) {
  const Icon = item.icon

  if (item.soon) {
    return (
      <li>
        <span
          className="flex h-9 cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 text-body font-medium text-ink-400"
          aria-disabled="true"
          title="Belum tersedia"
        >
          <Icon className="size-4 shrink-0" />
          <span className="flex-1 leading-none">{item.label}</span>
          <span className="rounded bg-ink-100 px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide text-ink-400">
            soon
          </span>
        </span>
      </li>
    )
  }

  return (
    <li>
      <NavLink
        to={item.to}
        onClick={onNavigate}
        end={item.to === '/admin' || item.to === '/admin/vendors'}
        className={({ isActive }) =>
          cn(
            /*
             * `h-9` (36px) eksplisit + `leading-none` agar tinggi baris tepat
             * bulat dan ikon tidak jatuh di koordinat pecahan. Sama seperti
             * sidebar vendor. Sebelumnya admin memakai `bg-ink-900 text-white`
             * (hitam) untuk item aktif — sekarang `brand-50`/`brand-700` (gold).
             */
            'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-body font-medium transition-colors',
            isActive
              ? 'bg-brand-50 text-brand-700'
              : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
          )
        }
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1 leading-none">{item.label}</span>
      </NavLink>
    </li>
  )
}
