import {
  BarChart3,
  CreditCard,
  LifeBuoy,
  Settings2,
  UserRound,
  Users,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { Topbar } from '@/components/layout/Topbar'
import { mockAdminUser } from '@/lib/mock/admin'
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
 */

interface AdminNavItem {
  label: string
  to: string
  icon: LucideIcon
  soon?: boolean
}

const ADMIN_NAV: AdminNavItem[] = [
  { label: 'Kelola Vendor', to: '/admin/vendors', icon: Users },
  { label: 'Paket Langganan', to: '/admin/plans', icon: CreditCard },
  { label: 'Laporan', to: '/admin/reports', icon: BarChart3, soon: true },
  { label: 'Akun Saya', to: '/admin/akun', icon: UserRound },
  { label: 'Pengaturan', to: '/admin/settings', icon: Settings2, soon: true },
]

/** Judul topbar untuk route admin. */
function resolveTitle(pathname: string): string {
  if (/^\/admin\/vendors(\/|$)/.test(pathname)) {
    if (pathname === '/admin/vendors/new') return 'Tambah Vendor'
    if (/^\/admin\/vendors\/[^/]+\/edit$/.test(pathname)) return 'Edit Vendor'
    if (/^\/admin\/vendors\/[^/]+$/.test(pathname)) return 'Detail Vendor'
    return 'Kelola Vendor'
  }
  if (/^\/admin\/plans(\/|$)/.test(pathname)) return 'Konfigurasi Paket'
  if (/^\/admin\/akun(\/|$)/.test(pathname)) return 'Akun Saya'
  return 'Dashboard Admin'
}

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const user: CurrentUser = mockAdminUser

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const title = resolveTitle(location.pathname)

  return (
    <div className="min-h-dvh bg-ink-50">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-ink-200/80 lg:block">
        <AdminSidebar />
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
            <AdminSidebar onNavigate={() => setSidebarOpen(false)} />
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

/** Context dari AdminLayout: akun admin yang sedang login. */
export function useAdminUser(): CurrentUser {
  return useOutletContext<{ user: CurrentUser }>().user
}

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-ink-900 text-body font-bold text-white">
          BV
        </span>
        <div className="leading-tight">
          <p className="text-body font-semibold text-ink-900">Booking Vendor</p>
          <p className="inline-flex items-center gap-1 text-caption text-ink-400">
            <ShieldCheck className="size-3" />
            Panel Admin
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <p className="px-2 pb-1.5 pt-2 text-2xs font-semibold uppercase tracking-wider text-ink-400">
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
          className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-body font-medium text-ink-400"
          aria-disabled="true"
          title="Belum tersedia"
        >
          <Icon className="size-4" />
          <span className="flex-1">{item.label}</span>
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
        end={item.to === '/admin/vendors'}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-body font-medium transition-colors',
            isActive
              ? 'bg-ink-900 text-white'
              : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
          )
        }
      >
        <Icon className="size-4" />
        <span className="flex-1">{item.label}</span>
      </NavLink>
    </li>
  )
}
