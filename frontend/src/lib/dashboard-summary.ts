import type { Booking, BookingStatus, CurrentUser } from '@/types/booking'
import type { Invoice } from '@/types/invoice'

/**
 * Agregat data untuk dashboard vendor.
 *
 * Dashboard butuh angka ringkas (pesanan masuk, jadwal terdekat, piutang), bukan
 * daftar panjang. Perhitungannya ditulis sebagai fungsi murni supaya bisa diuji
 * tanpa React dan dipakai ulang oleh endpoint `GET /api/dashboard/summary` nanti.
 */

export interface DashboardCounts {
  /** Booking yang menunggu konfirmasi vendor (status `tentative`). */
  pending: number
  confirmed: number
  completed: number
  cancelled: number
  /** Seluruh booking tanpa filter. */
  total: number
}

export interface DashboardMoney {
  /** Nilai kontrak booking yang tidak dibatalkan. */
  contractValue: number
  /** Total yang sudah ditagihkan (invoice non-void). */
  billed: number
  /** Total yang sudah masuk. */
  paid: number
  /** Sisa tagihan yang masih harus ditagih. */
  outstanding: number
  /** Nilai kontrak dari booking berstatus tentative — potensi pendapatan. */
  potentialValue: number
}

export interface DashboardSummary {
  counts: DashboardCounts
  money: DashboardMoney
  /** Booking mendatang terdekat (status tentative/confirmed, tanggal >= hari ini). */
  upcoming: Booking[]
  /** Invoice yang sudah lewat jatuh tempo dan masih collectible. */
  overdueInvoices: Invoice[]
  /** Invoice terbaru (urut terbit menurun). */
  recentInvoices: Invoice[]
  /** Tanggal hari ini dalam format `YYYY-MM-DD`. */
  today: string
}

/** Booking berstatus tentative adalah "pesanan masuk" yang perlu ditindaklanjuti. */
export function isIncomingOrder(booking: Booking): boolean {
  return booking.status === 'tentative'
}

/** Booking aktif (tentatif/terkonfirmasi) yang tanggalnya belum lewat. */
export function isUpcoming(booking: Booking, todayIso: string): boolean {
  if (booking.status !== 'tentative' && booking.status !== 'confirmed') return false
  return booking.eventDate >= todayIso
}

export function countBookings(bookings: Booking[]): DashboardCounts {
  const counts: DashboardCounts = {
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    total: bookings.length,
  }
  for (const booking of bookings) counts[statusKey(booking.status)] += 1
  return counts
}

/** `tentative` dipetakan ke `pending` agar nama field dashboard lebih jelas. */
function statusKey(status: BookingStatus): 'pending' | 'confirmed' | 'completed' | 'cancelled' {
  return status === 'tentative' ? 'pending' : status
}

/** Ringkas nominal kontrak & tagihan dari booking + invoice. */
export function summarizeMoney(bookings: Booking[], invoices: Invoice[]): DashboardMoney {
  let contractValue = 0
  let potentialValue = 0

  for (const booking of bookings) {
    if (booking.status === 'cancelled') continue
    contractValue += booking.totalPrice
    if (booking.status === 'tentative') potentialValue += booking.totalPrice
  }

  let billed = 0
  let paid = 0
  for (const invoice of invoices) {
    if (invoice.status === 'void') continue
    billed += invoice.amount
    paid += invoice.paidAmount
  }

  return {
    contractValue,
    billed,
    paid,
    outstanding: Math.max(billed - paid, 0),
    potentialValue,
  }
}

/**
 * Susun seluruh ringkasan dashboard.
 *
 * `todayIso` wajib dikirim pemanggil (bukan `new Date()` di dalam fungsi) agar
 * hasilnya deterministik dan mudah diuji.
 */
export function buildDashboardSummary(
  bookings: Booking[],
  invoices: Invoice[],
  todayIso: string,
  limit = 5,
): DashboardSummary {
  const upcoming = bookings
    .filter((booking) => isUpcoming(booking, todayIso))
    .sort((a, b) => {
      const byDate = a.eventDate.localeCompare(b.eventDate)
      return byDate !== 0 ? byDate : (a.eventTime ?? '').localeCompare(b.eventTime ?? '')
    })
    .slice(0, limit)

  const overdueInvoices = invoices
    .filter((invoice) => isInvoiceOverdue(invoice, todayIso))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, limit)

  const recentInvoices = [...invoices]
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
    .slice(0, limit)

  return {
    counts: countBookings(bookings),
    money: summarizeMoney(bookings, invoices),
    upcoming,
    overdueInvoices,
    recentInvoices,
    today: todayIso,
  }
}

/** Invoice masih collectible tetapi jatuh tempo sebelum hari ini. */
function isInvoiceOverdue(invoice: Invoice, todayIso: string): boolean {
  if (invoice.status !== 'unpaid' && invoice.status !== 'partial') return false
  if (invoice.dueAt >= todayIso) return false
  return invoice.amount - invoice.paidAmount > 0
}

/** Pelanggan yang paling sering memesan (berdasarkan jumlah booking). */
export function topClients(bookings: Booking[], limit = 3): Array<{ name: string; count: number }> {
  const map = new Map<string, number>()
  for (const booking of bookings) {
    if (booking.status === 'cancelled') continue
    map.set(booking.client.name, (map.get(booking.client.name) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}

/** Sapaan singkat berdasarkan jam lokal. */
export function greetingFor(date: Date): string {
  const hour = date.getHours()
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 19) return 'Selamat sore'
  return 'Selamat malam'
}

/** Nama depan vendor untuk sapaan. */
export function firstName(user: CurrentUser): string {
  return user.name.split(/\s+/)[0] ?? user.name
}
