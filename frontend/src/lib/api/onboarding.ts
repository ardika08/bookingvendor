import { apiRequest } from './client'
import type { VendorProfilePayload } from '@/lib/vendor-profile'

/**
 * Status kelengkapan onboarding vendor.
 *
 * Bentuknya mengikuti `GET /api/vendor/onboarding`. Status **tidak** disimpan di
 * server sebagai penanda: server menurunkannya dari isi tabel `vendors`, jadi
 * kalau vendor mengosongkan rekening lewat halaman Pengaturan, `complete`
 * otomatis kembali `false` tanpa perlu ada kode yang menyinkronkan.
 */
export interface OnboardingStep {
  key: 'business' | 'contact' | 'bank'
  label: string
  complete: boolean
  /** Hanya langkah wajib yang menghalangi penerbitan invoice. */
  required: boolean
  /** Nama kolom database yang masih kosong; dipakai untuk menjelaskan ke vendor. */
  missing: string[]
}

export interface OnboardingStatus {
  steps: OnboardingStep[]
  /** `true` bila semua langkah **wajib** sudah lengkap. */
  complete: boolean
  /** Langkah wajib pertama yang belum lengkap, atau `null`. */
  blockingStep: OnboardingStep['key'] | null
  /** Langkah pertama (wajib maupun opsional) yang belum lengkap. */
  nextStep: OnboardingStep['key'] | null
}

export async function fetchOnboardingStatus(signal?: AbortSignal): Promise<OnboardingStatus> {
  return apiRequest<OnboardingStatus>('/vendor/onboarding', { signal })
}

/**
 * Simpan satu langkah onboarding.
 *
 * Memakai `PATCH`, bukan `PUT`: `PUT` menimpa seluruh profil, sehingga
 * menyimpan langkah rekening akan mengosongkan kontak dan deskripsi yang sudah
 * diisi di langkah sebelumnya. Server membedakan keduanya lewat method HTTP.
 */
export async function patchVendorProfile(
  payload: Partial<VendorProfilePayload>,
): Promise<void> {
  await apiRequest<unknown>('/vendor/profile', { method: 'PATCH', body: payload })
}
