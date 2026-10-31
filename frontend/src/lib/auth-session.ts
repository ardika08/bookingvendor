/**
 * Sesi login: bridge antara SPA dan backend Laravel (Sanctum guard web).
 *
 * Login Google adalah server-side redirect flow:
 *   klik tombol → /auth/google/redirect → Google → /auth/google/callback
 *   → redirect ke /dashboard atau /admin.
 *
 * Setelah redirect, SPA perlu tahu siapa yang login. Endpoint `GET /api/me`
 * mengembalikan CurrentUser (termasuk role); modul ini menyimpan role di
 * localStorage sebagai cache agar RoleGate tidak memblokir render sebelum
 * /me selesai dimuat. Cache ini tidak dipakai untuk otorisasi — setiap
 * request API tetap divalidasi server lewat cookie sesi.
 */

import type { CurrentUser } from '@/types/booking'
import { apiRequest, ApiError } from '@/lib/api/client'

export type AuthRole = 'vendor' | 'admin'

const STORAGE_KEY = 'vendorkit:auth-role'

/** Simpan role dari hasil /me (dipakai RoleGate untuk redirect awal). */
export function saveAuthRole(role: AuthRole): void {
  try {
    localStorage.setItem(STORAGE_KEY, role)
  } catch {
    // localStorage bisa gagal (mode privat) — sesi hanya hilang saat refresh.
  }
}

/** Role yang di-cache; null bila belum masuk. */
export function readAuthRole(): AuthRole | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'vendor' || value === 'admin' ? value : null
  } catch {
    return null
  }
}

/** Keluar: hapus cache role lokal. Sesi server dibersihkan lewat POST /auth/logout. */
export function clearAuthRole(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // diabaikan.
  }
}

/**
 * Ambil CurrentUser dari backend.
 *
 * Melempar ApiError 401 bila belum login — pemanggil menangani redirect
 * ke /login.
 */
export async function fetchCurrentUser(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>('/me')
}

/** True bila ApiError berasal dari belum-login (401/419). */
export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && error.isUnauthorized
}
