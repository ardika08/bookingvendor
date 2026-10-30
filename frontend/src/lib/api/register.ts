import { apiRequest } from './client'

/** Kategori untuk dropdown pendaftaran. */
export interface RegistrationCategory {
  id: string
  name: string
  slug: string
  /** True untuk kategori "Lainnya" — memunculkan input teks bebas. */
  isOther: boolean
}

export interface RegistrationPayload {
  owner_name: string
  vendor_name: string
  category_id: string
  category_other?: string
  phone: string
  email: string
}

export interface RegistrationResult {
  message: string
  vendor: { id: string; name: string; slug: string }
  trialDays: number
  trialEndsAt: string | null
}

/**
 * Daftar kategori untuk formulir pendaftaran.
 *
 * Endpoint publik: dipakai sebelum calon vendor punya akun.
 */
export async function fetchRegistrationCategories(): Promise<RegistrationCategory[]> {
  return apiRequest<RegistrationCategory[]>('/register/categories')
}

/**
 * Pastikan cookie `XSRF-TOKEN` sudah ada sebelum POST pertama.
 *
 * Halaman pendaftaran adalah satu-satunya halaman publik yang mengirim POST
 * sebelum pengguna punya sesi. Pengunjung yang baru membuka situs belum punya
 * cookie `XSRF-TOKEN`, sehingga `apiRequest` mengirim POST tanpa header
 * `X-XSRF-TOKEN` dan Laravel menjawab 419. Endpoint ini men-set cookie
 * tersebut (Sanctum memakai sesi web), jadi cukup dipanggil sekali.
 */
async function ensureCsrfCookie(): Promise<void> {
  if (document.cookie.includes('XSRF-TOKEN=')) return

  await fetch('/sanctum/csrf-cookie', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
}

/**
 * Daftarkan vendor baru.
 *
 * Server langsung membuat sesi (login otomatis) dan memulai masa uji, jadi
 * pemanggil cukup mengarahkan vendor ke dashboard setelah berhasil.
 */
export async function registerVendor(payload: RegistrationPayload): Promise<RegistrationResult> {
  await ensureCsrfCookie()

  return apiRequest<RegistrationResult>('/register', {
    method: 'POST',
    body: payload,
  })
}
