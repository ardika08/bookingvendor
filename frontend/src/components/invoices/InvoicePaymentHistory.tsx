import { Banknote } from '@/components/ui/icons'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { formatCurrency, formatShortDate } from '@/lib/format'
import type { InvoicePayment, InvoicePaymentMethod } from '@/types/invoice'

const METHOD_LABEL: Record<InvoicePaymentMethod, string> = {
  transfer: 'Transfer bank',
  qris: 'QRIS',
  cash: 'Tunai',
  other: 'Lainnya',
}

/** Daftar pembayaran yang benar-benar diterima untuk satu invoice. */
export function InvoicePaymentHistory({ payments }: { payments: InvoicePayment[] }) {
  return (
    <Card>
      <CardHeader
        title="Riwayat pembayaran"
        description={
          payments.length > 0
            ? `${payments.length} pembayaran tercatat untuk invoice ini.`
            : 'Setiap pembayaran yang dicatat akan muncul di sini.'
        }
      />
      <CardBody>
        {payments.length === 0 ? (
          <p className="text-meta text-ink-500">Belum ada pembayaran yang tercatat.</p>
        ) : (
          <ul className="space-y-2">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-ink-200 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                    <Banknote className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-meta font-medium text-ink-800">
                      {METHOD_LABEL[payment.method]}
                    </p>
                    <p className="text-caption text-ink-500">
                      {formatShortDate(payment.paidAt)}
                    </p>
                    {payment.note ? (
                      <p className="mt-0.5 wrap-break-word text-caption text-ink-500">
                        {payment.note}
                      </p>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 text-meta font-semibold tabular-nums text-emerald-700">
                  +{formatCurrency(payment.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
