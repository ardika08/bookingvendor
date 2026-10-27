import { CalendarClock, CheckCircle2, Clock, XCircle, type IconComponent } from '@/components/ui/icons'
import type { BookingStatus } from '@/types/booking'

/**
 * Metadata status booking: label, penjelasan singkat, gaya badge, dan aksi
 * lanjutan yang tersedia.
 *
 * Satu sumber kebenaran untuk seluruh UI (badge di tabel, dropdown ubah status,
 * filter, dan halaman detail). Enum tetap bahasa Inggris sesuai PRD; teks yang
 * dilihat vendor berbahasa Indonesia.
 */
export interface BookingStatusMeta {
  label: string
  /** Kalimat singkat untuk tooltip / keterangan di bawah opsi status. */
  description: string
  icon: IconComponent
  /** Kelas badge ringkas (tabel & kartu). */
  badgeClass: string
  /** Kelas titik warna. */
  dotClass: string
  /** Warna aksen kalender & garis timeline. */
  accentClass: string
  /** Transisi status yang diizinkan dari status ini. */
  next: BookingStatus[]
}

export const BOOKING_STATUS_META: Record<BookingStatus, BookingStatusMeta> = {
  tentative: {
    label: 'Tentatif',
    description: 'Tanggal sudah dipegang, tetapi klien belum konfirmasi/DP.',
    icon: Clock,
    badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200',
    dotClass: 'bg-amber-500',
    accentClass: 'border-amber-400',
    next: ['confirmed', 'cancelled'],
  },
  confirmed: {
    label: 'Terkonfirmasi',
    description: 'Kesepakatan fix — acara berjalan pada tanggal tersebut.',
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dotClass: 'bg-emerald-500',
    accentClass: 'border-emerald-500',
    next: ['completed', 'cancelled'],
  },
  completed: {
    label: 'Selesai',
    description: 'Acara sudah dilaksanakan dan tersimpan sebagai riwayat.',
    icon: CalendarClock,
    badgeClass: 'bg-ink-100 text-ink-600 ring-ink-200',
    dotClass: 'bg-ink-400',
    accentClass: 'border-ink-300',
    next: [],
  },
  cancelled: {
    label: 'Batal',
    description: 'Booking dibatalkan; jatah trial tetap terpakai.',
    icon: XCircle,
    badgeClass: 'bg-rose-50 text-rose-700 ring-rose-200',
    dotClass: 'bg-rose-500',
    accentClass: 'border-rose-300',
    next: ['tentative'],
  },
}

/** Urutan tampil di filter & legend kalender (mengikuti alur operasional). */
export const STATUS_DISPLAY_ORDER: BookingStatus[] = [
  'tentative',
  'confirmed',
  'completed',
  'cancelled',
]

/** Status yang boleh dipilih saat membuat booking baru (Batal tidak masuk akal di awal). */
export const STATUS_CREATE_OPTIONS: BookingStatus[] = ['tentative', 'confirmed']

/** Status yang masih memakai tanggal di kalender (batal = tanggal bebas lagi). */
export function isDateOccupying(status: BookingStatus): boolean {
  return status !== 'cancelled'
}

/**
 * Aksi ubah status yang masuk akal untuk tombol cepat di baris tabel.
 * Mengembalikan daftar status tujuan (tanpa status saat ini).
 */
export function availableTransitions(current: BookingStatus): BookingStatus[] {
  return BOOKING_STATUS_META[current].next
}

/** Label aksi, mis. tombol "Konfirmasi" untuk tentative → confirmed. */
export function transitionLabel(from: BookingStatus, to: BookingStatus): string {
  if (to === 'confirmed') return 'Konfirmasi'
  if (to === 'completed') return 'Tandai selesai'
  if (to === 'cancelled') return 'Batalkan'
  if (to === 'tentative' && from === 'cancelled') return 'Aktifkan lagi'
  return BOOKING_STATUS_META[to].label
}
