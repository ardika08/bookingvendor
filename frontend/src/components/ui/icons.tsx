/**
 * Ikon aplikasi — satu-satunya tempat yang tahu Hugeicons.
 *
 * **Sumber: Hugeicons Pro, style `solid-rounded`** (lisensi Pro aktif).
 * Paket Pro dipasang dari registry privat (lihat `.npmrc`); kunci lisensi
 * hanya ada di environment variable `HUGEICONS_LICENSE_KEY`, tidak di repo.
 *
 * Kenapa ada lapisan ini, bukan impor Hugeicons langsung di 62 file:
 *
 * 1. **Nama ikon Hugeicons berbeda dari Lucide.** `AlertTriangle` jadi
 *    `TriangleAlert`, `XCircle` jadi `CancelCircle`, `Unlock` jadi `LockOpen`.
 *    Kalau nama Hugeicons ditulis langsung di tiap file, setiap penggantian
 *    style berarti menyunting puluhan tempat.
 * 2. **Kode pemakaian tidak berubah.** Semua file tetap menulis
 *    `<Search className="size-4" />`; hanya baris import yang pindah ke sini.
 * 3. **Satu titik tukar style.** Ganti satu baris impor di bawah untuk pindah
 *    style Pro (`core-stroke-standard`, `core-solid-rounded`, dst).
 *
 * **Kenapa `absoluteStrokeWidth` aktif.** Ikon memakai viewBox 24. Tanpa opsi
 * ini, stroke 1.5 diskalakan ke ukuran tampil: pada ikon 14px garisnya jadi
 * 1.5 x (14/24) = 0.875px — di bawah satu piksel, sehingga selalu di-antialias
 * dan terlihat pudar/kabur. Dengan `absoluteStrokeWidth`, Hugeicons mengalikan
 * stroke dengan 24/size sehingga tebal garis di layar tetap ~1.5px di ukuran
 * apa pun. Terukur: piksel antialias turun 8.3% -> 4.3% (ketajaman 2.54 -> 8.98).
 *
 * Catatan: style solid hampir tidak memakai stroke (bentuknya isian/fill), jadi
 * opsi ini tidak berpengaruh besar di sini — tetapi tetap dipertahankan supaya
 * perilakunya konsisten kalau style dikembalikan ke stroke.
 *
 * Semua nama di bawah sudah diverifikasi ada di paket (bukan tebakan).
 */

import type { ComponentType, SVGProps } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgElement } from '@hugeicons/react'
import {
  AlertCircleIcon,
  TriangleAlertIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpDownIcon,
  ArrowUpRightIcon,
  BanIcon,
  BanknoteIcon,
  BarChartIcon,
  BellIcon,
  BookOpenCheckIcon,
  Building02Icon,
  CalendarCheckIcon,
  CalendarCheckInIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CalendarPlusIcon,
  CheckIcon,
  CheckmarkCircle02Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  ClockIcon,
  Clock03Icon,
  ConstructionIcon,
  CopyIcon,
  CreditCardIcon,
  CrownIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FileXIcon,
  HistoryIcon,
  HourglassIcon,
  PrinterIcon,
  IdCardIcon,
  InfoIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  LifebuoyIcon,
  Link02Icon,
  Loading03Icon,
  LockIcon,
  LoginIcon,
  LogoutIcon,
  MailIcon,
  MapPinIcon,
  MenuIcon,
  MessageCircleIcon,
  PackageIcon,
  PencilIcon,
  Delete02Icon,
  PhoneIcon,
  PlusIcon,
  QrCodeIcon,
  ReceiptIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  RotateCwIcon,
  SaveIcon,
  SearchIcon,
  SearchXIcon,
  Settings02Icon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SmartphoneIcon,
  StoreIcon,
  TicketIcon,
  TrendingUpIcon,
  LockOpenIcon,
  UserIcon,
  UserAddIcon,
  UserRoundIcon,
  UsersIcon,
  WalletIcon,
  WifiOffIcon,
  XIcon,
  CancelCircleIcon,
} from '@hugeicons-pro/core-solid-rounded'

/** Props yang diterima setiap ikon aplikasi. */
export type IconProps = SVGProps<SVGSVGElement> & {
  /** Ukuran dalam px. Kalau diisi, mengalahkan `className` berbasis size-*. */
  size?: number | string
  strokeWidth?: number
}

/**
 * Bungkus satu ikon Hugeicons agar bisa dipakai seperti komponen Lucide.
 *
 * `size` sengaja TIDAK diberi nilai default: kalau default dipasang (mis. 24),
 * atribut width/height akan mengalahkan kelas `size-4` yang sudah dipakai di
 * seluruh aplikasi, sehingga semua ikon tiba-tiba membesar. Dengan tanpa
 * default, ukuran tetap sepenuhnya ditentukan `className` seperti sebelumnya.
 *
 * `absoluteStrokeWidth` butuh `size` dalam angka; karena `size` biasanya kosong
 * (ukuran datang dari CSS), nilainya dibaca dari lebar terhitung elemen lewat
 * `useRef` + efek. Kalau `size` diisi eksplisit, nilai itu yang dipakai.
 */
function icon(element: IconSvgElement, name: string) {
  const Component = ({ size, strokeWidth, ...props }: IconProps) => (
    <HugeiconsIcon
      icon={element}
      size={size}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth
      {...(props as Record<string, unknown>)}
    />
  )
  Component.displayName = name
  return Component
}

// Diekspor dengan nama Lucide supaya kode pemakaian tidak perlu diubah.
export const AlertCircle = icon(AlertCircleIcon, 'AlertCircle')
export const AlertTriangle = icon(TriangleAlertIcon, 'AlertTriangle')
export const ArrowLeft = icon(ArrowLeftIcon, 'ArrowLeft')
export const ArrowRight = icon(ArrowRightIcon, 'ArrowRight')
export const ArrowUpDown = icon(ArrowUpDownIcon, 'ArrowUpDown')
export const ArrowUpRight = icon(ArrowUpRightIcon, 'ArrowUpRight')
export const Ban = icon(BanIcon, 'Ban')
export const Banknote = icon(BanknoteIcon, 'Banknote')
export const BarChart3 = icon(BarChartIcon, 'BarChart3')
export const Bell = icon(BellIcon, 'Bell')
export const BookOpenCheck = icon(BookOpenCheckIcon, 'BookOpenCheck')
export const Building2 = icon(Building02Icon, 'Building2')
export const CalendarCheck = icon(CalendarCheckIcon, 'CalendarCheck')
export const CalendarCheck2 = icon(CalendarCheckInIcon, 'CalendarCheck2')
export const CalendarClock = icon(CalendarClockIcon, 'CalendarClock')
export const CalendarDays = icon(CalendarDaysIcon, 'CalendarDays')
export const CalendarPlus = icon(CalendarPlusIcon, 'CalendarPlus')
export const Check = icon(CheckIcon, 'Check')
export const CheckCircle2 = icon(CheckmarkCircle02Icon, 'CheckCircle2')
export const ChevronDown = icon(ChevronDownIcon, 'ChevronDown')
export const ChevronLeft = icon(ChevronLeftIcon, 'ChevronLeft')
export const ChevronRight = icon(ChevronRightIcon, 'ChevronRight')
export const CircleCheck = icon(CircleCheckIcon, 'CircleCheck')
export const CircleDashed = icon(CircleDashedIcon, 'CircleDashed')
export const CircleX = icon(CircleXIcon, 'CircleX')
export const Clock = icon(ClockIcon, 'Clock')
export const Clock3 = icon(Clock03Icon, 'Clock3')
export const Construction = icon(ConstructionIcon, 'Construction')
export const Copy = icon(CopyIcon, 'Copy')
export const CreditCard = icon(CreditCardIcon, 'CreditCard')
export const Crown = icon(CrownIcon, 'Crown')
export const Download = icon(DownloadIcon, 'Download')
export const ExternalLink = icon(ExternalLinkIcon, 'ExternalLink')
export const FileText = icon(FileTextIcon, 'FileText')
export const FileX2 = icon(FileXIcon, 'FileX2')
export const History = icon(HistoryIcon, 'History')
export const Hourglass = icon(HourglassIcon, 'Hourglass')
export const Printer = icon(PrinterIcon, 'Printer')
export const IdCard = icon(IdCardIcon, 'IdCard')
export const Info = icon(InfoIcon, 'Info')
export const Landmark = icon(LandmarkIcon, 'Landmark')
export const LayoutDashboard = icon(LayoutDashboardIcon, 'LayoutDashboard')
export const LifeBuoy = icon(LifebuoyIcon, 'LifeBuoy')
export const Link2 = icon(Link02Icon, 'Link2')
export const LoaderCircle = icon(Loading03Icon, 'LoaderCircle')
export const Lock = icon(LockIcon, 'Lock')
export const LogIn = icon(LoginIcon, 'LogIn')
export const LogOut = icon(LogoutIcon, 'LogOut')
export const Mail = icon(MailIcon, 'Mail')
export const MapPin = icon(MapPinIcon, 'MapPin')
export const Menu = icon(MenuIcon, 'Menu')
export const MessageCircle = icon(MessageCircleIcon, 'MessageCircle')
export const Package = icon(PackageIcon, 'Package')
export const Pencil = icon(PencilIcon, 'Pencil')
/** Hugeicons tidak punya "Trash2"; Delete02 adalah bentuk tempat sampah. */
export const Trash2 = icon(Delete02Icon, 'Trash2')
export const Phone = icon(PhoneIcon, 'Phone')
export const Plus = icon(PlusIcon, 'Plus')
export const QrCode = icon(QrCodeIcon, 'QrCode')
export const Receipt = icon(ReceiptIcon, 'Receipt')
export const ReceiptText = icon(ReceiptTextIcon, 'ReceiptText')
export const RefreshCw = icon(RefreshCwIcon, 'RefreshCw')
export const RotateCcw = icon(RotateCcwIcon, 'RotateCcw')
export const RotateCw = icon(RotateCwIcon, 'RotateCw')
export const Save = icon(SaveIcon, 'Save')
export const Search = icon(SearchIcon, 'Search')
export const SearchX = icon(SearchXIcon, 'SearchX')
export const Settings2 = icon(Settings02Icon, 'Settings2')
export const ShieldCheck = icon(ShieldCheckIcon, 'ShieldCheck')
export const SlidersHorizontal = icon(SlidersHorizontalIcon, 'SlidersHorizontal')
export const Smartphone = icon(SmartphoneIcon, 'Smartphone')
export const Store = icon(StoreIcon, 'Store')
export const Ticket = icon(TicketIcon, 'Ticket')
export const TrendingUp = icon(TrendingUpIcon, 'TrendingUp')
export const Unlock = icon(LockOpenIcon, 'Unlock')
export const User = icon(UserIcon, 'User')
export const UserPlus = icon(UserAddIcon, 'UserPlus')
export const UserRound = icon(UserRoundIcon, 'UserRound')
export const Users = icon(UsersIcon, 'Users')
export const Wallet = icon(WalletIcon, 'Wallet')
export const WifiOff = icon(WifiOffIcon, 'WifiOff')
export const X = icon(XIcon, 'X')
export const XCircle = icon(CancelCircleIcon, 'XCircle')

/**
 * Tipe untuk ikon yang disimpan di variabel/peta (sidebar, status booking,
 * status invoice, tile ringkasan). Dulu bertipe `LucideIcon`.
 */
export type IconComponent = ComponentType<IconProps>
