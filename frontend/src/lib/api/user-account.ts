import { apiRequest } from './client'

/**
 * Profil akun pengguna ("Akun Saya") — baris `users`, bukan profil usaha.
 *
 * Sebelumnya halaman ini membaca `lib/mock/user-account`, sehingga menampilkan
 * data karangan ("Dika Pratama", `dika@lumenwedding.id`, `0812-9000-1122`)
 * yang tidak ada hubungannya dengan akun yang sedang masuk. Sekarang memakai
 * `GET/PUT /api/user/profile` yang sesungguhnya.
 */
export interface UserAccount {
  id: string
  name: string
  email: string
  phone: string | null
  avatarUrl: string | null
  role: 'vendor' | 'admin'
}

/** Ambil profil akun yang sedang masuk. */
export async function fetchUserAccount(signal?: AbortSignal): Promise<UserAccount> {
  return apiRequest<UserAccount>('/user/profile', { signal })
}

/** Simpan nama & nomor HP akun. Email tidak bisa diubah. */
export async function saveUserAccount(payload: {
  name: string
  phone: string | null
}): Promise<UserAccount> {
  return apiRequest<UserAccount>('/user/profile', {
    method: 'PUT',
    body: payload,
  })
}
