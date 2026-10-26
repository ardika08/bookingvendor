/**
 * Konfigurasi paket langganan untuk admin (`/admin/plans`).
 *
 * Hanya ada tiga paket (PRD): Bulanan (harga pasti Rp50.000), 3 Bulan, dan
 * Tahunan. Harga 3 Bulan & Tahunan sengaja bisa `null` — tampil "Segera" dan
 * tidak bisa dibeli sampai admin menetapkannya. Kuota TIDAK tersimpan di sini:
 * batas hanya milik masa trial (2 booking + 2 invoice) dan konstan.
 */

export type AdminPlanCode = 'monthly' | 'quarterly' | 'yearly'

export interface AdminPlan {
  id: string
  code: AdminPlanCode
  name: string
  /** Lama aktif dalam bulan. */
  durationMonths: number
  /** null = harga belum ditetapkan (tampil "Segera", tidak bisa dibeli). */
  price: number | null
  /** Paket nonaktif tidak tampil di katalog pemilihan vendor. */
  isActive: boolean
}

export const PLAN_CODE_LABEL: Record<AdminPlanCode, string> = {
  monthly: 'Bulanan',
  quarterly: '3 Bulan',
  yearly: 'Tahunan',
}

/**
 * Parse input harga form.
 *
 * Return: `number` bila sah, `null` bila dikosongkan (harga belum ditetapkan),
 * atau `'invalid'` bila tidak dapat dipahami / ≤ 0.
 */
export function parsePlanPriceInput(raw: string): number | null | 'invalid' {
  const digits = raw.replace(/[^\d]/g, '')

  if (digits === '') return null

  const value = Number.parseInt(digits, 10)
  return value > 0 ? value : 'invalid'
}

/** True bila semua paket aktif punya harga — katalog siap dijual penuh. */
export function allPriced(plans: AdminPlan[]): boolean {
  return plans.filter((plan) => plan.isActive).every((plan) => plan.price !== null)
}
