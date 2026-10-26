import { AlertTriangle, RefreshCw, X } from 'lucide-react'
import { ApiError } from '@/lib/api/client'

/**
 * Banner error untuk kegagalan submit form.
 *
 * Menerjemahkan `ApiError` menjadi pesan yang bisa ditindaklanjuti vendor:
 * 422 menampilkan pesan per field, error jaringan memberi tombol coba lagi,
 * dan penolakan trial ditangani terpisah oleh `UpgradeModal`.
 */
export function SubmitErrorBanner({
  error,
  onRetry,
  onDismiss,
}: {
  error: ApiError | Error | null
  onRetry?: () => void
  onDismiss?: () => void
}) {
  if (!error) return null

  const fieldErrors = error instanceof ApiError ? Object.entries(error.fieldErrors) : []
  const isNetwork = error instanceof ApiError && error.status === 0

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-rose-800">{error.message}</p>

        {fieldErrors.length > 0 ? (
          <ul className="mt-1.5 space-y-0.5">
            {fieldErrors.slice(0, 4).map(([field, message]) => (
              <li key={field} className="text-[11.5px] text-rose-700">
                <span className="font-medium">{fieldLabel(field)}:</span> {message}
              </li>
            ))}
          </ul>
        ) : null}

        {isNetwork && onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[11.5px] font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
          >
            <RefreshCw className="size-3" />
            Coba lagi
          </button>
        ) : null}
      </div>

      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded p-1 text-rose-400 hover:bg-rose-100 hover:text-rose-700"
          aria-label="Tutup pesan"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}

/** Nama field API (`event_date`) → label manusiawi untuk pesan error. */
function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    'client.name': 'Nama klien',
    'client.phone': 'No. WhatsApp',
    'client.email': 'Email',
    event_date: 'Tanggal acara',
    event_time: 'Jam acara',
    event_location: 'Lokasi',
    total_price: 'Nilai kontrak',
    package_id: 'Paket',
    status: 'Status',
    notes: 'Catatan',
  }
  return labels[field] ?? field
}
