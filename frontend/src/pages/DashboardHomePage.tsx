import { ArrowLeft, Construction } from 'lucide-react'
import { Link, useOutletContext } from 'react-router-dom'
import { cn } from '@/lib/cn'
import type { CurrentUser } from '@/types/booking'
import { DashboardPage } from './DashboardPage'

/**
 * Titik masuk route dashboard.
 *
 * `/dashboard` kini menampilkan ringkasan operasional vendor (pesanan masuk,
 * jadwal terdekat, piutang). Daftar booking lengkap ada di `/bookings`.
 */

export function DashboardHomePage() {
  return <DashboardPage />
}

export function PlaceholderPage({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-300 bg-white px-6 py-16 text-center">
      <Construction className="mx-auto size-6 text-ink-400" />
      <h2 className="mt-3 text-lead text-ink-900">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-body text-ink-500">{note}</p>
      <Link
        to="/bookings"
        className={cn(
          'mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-body font-medium',
          'text-ink-700 shadow-sm ring-1 ring-ink-200 hover:bg-ink-50',
        )}
      >
        <ArrowLeft className="size-3.5" /> Kembali ke daftar booking
      </Link>
    </div>
  )
}

/** Context dari DashboardLayout: user yang sedang login beserta langganannya. */
export function useDashboardUser(): CurrentUser {
  return useOutletContext<{ user: CurrentUser }>().user
}
