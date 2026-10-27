import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Landmark,
  Phone,
  Receipt,
  RefreshCw,
  User,
} from '@/components/ui/icons'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card'
import { DetailGrid, DetailItem } from '@/components/ui/DetailGrid'
import { PaymentRecordModal } from '@/components/invoices/PaymentRecordModal'
import { InvoicePaymentHistory } from '@/components/invoices/InvoicePaymentHistory'
import { InvoiceShareLinkCard } from '@/components/invoices/InvoiceShareLinkCard'
import type { PaymentPayload } from '@/lib/payment-form'
import {
  INVOICE_STATUS_META,
  INVOICE_TYPE_META,
  isOverdue,
  paidPercent,
  remainingAmount,
} from '@/lib/invoice-status'
import { cn } from '@/lib/cn'
import { formatCurrency, formatLongDate, formatShortDate, initials } from '@/lib/format'
import type { VendorProfileDetail } from '@/lib/vendor-profile'
import type { Invoice, InvoicePayment } from '@/types/invoice'

/**
 * Halaman rincian invoice (`/invoices/:invoiceId`).
 *
 * Satu invoice dibaca seperti lembar tagihan: identitas invoice, data klien &
 * acara sebagai konteks, rincian nominal (kontrak → ditagihkan → dibayar →
 * sisa), plus riwayat pembayaran sederhana. Navigasi ke tagihan lain pada
 * booking yang sama disediakan di panel kanan supaya vendor bisa berpindah
 * DP ↔ pelunasan tanpa kembali ke daftar.
 */
export function InvoiceDetailPage({
  invoice,
  siblings = [],
  payments = [],
  vendorProfile = null,
  onRecordPayment,
  onMarkPaid,
}: {
  invoice: Invoice
  /** Invoice lain pada booking yang sama (urut terbit). */
  siblings?: Invoice[]
  /** Riwayat pembayaran manual invoice, terbaru lebih dulu. */
  payments?: InvoicePayment[]
  /** Profil vendor menyediakan rekening tujuan transfer pada invoice. */
  vendorProfile?: VendorProfileDetail | null
  /** Simpan pembayaran ke API; modal menutup sendiri bila sukses. */
  onRecordPayment?: (payload: PaymentPayload) => Promise<void>
  /** Catat seluruh sisa tagihan sebagai transfer yang sudah diterima. */
  onMarkPaid?: (amount: number) => Promise<void>
}) {
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [markPaidOpen, setMarkPaidOpen] = useState(false)
  const [markingPaid, setMarkingPaid] = useState(false)
  const [markPaidError, setMarkPaidError] = useState<string | null>(null)
  const statusMeta = INVOICE_STATUS_META[invoice.status]
  const typeMeta = INVOICE_TYPE_META[invoice.type]
  const overdue = isOverdue(invoice)
  const remaining = remainingAmount(invoice)
  const percent = paidPercent(invoice)
  const isVoid = invoice.status === 'void'
  const others = siblings.filter((item) => item.id !== invoice.id)
  const waLink = `https://wa.me/${invoice.clientPhone.replace(/\D/g, '').replace(/^0/, '62')}`

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/invoices"
          className="inline-flex items-center gap-1.5 text-meta font-medium text-ink-500 hover:text-ink-800"
        >
          <ArrowLeft className="size-3.5" />
          Daftar invoice
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink to={`/bookings/${invoice.bookingId}`} variant="secondary" size="sm">
            <CalendarDays className="size-3.5" />
            Lihat booking
          </ButtonLink>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            title="Cetak atau simpan invoice sebagai PDF"
          >
            <Download className="size-3.5" />
            Unduh PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-body font-semibold text-brand-700">
              {initials(invoice.clientName)}
            </span>
            <div className="min-w-0">
              <p className="text-caption font-medium uppercase tracking-wide text-ink-400">
                Invoice
              </p>
              <h2 className="text-title font-semibold tabular-nums tracking-tight text-ink-900">
                {invoice.number}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium ring-1 ring-inset',
                    statusMeta.badgeClass,
                  )}
                  title={statusMeta.description}
                >
                  <statusMeta.icon className="size-3" />
                  {statusMeta.label}
                </span>
                <Badge
                  className={cn(
                    invoice.type === 'dp' ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-600',
                  )}
                >
                  <FileText className="size-3" />
                  {typeMeta.label}
                </Badge>
                {overdue ? (
                  <Badge className="bg-rose-50 text-rose-700">
                    <AlertTriangle className="size-3" />
                    Lewat jatuh tempo
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-caption font-medium uppercase tracking-wide text-ink-400">
              Sisa tagihan
            </p>
            <p
              className={cn(
                'text-heading font-semibold tabular-nums',
                isVoid ? 'text-ink-400 line-through' : remaining > 0 ? 'text-ink-900' : 'text-emerald-700',
              )}
            >
              {formatCurrency(isVoid ? 0 : remaining)}
            </p>
            <p className="text-meta text-ink-500">
              dari {formatCurrency(invoice.amount)} ditagihkan
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Rincian Tagihan"
              description={typeMeta.description}
              action={
                <span className="text-meta tabular-nums text-ink-500">
                  Terbit {formatShortDate(invoice.issuedAt)}
                </span>
              }
            />
            <CardBody>
              <ul className="space-y-2.5 text-body">
                <AmountRow
                  label="Nilai kontrak booking"
                  value={formatCurrency(invoice.bookingTotal)}
                  muted
                />
                <AmountRow
                  label={invoice.type === 'dp' ? 'DP ditagihkan (40%)' : 'Pelunasan (60%)'}
                  value={formatCurrency(invoice.amount)}
                  hint={invoice.packageName ?? 'Tanpa paket'}
                />
                <AmountRow
                  label="Sudah dibayar"
                  value={formatCurrency(invoice.paidAmount)}
                  tone="emerald"
                />
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <span
                      className={cn(
                        'block h-full rounded-full',
                        percent >= 100 ? 'bg-emerald-500' : 'bg-brand-500',
                      )}
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                  <span className="text-2xs tabular-nums text-ink-400">{percent}%</span>
                </div>
                <li className="flex items-baseline justify-between gap-3 border-t border-ink-100 pt-2.5">
                  <span className="font-medium text-ink-900">Sisa yang harus dibayar</span>
                  <span className="text-lead font-semibold tabular-nums text-ink-900">
                    {formatCurrency(remaining)}
                  </span>
                </li>
              </ul>
            </CardBody>
            <CardFooter className="sm:justify-between">
              <p className="text-meta text-ink-500">
                {isVoid
                  ? 'Invoice ini dibatalkan dan tidak lagi ditagihkan.'
                  : overdue
                    ? `Sudah lewat jatuh tempo sejak ${formatShortDate(invoice.dueAt)}.`
                    : `Jatuh tempo ${formatShortDate(invoice.dueAt)}.`}
              </p>
              {!isVoid && remaining > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {onMarkPaid ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setMarkPaidError(null)
                        setMarkPaidOpen(true)
                      }}
                    >
                      <CheckCircle2 className="size-3.5" />
                      Tandai lunas
                    </Button>
                  ) : null}
                  <Button size="sm" onClick={() => setPaymentOpen(true)}>
                    <Banknote className="size-3.5" />
                    Catat pembayaran
                  </Button>
                </div>
              ) : null}
            </CardFooter>
          </Card>

          <Card>
            <CardHeader title="Klien & Acara" description="Data yang tercetak di invoice." />
            <CardBody>
              <DetailGrid>
                <DetailItem
                  label="Klien"
                  icon={<User className="size-3" />}
                  value={invoice.clientName}
                />
                <DetailItem
                  label="WhatsApp"
                  icon={<Phone className="size-3" />}
                  value={invoice.clientPhone}
                  href={waLink}
                />
                <DetailItem
                  label="Tanggal acara"
                  icon={<CalendarDays className="size-3" />}
                  value={formatLongDate(invoice.eventDate)}
                />
                <DetailItem
                  label="Paket"
                  icon={<Receipt className="size-3" />}
                  value={invoice.packageName ?? 'Tanpa paket'}
                  muted={!invoice.packageName}
                />
              </DetailGrid>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Pembayaran"
              description={isVoid ? 'Invoice dibatalkan.' : `${percent}% dari tagihan sudah masuk.`}
            />
            <CardBody className="space-y-2">
              {invoice.paidAmount > 0 ? (
                <div className="flex items-center justify-between rounded-lg border border-ink-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Banknote className="size-3.5 text-emerald-600" />
                    <span className="text-meta font-medium text-ink-800">Pembayaran diterima</span>
                  </div>
                  <span className="text-meta tabular-nums text-ink-700">
                    {formatCurrency(invoice.paidAmount)}
                  </span>
                </div>
              ) : (
                <p className="text-meta text-ink-500">
                  {isVoid
                    ? 'Tidak ada pembayaran pada invoice ini.'
                    : 'Belum ada pembayaran yang tercatat.'}
                </p>
              )}
              {!isVoid && remaining > 0 ? (
                <div className="flex items-center justify-between rounded-lg border border-dashed border-ink-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Clock className="size-3.5 text-ink-400" />
                    <span className="text-meta text-ink-600">Menunggu sisa</span>
                  </div>
                  <span className="text-meta tabular-nums text-ink-700">
                    {formatCurrency(remaining)}
                  </span>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <InvoicePaymentHistory payments={payments} />

          <Card>
            <CardHeader
              title="Rekening transfer"
              description="Gunakan rekening vendor ini untuk pembayaran invoice."
            />
            <CardBody>
              {vendorProfile?.bank.name &&
              vendorProfile.bank.accountNumber &&
              vendorProfile.bank.accountHolder ? (
                <dl className="space-y-2 text-meta">
                  <BankDetail label="Bank" value={vendorProfile.bank.name} />
                  <BankDetail label="Nomor rekening" value={vendorProfile.bank.accountNumber} mono />
                  <BankDetail label="Atas nama" value={vendorProfile.bank.accountHolder} />
                </dl>
              ) : (
                <div className="space-y-2">
                  <p className="text-meta leading-relaxed text-ink-500">
                    Rekening vendor belum lengkap, jadi belum bisa dicantumkan sebagai tujuan transfer.
                  </p>
                  <ButtonLink to="/settings" variant="secondary" size="sm">
                    <Landmark className="size-3.5" />
                    Atur rekening
                  </ButtonLink>
                </div>
              )}
            </CardBody>
          </Card>

          <InvoiceShareLinkCard key={invoice.id} invoiceId={invoice.id} />

          <Card>
            <CardHeader
              title="Tagihan lain"
              description={
                others.length > 0
                  ? `${others.length} invoice lain pada booking ini.`
                  : 'Belum ada tagihan lain pada booking ini.'
              }
            />
            <CardBody className="space-y-2">
              {others.length > 0 ? (
                others.map((item) => (
                  <Link
                    key={item.id}
                    to={`/invoices/${item.id}`}
                    className="flex items-start justify-between gap-2 rounded-lg border border-ink-200 px-3 py-2 hover:border-ink-300 hover:bg-ink-50/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-meta font-medium tabular-nums text-ink-800">
                        {INVOICE_TYPE_META[item.type].label}
                      </p>
                      <p className="truncate text-caption text-ink-500">{item.number}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-meta tabular-nums text-ink-700">
                        {formatCurrency(item.amount)}
                      </p>
                      <p className="text-caption text-ink-400">{INVOICE_STATUS_META[item.status].label}</p>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-meta text-ink-500">
                  Invoice DP dan pelunasan akan tampil di sini saat diterbitkan.
                </p>
              )}
            </CardBody>
            <CardFooter>
              <Link
                to={`/bookings/${invoice.bookingId}`}
                className="inline-flex items-center gap-1 text-meta font-medium text-brand-700 hover:underline"
              >
                Buka booking
                <ArrowUpRight className="size-3.5" />
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>

      <PaymentRecordModal
        key={invoice.id}
        open={paymentOpen}
        invoice={invoice}
        onClose={() => setPaymentOpen(false)}
        onSubmit={onRecordPayment}
      />
      {markPaidOpen && onMarkPaid ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Tutup konfirmasi"
            onClick={() => setMarkPaidOpen(false)}
            disabled={markingPaid}
            className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm disabled:cursor-wait"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="mark-paid-title"
            className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-4" />
            </span>
            <h2 id="mark-paid-title" className="mt-3 text-lead font-semibold text-ink-900">
              Tandai invoice lunas?
            </h2>
            <p className="mt-1 text-meta leading-relaxed text-ink-600">
              Sisa tagihan {formatCurrency(remaining)} akan dicatat sebagai transfer yang diterima
              hari ini. Pastikan pembayaran dari klien benar-benar sudah masuk.
            </p>
            {markPaidError ? (
              <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-meta text-rose-700">
                {markPaidError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMarkPaidOpen(false)}
                disabled={markingPaid}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  setMarkingPaid(true)
                  setMarkPaidError(null)
                  try {
                    await onMarkPaid(remaining)
                    setMarkPaidOpen(false)
                  } catch (error) {
                    setMarkPaidError(
                      error instanceof Error ? error.message : 'Gagal menandai invoice lunas.',
                    )
                  } finally {
                    setMarkingPaid(false)
                  }
                }}
                disabled={markingPaid}
              >
                {markingPaid ? 'Menyimpan…' : 'Ya, tandai lunas'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <InvoicePrintDocument
        invoice={invoice}
        vendorProfile={vendorProfile}
        statusLabel={statusMeta.label}
        typeLabel={typeMeta.label}
        remaining={isVoid ? 0 : remaining}
      />
    </div>
  )
}

function InvoicePrintDocument({
  invoice,
  vendorProfile,
  statusLabel,
  typeLabel,
  remaining,
}: {
  invoice: Invoice
  vendorProfile: VendorProfileDetail | null
  statusLabel: string
  typeLabel: string
  remaining: number
}) {
  return (
    <article className="invoice-print-document">
      <header className="invoice-print-header">
        <div>
          <p className="invoice-print-eyebrow">{vendorProfile?.category ?? 'Vendor'}</p>
          <h1>{vendorProfile?.businessName ?? 'Invoice'}</h1>
          {vendorProfile?.city ? <p>{vendorProfile.city}</p> : null}
          {vendorProfile?.contactPhone ? <p>{vendorProfile.contactPhone}</p> : null}
          {vendorProfile?.contactEmail ? <p>{vendorProfile.contactEmail}</p> : null}
        </div>
        <div className="invoice-print-number">
          <p>INVOICE</p>
          <h2>{invoice.number}</h2>
          <span>{statusLabel}</span>
        </div>
      </header>

      <section className="invoice-print-grid" aria-label="Informasi invoice">
        <div>
          <h3>Ditagihkan kepada</h3>
          <p>{invoice.clientName}</p>
          <p>{invoice.clientPhone}</p>
        </div>
        <div>
          <h3>Informasi tagihan</h3>
          <p>Jenis: {typeLabel}</p>
          <p>Tanggal terbit: {formatLongDate(invoice.issuedAt)}</p>
          <p>Jatuh tempo: {formatLongDate(invoice.dueAt)}</p>
        </div>
        <div>
          <h3>Detail acara</h3>
          <p>{formatLongDate(invoice.eventDate)}</p>
          <p>{invoice.packageName ?? 'Tanpa paket'}</p>
        </div>
      </section>

      <section className="invoice-print-totals" aria-label="Rincian pembayaran">
        <div><span>Nilai kontrak booking</span><strong>{formatCurrency(invoice.bookingTotal)}</strong></div>
        <div><span>{typeLabel}</span><strong>{formatCurrency(invoice.amount)}</strong></div>
        <div><span>Sudah dibayar</span><strong>{formatCurrency(invoice.paidAmount)}</strong></div>
        <div className="invoice-print-grand-total">
          <span>Sisa tagihan</span><strong>{formatCurrency(remaining)}</strong>
        </div>
      </section>

      {vendorProfile?.bank.name && vendorProfile.bank.accountNumber && vendorProfile.bank.accountHolder ? (
        <section className="invoice-print-bank">
          <h3>Informasi pembayaran</h3>
          <p>{vendorProfile.bank.name} · {vendorProfile.bank.accountNumber}</p>
          <p>Atas nama {vendorProfile.bank.accountHolder}</p>
        </section>
      ) : null}

      <footer className="invoice-print-footer">
        Dokumen ini diterbitkan secara digital oleh {vendorProfile?.businessName ?? 'vendor'}.
      </footer>
    </article>
  )
}

function BankDetail({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd className={cn('text-right font-medium text-ink-800', mono && 'font-mono tabular-nums')}>
        {value}
      </dd>
    </div>
  )
}

function AmountRow({
  label,
  value,
  hint,
  tone,
  muted,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'emerald'
  muted?: boolean
}) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="min-w-0">
        <span className={cn('block', muted ? 'text-ink-600' : 'text-ink-800')}>{label}</span>
        {hint ? <span className="block text-caption text-ink-400">{hint}</span> : null}
      </span>
      <span
        className={cn(
          'shrink-0 tabular-nums',
          tone === 'emerald' ? 'text-emerald-700' : muted ? 'text-ink-500' : 'text-ink-900',
        )}
      >
        {value}
      </span>
    </li>
  )
}

/** Skeleton saat invoice sedang diambil. */
export function InvoiceDetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="h-4 w-32 animate-pulse rounded bg-ink-100" />
      <div className="h-24 animate-pulse rounded-xl bg-white" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <div className="h-56 animate-pulse rounded-xl bg-white" />
          <div className="h-40 animate-pulse rounded-xl bg-white" />
        </div>
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-xl bg-white" />
          <div className="h-40 animate-pulse rounded-xl bg-white" />
        </div>
      </div>
    </div>
  )
}

/** Layar error rincian invoice (404 vs gangguan jaringan). */
export function InvoiceDetailError({
  notFound,
  onRetry,
}: {
  notFound: boolean
  onRetry?: () => void
}) {
  return (
    <div className="rounded-xl border border-ink-200/80 bg-white px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-ink-100 text-ink-500">
        {notFound ? <FileText className="size-5" /> : <AlertTriangle className="size-5" />}
      </div>
      <p className="text-lead font-semibold text-ink-800">
        {notFound ? 'Invoice tidak ditemukan' : 'Gagal memuat invoice'}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-body leading-relaxed text-ink-500">
        {notFound
          ? 'Invoice mungkin sudah dihapus atau tautannya tidak lagi berlaku.'
          : 'Periksa koneksi internet lalu coba lagi.'}
      </p>
      <div className="mt-4 flex items-center justify-center gap-2">
        <ButtonLink to="/invoices" variant="secondary" size="sm">
          <ArrowLeft className="size-3.5" />
          Daftar invoice
        </ButtonLink>
        {!notFound && onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-body font-medium text-white hover:bg-brand-700"
          >
            <RefreshCw className="size-3.5" />
            Coba lagi
          </button>
        ) : null}
      </div>
    </div>
  )
}
