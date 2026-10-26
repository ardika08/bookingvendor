import { fetchVendorProfile } from '@/lib/api/vendor-profile'
import { USE_MOCK_DATA } from '@/lib/api/bookings'
import { ApiError, apiRequest } from './client'
import { mockInvoices, mockPublicInvoiceTokens } from '../mock/invoices'
import type { Invoice } from '@/types/invoice'

let mockShareTokenSequence = 0

export interface PublicInvoiceData {
  invoice: Pick<
    Invoice,
    | 'number'
    | 'clientName'
    | 'packageName'
    | 'type'
    | 'status'
    | 'dueAt'
    | 'amount'
    | 'paidAmount'
    | 'eventDate'
  >
  vendor: {
    businessName: string
    contactPhone: string | null
    bank: {
      name: string | null
      accountNumber: string | null
      accountHolder: string | null
    }
  }
}

/** Ambil invoice yang dibagikan melalui token publik, tanpa route dashboard. */
export async function fetchPublicInvoice(
  token: string,
  signal?: AbortSignal,
): Promise<PublicInvoiceData> {
  if (USE_MOCK_DATA) {
    await delay(140, signal)
    const invoiceId = mockPublicInvoiceTokens[token]
    const invoice = mockInvoices.find((item) => item.id === invoiceId)
    if (!invoice) throw new ApiError('Link invoice tidak ditemukan atau sudah tidak aktif.', { status: 404 })

    const profile = await fetchVendorProfile(signal)
    return {
      invoice: {
        number: invoice.number,
        clientName: invoice.clientName,
        packageName: invoice.packageName,
        type: invoice.type,
        status: invoice.status,
        dueAt: invoice.dueAt,
        amount: invoice.amount,
        paidAmount: invoice.paidAmount,
        eventDate: invoice.eventDate,
      },
      vendor: {
        businessName: profile.businessName,
        contactPhone: profile.contactPhone,
        bank: { ...profile.bank },
      },
    }
  }

  return mapPublicInvoice(
    await apiRequest<PublicInvoiceResponse>(`/public/invoices/${encodeURIComponent(token)}`, { signal }),
  )
}

/**
 * Bentuk respons mentah dari `PublicInvoiceResource`.
 *
 * Backend mengirim struktur datar (data invoice, acara, dan vendor sejajar),
 * sedangkan halaman publik memakai bentuk bersarang. Pemetaan dilakukan di
 * sini supaya kontrak API tidak perlu diubah hanya demi kenyamanan satu
 * komponen.
 */
interface PublicInvoiceResponse {
  number: string
  type: Invoice['type']
  status: Invoice['status']
  dueAt: string | null
  amount: number
  paidAmount: number
  booking?: {
    clientName?: string | null
    eventDate?: string | null
    packageName?: string | null
  } | null
  vendor?: {
    name?: string | null
    contact?: string | null
    bank?: {
      name?: string | null
      accountNumber?: string | null
      accountName?: string | null
    } | null
  } | null
}

function mapPublicInvoice(raw: PublicInvoiceResponse): PublicInvoiceData {
  return {
    invoice: {
      number: raw.number,
      clientName: raw.booking?.clientName ?? '',
      packageName: raw.booking?.packageName ?? null,
      type: raw.type,
      status: raw.status,
      dueAt: raw.dueAt ?? '',
      amount: raw.amount,
      paidAmount: raw.paidAmount,
      eventDate: raw.booking?.eventDate ?? '',
    },
    vendor: {
      businessName: raw.vendor?.name ?? '',
      contactPhone: raw.vendor?.contact ?? null,
      bank: {
        name: raw.vendor?.bank?.name ?? null,
        accountNumber: raw.vendor?.bank?.accountNumber ?? null,
        accountHolder: raw.vendor?.bank?.accountName ?? null,
      },
    },
  }
}

/**
 * Token tautan publik yang sedang aktif, atau `null` bila belum ada.
 *
 * Dipakai agar kartu share-link tetap menampilkan tautan yang sudah dibuat
 * setelah halaman dimuat ulang. Tidak pernah membuat token baru.
 */
export async function fetchPublicInvoiceLink(invoiceId: string): Promise<string | null> {
  if (USE_MOCK_DATA) {
    await delay(80)
    return findMockToken(invoiceId) ?? null
  }

  const result = await apiRequest<{ token: string | null; active: boolean }>(
    `/invoices/${encodeURIComponent(invoiceId)}/share-link`,
  )

  return result.active ? result.token : null
}

/** Buat atau ambil tautan invoice publik untuk dibagikan kepada klien. */
export async function createPublicInvoiceLink(invoiceId: string, origin: string): Promise<string> {
  if (USE_MOCK_DATA) {
    await delay(100)
    ensureMockInvoice(invoiceId)

    let token = findMockToken(invoiceId)
    if (!token) {
      token = `demo_public_${invoiceId}_link_${++mockShareTokenSequence}`
      mockPublicInvoiceTokens[token] = invoiceId
    }
    return `${origin}/invoice/${encodeURIComponent(token)}`
  }

  const result = await apiRequest<{ token: string }>(
    `/invoices/${encodeURIComponent(invoiceId)}/share-link`,
    { method: 'POST' },
  )
  return `${origin}/invoice/${encodeURIComponent(result.token)}`
}

/** Ganti token publik; tautan sebelumnya tidak lagi dapat digunakan. */
export async function resetPublicInvoiceLink(invoiceId: string, origin: string): Promise<string> {
  if (USE_MOCK_DATA) {
    await delay(100)
    ensureMockInvoice(invoiceId)
    if (!findMockToken(invoiceId)) {
      throw new ApiError('Buat link publik terlebih dahulu sebelum meresetnya.', { status: 404 })
    }

    removeMockTokens(invoiceId)
    const token = `demo_public_${invoiceId}_reset_${++mockShareTokenSequence}`
    mockPublicInvoiceTokens[token] = invoiceId
    return `${origin}/invoice/${encodeURIComponent(token)}`
  }

  const result = await apiRequest<{ token: string }>(
    `/invoices/${encodeURIComponent(invoiceId)}/share-link/reset`,
    { method: 'POST' },
  )
  return `${origin}/invoice/${encodeURIComponent(result.token)}`
}

/** Nonaktifkan token publik yang terbit untuk invoice ini. */
export async function disablePublicInvoiceLink(invoiceId: string): Promise<void> {
  if (USE_MOCK_DATA) {
    await delay(100)
    ensureMockInvoice(invoiceId)
    removeMockTokens(invoiceId)
    return
  }

  await apiRequest<void>(`/invoices/${encodeURIComponent(invoiceId)}/share-link`, {
    method: 'DELETE',
  })
}

function ensureMockInvoice(invoiceId: string) {
  if (!mockInvoices.some((invoice) => invoice.id === invoiceId)) {
    throw new ApiError('Invoice tidak ditemukan.', { status: 404 })
  }
}

function findMockToken(invoiceId: string) {
  return Object.entries(mockPublicInvoiceTokens).find(([, id]) => id === invoiceId)?.[0]
}

function removeMockTokens(invoiceId: string) {
  for (const [token, id] of Object.entries(mockPublicInvoiceTokens)) {
    if (id === invoiceId) delete mockPublicInvoiceTokens[token]
  }
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timeout = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}
