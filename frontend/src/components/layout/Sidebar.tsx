import {
  CalendarClock,
  CalendarDays,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Settings2,
  Sparkles,
  UserRound,
  Users,
  type IconComponent,
} from '@/components/ui/icons'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'

/**
 * Sidebar navigasi dashboard vendor.
 *
 * Hanya menu yang memang ada di PRD fase berjalan; entri yang halamannya belum
 * dibangun tetap ditampilkan agar struktur produk terlihat utuh, tetapi
 * ditandai "soon" dan tidak bisa diklik membingungkan pengguna.
 */

interface NavItem {
  label: string
  to: string
  icon: IconComponent
  badge?: string
  soon?: boolean
}

const PRIMARY_NAV: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Booking', to: '/bookings', icon: CalendarDays },
  { label: 'Kalender', to: '/calendar', icon: CalendarClock },
  { label: 'Invoice', to: '/invoices', icon: FileText },
  { label: 'Klien', to: '/clients', icon: Users },
]

const SECONDARY_NAV: NavItem[] = [
  /*
   * Paket Layanan sudah berfungsi penuh (CRUD + dipakai form booking serta
   * halaman jadwal publik), jadi tidak lagi ditandai "soon".
   */
  { label: 'Paket Layanan', to: '/packages', icon: Sparkles },
  { label: 'Akun Saya', to: '/settings/akun', icon: UserRound },
  { label: 'Pengaturan', to: '/settings', icon: Settings2 },
]

export function Sidebar({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  return (
    <div className={cn('flex h-full flex-col bg-white', className)}>
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-body font-bold text-white">
          BV
        </span>
        <div className="leading-tight">
          <p className="text-body font-semibold text-ink-900">Booking Vendor</p>
          <p className="text-caption text-ink-400">Dashboard Vendor</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <p className="px-2 pb-1.5 pt-2 text-2xs font-semibold uppercase tracking-wider text-ink-400">
          Operasional
        </p>
        <ul className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <NavRow key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </ul>

        <p className="px-2 pb-1.5 pt-5 text-2xs font-semibold uppercase tracking-wider text-ink-400">
          Akun
        </p>
        <ul className="space-y-0.5">
          {SECONDARY_NAV.map((item) => (
            <NavRow key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </ul>
      </nav>

      <div className="border-t border-ink-100 p-3">
        <div className="rounded-lg bg-ink-50 p-3">
          <p className="flex items-center gap-1.5 text-meta font-semibold text-ink-800">
            <LifeBuoy className="size-3.5 text-ink-400" />
            Butuh bantuan?
          </p>
          <p className="mt-1 text-caption leading-relaxed text-ink-500">
            Panduan singkat booking, invoice, dan link jadwal publik.
          </p>
        </div>
      </div>
    </div>
  )
}

function NavRow({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
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
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-body font-medium transition-colors',
            isActive
              ? 'bg-brand-50 text-brand-700'
              : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
          )
        }
      >
        <Icon className="size-4" />
        <span className="flex-1">{item.label}</span>
        {item.badge ? (
          <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-2xs font-semibold text-white">
            {item.badge}
          </span>
        ) : null}
      </NavLink>
    </li>
  )
}
