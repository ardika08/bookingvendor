import { AlertTriangle, ArrowUpRight, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import {
  INVOICE_STATUS_META,
  INVOICE_TYPE_META,
  isOverdue,
  paidPercent,
  remainingAmount,
} from '@/lib/invoice-status'
import { cn } from '@/lib/cn'
import { formatCurrency, formatShortDate } from '@/lib/format'
import type { Invoice } from '@/types/invoice'

/**
 * Tabel daftar invoice.
 *
 * Di layar ≥md berupa tabel 6 kolom; di ponsel berubah menjadi kartu bertumpuk
 * supaya nomor invoice, klien, nominal, dan status tetap terbaca tanpa scroll
 * horizontal. Baris yang lewat jatuh tempo diberi penanda agar vendor langsung
 * tahu mana yang perlu diingatkan.
 */
export function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto scrollbar-slim md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/60 text-caption font-semibold uppercase tracking-wide text-ink-500">
              <th scope="col" className="py-2.5 pl-5 pr-3">Invoice</th>
              <th scope="col" className="px-3 py-2.5">Klien</th>
              <th scope="col" className="px-3 py-2.5">Tagihan</th>
              <th scope="col" className="px-3 py-2.5">Status</th>
              <th scope="col" className="px-3 py-2.5 text-right">Nominal</th>
              <th scope="col" className="py-2.5 pl-3 pr-5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="group hover:bg-ink-50/70">
                <td className="py-3 pl-5 pr-3">
                  <InvoiceNumberCell invoice={invoice} />
                </td>
                <td className="px-3 py-3">
                  <p className="max-w-[11rem] truncate text-body font-medium text-ink-800">
                    {invoice.clientName}
                  </p>
                  <p className="text-caption text-ink-500">{invoice.clientPhone}</p>
                </td>
                <td className="px-3 py-3">
                  <AmountBreakdown invoice={invoice} />
                </td>
                <td className="px-3 py-3">
                  <StatusCell invoice={invoice} />
                </td>
                <td className="px-3 py-3 text-right">
                  <p className="text-body font-semibold tabular-nums text-ink-900">
                    {formatCurrency(invoice.amount)}
                  </p>
                  {remainingAmount(invoice) > 0 && invoice.status !== 'void' ? (
                    <p className="text-caption tabular-nums text-ink-500">
                      sisa {formatCurrency(remainingAmount(invoice))}
                    </p>
                  ) : null}
                </td>
                <td className="py-3 pl-3 pr-5 text-right">
                  <Link
                    to={`/invoices/${invoice.id}`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-meta font-medium text-brand-700 hover:bg-brand-50"
                  >
                    Lihat rincian
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-ink-100 md:hidden">
        {invoices.map((invoice) => (
          <li key={invoice.id} className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-ink-900">{invoice.number}</p>
                <p className="truncate text-meta text-ink-500">{invoice.clientName}</p>
              </div>
              <StatusCell invoice={invoice} align="right" />
            </div>

            <div className="mt-2 flex items-end justify-between gap-3">
              <AmountBreakdown invoice={invoice} />
              <p className="text-body font-semibold tabular-nums text-ink-900">
                {formatCurrency(invoice.amount)}
              </p>
            </div>

            <Link
              to={`/invoices/${invoice.id}`}
              className="mt-2 inline-flex items-center gap-1 text-meta font-medium text-brand-700"
            >
              Lihat rincian
              <ArrowUpRight className="size-3.5" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

function InvoiceNumberCell({ invoice }: { invoice: Invoice }) {
  const overdue = isOverdue(invoice)
  return (
    <div>
      <p className="flex items-center gap-1.5 text-body font-semibold tabular-nums text-ink-900">
        {invoice.number}
        {overdue ? (
          <span title="Lewat jatuh tempo">
            <AlertTriangle className="size-3.5 text-rose-500" aria-label="Lewat jatuh tempo" />
          </span>
        ) : null}
      </p>
      <p className="text-caption text-ink-500">Terbit {formatShortDate(invoice.issuedAt)}</p>
    </div>
  )
}

function AmountBreakdown({ invoice }: { invoice: Invoice }) {
  const percent = paidPercent(invoice)
  return (
    <div>
      <p className="flex items-center gap-1.5 text-meta text-ink-700">
        <Badge
          className={cn(
            invoice.type === 'dp'
              ? 'bg-brand-50 text-brand-700'
              : 'bg-ink-100 text-ink-600',
          )}
        >
          <FileText className="size-3" />
          {INVOICE_TYPE_META[invoice.type].label}
        </Badge>
        <span className="tabular-nums text-ink-500">dari {formatCurrency(invoice.bookingTotal)}</span>
      </p>
      {invoice.status === 'void' ? (
        <p className="mt-1 text-caption text-ink-400">Tidak ditagihkan</p>
      ) : (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="h-1 w-16 overflow-hidden rounded-full bg-ink-100">
            <span
              className={cn(
                'block h-full rounded-full',
                percent >= 100 ? 'bg-emerald-500' : 'bg-brand-500',
              )}
              style={{ width: `${percent}%` }}
            />
          </span>
          <span className="text-2xs tabular-nums text-ink-400">{percent}% dibayar</span>
        </div>
      )}
      <p className="mt-1 text-caption text-ink-400">
        {isOverdue(invoice) ? 'Lewat jatuh tempo ' : 'Jatuh tempo '}
        {formatShortDate(invoice.dueAt)}
      </p>
    </div>
  )
}

function StatusCell({ invoice, align }: { invoice: Invoice; align?: 'right' }) {
  const meta = INVOICE_STATUS_META[invoice.status]
  const Icon = meta.icon
  return (
    <div className={cn(align === 'right' && 'shrink-0 text-right')}>
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium ring-1 ring-inset',
          meta.badgeClass,
        )}
        title={meta.description}
      >
        <Icon className="size-3" />
        {meta.label}
      </span>
      {isOverdue(invoice) ? (
        <p className="mt-1 text-2xs font-medium text-rose-600">Terlambat</p>
      ) : null}
    </div>
  )
}
