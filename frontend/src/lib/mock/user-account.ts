import type { AuthRole } from '@/lib/auth-session'

/**
 * Data akun pengguna (mode mock) — halaman "Akun Saya".
 *
 * Akun = baris `users`: nama, email Google (tidak bisa diubah), dan nomor HP.
 * Berbeda dari profil usaha (`/settings`) yang menyimpan data vendor. Override
 * disimpan di state module-level agar perubahan bertahan selama sesi; begitu
 * backend aktif diganti `PUT /api/user`.
 */

export interface UserAccount {
  name: string
  /** Email Google — berasal dari OAuth, tidak bisa diedit. */
  email: string
  phone: string | null
  /** Foto dari Google — tidak diupload manual (PRD). */
  avatarUrl: string | null
  role: AuthRole
}

const accounts: Record<AuthRole, UserAccount> = {
  vendor: {
    name: 'Dika Pratama',
    email: 'dika@lumenwedding.id',
    phone: '0812-9000-1122',
    avatarUrl: null,
    role: 'vendor',
  },
  admin: {
    name: 'Admin Booking Vendor',
    email: 'admin@bookingvendor.id',
    phone: null,
    avatarUrl: null,
    role: 'admin',
  },
}

/** Ambil salinan data akun untuk role tertentu. */
export function getUserAccount(role: AuthRole): UserAccount {
  return { ...accounts[role] }
}

/**
 * Simpan perubahan akun (nama & nomor HP).
 *
 * Email tidak bisa diubah lewat form — identitas OAuth. Mengembalikan salinan
 * terbaru.
 */
export function updateUserAccount(
  role: AuthRole,
  values: { name: string; phone: string | null },
): UserAccount {
  accounts[role] = {
    ...accounts[role],
    name: values.name,
    phone: values.phone,
  }
  return { ...accounts[role] }
}
