/**
 * Verifikasi ulang seluruh nama ikon terhadap paket Pro.
 *
 * Nama ikon di paket Pro TIDAK dijamin sama dengan paket gratis (akhiran
 * `FreeIcons` -> `Icon`), jadi pemetaan yang sudah ada harus diuji ulang ke
 * paket Pro yang sebenarnya, bukan diasumsikan.
 */

import * as pro from '@hugeicons-pro/core-stroke-standard'

const nama = Object.keys(pro)
const set = new Set(nama)

const MAP = {
  AlertCircle: 'AlertCircle',
  AlertTriangle: 'TriangleAlert',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  ArrowUpDown: 'ArrowUpDown',
  ArrowUpRight: 'ArrowUpRight',
  Ban: 'Ban',
  Banknote: 'Banknote',
  BarChart3: 'BarChart',
  Bell: 'Bell',
  BookOpenCheck: 'BookOpenCheck',
  Building2: 'Building02',
  CalendarCheck: 'CalendarCheck',
  CalendarCheck2: 'CalendarCheckIn',
  CalendarClock: 'CalendarClock',
  CalendarDays: 'CalendarDays',
  CalendarPlus: 'CalendarPlus',
  Check: 'Check',
  CheckCircle2: 'CheckmarkCircle02',
  ChevronDown: 'ChevronDown',
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  CircleCheck: 'CircleCheck',
  CircleDashed: 'CircleDashed',
  CircleX: 'CircleX',
  Clock: 'Clock',
  Clock3: 'Clock03',
  Construction: 'Construction',
  Copy: 'Copy',
  CreditCard: 'CreditCard',
  Crown: 'Crown',
  Download: 'Download',
  ExternalLink: 'ExternalLink',
  FileText: 'FileText',
  FileX2: 'FileX',
  Hourglass: 'Hourglass',
  IdCard: 'IdCard',
  Info: 'Info',
  Landmark: 'Landmark',
  LayoutDashboard: 'LayoutDashboard',
  LifeBuoy: 'Lifebuoy',
  Link2: 'Link02',
  LoaderCircle: 'Loading03',
  Lock: 'Lock',
  LogIn: 'Login',
  LogOut: 'Logout',
  Mail: 'Mail',
  MapPin: 'MapPin',
  Menu: 'Menu',
  MessageCircle: 'MessageCircle',
  Package: 'Package',
  Pencil: 'Pencil',
  Phone: 'Phone',
  Plus: 'Plus',
  QrCode: 'QrCode',
  Receipt: 'Receipt',
  ReceiptText: 'ReceiptText',
  RefreshCw: 'RefreshCw',
  RotateCcw: 'RotateCcw',
  RotateCw: 'RotateCw',
  Save: 'Save',
  Search: 'Search',
  SearchX: 'SearchX',
  Settings2: 'Settings02',
  ShieldCheck: 'ShieldCheck',
  SlidersHorizontal: 'SlidersHorizontal',
  Smartphone: 'Smartphone',
  Sparkles: 'Sparkles',
  Store: 'Store',
  TrendingUp: 'TrendingUp',
  Unlock: 'LockOpen',
  User: 'User',
  UserPlus: 'UserAdd',
  UserRound: 'UserRound',
  Users: 'Users',
  Wallet: 'Wallet',
  WifiOff: 'WifiOff',
  X: 'X',
  XCircle: 'CancelCircle',
}

console.log(`Total export paket Pro : ${nama.length}`)
console.log(`Ikon yang dipetakan     : ${Object.keys(MAP).length}`)

const hilang = []
for (const [lucide, hg] of Object.entries(MAP)) {
  if (!set.has(`${hg}Icon`)) hilang.push(`${lucide} -> ${hg}Icon`)
}

if (hilang.length === 0) {
  console.log('\nHASIL: semua 79 nama ditemukan di paket Pro (akhiran Icon).')
} else {
  console.log(`\nHASIL: ${hilang.length} TIDAK ditemukan:`)
  for (const h of hilang) console.log('  ', h)
}
