import { formatCurrency } from '@/lib/format'
import type { InvoiceAddon } from '@/types/invoice'

/**
 * Rincian baris satu invoice: paket dasar + setiap addon yang dipilih klien.
 *
 * Dipakai dua tempat — halaman invoice vendor dan halaman invoice publik —
 * supaya angka yang dilihat klien dan vendor selalu identik. Addon yang
 * ditampilkan adalah snapshot saat booking dibuat (nama & harga dibekukan),
 * jadi katalog addon yang berubah tidak menggeser invoice lama.
 */
export function InvoiceLineItems({
  packageName,
  packagePrice,
  addons,
}: {
  packageName: string | null
  packagePrice: number
  addons: InvoiceAddon[]
}) {
  return (
    <div className="space-y-2.5 text-body">
      <InvoiceLineRow
        label={packageName ?? 'Tanpa paket'}
        amount={packagePrice}
        muted={!packageName}
      />
      {addons.map((addon) => (
        <InvoiceLineRow key={addon.id} label={addon.name} amount={addon.price} />
      ))}
    </div>
  )
}

function InvoiceLineRow({
  label,
  amount,
  muted = false,
}: {
  label: string
  amount: number
  muted?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={muted ? 'text-ink-400' : 'text-ink-700'}>{label}</span>
      <span className={muted ? 'tabular-nums text-ink-400' : 'tabular-nums text-ink-700'}>
        {formatCurrency(amount)}
      </span>
    </div>
  )
}
