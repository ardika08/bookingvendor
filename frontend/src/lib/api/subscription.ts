import type {
  CheckoutSession,
  Payment,
  PaymentMethod,
  PaymentMethodCode,
  Plan,
  SubscriptionState,
} from '@/types/subscription'
import {
  confirmMockPayment,
  createMockCheckoutSession,
  getMockCheckoutSession,
  getMockPlanCheckout,
  expireMockPayment,
  mockPaymentMethods,
  mockPayments,
  mockPlans,
  mockSubscription,
  selectMockPaymentMethod,
} from '../mock/subscription'
import { ApiError, apiRequest } from './client'

/** Tunda singkat agar loading state mock terlihat realistis. */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Adapter data langganan.
 *
 * Pola sama dengan `lib/api/bookings.ts`: bentuk fungsi Promise mengikuti
 * endpoint yang akan disediakan Laravel —
 *   GET /api/plans                 → Plan[]
 *   GET /api/subscription          → SubscriptionState
 *   GET /api/payments              → Payment[]
 * Set `USE_MOCK_SUBSCRIPTION = false` saat backend siap; komponen tidak berubah.
 */

export const USE_MOCK_SUBSCRIPTION = false

export async function fetchPlans(): Promise<Plan[]> {
  if (USE_MOCK_SUBSCRIPTION) return structuredClone(mockPlans)
  return (await fetch('/api/plans', { credentials: 'include' })).json()
}

export async function fetchSubscription(): Promise<SubscriptionState> {
  if (USE_MOCK_SUBSCRIPTION) return structuredClone(mockSubscription)
  return (await fetch('/api/subscription', { credentials: 'include' })).json()
}

export async function fetchPayments(): Promise<Payment[]> {
  if (USE_MOCK_SUBSCRIPTION) return structuredClone(mockPayments)
  return (await fetch('/api/payments', { credentials: 'include' })).json()
}

// ---------------------------------------------------------------------------
// Alur checkout langganan (payment gateway — adapter Midtrans/Duitku)
// ---------------------------------------------------------------------------

/**
 * Sesi checkout untuk paket baru: ringkasan order sebelum transaksi dibuat.
 * Kontrak backend: GET /api/subscription/checkout?plan_id=…
 */
export async function fetchPlanCheckout(planId: string): Promise<CheckoutSession> {
  if (USE_MOCK_SUBSCRIPTION) {
    await delay(300)
    const session = getMockPlanCheckout(planId)
    if (!session) {
      throw new ApiError('Paket tidak ditemukan.', { status: 404 })
    }
    return session
  }
  return apiRequest(`/subscription/checkout?plan_id=${encodeURIComponent(planId)}`)
}

/**
 * Buat transaksi baru dari ringkasan (tombol "Bayar sekarang").
 * Kontrak backend: POST /api/subscription/checkout { plan_id } → session
 * yang berisi payment pending + pilihan metode dari gateway.
 */
export async function createCheckout(planId: string): Promise<CheckoutSession> {
  if (USE_MOCK_SUBSCRIPTION) {
    await delay(500)
    const plan = mockPlans.find((candidate) => candidate.id === planId)
    if (!plan || plan.price === null) {
      throw new Error('Paket tidak tersedia atau harga belum ditetapkan.')
    }
    return createMockCheckoutSession(plan)
  }
  return apiRequest<CheckoutSession>('/subscription/checkout', {
    method: 'POST',
    body: { plan_id: planId },
  })
}

/**
 * Lanjutkan checkout transaksi pending dari riwayat pembayaran.
 * Kontrak backend: GET /api/payments/{id}/checkout.
 */
export async function fetchCheckoutSession(paymentId: string): Promise<CheckoutSession | null> {
  if (USE_MOCK_SUBSCRIPTION) {
    await delay(300)
    return getMockCheckoutSession(paymentId)
  }
  try {
    return await apiRequest<CheckoutSession>(`/payments/${encodeURIComponent(paymentId)}/checkout`)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** Daftar metode pembayaran yang tersedia dari adapter gateway. */
export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  if (USE_MOCK_SUBSCRIPTION) {
    await delay(150)
    return structuredClone(mockPaymentMethods)
  }
  return apiRequest<PaymentMethod[]>('/subscription/checkout/methods')
}

/**
 * Pilih metode pembayaran → server mengembalikan instruksi spesifik
 * (nomor VA, QR, atau deep link). Kontrak: POST /payments/{id}/method
 */
export async function selectPaymentMethod(
  sessionId: string,
  code: PaymentMethodCode,
): Promise<CheckoutSession | null> {
  if (USE_MOCK_SUBSCRIPTION) {
    await delay(400)
    return selectMockPaymentMethod(sessionId, code)
  }
  return apiRequest<CheckoutSession>(`/payments/${encodeURIComponent(sessionId)}/method`, {
    method: 'POST',
    body: { method: code },
  })
}

/**
 * Cek status pembayaran (dipanggil berulang saat vendor menunggu webhook).
 * Kontrak backend: GET /payments/{id}/status → { status }.
 */
export async function checkPaymentStatus(
  sessionId: string,
): Promise<{ status: Payment['status'] }> {
  if (USE_MOCK_SUBSCRIPTION) {
    await delay(600)
    const session = getMockCheckoutSession(sessionId)
    return { status: session?.payment.status ?? 'expired' }
  }
  return apiRequest<{ status: Payment['status'] }>(
    `/payments/${encodeURIComponent(sessionId)}/status`,
  )
}

/**
 * Simulasi pembayaran (HANYA mock): meniru webhook gateway yang mengonfirmasi
 * pembayaran dan mengaktifkan langganan. Tidak dipanggil saat backend nyata —
 * halaman akan memakai polling status dari endpoint di atas.
 */
export async function simulatePaymentPaid(sessionId: string): Promise<CheckoutSession | null> {
  if (USE_MOCK_SUBSCRIPTION) {
    await delay(900)
    return confirmMockPayment(sessionId)
  }
  throw new Error('Simulasi pembayaran hanya tersedia di mode mock.')
}

/** Tandai transaksi kedaluwarsa (dipakai UI saat countdown habis). */
export async function expirePayment(sessionId: string): Promise<CheckoutSession | null> {
  if (USE_MOCK_SUBSCRIPTION) {
    await delay(300)
    return expireMockPayment(sessionId)
  }
  return apiRequest<CheckoutSession>(`/payments/${encodeURIComponent(sessionId)}/expire`, {
    method: 'POST',
  })
}
