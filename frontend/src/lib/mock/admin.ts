import type {
  AdminPaymentStatus,
  AdminSubscriptionPayment,
  AdminVendorDetail,
  AdminVendorSummary,
} from '@/lib/admin-vendors'
import type { AdminPlan } from '@/lib/admin-plans'
import type { CurrentUser } from '@/types/booking'
import { toIsoDate } from '@/lib/format'

/**
 * Akun admin tiruan untuk fase frontend dashboard admin.
 *
 * Tipe `CurrentUser` mewajibkan `subscription` karena dipakai bersama akun
 * vendor — field itu tidak dipakai UI admin (Topbar melewatinya untuk role
 * admin), jadi diisi nilai netral agar tetap lolos tipe.
 */
export const mockAdminUser: CurrentUser = {
  name: 'Admin Booking Vendor',
  email: 'admin@bookingvendor.id',
  avatarUrl: null,
  role: 'admin',
  vendor: null,
  subscription: {
    status: 'trial',
    trialBookingsUsed: 0,
    trialBookingsLimit: 0,
    trialInvoicesUsed: 0,
    trialInvoicesLimit: 0,
    endsAt: null,
  },
}

function shiftDays(days: number): string {
  const today = new Date()
  return toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days))
}

/**
 * Daftar vendor untuk panel admin (mode mock).
 *
 * State module-level supaya vendor yang ditambahkan admin tetap tampil selama
 * sesi berjalan — sama seperti pola mock lain.
 */
let mockState: AdminVendorDetail[] = [
  {
    id: 'vd-1',
    name: 'Lumen Wedding Story',
    ownerName: 'Dika Pratama',
    email: 'dika@lumenwedding.id',
    category: 'Wedding Organizer',
    city: 'Jakarta Selatan',
    isActive: true,
    subscription: { status: 'active', endsAt: shiftDays(19) },
    bookingsCount: 8,
    invoicesCount: 11,
    createdAt: shiftDays(-45),
    description: 'WO berbasis Jakarta — konsep, koordinasi vendor, dan rundown acara.',
    contact: '0812-9000-1122',
  },
  {
    id: 'vd-2',
    name: 'Aurora Frame',
    ownerName: 'Nadia Kusuma',
    email: 'nadia@auroraframe.id',
    category: 'Fotografer / Videografer',
    city: 'Bandung',
    isActive: true,
    subscription: { status: 'trial', endsAt: null },
    bookingsCount: 2,
    invoicesCount: 1,
    createdAt: shiftDays(-6),
    description: 'Dokumentasi pernikahan gaya dokumenter dan cinematic video.',
    contact: '0813-2222-3344',
  },
  {
    id: 'vd-3',
    name: 'Bunga & Dekor Rasa',
    ownerName: 'Sari Melati',
    email: 'sari@bungarasa.id',
    category: 'Dekorasi',
    city: 'Yogyakarta',
    isActive: false,
    subscription: { status: 'expired', endsAt: shiftDays(-21) },
    bookingsCount: 5,
    invoicesCount: 7,
    createdAt: shiftDays(-120),
    description: 'Dekorasi kapel, pelaminan, dan styling seserahan.',
    contact: '0819-5555-6677',
  },
  {
    id: 'vd-4',
    name: 'Rasa Catering',
    ownerName: 'Bagas Wirawan',
    email: 'bagas@rasacatering.id',
    category: 'Catering',
    city: 'Surabaya',
    isActive: true,
    subscription: { status: 'grace', endsAt: shiftDays(-2) },
    bookingsCount: 3,
    invoicesCount: 4,
    createdAt: shiftDays(-60),
    description: 'Katering akad & resepsi 100–1.000 pax.',
    contact: '0821-8888-9900',
  },
]

/** Daftar vendor untuk ditampilkan (bentuk ringkas daftar). */
export function listMockAdminVendors(): AdminVendorSummary[] {
  return mockState.map((vendor) => ({
    ...vendor,
    subscription: { ...vendor.subscription },
  }))
}

/** Detail satu vendor; null bila id tidak dikenal. */
export function getMockAdminVendor(id: string): AdminVendorDetail | null {
  const vendor = mockState.find((item) => item.id === id)
  if (!vendor) return null
  return { ...vendor, subscription: { ...vendor.subscription } }
}

/** Tambah vendor contoh (mode mock) — mengembalikan vendor yang barusan dibuat. */
export function addMockAdminVendor(values: {
  name: string
  ownerName: string
  email: string
  category: string
  city: string
}): AdminVendorDetail {
  const created: AdminVendorDetail = {
    id: `vd-${Date.now()}`,
    name: values.name,
    ownerName: values.ownerName,
    email: values.email,
    category: values.category,
    city: values.city || null,
    isActive: true,
    subscription: { status: 'trial', endsAt: null },
    bookingsCount: 0,
    invoicesCount: 0,
    createdAt: shiftDays(0),
    description: null,
    contact: null,
  }

  mockState = [created, ...mockState]
  return { ...created, subscription: { ...created.subscription } }
}

/** Ubah profil vendor (mode mock, tanpa menyentuh status langganan/akun). */
export function updateMockAdminVendor(
  id: string,
  values: {
    name: string
    ownerName: string
    category: string
    city: string
    description: string
    contact: string
  },
): AdminVendorDetail | null {
  mockState = mockState.map((vendor) =>
    vendor.id === id
      ? {
          ...vendor,
          name: values.name,
          ownerName: values.ownerName,
          category: values.category,
          city: values.city || null,
          description: values.description.trim() || null,
          contact: values.contact.trim() || null,
        }
      : vendor,
  )
  return getMockAdminVendor(id)
}

/** Ubah status aktif/nonaktif vendor (mode mock). Mengembalikan detail terbaru. */
export function setMockAdminVendorActive(id: string, isActive: boolean): AdminVendorDetail | null {
  mockState = mockState.map((vendor) => (vendor.id === id ? { ...vendor, isActive } : vendor))
  return getMockAdminVendor(id)
}

/**
 * Transaksi langganan vendor (mode mock) — mengikuti status langganan tiap
 * vendor: aktif punya yang `paid`, tenggang punya `pending`, dst.
 */
let paymentState: AdminSubscriptionPayment[] = [
  {
    id: 'pay-1',
    reference: 'PAY-20261001-0001',
    vendorId: 'vd-1',
    planName: 'Bulanan',
    amount: 50000,
    status: 'paid',
    method: 'midtrans-qris',
    createdAt: shiftDays(-19),
    paidAt: shiftDays(-19),
  },
  {
    id: 'pay-2',
    reference: 'PAY-20260901-0002',
    vendorId: 'vd-1',
    planName: 'Bulanan',
    amount: 50000,
    status: 'paid',
    method: 'midtrans-va',
    createdAt: shiftDays(-49),
    paidAt: shiftDays(-49),
  },
  {
    id: 'pay-3',
    reference: 'PAY-20261020-0003',
    vendorId: 'vd-4',
    planName: 'Bulanan',
    amount: 50000,
    status: 'pending',
    method: 'midtrans-qris',
    createdAt: shiftDays(-2),
    paidAt: null,
  },
  {
    id: 'pay-4',
    reference: 'PAY-20261001-0004',
    vendorId: 'vd-4',
    planName: 'Bulanan',
    amount: 50000,
    status: 'expired',
    method: 'midtrans-va',
    createdAt: shiftDays(-32),
    paidAt: null,
  },
  {
    id: 'pay-5',
    reference: 'PAY-20260918-0005',
    vendorId: 'vd-3',
    planName: 'Bulanan',
    amount: 50000,
    status: 'failed',
    method: 'duitku-va',
    createdAt: shiftDays(-35),
    paidAt: null,
  },
]

/** Riwayat transaksi langganan satu vendor (terbaru di atas, salinan). */
export function listMockVendorPayments(vendorId: string): AdminSubscriptionPayment[] {
  return paymentState
    .filter((payment) => payment.vendorId === vendorId)
    .map((payment) => ({ ...payment }))
}

/** Ubah status transaksi (mode mock) — dipakai untuk aksi konfirmasi admin. */
export function setMockPaymentStatus(id: string, status: AdminPaymentStatus): void {
  paymentState = paymentState.map((payment) =>
    payment.id === id
      ? { ...payment, status, paidAt: status === 'paid' ? shiftDays(0) : payment.paidAt }
      : payment,
  )
}

/**
 * Paket langganan (mode mock) — harga Bulanan pasti, 3 Bulan & Tahunan belum
 * ditetapkan (null = tampil "Segera").
 */
let planState: AdminPlan[] = [
  {
    id: 'plan-monthly',
    code: 'monthly',
    name: 'Bulanan',
    durationMonths: 1,
    price: 50000,
    isActive: true,
  },
  {
    id: 'plan-quarterly',
    code: 'quarterly',
    name: '3 Bulan',
    durationMonths: 3,
    price: null,
    isActive: true,
  },
  {
    id: 'plan-yearly',
    code: 'yearly',
    name: 'Tahunan',
    durationMonths: 12,
    price: null,
    isActive: true,
  },
]

/** Daftar paket langganan (salinan). */
export function listMockAdminPlans(): AdminPlan[] {
  return planState.map((plan) => ({ ...plan }))
}

/** Tetapkan harga paket (null = belum ditetapkan / "Segera"). */
export function updateMockPlanPrice(id: string, price: number | null): AdminPlan | null {
  planState = planState.map((plan) => (plan.id === id ? { ...plan, price } : plan))
  const plan = planState.find((item) => item.id === id)
  return plan ? { ...plan } : null
}
