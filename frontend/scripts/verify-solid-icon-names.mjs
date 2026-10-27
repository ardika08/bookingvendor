/**
 * Verifikasi nama ikon terhadap paket Pro SOLID-rounded.
 *
 * Ikon solid tidak memakai garis (stroke) melainkan isian (fill), sehingga
 * himpunan namanya bisa berbeda dari style stroke. Pemetaan lama tidak boleh
 * diasumsikan berlaku — harus diuji ke paket yang benar-benar dipakai.
 */

import * as solid from '@hugeicons-pro/core-solid-rounded'

const set = new Set(Object.keys(solid))

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

console.log(`Total export solid-rounded : ${set.size}`)
console.log(`Ikon dipetakan             : ${Object.keys(MAP).length}`)

const hilang = Object.entries(MAP).filter(([, hg]) => !set.has(`${hg}Icon`))
if (hilang.length === 0) {
  console.log('\nHASIL: semua nama ditemukan di paket solid-rounded.')
} else {
  console.log(`\nHASIL: ${hilang.length} tidak ditemukan:`)
  for (const [l, h] of hilang) console.log(`   ${l} -> ${h}Icon`)
}
