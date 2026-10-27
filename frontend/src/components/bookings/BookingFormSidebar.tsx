import { X } from '@/components/ui/icons'
import { formatCurrency } from '@/lib/format'
import type { VendorPackage } from '@/types/booking'

/**
 * Panel samping form booking: ringkasan isian sambil mengetik, pilihan paket
 * cepat, dan tanggal yang sudah terisi (double booking guard).
 *
 * Di desktop menempel di kanan form; di mobile menjadi kartu biasa di bawah.
 */
export function BookingFormSidebar({
  packages,
  selectedPackageId,
  onSelectPackage,
  clientName,
  eventDate,
  eventTime,
  totalPrice,
  takenDates,
  onPickTakenDate,
}: {
  packages: VendorPackage[]
  selectedPackageId: string
  onSelectPackage: (packageId: string) => void
  clientName: string
  eventDate: string
  eventTime: string
  totalPrice: number
  takenDates: string[]
  onPickTakenDate?: (date: string) => void
}) {
  return (
    <aside className="space-y-3 lg:sticky lg:top-20">
      <div className="rounded-xl border border-ink-200/80 bg-white p-4">
        <h3 className="text-meta font-semibold uppercase tracking-wide text-ink-400">
          Ringkasan booking
        </h3>
        <dl className="mt-3 space-y-2 text-meta">
          <Row label="Klien" value={clientName.trim() || '—'} />
          <Row label="Tanggal" value={eventDate || '—'} mono />
          <Row label="Jam" value={eventTime || '—'} mono />
          <Row
            label="Nilai kontrak"
            value={totalPrice > 0 ? formatCurrency(totalPrice) : '—'}
            strong
          />
        </dl>
      </div>

      <div className="rounded-xl border border-ink-200/80 bg-white p-4">
        <h3 className="text-meta font-semibold uppercase tracking-wide text-ink-400">
          Paket cepat
        </h3>
        <p className="mt-0.5 text-caption text-ink-400">Isi nama paket &amp; harga otomatis.</p>
        <ul className="mt-2.5 space-y-1.5">
          {packages.map((pkg) => {
            const active = pkg.id === selectedPackageId
            return (
              <li key={pkg.id}>
                <button
                  type="button"
                  onClick={() => onSelectPackage(pkg.id)}
                  className={
                    active
                      ? 'w-full rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-left'
                      : 'w-full rounded-lg border border-ink-200 px-3 py-2 text-left hover:border-ink-300 hover:bg-ink-50'
                  }
                >
                  <span className="block truncate text-meta font-medium text-ink-800">
                    {pkg.name}
                  </span>
                  <span className="block text-caption text-ink-500">
                    {formatCurrency(pkg.price)}
                  </span>
                </button>
              </li>
            )
          })}
          {packages.length === 0 ? (
            <li className="rounded-lg border border-dashed border-ink-200 px-3 py-3 text-meta text-ink-400">
              Belum ada paket. Isi manual di form.
            </li>
          ) : null}
        </ul>
      </div>

      <div className="rounded-xl border border-ink-200/80 bg-white p-4">
        <h3 className="text-meta font-semibold uppercase tracking-wide text-ink-400">
          Tanggal sudah terisi
        </h3>
        <p className="mt-0.5 text-caption text-ink-400">
          Tanggal ini tidak bisa dipilih agar tidak bentrok.
        </p>
        {takenDates.length === 0 ? (
          <p className="mt-2 text-meta text-ink-400">Semua tanggal masih kosong.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {takenDates.slice(0, 8).map((date) => (
              <button
                key={date}
                type="button"
                onClick={() => onPickTakenDate?.(date)}
                className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-2 py-1 text-caption font-medium text-ink-600 hover:bg-rose-50 hover:text-rose-700"
                title="Tanggal sudah terisi — coba tanggal lain"
              >
                {date.slice(8, 10)}/{date.slice(5, 7)}/{date.slice(0, 4)}
              </button>
            ))}
            {takenDates.length > 8 ? (
              <span className="inline-flex items-center rounded-md px-1.5 py-1 text-caption text-ink-400">
                +{takenDates.length - 8} lagi
              </span>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  )
}

function Row({
  label,
  value,
  strong,
  mono,
}: {
  label: string
  value: string
  strong?: boolean
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd
        className={[
          'truncate text-right',
          strong ? 'font-semibold text-ink-900' : 'text-ink-800',
          mono ? 'tabular-nums' : '',
        ].join(' ')}
      >
        {value}
      </dd>
    </div>
  )
}

/** Tombol tutup kecil untuk banner informasi di atas form. */
export function DismissButton({ onDismiss, label }: { onDismiss: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      className="rounded p-1 text-ink-400 hover:bg-white hover:text-ink-700"
      aria-label={label}
    >
      <X className="size-3.5" />
    </button>
  )
}
