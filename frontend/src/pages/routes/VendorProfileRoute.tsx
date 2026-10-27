import { useCallback, useEffect, useState } from 'react'
import { fetchVendorProfile, updateVendorProfile } from '@/lib/api/vendor-profile'
import { ApiError } from '@/lib/api/client'
import { VendorProfilePage, VendorProfileSkeleton } from '@/pages/VendorProfilePage'
import type {
  VendorProfileDetail,
  VendorProfilePayload,
} from '@/lib/vendor-profile'

/**
 * Route `/settings` — pengaturan profil vendor.
 *
 * Memuat profil dari lapisan API lalu menyerahkannya ke form. Penyimpanan
 * mengembalikan profil terbaru dari server sehingga snapshot "tersimpan" di form
 * ikut diperbarui tanpa fetch ulang.
 */
export function VendorProfileRoute() {
  const { profile, loading, error, reload, setProfile } = useVendorProfile()

  const handleSave = useCallback(
    async (payload: VendorProfilePayload) => {
      const updated = await updateVendorProfile(payload)
      setProfile(updated)
      return updated
    },
    [setProfile],
  )

  if (loading) return <VendorProfileSkeleton />
  if (error || !profile) {
    return (
      <ProfileError
        unauthorized={error instanceof ApiError && error.isUnauthorized}
        message={error instanceof ApiError ? error.message : 'Gagal memuat profil vendor.'}
        onRetry={reload}
      />
    )
  }

  return <VendorProfilePage profile={profile} onSave={handleSave} />
}

function useVendorProfile() {
  const [profile, setProfile] = useState<VendorProfileDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError(null)

    fetchVendorProfile(controller.signal)
      .then((result) => {
        if (active) setProfile(result)
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof Error ? cause : new Error('Gagal memuat profil vendor.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [reloadToken])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  return { profile, loading, error, reload, setProfile }
}

function ProfileError({
  unauthorized,
  message,
  onRetry,
}: {
  unauthorized: boolean
  message: string
  onRetry: () => void
}) {
  return (
    <div className="rounded-xl border border-ink-200/80 bg-white px-6 py-12 text-center">
      <p className="text-lead font-semibold text-ink-800">
        {unauthorized ? 'Sesi kamu berakhir' : 'Gagal memuat profil'}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-body leading-relaxed text-ink-500">
        {unauthorized
          ? 'Masuk kembali dengan akun Google untuk melanjutkan.'
          : message || 'Periksa koneksi internet lalu coba lagi.'}
      </p>
      {!unauthorized ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-body font-medium text-white hover:bg-brand-700"
        >
          Coba lagi
        </button>
      ) : null}
    </div>
  )
}
