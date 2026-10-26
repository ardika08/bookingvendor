import type { BlockedDate } from '@/lib/vendor-availability'
import { toIsoDate } from '@/lib/format'

/**
 * Data tiruan tanggal terblokir.
 *
 * Tanggal dibuat relatif terhadap hari ini supaya penanda "libur" selalu
 * muncul di bulan berjalan saat diuji tanpa mengedit data.
 */

const today = new Date()

function shiftDays(days: number): string {
  return toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days))
}

export const mockBlockedDates: BlockedDate[] = [
  {
    id: 'blk-1',
    date: shiftDays(9),
    reason: 'Acara keluarga',
    createdAt: shiftDays(-14),
  },
  {
    id: 'blk-2',
    date: shiftDays(16),
    reason: 'Maintenance alat',
    createdAt: shiftDays(-10),
  },
  {
    id: 'blk-3',
    date: shiftDays(23),
    reason: null,
    createdAt: shiftDays(-7),
  },
]
