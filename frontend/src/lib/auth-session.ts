/**
 * Sesi login tiruan (fase frontend) — fitur "Masuk dengan Google".
 *
 * OAuth belum ada; role yang dipilih saat masuk disimpan di localStorage agar
 * kedua dashboard (vendor & admin) punya konteks sesi yang konsisten saat
 * diklik-klik. Begitu backend aktif, fungsi-fungsi ini diganti panggilan API
 * Sanctum tanpa mengubah pemanggilnya.
 */

export type AuthRole = 'vendor' | 'admin'

const STORAGE_KEY = 'booking-vendor:auth-role'

/** Simpan role yang dipilih saat masuk (mock OAuth sukses). */
export function saveAuthRole(role: AuthRole): void {
  try {
    localStorage.setItem(STORAGE_KEY, role)
  } catch {
    // localStorage bisa gagal (mode privat) — sesi hanya hilang saat refresh.
  }
}

/** Role sesi saat ini; null bila belum masuk. */
export function readAuthRole(): AuthRole | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'vendor' || value === 'admin' ? value : null
  } catch {
    return null
  }
}

/** Keluar: hapus sesi mock. */
export function clearAuthRole(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // diabaikan — sama seperti simpan.
  }
}
