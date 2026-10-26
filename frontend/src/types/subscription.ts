import type { SubscriptionSummary } from '@/types/booking'

/**
 * Tipe domain langganan & pembayaran (fase Katalog Paket).
 *
 * Bentuk mengikuti rencana tabel Laravel: `plans` (kode, durasi, harga,
 * batas pemakaian), `subscriptions` (status + masa aktif + tenggang), dan
 * `payments` (transaksi manual dengan instruksi transfer). Selama backend
 * belum ada, dipasok data tiruan di `lib/mock/subscription.ts`.
 */

/** Kode paket — `monthly` wajib ada sesuai PRD (Rp50.000). */
export type PlanCode = 'monthly' | 'quarterly' | 'yearly'

export interface Plan {
  id: string
  code: PlanCode
  name: string
  /** Lama aktif dalam bulan. */
  durationMonths: number
  /** null = harga belum ditetapkan (tampil "Segera", tidak bisa dibeli). */
  price: number | null
  /** null = tanpa batas. */
  maxBookings: number | null
  maxInvoices: number | null
  highlight?: boolean
  /** Daftar manfaat singkat untuk kartu katalog. */
  benefits: string[]
}

/** Status langganan diperluas dengan masa tenggang (grace period). */
export type SubscriptionStatus = SubscriptionSummary['status'] | 'grace'

export interface SubscriptionState {
  status: SubscriptionStatus
  /** ISO datetime atau null (trial tidak punya tanggal berakhir). */
  endsAt: string | null
  /** Akhir masa tenggang untuk status `grace`/`expired`. */
  graceEndsAt: string | null
  trialBookingsUsed: number
  trialBookingsLimit: number
  trialInvoicesUsed: number
  trialInvoicesLimit: number
}

export type PaymentStatus = 'pending' | 'confirmed' | 'rejected' | 'expired'

export interface Payment {
  id: string
  /** Kode tampilan untuk vendor, mis. `PAY-20261023-0001`. */
  reference: string
  planId: string
  planName: string
  amount: number
  status: PaymentStatus
  /** Rekening tujuan + nama pemilik untuk transfer manual. */
  bank: { name: string; accountNumber: string; accountHolder: string }
  createdAt: string
  /** Batas waktu pembayaran sebelum transaksi kedaluwarsa. */
  expiresAt: string | null
}

/** Metode pembayaran yang ditawarkan di checkout (gateway belum final — adapter). */
export type PaymentMethodCode = 'qris' | 'va_bca' | 'va_bni' | 'va_mandiri' | 'ewallet'

export interface PaymentMethod {
  code: PaymentMethodCode
  name: string
  description: string
  /** Nama bank/provider — kosong untuk QRIS. */
  provider?: string
  /** Nomor VA (hanya bila code berisi 'va_'). */
  virtualAccount?: string
  /** Deep link e-wallet (hanya bila code = 'ewallet'). */
  ewalletDeepLink?: string
  /** URL gambar QR siap pakai (bila gateway menyediakannya). */
  qrCodeUrl?: string
  /**
   * Payload QR mentah dari gateway (EMVCo string), mis. dari Duitku.
   * Dirender menjadi gambar QR di sisi klien karena gateway hanya
   * mengirim string, bukan gambar.
   */
  qrString?: string
}

export type CheckoutStep = 'summary' | 'instructions' | 'success' | 'expired'

/**
 * Sesi checkout yang terbentuk saat vendor memilih paket atau melanjutkan
 * transaksi pending. Menyimpan state alur pembayaran agar tidak hilang
 * saat navigasi antar langkah.
 */
export interface CheckoutSession {
  /** ID sama dengan `payment.id` setelah transaksi dibuat. */
  id: string
  payment: Payment
  plan: Plan
  /** Langkah saat ini dalam alur checkout. */
  step: CheckoutStep
  /** Metode yang dipilih vendor; null = belum dipilih. */
  selectedMethod: PaymentMethodCode | null
  /** Instruksi yang ditampilkan setelah pilih metode. */
  methodInstructions: PaymentMethod | null
}
