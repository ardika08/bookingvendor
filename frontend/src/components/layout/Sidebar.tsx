import {
  CalendarClock,
  CalendarDays,
  Crown,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Package,
  Settings2,
  Telegram,
  UserRound,
  Users,
  type IconComponent,
} from '@/components/ui/icons'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'

/**
 * Tautan grup Telegram support.
 *
 * Dipasang lewat env var `VITE_SUPPORT_URL` supaya bisa diganti tanpa
 * mengubah kode. Fallback string kosong menyebabkan tombol tidak dirender —
 * kalau env belum diset, sidebar tidak menampilkan link yang menuju ke mana-mana.
 */
const SUPPORT_URL: string = import.meta.env.VITE_SUPPORT_URL ?? ''

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
  { label: 'Paket Layanan', to: '/packages', icon: Package },
  /*
   * Langganan dipisah dari `/upgrade`: halaman itu menumpuk status dan riwayat
   * di bawah katalog paket, sehingga vendor harus menggulir jauh hanya untuk
   * melihat kapan masa aktifnya berakhir.
   */
  { label: 'Langganan', to: '/langganan', icon: Crown },
  { label: 'Akun Saya', to: '/settings/akun', icon: UserRound },
  { label: 'Pengaturan', to: '/settings', icon: Settings2 },
]

export function Sidebar({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  return (
    <div className={cn('flex h-full flex-col bg-white', className)}>
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-400 text-body font-bold text-ink-900">
          VK
        </span>
        <div className="leading-tight">
          <p className="text-body font-semibold text-ink-900">VendorKit</p>
          <p className="text-caption text-ink-400">Dashboard Vendor</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <p className="px-2 pb-1.5 pt-2 text-2xs font-semibold uppercase leading-4 tracking-wider text-ink-400">
          Operasional
        </p>
        <ul className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <NavRow key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </ul>

        <p className="px-2 pb-1.5 pt-5 text-2xs font-semibold uppercase leading-4 tracking-wider text-ink-400">
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
            Tanya jawab, request fitur, atau kirim masukan ke tim kami.
          </p>
          {SUPPORT_URL ? (
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onNavigate}
              className="mt-2.5 flex h-9 items-center justify-center gap-2 rounded-lg bg-brand-400 px-3 text-meta font-semibold text-ink-900 transition-colors hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800"
            >
              <Telegram className="size-4 shrink-0" />
              Gabung grup support
            </a>
          ) : null}
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
          className="flex h-9 cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 text-body font-medium text-ink-400"
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
            /*
             * `h-9` (36px) ditulis eksplisit, bukan dibiarkan tumbuh dari
             * padding + line-height. Sebelumnya tinggi baris jadi 36.14px
             * karena text-body 13px x line-height 1.55 = 20.15px, ditambah
             * py-2 (8+8). Angka 0.14px itu membuat setiap ikon berikutnya
             * bergeser ke koordinat pecahan (112.00, 150.14, 188.28, ...),
             * dan glyph yang digambar di antara dua piksel selalu tampak
             * kabur. Tinggi bulat 36px membuat ikon jatuh tepat di piksel.
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
        {item.badge ? (
          <span className="rounded-full bg-brand-400 px-1.5 py-0.5 text-2xs font-semibold text-ink-900">
            {item.badge}
          </span>
        ) : null}
      </NavLink>
    </li>
  )
}
