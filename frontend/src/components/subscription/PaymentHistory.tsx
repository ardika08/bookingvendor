import { Banknote, CheckCircle2, Clock3, XCircle } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/cn'
import { formatCurrency, formatShortDate } from '@/lib/format'
import type { Payment, PaymentStatus } from '@/types/subscription'

/**
 * Riwayat pembayaran langganan di halaman /upgrade.
 *
 * Status `pending` adalah pintu masuk alur pembayaran manual: vendor melanjutkan
 * ke halaman instruksi transfer dan bisa membuat ulang transaksi bila lewat
 * batas waktu. Status lain bersifat informasional.
 */

const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; icon: typeof Clock3; className: string }
> = {
  pending: { label: 'Menunggu pembayaran', icon: Clock3, className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  confirmed: { label: 'Terkonfirmasi', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  rejected: { label: 'Ditolak', icon: XCircle, className: 'bg-rose-50 text-rose-700 ring-rose-200' },
  expired: { label: 'Kedaluwarsa', icon: XCircle, className: 'bg-ink-100 text-ink-500 ring-ink-200' },
}

export function PaymentHistory({ payments }: { payments: Payment[] }) {
  return (
    <Card>
      <CardHeader
        title="Riwayat pembayaran"
        description="Transaksi langganan yang pernah dibuat, termasuk yang belum dibayar."
      />
      {payments.length === 0 ? (
        <EmptyState
          icon={<Banknote className="size-5" />}
          title="Belum ada transaksi"
          description="Pilih salah satu paket di atas untuk membuat transaksi pertama."
        />
      ) : (
        <CardBody className="space-y-2.5">
          {payments.map((payment) => (
            <PaymentRow key={payment.id} payment={payment} />
          ))}
        </CardBody>
      )}
    </Card>
  )
}

function PaymentRow({ payment }: { payment: Payment }) {
  const meta = PAYMENT_STATUS_META[payment.status]
  const Icon = meta.icon

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-ink-200/80 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
            meta.className,
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink-900">
            {payment.planName} · {formatCurrency(payment.amount)}
          </p>
          <p className="mt-0.5 text-[11.5px] tabular-nums text-ink-500">
            {payment.reference} · dibuat {formatShortDate(payment.createdAt.slice(0, 10))}
            {payment.expiresAt && payment.status === 'pending'
              ? ` · bayar sebelum ${formatShortDate(payment.expiresAt.slice(0, 10))}`
              : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:justify-end">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium ring-1 ring-inset',
            meta.className,
          )}
        >
          {meta.label}
        </span>
        {payment.status === 'pending' ? (
          <ButtonLink to={`/upgrade/checkout/${payment.id}`} variant="secondary" size="sm">
            Lanjut bayar
          </ButtonLink>
        ) : null}
        {payment.status === 'expired' || payment.status === 'rejected' ? (
          <ButtonLink to="/upgrade" variant="secondary" size="sm">
            Buat ulang
          </ButtonLink>
        ) : null}
      </div>
    </div>
  )
}
