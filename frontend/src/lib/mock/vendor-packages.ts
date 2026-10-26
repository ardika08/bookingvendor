import type { VendorPackageDetail } from '@/lib/vendor-packages'

/**
 * Data tiruan paket layanan vendor.
 *
 * Tiga paket dasar ditambah satu paket nonaktif supaya keadaan "arsip" bisa
 * diuji tanpa mengedit data. `usageCount` mencerminkan pemakaian di mock booking.
 */

export const mockVendorPackages: VendorPackageDetail[] = [
  {
    id: 'pkg-silver',
    name: 'Paket Silver — 1 Crew',
    price: 8500000,
    description: 'Satu fotografer, liputan 6 jam, softcopy seluruh hasil.',
    durationHours: 6,
    active: true,
    usageCount: 1,
  },
  {
    id: 'pkg-gold',
    name: 'Paket Gold — Full Day + Album',
    price: 15000000,
    description: 'Fotografer + asisten, liputan full day, album cetak 20 halaman.',
    durationHours: 10,
    active: true,
    usageCount: 3,
  },
  {
    id: 'pkg-platinum',
    name: 'Paket Platinum — 2 Crew + Video',
    price: 24500000,
    description: 'Dua fotografer, videografer, teaser 3 menit, album premium.',
    durationHours: 12,
    active: true,
    usageCount: 1,
  },
  {
    id: 'pkg-intimate',
    name: 'Paket Intimate — Akad Saja',
    price: 4500000,
    description: 'Liputan akad 3 jam tanpa resepsi. Cocok untuk acara kecil.',
    durationHours: 3,
    active: false,
    usageCount: 0,
  },
]
