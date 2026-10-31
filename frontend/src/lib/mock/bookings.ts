import type { Booking, CurrentUser, VendorPackage } from '@/types/booking'

/**
 * Data tiruan untuk fase frontend.
 *
 * Dipakai sampai endpoint Laravel tersedia. Tanggal dibuat relatif terhadap
 * hari ini supaya filter bulan berjalan, past month, dan bulan depan selalu
 * punya isi yang bisa diuji tanpa mengedit data.
 */

const today = new Date()

function isoDate(year: number, monthIndex: number, day: number): string {
  const month = `${monthIndex + 1}`.padStart(2, '0')
  const date = `${day}`.padStart(2, '0')
  return `${year}-${month}-${date}`
}

function shiftMonth(months: number): { year: number; monthIndex: number } {
  const date = new Date(today.getFullYear(), today.getMonth() + months, 1)
  return { year: date.getFullYear(), monthIndex: date.getMonth() }
}

const thisMonth = shiftMonth(0)
const nextMonth = shiftMonth(1)
const prevMonth = shiftMonth(-1)

export const mockUser: CurrentUser = {
  name: 'Dika Pratama',
  email: 'dika@lumenwedding.id',
  avatarUrl: null,
  role: 'vendor',
  vendor: {
    id: 'vendor-1',
    businessName: 'Lumen Wedding Story',
    category: 'Wedding Organizer',
    slug: 'lumen-wedding-story',
    avatarUrl: null,
  },
  subscription: {
    status: 'trial',
    endsAt: null,
    daysLeft: 30,
  },
}

export const mockPackages: VendorPackage[] = [
  { id: 'pkg-silver', name: 'Paket Silver — 1 Crew', price: 8500000 },
  { id: 'pkg-gold', name: 'Paket Gold — Full Day + Album', price: 15000000 },
  { id: 'pkg-platinum', name: 'Paket Platinum — 2 Crew + Video', price: 24500000 },
]

export const mockBookings: Booking[] = [
  {
    id: 'bk-1',
    client: {
      id: 'cl-1',
      name: 'Rani & Bagas',
      phone: '0812-3456-7890',
      email: 'rani.bagas@gmail.com',
    },
    packageId: 'pkg-gold',
    packageName: 'Paket Gold — Full Day + Album',
    eventDate: isoDate(thisMonth.year, thisMonth.monthIndex, 14),
    eventTime: '08:00',
    eventLocation: 'Gedung Balai Kartini, Jakarta Selatan',
    status: 'confirmed',
    totalPrice: 15000000,
    notes: 'Klien minta crew datang 1 jam lebih awal untuk sesi pre-wedding.',
    invoiceCount: 1,
    createdAt: isoDate(prevMonth.year, prevMonth.monthIndex, 2),
  },
  {
    id: 'bk-2',
    client: {
      id: 'cl-2',
      name: 'Sinta & Arya',
      phone: '0857-1122-3344',
      email: null,
    },
    packageId: 'pkg-platinum',
    packageName: 'Paket Platinum — 2 Crew + Video',
    eventDate: isoDate(thisMonth.year, thisMonth.monthIndex, 22),
    eventTime: '06:30',
    eventLocation: 'The Grand Ballroom, Surabaya',
    status: 'tentative',
    totalPrice: 24500000,
    notes: 'Menunggu konfirmasi venue dari keluarga.',
    invoiceCount: 0,
    createdAt: isoDate(thisMonth.year, thisMonth.monthIndex, 3),
  },
  {
    id: 'bk-3',
    client: {
      id: 'cl-3',
      name: 'Nadia & Fikri',
      phone: '0813-8899-0011',
      email: 'nadiafikri@gmail.com',
    },
    packageId: 'pkg-silver',
    packageName: 'Paket Silver — 1 Crew',
    eventDate: isoDate(nextMonth.year, nextMonth.monthIndex, 5),
    eventTime: '09:00',
    eventLocation: 'Villa Lembang, Bandung Barat',
    status: 'tentative',
    totalPrice: 8500000,
    notes: null,
    invoiceCount: 0,
    createdAt: isoDate(thisMonth.year, thisMonth.monthIndex, 9),
  },
  {
    id: 'bk-4',
    client: {
      id: 'cl-4',
      name: 'Dewi & Reza',
      phone: '0821-4455-6677',
      email: null,
    },
    packageId: 'pkg-gold',
    packageName: 'Paket Gold — Full Day + Album',
    eventDate: isoDate(nextMonth.year, nextMonth.monthIndex, 19),
    eventTime: '07:30',
    eventLocation: 'Hotel Mulia, Jakarta Pusat',
    status: 'confirmed',
    totalPrice: 15000000,
    notes: 'Sudah DP 50%, pelunasan H-7.',
    invoiceCount: 1,
    createdAt: isoDate(prevMonth.year, prevMonth.monthIndex, 20),
  },
  {
    id: 'bk-5',
    client: {
      id: 'cl-5',
      name: 'Ayu & Dimas',
      phone: '0819-2233-4455',
      email: 'ayu.dimas@gmail.com',
    },
    packageId: 'pkg-silver',
    packageName: 'Paket Silver — 1 Crew',
    eventDate: isoDate(prevMonth.year, prevMonth.monthIndex, 28),
    eventTime: '10:00',
    eventLocation: 'Pendopo Agung, Yogyakarta',
    status: 'completed',
    totalPrice: 8500000,
    notes: null,
    invoiceCount: 2,
    createdAt: isoDate(prevMonth.year, prevMonth.monthIndex, 1),
  },
  {
    id: 'bk-6',
    client: {
      id: 'cl-6',
      name: 'Putri & Yoga',
      phone: '0838-7788-9900',
      email: null,
    },
    packageId: null,
    packageName: null,
    eventDate: isoDate(thisMonth.year, thisMonth.monthIndex, 8),
    eventTime: null,
    eventLocation: 'Rumah mempelai, Bogor',
    status: 'cancelled',
    totalPrice: 4000000,
    notes: 'Dibatalkan karena perubahan tanggal dari pihak klien.',
    invoiceCount: 0,
    createdAt: isoDate(prevMonth.year, prevMonth.monthIndex, 12),
  },
  {
    id: 'bk-7',
    client: {
      id: 'cl-7',
      name: 'Melati & Rangga',
      phone: '0896-3344-5566',
      email: 'melati.rangga@gmail.com',
    },
    packageId: 'pkg-platinum',
    packageName: 'Paket Platinum — 2 Crew + Video',
    eventDate: isoDate(nextMonth.year, nextMonth.monthIndex, 27),
    eventTime: '08:30',
    eventLocation: 'Ayana Bali, Jimbaran',
    status: 'confirmed',
    totalPrice: 24500000,
    notes: 'Butuh drone shot untuk sesi sunset.',
    invoiceCount: 1,
    createdAt: isoDate(thisMonth.year, thisMonth.monthIndex, 11),
  },
  {
    id: 'bk-8',
    client: {
      id: 'cl-8',
      name: 'Kirana & Adit',
      phone: '0852-1199-8877',
      email: null,
    },
    packageId: 'pkg-gold',
    packageName: 'Paket Gold — Full Day + Album',
    eventDate: isoDate(thisMonth.year, thisMonth.monthIndex, 30),
    eventTime: '07:00',
    eventLocation: 'Alila Solo, Jawa Tengah',
    status: 'tentative',
    totalPrice: 15000000,
    notes: null,
    invoiceCount: 0,
    createdAt: isoDate(thisMonth.year, thisMonth.monthIndex, 15),
  },
]
