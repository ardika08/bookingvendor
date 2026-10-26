import { Banknote, CheckCircle2, CircleDashed, FileX2, type LucideIcon } from 'lucide-react'
import { toDate } from '@/lib/format'
import type { InvoiceStatus, InvoiceType } from '@/types/invoice'

/**
 * Metadata status & jenis invoice — satu sumber kebenaran untuk badge, filter,
 * dan ringkasan nominal di seluruh UI.
 *
 * Enum tetap bahasa Inggris (mengikuti `invoices.status` di PRD), teks yang
 * dibaca vendor berbahasa Indonesia.
 */
export interface InvoiceStatusMeta {
  label: string
  description: string
  icon: LucideIcon
  /** Kelas badge ringkas untuk tabel & kartu. */
  badgeClass: string
  /** Warna titik pada legenda / indikator. */
  dotClass: string
  /** True bila nominal invoice ini masih bisa ditagih (masuk hitungan piutang). */
  collectible: boolean
}

export const INVOICE_STATUS_META: Record<InvoiceStatus, InvoiceStatusMeta> = {
  unpaid: {
    label: 'Belum dibayar',
    description: 'Invoice sudah dikirim, pembayaran belum diterima.',
    icon: CircleDashed,
    badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200',
    dotClass: 'bg-amber-500',
    collectible: true,
  },
  partial: {
    label: 'Dibayar sebagian',
    description: 'DP sudah masuk, sisa pembayaran belum diterima.',
    icon: Banknote,
    badgeClass: 'bg-sky-50 text-sky-700 ring-sky-200',
    dotClass: 'bg-sky-500',
    collectible: true,
  },
  paid: {
    label: 'Lunas',
    description: 'Seluruh nominal invoice sudah dibayar.',
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dotClass: 'bg-emerald-500',
    collectible: false,
  },
  void: {
    label: 'Dibatalkan',
    description: 'Invoice digugurkan vendor dan tidak ditagihkan.',
    icon: FileX2,
    badgeClass: 'bg-ink-100 text-ink-500 ring-ink-200',
    dotClass: 'bg-ink-400',
    collectible: false,
  },
}

export const INVOICE_TYPE_META: Record<InvoiceType, { label: string; description: string }> = {
  dp: {
    label: 'DP',
    description: 'Uang muka untuk mengunci tanggal acara.',
  },
  pelunasan: {
    label: 'Pelunasan',
    description: 'Sisa pembayaran kontrak sebelum/setelah acara.',
  },
}

/** Urutan tampil di filter — yang perlu ditindaklanjuti lebih dulu. */
export const INVOICE_STATUS_DISPLAY_ORDER: InvoiceStatus[] = ['unpaid', 'partial', 'paid', 'void']

/**
 * Invoice dianggap lewat jatuh tempo bila masih collectible dan `dueAt` sudah
 * lewat dari hari ini. Dibandingkan per tanggal (bukan timestamp) supaya
 * invoice yang jatuh tempo hari ini belum dihitung terlambat.
 */
export function isOverdue(
  invoice: { status: InvoiceStatus; dueAt: string },
  today: Date = new Date(),
): boolean {
  if (!INVOICE_STATUS_META[invoice.status].collectible) return false
  const due = toDate(invoice.dueAt).getTime()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  return due < startOfToday
}

/** Sisa yang belum dibayar pada satu invoice (tidak pernah negatif). */
export function remainingAmount(invoice: { amount: number; paidAmount: number }): number {
  return Math.max(invoice.amount - invoice.paidAmount, 0)
}

/** Persentase pembayaran 0–100 untuk progress bar kecil di tabel. */
export function paidPercent(invoice: { amount: number; paidAmount: number }): number {
  if (invoice.amount <= 0) return invoice.paidAmount > 0 ? 100 : 0
  return Math.min(Math.round((invoice.paidAmount / invoice.amount) * 100), 100)
}
