import { apiRequest } from './client'
import { ensureCsrfCookie } from './register'

/** Hasil POST /api/login. */
export interface LoginResult {
  message: string
  role: 'vendor' | 'admin'
}

/**
 * Masuk dengan email + kata sandi.
 *
 * Cookie CSRF harus ada sebelum POST (Sanctum stateful), jadi
 * `ensureCsrfCookie` dipanggil lebih dulu — sama seperti pendaftaran.
 */
export async function loginWithEmail(
  email: string,
  password: string,
  remember = false,
): Promise<LoginResult> {
  await ensureCsrfCookie()

  return apiRequest<LoginResult>('/login', {
    method: 'POST',
    body: { email, password, remember },
  })
}
