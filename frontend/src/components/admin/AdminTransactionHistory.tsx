import { useEffect, useState } from 'react'
import { Receipt } from '@/components/ui/icons'
import {
  fetchAdminTransactions,
  type AdminTransaction,
  type AdminTransactionPage,
} from '@/lib/api/admin-dashboard'
import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Riwayat transaksi langganan di bawah grafik dashboard admin.
 *
 * Semua status ditampilkan (lunas, menunggu, gagal, kedaluwarsa) supaya admin
 * bisa melihat transaksi yang belum selesai. Paginasi dipatok 10 per halaman
 * di server — komponen ini hanya mengirim nomor halaman.
 */
export function AdminTransactionHistory() {
  const [data, setData] = useState<AdminTransactionPage | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)

    fetchAdminTransactions(page, controller.signal)
      .then((result) => {
        if (!active) return
        setData(result)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof Error ? cause : new Error('Gagal memuat riwayat transaksi.'))
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [page])

  const items = data?.items ?? []
  const totalPages = data?.totalPages ?? 1
  const total = data?.total ?? 0
  const perPage = data?.perPage ?? 10

  const firstRow = total === 0 ? 0 : (page - 1) * perPage + 1
  const lastRow = (page - 1) * perPage + items.length

  return (
    <section className="rounded-xl border border-ink-200/80 bg-white">
      <header className="flex items-start gap-2.5 px-5 pt-5">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Receipt className="size-4" />
        </span>
        <div>
          <h2 className="text-lead font-semibold text-ink-900">Riwayat transaksi</h2>
          <p className="mt-0.5 text-meta text-ink-500">
            Pembayaran langganan vendor, terbaru di atas.
          </p>
        </div>
      </header>

      {error ? (
        <p className="px-5 py-10 text-center text-body text-ink-500">{error.message}</p>
      ) : loading && items.length === 0 ? (
        <TableSkeleton />
      ) : items.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-meta font-medium text-ink-700">Belum ada transaksi</p>
          <p className="mx-auto mt-1 max-w-xs text-caption text-ink-500">
            Transaksi muncul setelah vendor membayar paket langganan.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: tabel. Di layar kecil tabel diganti daftar kartu di bawah. */}
          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-meta">
              <caption className="sr-only">
                Riwayat transaksi langganan vendor, halaman {page} dari {totalPages}
              </caption>
              <thead>
                <tr className="border-y border-ink-100 bg-ink-50/60 text-left">
                  <th scope="col" className="px-5 py-2 font-medium text-ink-500">
                    Tanggal
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium text-ink-500">
                    Vendor
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium text-ink-500">
                    Paket
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium text-ink-500">
                    Jumlah
                  </th>
                  <th scope="col" className="px-5 py-2 text-right font-medium text-ink-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-ink-100 last:border-0">
                    <td className="whitespace-nowrap px-5 py-2.5 text-ink-700">
                      {formatTransactionDate(item)}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-ink-900">{item.vendorName}</td>
                    <td className="px-3 py-2.5 text-ink-600">{item.planName}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-ink-900">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Layar kecil: kartu, karena tabel 5 kolom tidak terbaca di ponsel. */}
          <ul className="mt-4 divide-y divide-ink-100 sm:hidden">
            {items.map((item) => (
              <li key={item.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-900">{item.vendorName}</p>
                    <p className="mt-0.5 text-caption text-ink-500">
                      {item.planName} · {formatTransactionDate(item)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular-nums font-medium text-ink-900">
                      {formatCurrency(item.amount)}
                    </p>
                    <div className="mt-1">
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2 border-t border-ink-100 px-5 py-2.5 text-meta text-ink-500 sm:flex-row sm:items-center sm:justify-between">
            <span className="tabular-nums">
              Menampilkan {firstRow}–{lastRow} dari {total} transaksi
              {loading ? ' · memuat…' : ''}
            </span>

            {totalPages > 1 ? (
              <nav aria-label="Navigasi halaman transaksi" className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="rounded-md px-2 py-1 font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900 disabled:cursor-not-allowed disabled:text-ink-300 disabled:hover:bg-transparent"
                >
                  Sebelumnya
                </button>
                <span className="tabular-nums text-ink-500">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="rounded-md px-2 py-1 font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900 disabled:cursor-not-allowed disabled:text-ink-300 disabled:hover:bg-transparent"
                >
                  Berikutnya
                </button>
              </nav>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}

/** Tanggal transaksi: pakai waktu lunas bila ada, jika tidak waktu dibuat. */
function formatTransactionDate(item: AdminTransaction): string {
  const iso = item.paidAt ?? item.createdAt
  if (!iso) return '—'
  return formatDate(iso.slice(0, 10))
}

const STATUS_LABEL: Record<AdminTransaction['status'], string> = {
  paid: 'Lunas',
  pending: 'Menunggu',
  failed: 'Gagal',
  expired: 'Kedaluwarsa',
  refunded: 'Dikembalikan',
}

/*
 * Warna badge memakai pasangan latar-muda + teks-gelap agar kontras tetap
 * lolos WCAG di atas latar putih. Teks `*-700` di atas `*-50` >= 4.5:1.
 */
const STATUS_CLASS: Record<AdminTransaction['status'], string> = {
  paid: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  failed: 'bg-red-50 text-red-700',
  expired: 'bg-ink-100 text-ink-600',
  refunded: 'bg-violet-50 text-violet-700',
}

function StatusBadge({ status }: { status: AdminTransaction['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium',
        STATUS_CLASS[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function TableSkeleton() {
  return (
    <div className="mt-4 space-y-2 px-5 pb-5" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded bg-ink-50" />
      ))}
    </div>
  )
}
