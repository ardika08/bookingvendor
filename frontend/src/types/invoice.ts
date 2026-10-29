/**
 * Tipe domain invoice.
 *
 * Invoice selalu lahir dari sebuah booking (PRD: "Invoice otomatis dari
 * booking"), jadi setiap invoice menyimpan relasi ke booking sekaligus salinan
 * data yang dibutuhkan untuk dicetak/dibagikan — bila data booking berubah,
 * invoice lama tetap menampilkan nilai saat diterbitkan.
 */

/** Jenis tagihan: DP (uang muka) atau pelunasan sisa kontrak. */
export type InvoiceType = 'dp' | 'pelunasan'

export const INVOICE_TYPES: InvoiceType[] = ['dp', 'pelunasan']

/**
 * Status pembayaran invoice.
 *
 * - `unpaid`   — terbit, belum ada pembayaran
 * - `partial`  — DP masuk, sisa belum lunas
 * - `paid`     — lunas
 * - `void`     — dibatalkan vendor (tidak dihitung pada total)
 */
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'void'

export const INVOICE_STATUSES: InvoiceStatus[] = ['unpaid', 'partial', 'paid', 'void']

export interface Invoice {
  id: string
  /** Nomor yang dibaca manusia, mis. `INV/2026/10/0007`. */
  number: string
  bookingId: string
  /** Nama klien pada saat invoice diterbitkan. */
  clientName: string
  clientPhone: string
  /** Nama paket/layanan yang ditagihkan. */
  packageName: string | null
  type: InvoiceType
  status: InvoiceStatus
  /** ISO date `YYYY-MM-DD` — tanggal invoice diterbitkan. */
  issuedAt: string
  /** ISO date `YYYY-MM-DD` — batas pembayaran. */
  dueAt: string
  /** Nilai kontrak booking (dasar perhitungan). */
  bookingTotal: number
  /** Nominal yang ditagihkan pada invoice ini. */
  amount: number
  /** Nominal yang sudah dibayar (DP/angsuran). */
  paidAmount: number
  /** ISO date `YYYY-MM-DD` — tanggal acara, dipakai sebagai kolom pengingat. */
  eventDate: string
  /** Posisi invoice dalam urutan term booking; diturunkan server. */
  term: { term: number; total: number }
}

export type InvoicePaymentMethod = 'transfer' | 'qris' | 'cash' | 'other'

/** Satu pembayaran manual yang diterima untuk invoice. */
export interface InvoicePayment {
  id: string
  invoiceId: string
  amount: number
  /** ISO date `YYYY-MM-DD`. */
  paidAt: string
  method: InvoicePaymentMethod
  note: string | null
}

export interface InvoiceFilters {
  status: InvoiceStatus | 'all'
  type: InvoiceType | 'all'
  /** Kata kunci: nomor invoice, nama klien, atau nomor WA. */
  search: string
}

export interface InvoiceListResult {
  items: Invoice[]
  /** Total baris yang cocok filter, sebelum paginasi. */
  total: number
  page: number
  perPage: number
  /** Agregat seluruh baris yang cocok filter (bukan hanya halaman ini). */
  summary: InvoiceSummary
}

/** Angka ringkasan di atas tabel — dihitung server dari seluruh hasil filter. */
export interface InvoiceSummary {
  /** Jumlah nominal seluruh invoice yang cocok filter. */
  billed: number
  /** Yang sudah masuk. */
  paid: number
  /** billed - paid. */
  outstanding: number
  /** Jumlah invoice berstatus `unpaid`/`partial` yang sudah lewat jatuh tempo. */
  overdueCount: number
}
