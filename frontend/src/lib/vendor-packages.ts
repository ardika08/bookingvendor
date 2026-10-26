import type { VendorPackage } from '@/types/booking'

/**
 * Tipe & aturan paket layanan vendor.
 *
 * Paket adalah katalog harga yang dipakai ulang saat membuat booking: vendor
 * mendefinisikan sekali (nama, harga, durasi, apa saja yang termasuk), lalu
 * memilihnya di form booking. Tidak ada kuota — jumlah paket bebas.
 */

export interface PackageFormValues {
  name: string
  price: string
  durationHours: string
  description: string
  active: boolean
}

export type PackageFormErrors = Partial<Record<keyof PackageFormValues, string>>

/** Bentuk data paket seperti yang dikembalikan `GET /api/packages`. */
export interface VendorPackageDetail extends VendorPackage {
  description: string | null
  /** Durasi pengerjaan dalam jam; null = tidak disebutkan. */
  durationHours: number | null
  active: boolean
  /** Jumlah booking yang memakai paket ini (0 = belum pernah dipakai). */
  usageCount: number
}

/** Payload `POST/PUT /api/packages`. */
export interface PackagePayload {
  name: string
  price: number
  duration_hours: number | null
  description: string | null
  active: boolean
}

export const EMPTY_PACKAGE_FORM: PackageFormValues = {
  name: '',
  price: '',
  durationHours: '',
  description: '',
  active: true,
}

export function packageToFormValues(pkg: VendorPackageDetail): PackageFormValues {
  return {
    name: pkg.name,
    price: formatThousands(pkg.price),
    durationHours: pkg.durationHours ? String(pkg.durationHours) : '',
    description: pkg.description ?? '',
    active: pkg.active,
  }
}

export function isPackageDirty(before: PackageFormValues, after: PackageFormValues): boolean {
  const keys = Object.keys(before) as Array<keyof PackageFormValues>
  return keys.some((key) => before[key] !== after[key])
}

/**
 * Validasi paket.
 *
 * Nama wajib (maks 60 karakter agar muat di kolom tabel), harga wajib > 0,
 * durasi opsional tetapi harus 1–48 jam bila diisi. Deskripsi bebas.
 */
export function validatePackageForm(values: PackageFormValues): PackageFormErrors {
  const errors: PackageFormErrors = {}
  const price = parseThousands(values.price)

  if (!values.name.trim()) {
    errors.name = 'Nama paket wajib diisi.'
  } else if (values.name.trim().length < 2) {
    errors.name = 'Nama paket terlalu pendek.'
  } else if (values.name.trim().length > 60) {
    errors.name = 'Nama paket maksimal 60 karakter.'
  }

  if (!values.price.trim()) {
    errors.price = 'Harga paket wajib diisi.'
  } else if (price <= 0) {
    errors.price = 'Harga harus lebih besar dari nol.'
  }

  if (values.durationHours.trim()) {
    const hours = Number.parseInt(values.durationHours, 10)
    if (!Number.isFinite(hours) || hours < 1 || hours > 48) {
      errors.durationHours = 'Durasi antara 1–48 jam.'
    }
  }

  return errors
}

export function toPackagePayload(values: PackageFormValues): PackagePayload {
  const hours = Number.parseInt(values.durationHours, 10)
  return {
    name: values.name.trim(),
    price: parseThousands(values.price),
    duration_hours: Number.isFinite(hours) && hours > 0 ? hours : null,
    description: values.description.trim() || null,
    active: values.active,
  }
}

/** Peta nama field API → field form lokal. */
const SERVER_FIELD_MAP: Record<string, keyof PackageFormValues> = {
  name: 'name',
  price: 'price',
  duration_hours: 'durationHours',
  description: 'description',
  active: 'active',
}

export function mapPackageServerErrors(
  fieldErrors: Record<string, string>,
): PackageFormErrors {
  const result: PackageFormErrors = {}
  for (const [field, message] of Object.entries(fieldErrors)) {
    const localKey = SERVER_FIELD_MAP[field]
    if (localKey) result[localKey] = message
  }
  return result
}

/** `15000000` → `15.000.000`. */
export function formatThousands(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  return new Intl.NumberFormat('id-ID').format(value)
}

/** `15.000.000` → `15000000`. */
export function parseThousands(value: string): number {
  const digits = value.replace(/[^\d]/g, '')
  return digits ? Number.parseInt(digits, 10) : 0
}

/** Filter daftar paket: status aktif + kata kunci nama. */
export interface PackageFilters {
  active: 'all' | 'active' | 'inactive'
  search: string
}

export const EMPTY_PACKAGE_FILTERS: PackageFilters = { active: 'all', search: '' }

export function hasActivePackageFilters(filters: PackageFilters): boolean {
  return filters.active !== 'all' || filters.search.trim() !== ''
}
