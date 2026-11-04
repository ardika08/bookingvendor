import { apiRequest, apiUpload, backendUrl, ApiError } from './client'

/**
 * Unggah / hapus logo usaha vendor.
 *
 * Dipisah dari `vendor-profile.ts` karena bentuk request-nya berbeda:
 * `apiRequest` selalu mengirim JSON, sedangkan berkas butuh
 * `multipart/form-data` (lihat `apiUpload` di `client.ts`).
 *
 * PENTING — backend mengirim PATH (`vendor-logos/abc.png`), bukan URL absolut.
 * URL absolut yang dibentuk server memakai `APP_URL`, sedangkan origin backend
 * bisa berbeda dari domain frontend (dev `:8082` vs `:4173`, produksi
 * `api.` vs domain utama). Karena itu URL disusun di sini lewat `backendUrl`.
 */

/** Ubah path logo dari API menjadi URL yang bisa dipakai `<img src>`. */
export function logoUrlFromPath(path: string | null): string | null {
  if (!path) return null
  // Sudah berupa URL (mis. objek blob saat mode mock) — pakai apa adanya.
  if (/^(https?:|blob:|data:)/.test(path)) return path
  return backendUrl(`/storage/${path.replace(/^\/+/, '')}`)
}

/** `POST /api/vendor/logo` — multipart dengan field `logo`. */
export async function uploadVendorLogo(file: File): Promise<string | null> {
  const form = new FormData()
  form.append('logo', file)

  const result = await apiUpload<{ logoPath: string | null }>('/vendor/logo', form)
  return result.logoPath
}

/** `DELETE /api/vendor/logo` — menghapus logo dan mengembalikan tampilan awal. */
export async function deleteVendorLogo(): Promise<void> {
  await apiRequest('/vendor/logo', { method: 'DELETE' })
}

/** Batas ukuran berkas, harus sama dengan `VendorLogoController::MAX_KB`. */
export const VENDOR_LOGO_MAX_BYTES = 2 * 1024 * 1024

/** Tipe berkas yang diterima, harus sama dengan validasi server. */
export const VENDOR_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export { ApiError }
