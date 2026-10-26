/**
 * Klien HTTP tipis untuk backend Laravel.
 *
 * Semua request melewati satu tempat supaya: base URL, header auth, CSRF,
 * parsing error 422, dan penanganan 401 konsisten di seluruh aplikasi. Selama
 * backend belum ada, adapter mock di `lib/api/*` yang dipakai — modul ini sudah
 * siap dipakai begitu endpoint tersedia.
 */

const API_BASE_URL =
  (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE_URL : undefined) ?? '/api'

/** Error API dengan status HTTP + field error dari validasi Laravel. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string | null
  /** Peta `field → pesan` dari respons 422. */
  readonly fieldErrors: Record<string, string>

  constructor(
    message: string,
    options: {
      status: number
      code?: string | null
      fieldErrors?: Record<string, string>
    },
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code ?? null
    this.fieldErrors = options.fieldErrors ?? {}
  }

  /** True bila server menolak karena jatah trial habis (PRD: kode `trial_limit_reached`). */
  get isTrialLimit(): boolean {
    return this.status === 422 && this.code === 'trial_limit_reached'
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 419
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Query string; nilai undefined/kosong dilewati. */
  query?: Record<string, string | number | boolean | undefined | null>
  signal?: AbortSignal
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options

  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue
      url.searchParams.set(key, String(value))
    }
  }

  let response: Response
  try {
    response = await fetch(url.toString(), {
      method,
      credentials: 'include',
      signal,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new ApiError('Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.', {
      status: 0,
    })
  }

  if (response.status === 204) return undefined as T

  const payload = await safeJson(response)

  if (!response.ok) {
    const data = payload as Record<string, unknown> | null
    const fieldErrors = extractFieldErrors(data)
    throw new ApiError(
      typeof data?.message === 'string' ? data.message : defaultMessage(response.status),
      {
        status: response.status,
        code: typeof data?.code === 'string' ? data.code : null,
        fieldErrors,
      },
    )
  }

  return payload as T
}

/** Laravel mengirim `{ message, errors: { field: [pesan, ...] } }` untuk 422. */
function extractFieldErrors(data: Record<string, unknown> | null): Record<string, string> {
  const errors = data?.errors
  if (!errors || typeof errors !== 'object') return {}

  const result: Record<string, string> = {}
  for (const [field, messages] of Object.entries(errors as Record<string, unknown>)) {
    if (Array.isArray(messages) && typeof messages[0] === 'string') {
      result[field] = messages[0]
    } else if (typeof messages === 'string') {
      result[field] = messages
    }
  }
  return result
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function defaultMessage(status: number): string {
  if (status === 401) return 'Sesi kamu berakhir. Silakan masuk kembali.'
  if (status === 403) return 'Kamu tidak punya akses untuk aksi ini.'
  if (status === 404) return 'Data tidak ditemukan.'
  if (status === 429) return 'Terlalu banyak permintaan. Coba lagi sebentar.'
  if (status >= 500) return 'Server sedang bermasalah. Coba lagi beberapa saat.'
  return 'Permintaan gagal diproses.'
}
