import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Landmark,
  Phone,
  ReceiptText,
  UserRound,
} from '@/components/ui/icons'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import {
  INVOICE_STATUS_META,
  INVOICE_TYPE_META,
  isOverdue,
  remainingAmount,
  termLabel,
} from '@/lib/invoice-status'
import { formatCurrency, formatLongDate, formatShortDate } from '@/lib/format'
import type { PublicInvoiceData } from '@/lib/api/public-invoices'

export function PublicInvoicePage({ data }: { data: PublicInvoiceData }) {
  const { invoice, vendor } = data
  const status = INVOICE_STATUS_META[invoice.status]
  const overdue = isOverdue(invoice)
  const remaining = invoice.status === 'void' ? 0 : remainingAmount(invoice)
  const waDigits = vendor.contactPhone?.replace(/\D/g, '').replace(/^0/, '62') ?? ''
  const paymentDescription =
    invoice.status === 'paid'
      ? 'Pembayaran untuk invoice ini telah lunas.'
      : invoice.status === 'void'
        ? 'Invoice ini dibatalkan dan tidak perlu dibayar.'
        : 'Gunakan rekening berikut untuk menyelesaikan pembayaran.'

  return (
    <main className="min-h-screen bg-ink-50 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink-200 bg-white px-5 py-4 shadow-sm sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <Building2 className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-400">
                Invoice dari
              </p>
              <h1 className="truncate text-lead font-semibold text-ink-900 sm:text-title">
                {vendor.businessName}
              </h1>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-400">
              Nomor invoice
            </p>
            <p className="mt-0.5 text-body font-semibold tabular-nums text-ink-800">
              {invoice.number}
            </p>
          </div>
        </header>

        <section
          aria-label="Ringkasan invoice"
          className="rounded-2xl bg-brand-800 px-5 py-5 text-white shadow-sm sm:px-7 sm:py-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-caption font-medium text-white/75">
                {invoice.status === 'paid'
                  ? 'Status pembayaran'
                  : invoice.status === 'void'
                    ? 'Status invoice'
                    : 'Sisa tagihan'}
              </p>
              <p className="mt-1 text-heading font-semibold tracking-tight sm:text-display">
                {invoice.status === 'paid'
                  ? 'Lunas'
                  : invoice.status === 'void'
                    ? 'Dibatalkan'
                    : formatCurrency(remaining)}
              </p>
              {invoice.status !== 'paid' && invoice.status !== 'void' ? (
                <p className="mt-1 text-meta text-white/75">
                  dari {formatCurrency(invoice.amount)} tagihan {INVOICE_TYPE_META[invoice.type].label.toLowerCase()}
                  {termLabel(invoice.term) ? ` · ${termLabel(invoice.term)}` : ''}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <Badge className={status.badgeClass}>
                <status.icon className="size-3" aria-hidden="true" />
                {status.label}
              </Badge>
              <p className="flex items-center gap-1.5 text-meta text-white/80">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                Jatuh tempo {formatShortDate(invoice.dueAt)}
              </p>
            </div>
          </div>
          {overdue ? (
            <p className="mt-5 flex items-start gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-meta leading-relaxed text-white">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Invoice ini melewati tanggal jatuh tempo.
            </p>
          ) : null}
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card>
            <CardHeader
              title="Rincian invoice"
              description={`${invoice.number} · ${INVOICE_TYPE_META[invoice.type].label}`}
            />
            <CardBody className="space-y-5">
              <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <PublicDetail
                  icon={<UserRound className="size-3.5" />}
                  label="Ditagihkan kepada"
                  value={invoice.clientName}
                />
                <PublicDetail
                  icon={<CalendarDays className="size-3.5" />}
                  label="Tanggal acara"
                  value={formatLongDate(invoice.eventDate)}
                />
                <PublicDetail
                  icon={<ReceiptText className="size-3.5" />}
                  label="Paket"
                  value={invoice.packageName ?? 'Tanpa paket'}
                />
                <PublicDetail
                  icon={<CalendarDays className="size-3.5" />}
                  label="Jatuh tempo pembayaran"
                  value={formatLongDate(invoice.dueAt)}
                />
              </dl>

              <div className="rounded-xl border border-ink-200 bg-ink-50/70 p-4 sm:p-5">
                <h2 className="mb-3 text-caption font-semibold uppercase tracking-wide text-ink-500">
                  Rincian pembayaran
                </h2>
                <div className="space-y-3">
                  <AmountRow label="Total tagihan" amount={invoice.amount} />
                  <AmountRow label="Sudah dibayar" amount={invoice.paidAmount} tone="emerald" />
                  <div className="flex items-baseline justify-between gap-3 border-t border-ink-200 pt-3">
                    <span className="text-body font-semibold text-ink-900">Sisa tagihan</span>
                    <span className="text-lead font-semibold tabular-nums text-ink-900">
                      {formatCurrency(remaining)}
                    </span>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Cara pembayaran" description={paymentDescription} />
            <CardBody>
              {invoice.status !== 'paid' && invoice.status !== 'void' ? (
                vendor.bank.name && vendor.bank.accountNumber && vendor.bank.accountHolder ? (
                  <dl className="space-y-4">
                    <PublicDetail
                      label="Bank"
                      value={vendor.bank.name}
                      icon={<Landmark className="size-3.5" />}
                    />
                    <PublicDetail
                      label="Nomor rekening"
                      value={vendor.bank.accountNumber}
                      icon={<Landmark className="size-3.5" />}
                      mono
                    />
                    <PublicDetail
                      label="Atas nama"
                      value={vendor.bank.accountHolder}
                      icon={<UserRound className="size-3.5" />}
                    />
                  </dl>
                ) : (
                  <p className="rounded-lg bg-ink-50 px-3 py-2.5 text-meta leading-relaxed text-ink-500">
                    Informasi rekening belum tersedia. Hubungi vendor untuk mendapatkan instruksi pembayaran.
                  </p>
                )
              ) : null}

              {waDigits ? (
                <a
                  href={`https://wa.me/${waDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-meta font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  <Phone className="size-3.5" aria-hidden="true" />
                  Hubungi vendor via WhatsApp
                </a>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <footer className="px-2 pb-2 text-center text-caption leading-relaxed text-ink-400">
          Halaman ini hanya menampilkan rincian invoice yang dibagikan kepada Anda.
        </footer>
      </div>
    </main>
  )
}

function PublicDetail({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-ink-400">
        {icon}
        {label}
      </dt>
      <dd className={`mt-1 wrap-break-word text-meta font-medium text-ink-800 ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </dd>
    </div>
  )
}

function AmountRow({
  label,
  amount,
  tone,
}: {
  label: string
  amount: number
  tone?: 'emerald'
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-meta">
      <span className="text-ink-500">{label}</span>
      <span className={tone === 'emerald' ? 'tabular-nums text-emerald-700' : 'tabular-nums text-ink-700'}>
        {formatCurrency(amount)}
      </span>
    </div>
  )
}
