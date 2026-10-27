import { FileText, MapPin } from '@/components/ui/icons'
import { Link } from 'react-router-dom'
import { StatusBadge, StatusMenu } from '@/components/bookings/StatusControls'
import { cn } from '@/lib/cn'
import { formatCurrency, formatShortDate, formatTime, initials } from '@/lib/format'
import type { Booking, BookingStatus } from '@/types/booking'

/**
 * Tabel daftar booking.
 *
 * Gaya mengikuti acuan desain: header ringan berhuruf kecil, baris longgar,
 * nama klien dengan avatar, dan nilai penting dibungkus chip agar mudah
 * dipindai. Di layar <md tabel berubah menjadi kartu bertumpuk supaya nama,
 * tanggal, dan status tetap terbaca tanpa scroll horizontal.
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
            <tr className="text-caption font-medium text-ink-400">
              <th scope="col" className="py-2 pl-5 pr-3 font-medium">Klien</th>
              <th scope="col" className="px-3 py-2 font-medium">Tanggal acara</th>
              <th scope="col" className="px-3 py-2 font-medium">Paket</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Nilai</th>
              <th scope="col" className="py-2 pl-3 pr-5 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr
                key={booking.id}
                className="border-t border-ink-100 transition-colors hover:bg-ink-50/60"
              >
                <td className="py-3 pl-5 pr-3">
                  <ClientCell booking={booking} />
                </td>
                <td className="px-3 py-3">
                  <EventCell booking={booking} />
                </td>
                <td className="px-3 py-3">
                  {booking.packageName ? (
                    <span className="inline-flex max-w-[11rem] items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-caption font-medium text-brand-700">
                      <span className="truncate">{booking.packageName}</span>
                    </span>
                  ) : (
                    <span className="text-meta text-ink-400">Tanpa paket</span>
                  )}
                  {booking.invoiceCount > 0 ? (
                    <span className="mt-1 flex items-center gap-1 text-caption text-ink-500">
                      <FileText className="size-3" />
                      {booking.invoiceCount} invoice
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={booking.status} />
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="text-body font-semibold tabular-nums text-ink-900">
                    {formatCurrency(booking.totalPrice)}
                  </span>
                </td>
                <td className="whitespace-nowrap py-3 pl-3 pr-5 text-right">
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
                  <p className="truncate text-body font-semibold text-ink-900">
                    {booking.client.name}
                  </p>
                  <StatusBadge status={booking.status} className="shrink-0" />
                </div>
                <p className="mt-1 flex items-center gap-1 text-meta text-ink-500">
                  <span className="rounded-md bg-ink-50 px-1.5 py-0.5 font-medium text-ink-700">
                    {formatShortDate(booking.eventDate)}
                  </span>
                  {booking.eventTime ? <span>· {formatTime(booking.eventTime)}</span> : null}
                </p>
                <p className="mt-1 truncate text-meta text-ink-500">
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
          className="block max-w-[12rem] truncate text-body font-semibold text-ink-900 hover:text-brand-700"
        >
          {booking.client.name}
        </Link>
        <p className="truncate text-caption text-ink-400">{booking.client.phone}</p>
      </div>
    </div>
  )
}

function EventCell({ booking }: { booking: Booking }) {
  return (
    <div>
      <p className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-ink-50 px-2 py-0.5 text-caption font-medium text-ink-700">
          {formatShortDate(booking.eventDate)}
        </span>
        {booking.eventTime ? (
          <span className="text-caption text-ink-400">{formatTime(booking.eventTime)}</span>
        ) : null}
      </p>
      <p className="mt-1 flex items-center gap-1 text-caption text-ink-400">
        <MapPin className="size-3 shrink-0" />
        <span className="max-w-[11rem] truncate">{booking.eventLocation ?? 'Lokasi belum diisi'}</span>
      </p>
    </div>
  )
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-caption font-semibold text-brand-700',
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}
