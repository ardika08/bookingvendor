import {
  ArrowLeft,
  CalendarDays,
  Clock,
  FileText,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Receipt,
  User,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge, StatusMenu } from '@/components/bookings/StatusControls'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card'
import { DetailGrid, DetailItem } from '@/components/ui/DetailGrid'
import { BOOKING_STATUS_META } from '@/lib/booking-status'
import { formatCurrency, formatLongDate, formatShortDate, formatTime, initials } from '@/lib/format'
import { resolveAccess } from '@/lib/subscription-access'
import { ReadOnlyActionHint, ReadOnlyBanner } from '@/components/subscription/ReadOnlyBanner'
import { useDashboardUser } from '@/pages/DashboardHomePage'
import type { Booking, BookingStatus } from '@/types/booking'

/**
 * Halaman detail booking (`/bookings/:id`).
 *
 * Menampilkan data klien, detail acara, tautan cepat ke WhatsApp, dan daftar
 * invoice terkait. Aksi: ubah status, edit, dan buat invoice (invoice otomatis
 * diisi dari data booking — fase 2).
 */
export function BookingDetailPage({
  booking,
  onChangeStatus,
}: {
  booking: Booking
  /** Mengembalikan false bila server menolak — status lokal akan dikembalikan. */
  onChangeStatus?: (next: BookingStatus) => Promise<boolean>
}) {
  const [status, setStatus] = useState<BookingStatus>(booking.status)
  const [pending, setPending] = useState(false)
  const meta = BOOKING_STATUS_META[status]
  const isCancelled = status === 'cancelled'
  /** Detail & riwayat tetap terbaca saat kedaluwarsa; aksi tulis baru direm. */
  const access = resolveAccess(useDashboardUser().subscription)

  async function handleStatus(next: BookingStatus) {
    const previous = status
    setStatus(next)
    setPending(true)
    try {
      const ok = (await onChangeStatus?.(next)) ?? true
      if (!ok) setStatus(previous)
    } catch {
      setStatus(previous)
    } finally {
      setPending(false)
    }
  }

  const waLink = `https://wa.me/${booking.client.phone.replace(/\D/g, '').replace(/^0/, '62')}`

  return (
    <div className="space-y-4">
      <ReadOnlyBanner access={access} />

      <div className="flex items-center justify-between gap-2">
        <Link
          to="/bookings"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 hover:text-ink-800"
        >
          <ArrowLeft className="size-3.5" />
          Daftar booking
        </Link>
        <div className="flex items-center gap-2">
          <StatusMenu
            status={status}
            onChange={handleStatus}
            disabled={pending}
            hasInvoice={booking.invoiceCount > 0}
          />
          <ButtonLink to={`/bookings/${booking.id}/edit`} variant="secondary" size="sm">
            <Pencil className="size-3.5" />
            Edit
          </ButtonLink>
        </div>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[13px] font-semibold text-brand-700">
              {initials(booking.client.name)}
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink-900">
                {booking.client.name}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge status={status} variant="pill" />
                <span className="text-[12px] text-ink-500">{meta.description}</span>
              </div>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
              Nilai kontrak
            </p>
            <p className="text-xl font-semibold tabular-nums text-ink-900">
              {formatCurrency(booking.totalPrice)}
            </p>
            <p className="text-[12px] text-ink-500">{booking.packageName ?? 'Tanpa paket'}</p>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Detail Acara" description="Data yang tampil di kalender & invoice." />
            <CardBody>
              <DetailGrid>
                <DetailItem
                  label="Tanggal"
                  icon={<CalendarDays className="size-3" />}
                  value={formatLongDate(booking.eventDate)}
                />
                <DetailItem
                  label="Jam"
                  icon={<Clock className="size-3" />}
                  value={formatTime(booking.eventTime) ?? 'Belum ditentukan'}
                  muted={!booking.eventTime}
                />
                <DetailItem
                  label="Lokasi"
                  icon={<MapPin className="size-3" />}
                  value={booking.eventLocation ?? 'Belum diisi'}
                  muted={!booking.eventLocation}
                  className="sm:col-span-2"
                />
              </DetailGrid>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Data Klien" description="Dibuat otomatis dari form booking." />
            <CardBody>
              <DetailGrid>
                <DetailItem
                  label="Nama"
                  icon={<User className="size-3" />}
                  value={booking.client.name}
                />
                <DetailItem
                  label="WhatsApp"
                  icon={<Phone className="size-3" />}
                  value={booking.client.phone}
                  href={waLink}
                />
                <DetailItem
                  label="Email"
                  icon={<Mail className="size-3" />}
                  value={booking.client.email ?? 'Tidak ada'}
                  muted={!booking.client.email}
                  className="sm:col-span-2"
                />
              </DetailGrid>
            </CardBody>
            <CardFooter>
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-[13px] font-medium text-ink-700 shadow-sm ring-1 ring-ink-200 hover:bg-ink-50"
              >
                <Phone className="size-3.5" />
                Chat WhatsApp
              </a>
            </CardFooter>
          </Card>

          {booking.notes ? (
            <Card>
              <CardHeader title="Catatan Internal" description="Hanya terlihat oleh kamu." />
              <CardBody>
                <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-700">
                  {booking.notes}
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Invoice"
              description={
                booking.invoiceCount > 0
                  ? `${booking.invoiceCount} tagihan untuk booking ini.`
                  : 'Belum ada tagihan.'
              }
            />
            <CardBody className="space-y-2">
              {booking.invoiceCount > 0 ? (
                Array.from({ length: booking.invoiceCount }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-ink-200 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="size-3.5 text-ink-400" />
                      <span className="text-[12.5px] font-medium text-ink-800">
                        {index === 0 ? 'DP / tagihan awal' : `Pelunasan ${index}`}
                      </span>
                    </div>
                    <span className="text-[11.5px] text-ink-400">Segera</span>
                  </div>
                ))
              ) : (
                <p className="text-[12.5px] text-ink-500">
                  Buat invoice supaya klien menerima rincian tagihan dan link pembayaran.
                </p>
              )}
            </CardBody>
            <CardFooter>
              {access.readOnly ? (
                <ReadOnlyActionHint label="Buat invoice" />
              ) : (
                <ButtonLink to={`/bookings/${booking.id}/invoice/new`} size="sm">
                  <Receipt className="size-3.5" />
                  Buat invoice
                </ButtonLink>
              )}
            </CardFooter>
          </Card>

          <Card>
            <CardHeader title="Riwayat" />
            <CardBody>
              <ul className="space-y-2.5 text-[12.5px]">
                <li className="flex items-start gap-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-ink-300" />
                  <span>
                    <span className="block text-ink-700">Booking dibuat</span>
                    <span className="block text-[11.5px] text-ink-400">
                      {formatShortDate(booking.createdAt.slice(0, 10))}
                    </span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className={`mt-1 size-1.5 shrink-0 rounded-full ${meta.dotClass}`} />
                  <span>
                    <span className="block text-ink-700">Status sekarang: {meta.label}</span>
                    <span className="block text-[11.5px] text-ink-400">{meta.description}</span>
                  </span>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>

      {isCancelled ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-[12.5px] text-rose-800">
          Booking ini dibatalkan — tanggal sudah kosong lagi di kalender, dan jatah trial tetap
          terpakai sesuai aturan.
        </div>
      ) : null}
    </div>
  )
}
