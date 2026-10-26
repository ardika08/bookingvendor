import type {
  CheckoutSession,
  Payment,
  PaymentMethod,
  PaymentMethodCode,
  Plan,
  SubscriptionState,
} from '@/types/subscription'

/**
 * Data tiruan fase Katalog Paket + alur checkout.
 *
 * Harga 3 Bulan & Tahunan sengaja `null` (belum ditetapkan admin) supaya UI
 * sudah membaca bentuk data nyata sejak awal; begitu admin mengisi harga di
 * tabel `plans`, tampilan "Segera" otomatis jadi tombol beli.
 *
 * Bagian checkout bersifat mutable dalam memori: membuat transaksi menambah
 * baris payment dan simulasi pembayaran memperbarui status — meniru backend
 * Laravel. State kembali ke bawaan saat halaman di-refresh (khas mock).
 */

export const mockPlans: Plan[] = [
  {
    id: 'plan-monthly',
    code: 'monthly',
    name: 'Bulanan',
    durationMonths: 1,
    price: 50000,
    maxBookings: null,
    maxInvoices: null,
    highlight: true,
    benefits: ['Booking & invoice tanpa batas', 'Aktif 30 hari', 'Link jadwal publik'],
  },
  {
    id: 'plan-quarterly',
    code: 'quarterly',
    name: '3 Bulan',
    durationMonths: 3,
    price: null,
    maxBookings: null,
    maxInvoices: null,
    benefits: ['Semua fitur Bulanan', 'Aktif 90 hari', 'Hemat hingga 20% (menyusul)'],
  },
  {
    id: 'plan-yearly',
    code: 'yearly',
    name: 'Tahunan',
    durationMonths: 12,
    price: null,
    maxBookings: null,
    maxInvoices: null,
    benefits: ['Semua fitur Bulanan', 'Aktif 365 hari', 'Prioritas dukungan (menyusul)'],
  },
]

export const mockSubscription: SubscriptionState = {
  status: 'trial',
  endsAt: null,
  graceEndsAt: null,
  trialBookingsUsed: 2,
  trialBookingsLimit: 2,
  trialInvoicesUsed: 1,
  trialInvoicesLimit: 2,
}

export const mockBank = {
  name: 'BCA',
  accountNumber: '1234567890',
  accountHolder: 'PT Lumen Wedding Digital',
}

/** Riwayat pembayaran tiruan: satu transaksi pending yang masih bisa dibayar. */
const mockNow = new Date()
export const mockPayments: Payment[] = [
  {
    id: 'pay-1',
    reference: 'PAY-20261001-0001',
    planId: 'plan-monthly',
    planName: 'Bulanan',
    amount: 50000,
    status: 'pending',
    bank: mockBank,
    createdAt: mockNow.toISOString(),
    // Dinamis (+24 jam dari saat halaman dibuka) agar alur "lanjutkan pembayaran"
    // tetap bisa didemokan tanpa transaksi langsung kedaluwarsa.
    expiresAt: new Date(mockNow.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  },
]

// ---------------------------------------------------------------------------
// Store alur checkout (mutable, in-memory)
// ---------------------------------------------------------------------------

/**
 * Sesi checkout per ID transaksi. Disimpan di level modul supaya semua fungsi
 * API mock melihat state yang sama selama satu sesi browser — meniru
 * persistensi server sebelum integrasi gateway nyata.
 */
const checkoutSessions = new Map<string, CheckoutSession>()

/** Metode pembayaran yang ditawarkan — mengikuti kontrak adapter gateway. */
export const mockPaymentMethods: PaymentMethod[] = [
  { code: 'qris', name: 'QRIS', description: 'Scan sekali dari semua aplikasi pembayaran' },
  {
    code: 'va_bca',
    name: 'Virtual Account BCA',
    description: 'Transfer ke nomor VA, terverifikasi otomatis',
    provider: 'BCA',
  },
  {
    code: 'va_bni',
    name: 'Virtual Account BNI',
    description: 'Transfer ke nomor VA BNI',
    provider: 'BNI',
  },
  {
    code: 'va_mandiri',
    name: 'Virtual Account Mandiri',
    description: 'Transfer ke nomor VA Mandiri',
    provider: 'Mandiri',
  },
  {
    code: 'ewallet',
    name: 'E-Wallet',
    description: 'GoPay, OVO, DANA, ShopeePay',
    provider: 'GoPay/OVO/DANA',
  },
]

/** Nomor VA tiruan dengan prefix berbeda per bank agar terlihat realistis. */
function mockVirtualAccount(code: PaymentMethodCode): string {
  const prefix = code === 'va_bca' ? '8077' : code === 'va_bni' ? '988' : '895'
  const random = Math.floor(Math.random() * 1_000_000_000)
    .toString()
    .padStart(9, '0')
  return `${prefix}08${random}`
}

function findPlan(planId: string): Plan | undefined {
  return mockPlans.find((candidate) => candidate.id === planId)
}

/**
 * Sesi checkout baru untuk paket yang dipilih. Transaksi terbentuk di sisi
 * klien (mock); backend nantinya membuat baris `payments` + order gateway.
 */
export function createMockCheckoutSession(plan: Plan): CheckoutSession {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  const sequence = String(mockPayments.length + 1).padStart(4, '0')

  const payment: Payment = {
    id: `pay-checkout-${Date.now()}`,
    reference: `PAY-${dateStamp}-${sequence}`,
    planId: plan.id,
    planName: plan.name,
    amount: plan.price ?? 0,
    status: 'pending',
    bank: mockBank,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }

  mockPayments.unshift(payment)

  const session: CheckoutSession = {
    id: payment.id,
    payment,
    plan,
    step: 'summary',
    selectedMethod: null,
    methodInstructions: null,
  }
  checkoutSessions.set(session.id, session)
  return structuredClone(session)
}

/**
 * Ambil sesi checkout yang sudah ada (melanjutkan transaksi pending dari
 * riwayat). Bila memori kosong karena refresh, sesi dibangun ulang dari
 * data payment + plan agar alur tetap bisa dilanjutkan.
 */
export function getMockCheckoutSession(paymentId: string): CheckoutSession | null {
  const existing = checkoutSessions.get(paymentId)
  if (existing) return structuredClone(existing)

  const payment = mockPayments.find((item) => item.id === paymentId)
  const plan = payment ? findPlan(payment.planId) : undefined
  if (!payment || !plan) return null

  const session: CheckoutSession = {
    id: payment.id,
    payment,
    plan,
    step: payment.status === 'confirmed' ? 'success' : 'summary',
    selectedMethod: null,
    methodInstructions: null,
  }
  checkoutSessions.set(session.id, session)
  return structuredClone(session)
}

/** Sesi checkout untuk paket baru: transaksi belum dibuat (langkah ringkasan). */
export function getMockPlanCheckout(planId: string): CheckoutSession | null {
  const plan = findPlan(planId)
  if (!plan) return null

  const session: CheckoutSession = {
    id: '',
    payment: {
      id: '',
      reference: '',
      planId: plan.id,
      planName: plan.name,
      amount: plan.price ?? 0,
      status: 'pending',
      bank: mockBank,
      createdAt: new Date().toISOString(),
      expiresAt: null,
    },
    plan,
    step: 'summary',
    selectedMethod: null,
    methodInstructions: null,
  }
  return structuredClone(session)
}

/** Pilih metode pembayaran → hasilkan instruksi (VA/QR/deep link) tiruan. */
export function selectMockPaymentMethod(
  sessionId: string,
  code: PaymentMethodCode,
): CheckoutSession | null {
  const session = checkoutSessions.get(sessionId)
  if (!session) return null

  const method = mockPaymentMethods.find((candidate) => candidate.code === code)
  if (!method) return null

  session.selectedMethod = code
  session.step = 'instructions'
  session.methodInstructions = {
    ...method,
    virtualAccount: code.startsWith('va_') ? mockVirtualAccount(code) : undefined,
    ewalletDeepLink: code === 'ewallet' ? 'https://mock-gateway.local/ewallet/pay' : undefined,
    qrCodeUrl: code === 'qris' ? '/mock/qr-code.svg' : undefined,
  }
  return structuredClone(session)
}

/**
 * Simulasi webhook gateway: status transaksi jadi terkonfirmasi dan masa aktif
 * langganan diperpanjang dari hari ini. Di backend, inilah yang dilakukan
 * webhook Midtrans/Duitku setelah verifikasi signature & nominal.
 */
export function confirmMockPayment(sessionId: string): CheckoutSession | null {
  const session = checkoutSessions.get(sessionId)
  if (!session) return null

  const payment = mockPayments.find((item) => item.id === sessionId)
  if (payment) {
    payment.status = 'confirmed'
    session.payment = structuredClone(payment)
  }

  const endsAt = renewalBase(mockSubscription.endsAt)
  endsAt.setMonth(endsAt.getMonth() + session.plan.durationMonths)
  mockSubscription.status = 'active'
  mockSubscription.endsAt = endsAt.toISOString()
  mockSubscription.graceEndsAt = null

  session.step = 'success'
  return structuredClone(session)
}

/**
 * Titik mulai masa aktif baru: bila langganan masih aktif, perpanjangan dihitung
 * dari tanggal berakhir lama (sesuai PRD); kalau tidak, mulai dari hari ini.
 */
function renewalBase(endsAt: string | null): Date {
  if (!endsAt) return new Date()
  const previous = new Date(endsAt)
  return previous.getTime() > Date.now() ? previous : new Date()
}

/** Tandai transaksi kedaluwarsa (melewati batas waktu tanpa pembayaran). */
export function expireMockPayment(sessionId: string): CheckoutSession | null {
  const session = checkoutSessions.get(sessionId)
  if (!session) return null

  const payment = mockPayments.find((item) => item.id === sessionId)
  if (payment) {
    payment.status = 'expired'
    session.payment = structuredClone(payment)
  }
  session.step = 'expired'
  return structuredClone(session)
}
