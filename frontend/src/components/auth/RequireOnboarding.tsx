import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { fetchOnboardingStatus } from '@/lib/api/onboarding'

/**
 * Gerbang onboarding untuk area dashboard vendor.
 *
 * Vendor yang rekening bank-nya belum lengkap tidak boleh memakai dashboard:
 * ia bisa menerbitkan invoice yang tidak bisa dibayar klien. Selama status
 * masih dimuat, gerbang ini **tidak** mengalihkan apa pun — kalau langsung
 * mengalihkan, setiap muat halaman akan berkedip ke `/onboarding` sebelum
 * jawaban server datang.
 *
 * Ini hanya kenyamanan navigasi. Penegak sebenarnya ada di server
 * (`EnsureOnboardingComplete` pada `POST /bookings/{id}/invoices`), karena
 * endpoint API bisa dipanggil langsung tanpa melewati React.
 *
 * Bila status gagal dimuat, gerbang membiarkan halaman lewat: kegagalan
 * jaringan sesaat tidak boleh mengunci vendor dari aplikasinya sendiri.
 */
export function RequireOnboarding({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'blocked' | 'ok'>('loading')

  useEffect(() => {
    let cancelled = false

    fetchOnboardingStatus()
      .then((status) => {
        if (cancelled) return
        setState(status.blockingStep === null ? 'ok' : 'blocked')
      })
      .catch(() => {
        if (cancelled) return
        setState('ok')
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-50">
        <div className="size-6 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600" />
      </div>
    )
  }

  if (state === 'blocked') {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}
