import type { VendorProfile } from '@/types/booking'
import { toIsoDate } from '@/lib/format'

/**
 * Tipe & aturan form profil vendor.
 *
 * Vendor mengisi identitas usaha (nama, kategori, deskripsi, kontak publik) dan
 * rekening pembayaran yang dipakai di invoice. Tidak ada verifikasi/approval
 * sesuai PRD — vendor boleh mengubah kapan saja.
 */

export interface VendorProfileFormValues {
  businessName: string
  category: string
  description: string
  contactPhone: string
  contactEmail: string
  city: string
  bankName: string
  bankAccountNumber: string
  bankAccountHolder: string
}

export type VendorProfileFormErrors = Partial<Record<keyof VendorProfileFormValues, string>>

/** Bentuk data profil yang dikirim ke `PUT /api/vendor/profile`. */
export interface VendorProfilePayload {
  business_name: string
  category: string | null
  description: string | null
  contact_phone: string | null
  contact_email: string | null
  city: string | null
  bank: {
    name: string | null
    account_number: string | null
    account_holder: string | null
  }
}

/** Kategori usaha yang dikenali PRD; teks bebas lain tetap boleh diketik. */
export const VENDOR_CATEGORIES: string[] = [
  'Wedding Organizer',
  'Fotografer / Videografer',
  'Venue',
  'Dekorasi',
  'MUA',
  'Catering',
  'Seserahan',
  'Lainnya',
]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^(\+62|62|0)8[1-9][0-9]{6,11}$/

/** Profil lengkap vendor seperti yang dikembalikan `GET /api/vendor/profile`. */
export interface VendorProfileDetail extends VendorProfile {
  description: string | null
  contactPhone: string | null
  contactEmail: string | null
  city: string | null
  bank: {
    name: string | null
    accountNumber: string | null
    accountHolder: string | null
  }
}

export function profileToFormValues(profile: VendorProfileDetail): VendorProfileFormValues {
  return {
    businessName: profile.businessName,
    category: profile.category ?? '',
    description: profile.description ?? '',
    contactPhone: profile.contactPhone ?? '',
    contactEmail: profile.contactEmail ?? '',
    city: profile.city ?? '',
    bankName: profile.bank.name ?? '',
    bankAccountNumber: profile.bank.accountNumber ?? '',
    bankAccountHolder: profile.bank.accountHolder ?? '',
  }
}

/** Hanya field yang berubah — dipakai untuk menonaktifkan tombol simpan. */
export function isProfileDirty(
  before: VendorProfileFormValues,
  after: VendorProfileFormValues,
): boolean {
  const keys = Object.keys(before) as Array<keyof VendorProfileFormValues>
  return keys.some((key) => before[key] !== after[key])
}

/**
 * Validasi profil vendor.
 *
 * Nama usaha wajib; kategori opsional tetapi harus salah satu yang dikenali bila
 * diisi; kontak opsional tetapi formatnya diperiksa bila diisi. Rekening
 * dianggap lengkap hanya bila ketiga bagian terisi — kalau tidak, invoice tidak
 * bisa mencantumkan instruksi transfer.
 */
export function validateVendorProfile(
  values: VendorProfileFormValues,
): VendorProfileFormErrors {
  const errors: VendorProfileFormErrors = {}

  if (!values.businessName.trim()) {
    errors.businessName = 'Nama usaha wajib diisi.'
  } else if (values.businessName.trim().length < 2) {
    errors.businessName = 'Nama usaha terlalu pendek.'
  } else if (values.businessName.trim().length > 80) {
    errors.businessName = 'Nama usaha maksimal 80 karakter.'
  }

  if (values.contactPhone.trim() && !PHONE_PATTERN.test(normalizePhone(values.contactPhone))) {
    errors.contactPhone = 'Format nomor tidak valid. Contoh: 08123456789.'
  }

  if (values.contactEmail.trim() && !EMAIL_PATTERN.test(values.contactEmail.trim())) {
    errors.contactEmail = 'Format email tidak valid.'
  }

  const bankName = values.bankName.trim()
  const accountNumber = values.bankAccountNumber.trim()
  const accountHolder = values.bankAccountHolder.trim()

  if (!bankName) errors.bankName = 'Nama bank wajib dipilih.'
  if (!accountNumber) errors.bankAccountNumber = 'Nomor rekening wajib diisi.'
  if (!accountHolder) errors.bankAccountHolder = 'Nama pemilik rekening wajib diisi.'

  if (accountNumber && !/^\d{6,20}$/.test(accountNumber)) {
    errors.bankAccountNumber = 'Nomor rekening hanya angka (6–20 digit).'
  }

  return errors
}

/** Varian validasi untuk rekening saja — dipakai saat menyimpan blok rekening. */
export function validateBankDetails(
  values: VendorProfileFormValues,
): VendorProfileFormErrors {
  const errors: VendorProfileFormErrors = {}
  const bankName = values.bankName.trim()
  const accountNumber = values.bankAccountNumber.trim()
  const accountHolder = values.bankAccountHolder.trim()

  if (!bankName) {
    errors.bankName = 'Nama bank wajib dipilih.'
  } else if (bankName.length > 40) {
    errors.bankName = 'Nama bank maksimal 40 karakter.'
  }

  if (!accountNumber) {
    errors.bankAccountNumber = 'Nomor rekening wajib diisi.'
  } else if (!/^\d{6,20}$/.test(accountNumber)) {
    errors.bankAccountNumber = 'Nomor rekening hanya angka (6–20 digit).'
  }

  if (!accountHolder) {
    errors.bankAccountHolder = 'Nama pemilik rekening wajib diisi.'
  } else if (accountHolder.length < 3) {
    errors.bankAccountHolder = 'Nama pemilik rekening terlalu pendek.'
  }

  return errors
}

/** Hanya bagian rekening yang belum lengkap — dipakai untuk badge status. */
export function bankIncomplete(values: VendorProfileFormValues): boolean {
  return !(
    values.bankName.trim() &&
    values.bankAccountNumber.trim() &&
    values.bankAccountHolder.trim()
  )
}

export function toVendorProfilePayload(values: VendorProfileFormValues): VendorProfilePayload {
  return {
    business_name: values.businessName.trim(),
    category: values.category.trim() || null,
    description: values.description.trim() || null,
    contact_phone: values.contactPhone.trim() || null,
    contact_email: values.contactEmail.trim() || null,
    city: values.city.trim() || null,
    bank: {
      name: values.bankName.trim() || null,
      account_number: values.bankAccountNumber.trim() || null,
      account_holder: values.bankAccountHolder.trim() || null,
    },
  }
}

/** Peta nama field API `PUT /api/vendor/profile` → field form lokal. */
const SERVER_FIELD_MAP: Record<string, keyof VendorProfileFormValues> = {
  business_name: 'businessName',
  category: 'category',
  description: 'description',
  contact_phone: 'contactPhone',
  contact_email: 'contactEmail',
  city: 'city',
  'bank.name': 'bankName',
  'bank.account_number': 'bankAccountNumber',
  'bank.account_holder': 'bankAccountHolder',
}

export function mapVendorServerErrors(
  fieldErrors: Record<string, string>,
): VendorProfileFormErrors {
  const result: VendorProfileFormErrors = {}
  for (const [field, message] of Object.entries(fieldErrors)) {
    const localKey = SERVER_FIELD_MAP[field]
    if (localKey) result[localKey] = message
  }
  return result
}

function normalizePhone(value: string): string {
  return value.replace(/[\s\-().]/g, '')
}

/** Tanggal hari ini sebagai `YYYY-MM-DD` (dipakai untuk field tanggal bila perlu). */
export const todayIso = (): string => toIsoDate(new Date())
