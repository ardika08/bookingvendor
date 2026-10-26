import { Bell, ChevronDown, LogOut, Menu } from 'lucide-react'
import { formatMonthYear, initials } from '@/lib/format'
import { clearAuthRole } from '@/lib/auth-session'
import type { CurrentUser } from '@/types/booking'

/**
 * Topbar dashboard: tombol buka menu di mobile, nama halaman aktif, badge masa
 * trial, dan identitas vendor yang login.
 */
export function Topbar({
  user,
  title,
  onOpenSidebar,
}: {
  user: CurrentUser
  title: string
  onOpenSidebar: () => void
}) {
  const { subscription } = user
  const isTrial = subscription.status === 'trial'

  /** Keluar: redirect ke server logout, yang mengalihkan kembali ke /login. */
  function handleLogout() {
    clearAuthRole()
    // GET /auth/logout menghapus sesi server lalu redirect ke /login.
    window.location.href = '/auth/logout'
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-200/80 bg-white/90 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="inline-flex size-9 items-center justify-center rounded-lg text-ink-600 hover:bg-ink-100 lg:hidden"
        aria-label="Buka menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold text-ink-900">{title}</h1>
        <p className="hidden text-[12px] text-ink-500 sm:block">{user.vendor?.businessName}</p>
      </div>

      {user.role === 'admin' ? null : isTrial ? (
        <span className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200 md:inline-flex">
          Trial · {subscription.trialBookingsUsed}/{subscription.trialBookingsLimit} booking
        </span>
      ) : subscription.status === 'active' && subscription.endsAt ? (
        <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 md:inline-flex">
          Langganan aktif s/d {formatMonthYear(subscription.endsAt.slice(0, 7))}
        </span>
      ) : (
        <span className="hidden items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 ring-1 ring-inset ring-rose-200 md:inline-flex">
          Langganan berakhir
        </span>
      )}

      <button
        type="button"
        className="hidden size-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 sm:inline-flex"
        aria-label="Notifikasi"
      >
        <Bell className="size-4.5" />
      </button>

      <div className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 hover:bg-ink-50">
        <span className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-ink-200 text-[11px] font-semibold text-ink-700">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            initials(user.name)
          )}
        </span>
        <div className="hidden leading-tight sm:block">
          <p className="max-w-[10rem] truncate text-[12px] font-medium text-ink-800">{user.name}</p>
          <p className="text-[11px] text-ink-400">{user.role === 'admin' ? 'Admin' : 'Vendor'}</p>
        </div>
        <ChevronDown className="hidden size-3.5 text-ink-400 sm:block" />
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex size-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-800"
        aria-label="Keluar"
        title="Keluar"
      >
        <LogOut className="size-4" />
      </button>
    </header>
  )
}
