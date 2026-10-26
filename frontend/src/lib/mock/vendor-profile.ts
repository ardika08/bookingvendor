import type { VendorProfileDetail } from '@/lib/vendor-profile'

/**
 * Data tiruan profil vendor.
 *
 * Bentuk mengikuti `GET /api/vendor/profile`. Sebagian field sengaja kosong
 * (rekening) supaya keadaan "belum lengkap" bisa diuji di mode mock tanpa
 * mengedit data.
 */

export const mockVendorProfile: VendorProfileDetail = {
  id: 'vendor-1',
  businessName: 'Lumen Wedding Story',
  category: 'Wedding Organizer',
  slug: 'lumen-wedding-story',
  avatarUrl: null,
  description:
    'Wedding organizer berbasis Jakarta yang menangani konsep, vendor koordinasi, dan rundown acara.',
  contactPhone: '0812-9000-1122',
  contactEmail: 'hello@lumenwedding.id',
  city: 'Jakarta Selatan',
  bank: {
    name: '',
    accountNumber: '',
    accountHolder: '',
  },
}
