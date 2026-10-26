import { FileText, MapPin, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusBadge, StatusMenu } from '@/components/bookings/StatusControls'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { formatCurrency, formatShortDate, formatTime, initials } from '@/lib/format'
import type { Booking, BookingStatus } from '@/types/booking'

/**
 * Tabel daftar booking.
 *
 * Di layar ≥md ditampilkan sebagai tabel 6 kolom; di ponsel berubah menjadi
 * kartu bertumpuk supaya nama klien, tanggal, dan status tetap terbaca tanpa
 * scroll horizontal. Kolom aksi memakai `StatusMenu` — hanya transisi status
 * yang sah yang ditawarkan, sesuai alur operasional vendor.
 */
export function BookingTable({
  bookings,
  onChangeStatus,
  pendingIds,
}: {
  bookings: Booking[]
  onChangeStatus?: (booking: Booking, next: BookingStatus) => void
  /** ID booking yang statusnya sedang dikirim ke server. */
  pendingIds?: Set<string>
}) {
  const isPending = (id: string) => pendingIds?.has(id) ?? false
  return (
    <>
      <div className="hidden overflow-x-auto scrollbar-slim md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/60 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              <th scope="col" className="py-2.5 pl-5 pr-3">Klien</th>
              <th scope="col" className="px-3 py-2.5">Acara</th>
              <th scope="col" className="px-3 py-2.5">Paket</th>
              <th scope="col" className="px-3 py-2.5">Status</th>
              <th scope="col" className="px-3 py-2.5 text-right">Nilai</th>
              <th scope="col" className="py-2.5 pl-3 pr-5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {bookings.map((booking) => (
              <tr key={booking.id} className="group hover:bg-ink-50/70">
                <td className="py-3 pl-5 pr-3">
                  <ClientCell booking={booking} />
                </td>
                <td className="px-3 py-3">
                  <EventCell booking={booking} />
                </td>
                <td className="px-3 py-3">
                  <p className="max-w-[13rem] truncate text-[13px] text-ink-700">
                    {booking.packageName ?? 'Tanpa paket'}
                  </p>
                  {booking.invoiceCount > 0 ? (
                    <Badge className="mt-1">
                      <FileText className="size-3" />
                      {booking.invoiceCount} invoice
                    </Badge>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={booking.status} />
                </td>
                <td className="px-3 py-3 text-right">
                  <p className="text-[13px] font-semibold text-ink-900">
                    {formatCurrency(booking.totalPrice)}
                  </p>
                </td>
                <td className="py-3 pl-3 pr-5 text-right">
                  {onChangeStatus ? (
                    <StatusMenu
                      status={booking.status}
                      hasInvoice={booking.invoiceCount > 0}
                      disabled={isPending(booking.id)}
                      onChange={(next) => onChangeStatus(booking, next)}
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-ink-100 md:hidden">
        {bookings.map((booking) => (
          <li key={booking.id} className="px-4 py-3.5">
            <Link to={`/bookings/${booking.id}`} className="flex items-start gap-3 active:opacity-70">
              <Avatar name={booking.client.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-[13.5px] font-semibold text-ink-900">
                    {booking.client.name}
                  </p>
                  <StatusBadge status={booking.status} className="shrink-0" />
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-500">
                  <span className="font-medium text-ink-700">
                    {formatShortDate(booking.eventDate)}
                  </span>
                  {booking.eventTime ? <span>· {formatTime(booking.eventTime)}</span> : null}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-ink-500">
                  {booking.packageName ?? 'Tanpa paket'} · {formatCurrency(booking.totalPrice)}
                </p>
              </div>
            </Link>
            {onChangeStatus ? (
              <div className="mt-2 flex items-center justify-end">
                <StatusMenu
                  status={booking.status}
                  hasInvoice={booking.invoiceCount > 0}
                  disabled={isPending(booking.id)}
                  onChange={(next) => onChangeStatus(booking, next)}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  )
}

function ClientCell({ booking }: { booking: Booking }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={booking.client.name} />
      <div className="min-w-0">
        <Link
          to={`/bookings/${booking.id}`}
          className="block max-w-[13rem] truncate text-[13px] font-semibold text-ink-900 hover:text-brand-700"
        >
          {booking.client.name}
        </Link>
        <p className="flex items-center gap-1 text-[11.5px] text-ink-500">
          <Phone className="size-3" />
          {booking.client.phone}
        </p>
      </div>
    </div>
  )
}

function EventCell({ booking }: { booking: Booking }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-ink-800">
        {formatShortDate(booking.eventDate)}
        {booking.eventTime ? (
          <span className="ml-1.5 font-normal text-ink-500">· {formatTime(booking.eventTime)}</span>
        ) : null}
      </p>
      <p className="flex items-center gap-1 text-[11.5px] text-ink-500">
        <MapPin className="size-3 shrink-0" />
        <span className="max-w-[13rem] truncate">{booking.eventLocation ?? 'Lokasi belum diisi'}</span>
      </p>
    </div>
  )
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700',
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}
