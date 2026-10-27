import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  Phone,
  RotateCcw,
  ShieldCheck,
  Store,
  User,
  XCircle,
  type IconComponent,
} from '@/components/ui/icons'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { DetailGrid, DetailItem } from '@/components/ui/DetailGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import {
  sortPayments,
  subscriptionDaysLeft,
  type AdminPaymentStatus,
  type AdminSubscriptionPayment,
  type AdminSubscriptionStatus,
  type AdminVendorDetail,
} from '@/lib/admin-vendors'
import { getMockAdminVendor, listMockVendorPayments, setMockAdminVendorActive } from '@/lib/mock/admin'
import { formatCurrency, formatLongDate, formatShortDate, initials, toIsoDate } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Detail profil & langganan vendor (`/admin/vendors/:id`).
 *
 * Vendor datang dari daftar admin untuk melihat identitas usaha dan mengatur
 * langgangannya. Sesuai PRD: admin TIDAK membaca booking/invoice vendor — kartu
 * aktivitas hanya menampilkan jumlah, bukan isinya.
 *
 * Fase frontend: data dari `lib/mock/admin`; aksi ubah langganan menyusul di
 * task backend/berikutnya sehingga tombolnya ditandai "soon".
 */

const SUBSCRIPTION_META: Record<
  AdminSubscriptionStatus,
  { label: string; badgeClass: string }
> = {
  trial: { label: 'Trial', badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200' },
  active: { label: 'Aktif', badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  grace: { label: 'Tenggang', badgeClass: 'bg-sky-50 text-sky-700 ring-sky-200' },
  expired: { label: 'Berakhir', badgeClass: 'bg-rose-50 text-rose-700 ring-rose-200' },
}

const PAYMENT_STATUS_META: Record<
  AdminPaymentStatus,
  { label: string; icon: IconComponent; badgeClass: string; iconClass: string }
> = {
  paid: {
    label: 'Terbayar',
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    iconClass: 'bg-emerald-50 text-emerald-600',
  },
  pending: {
    label: 'Menunggu',
    icon: Clock3,
    badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200',
    iconClass: 'bg-amber-50 text-amber-600',
  },
  failed: {
    label: 'Gagal',
    icon: XCircle,
    badgeClass: 'bg-rose-50 text-rose-700 ring-rose-200',
    iconClass: 'bg-rose-50 text-rose-600',
  },
  expired: {
    label: 'Kedaluwarsa',
    icon: XCircle,
    badgeClass: 'bg-ink-100 text-ink-500 ring-ink-200',
    iconClass: 'bg-ink-100 text-ink-500',
  },
  refunded: {
    label: 'Dana kembali',
    icon: RotateCcw,
    badgeClass: 'bg-sky-50 text-sky-700 ring-sky-200',
    iconClass: 'bg-sky-50 text-sky-600',
  },
}

export function VendorDetailPage() {
  const { vendorId = '' } = useParams()
  const { notify } = useToast()
  const [vendor, setVendor] = useState<AdminVendorDetail | null>(() =>
    getMockAdminVendor(vendorId),
  )
  const [todayIso] = useState(() => toIsoDate(new Date()))
  const [payments] = useState(() => sortPayments(listMockVendorPayments(vendorId)))

  if (vendor === null) {
    return (
      <EmptyState
        icon={<ShieldCheck className="size-5" />}
        title="Vendor tidak ditemukan"
        description="Vendor mungkin sudah dihapus atau tautannya tidak berlaku."
        action={
          <ButtonLink to="/admin/vendors" variant="secondary" size="sm">
            <ArrowLeft className="size-3.5" />
            Daftar vendor
          </ButtonLink>
        }
      />
    )
  }

  const subscription = SUBSCRIPTION_META[vendor.subscription.status]
  const daysLeft = subscriptionDaysLeft(vendor.subscription.endsAt, todayIso)
  const waDigits = vendor.contact?.replace(/\D/g, '').replace(/^0/, '62') ?? ''
  const waLink = waDigits ? `https://wa.me/${waDigits}` : null

  function toggleActive() {
    const updated = setMockAdminVendorActive(vendor!.id, !vendor!.isActive)
    if (updated) setVendor(updated)
    notify(
      updated?.isActive
        ? `"${updated.name}" diaktifkan kembali.`
        : `"${updated?.name}" dinonaktifkan — vendor tidak bisa masuk sementara data tetap utuh.`,
      { tone: 'success' },
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/admin/vendors"
          className="inline-flex items-center gap-1.5 text-meta font-medium text-ink-500 hover:text-ink-800"
        >
          <ArrowLeft className="size-3.5" />
          Daftar vendor
        </Link>
        <div className="flex items-center gap-2">
          <ButtonLink to={`/admin/vendors/${vendorId}/edit`} variant="secondary" size="sm">
            Edit profil
          </ButtonLink>
          <Button
            size="sm"
            variant={vendor.isActive ? 'secondary' : 'primary'}
            onClick={toggleActive}
          >
            {vendor.isActive ? 'Nonaktifkan akun' : 'Aktifkan akun'}
          </Button>
        </div>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lead font-semibold text-brand-700">
              {initials(vendor.name)}
            </span>
            <div className="min-w-0">
              <h2 className="text-title tracking-tight text-ink-900">{vendor.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium ring-1 ring-inset',
                    subscription.badgeClass,
                  )}
                >
                  Langganan {subscription.label}
                </span>
                <Badge className={vendor.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500'}>
                  {vendor.isActive ? 'Akun aktif' : 'Akun nonaktif'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-2">
            <div>
              <p className="text-caption font-medium uppercase tracking-wide text-ink-400">
                Booking
              </p>
              <p className="text-title font-semibold tabular-nums text-ink-900">
                {vendor.bookingsCount}
              </p>
            </div>
            <div>
              <p className="text-caption font-medium uppercase tracking-wide text-ink-400">
                Invoice
              </p>
              <p className="text-title font-semibold tabular-nums text-ink-900">
                {vendor.invoicesCount}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Profil Usaha" description="Data yang tampil di halaman publik." />
            <CardBody>
              <DetailGrid>
                <DetailItem
                  label="Pemilik"
                  icon={<User className="size-3" />}
                  value={vendor.ownerName}
                />
                <DetailItem
                  label="Email akun"
                  icon={<Mail className="size-3" />}
                  value={vendor.email}
                  href={`mailto:${vendor.email}`}
                />
                <DetailItem
                  label="Kategori"
                  icon={<Store className="size-3" />}
                  value={vendor.category ?? 'Belum dipilih'}
                  muted={!vendor.category}
                />
                <DetailItem
                  label="Kota"
                  value={vendor.city ?? 'Belum diisi'}
                  muted={!vendor.city}
                />
                <DetailItem
                  label="Kontak / WA"
                  icon={<Phone className="size-3" />}
                  value={vendor.contact ?? 'Belum diisi'}
                  href={waLink ?? undefined}
                  muted={!vendor.contact}
                />
                <DetailItem
                  label="Bergabung"
                  icon={<CalendarDays className="size-3" />}
                  value={formatLongDate(vendor.createdAt)}
                />
              </DetailGrid>

              {vendor.description ? (
                <p className="mt-4 border-t border-ink-100 pt-3 text-meta leading-relaxed text-ink-600">
                  {vendor.description}
                </p>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader
              title="Langganan"
              description={vendor.subscription.status === 'trial'
                ? 'Jatah trial: 2 booking + 2 invoice, sekali pakai.'
                : 'Masa aktif paket langganan vendor.'}
            />
            <CardBody className="space-y-2 text-meta">
              {vendor.subscription.endsAt ? (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-ink-500">Berakhir</span>
                    <span className="tabular-nums text-ink-800">
                      {formatShortDate(vendor.subscription.endsAt)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-ink-500">Sisa</span>
                    <span
                      className={cn(
                        'tabular-nums font-medium',
                        daysLeft !== null && daysLeft <= 7 ? 'text-amber-700' : 'text-ink-800',
                      )}
                    >
                      {daysLeft !== null && daysLeft < 0
                        ? `lewat ${Math.abs(daysLeft)} hari`
                        : `${daysLeft} hari`}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-ink-500">
                  Trial aktif — batas mengikuti jatah 2 booking + 2 invoice, bukan tanggal.
                </p>
              )}

              {vendor.subscription.status === 'grace' ? (
                <p className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-2 text-caption leading-relaxed text-sky-900">
                  Masa tenggang: vendor masih bisa bekerja sampai batas tenggang, lalu otomatis
                  berstatus berakhir.
                </p>
              ) : null}
            </CardBody>
            <CardBody className="border-t border-ink-100">
              <Button size="sm" variant="secondary" disabled title="Belum tersedia">
                Atur langganan · soon
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="text-caption leading-relaxed text-ink-500">
                Admin tidak membuka booking & invoice vendor — hanya melihat jumlah pemakaiannya.
                Angka di atas terpakai untuk konteks pengelolaan akun.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>

      <Card>
        <CardHeader
          title="Riwayat Transaksi Langganan"
          description="Pembayaran paket lewat payment gateway. Konfirmasi manual & pengaturan masa aktif menyusul."
        />
        {payments.length === 0 ? (
          <EmptyState
            icon={<Clock3 className="size-5" />}
            title="Belum ada transaksi"
            description="Vendor masih di masa trial atau belum pernah membeli paket."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {payments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function PaymentRow({ payment }: { payment: AdminSubscriptionPayment }) {
  const meta = PAYMENT_STATUS_META[payment.status]
  const Icon = meta.icon

  return (
    <li className="flex items-start gap-3 px-4 py-3 sm:px-5">
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          meta.iconClass,
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-body font-semibold text-ink-900">
            {payment.planName} · {formatCurrency(payment.amount)}
          </p>
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium ring-1 ring-inset',
              meta.badgeClass,
            )}
          >
            {meta.label}
          </span>
        </div>
        <p className="mt-0.5 truncate text-caption tabular-nums text-ink-500">
          {payment.reference} · {payment.method}
        </p>
        <p className="text-caption text-ink-400">
          {payment.paidAt
            ? `Dibayar ${formatShortDate(payment.paidAt)}`
            : `Dibuat ${formatShortDate(payment.createdAt)}`}
          {payment.paidAt && payment.createdAt !== payment.paidAt
            ? ` · dibuat ${formatShortDate(payment.createdAt)}`
            : ''}
        </p>
      </div>
    </li>
  )
}
