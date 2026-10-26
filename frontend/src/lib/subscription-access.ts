import type { SubscriptionSummary } from '@/types/booking'

/**
 * Rem akses tulis saat langganan berakhir.
 *
 * PRD: ketika masa paket habis vendor **tetap dapat membaca dan mengekspor**
 * seluruh data lama (booking, kalender, invoice, PDF, link publik), tetapi tidak
 * boleh membuat data baru sampai memperpanjang. Catatan penting: status
 * `expired` bukan satu-satunya jalur — vendor yang tidak pernah berlangganan dan
 * sudah menghabiskan jatah trial juga kehilangan hak tulis. Karena itu rem ini
 * **tidak** dipakai untuk trial; trial tetap ditangani `trial_limit_reached`
 * dari server supaya modal upgrade muncul setelah submit ditolak.
 */
export type ReadOnlyReason = 'expired'

export interface AccessState {
  /** true = aksi pembuatan data baru harus diblokir. */
  readOnly: boolean
  reason: ReadOnlyReason | null
}

/** Apakah langganan sudah berakhir sehingga aksi tulis perlu direm. */
export function isSubscriptionExpired(subscription: SubscriptionSummary): boolean {
  return subscription.status === 'expired'
}

/**
 * State akses tulis untuk sebuah halaman.
 *
 * Hanya `expired` yang memicu mode baca-saja; `trial` dan `active` bebas
 * menulis (trial tetap dibatasi server lewat kode `trial_limit_reached`).
 */
export function resolveAccess(subscription: SubscriptionSummary): AccessState {
  const readOnly = isSubscriptionExpired(subscription)
  return { readOnly, reason: readOnly ? 'expired' : null }
}

/** Judul penjelasan singkat saat aksi tulis diblokir. */
export function readOnlyHeadline(reason: ReadOnlyReason): string {
  switch (reason) {
    case 'expired':
      return 'Langganan berakhir — mode baca saja'
  }
}

/** Kalimat penjelas: apa yang masih bisa dilakukan dan apa yang terkunci. */
export function readOnlyDescription(reason: ReadOnlyReason): string {
  switch (reason) {
    case 'expired':
      return 'Data lama tetap bisa dibaca, dicari, dan diekspor. Membuat booking, invoice, atau blokir tanggal baru aktif lagi setelah paket diperpanjang.'
  }
}
