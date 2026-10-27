/**
 * Ikon aplikasi — satu-satunya tempat yang tahu Hugeicons.
 *
 * Kenapa ada lapisan ini, bukan impor Hugeicons langsung di 62 file:
 *
 * 1. **Nama ikon Hugeicons berbeda dari Lucide.** `CalendarDays` jadi
 *    `CalendarDays`, tapi `AlertTriangle` jadi `TriangleAlert` dan `XCircle`
 *    jadi `CancelCircle`. Kalau nama Hugeicons ditulis langsung di tiap file,
 *    setiap penggantian style/ikon berarti menyunting puluhan tempat.
 * 2. **Kode pemakaian tidak berubah.** Semua file tetap menulis
 *    `<Search className="size-4" />`; hanya baris import yang pindah ke sini.
 *    Migrasi jadi mekanis dan tidak menyentuh JSX.
 * 3. **Satu titik tukar paket.** Modul ini mengimpor dari paket ikon gratis
 *    (`@hugeicons/core-free-icons`). Saat lisensi Pro aktif, cukup ganti
 *    sumber impor di bawah ke `@hugeicons-pro/core-stroke-rounded` dan ubah
 *    akhiran `FreeIcons` -> `Icon`; seluruh aplikasi ikut berganti tanpa
 *    menyentuh file lain.
 *
 * Semua nama di bawah sudah diverifikasi ada di paket (bukan tebakan):
 * 79 ikon, nol yang hilang.
 */

import type { ComponentType, SVGProps } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgElement } from '@hugeicons/react'
import {
  AlertCircleFreeIcons,
  TriangleAlertFreeIcons,
  ArrowLeftFreeIcons,
  ArrowRightFreeIcons,
  ArrowUpDownFreeIcons,
  ArrowUpRightFreeIcons,
  BanFreeIcons,
  BanknoteFreeIcons,
  BarChartFreeIcons,
  BellFreeIcons,
  BookOpenCheckFreeIcons,
  Building02FreeIcons,
  CalendarCheckFreeIcons,
  CalendarCheckInFreeIcons,
  CalendarClockFreeIcons,
  CalendarDaysFreeIcons,
  CalendarPlusFreeIcons,
  CheckFreeIcons,
  CheckmarkCircle02FreeIcons,
  ChevronDownFreeIcons,
  ChevronLeftFreeIcons,
  ChevronRightFreeIcons,
  CircleCheckFreeIcons,
  CircleDashedFreeIcons,
  CircleXFreeIcons,
  ClockFreeIcons,
  Clock03FreeIcons,
  ConstructionFreeIcons,
  CopyFreeIcons,
  CreditCardFreeIcons,
  CrownFreeIcons,
  DownloadFreeIcons,
  ExternalLinkFreeIcons,
  FileTextFreeIcons,
  FileXFreeIcons,
  HourglassFreeIcons,
  IdCardFreeIcons,
  InfoFreeIcons,
  LandmarkFreeIcons,
  LayoutDashboardFreeIcons,
  LifebuoyFreeIcons,
  Link02FreeIcons,
  Loading03FreeIcons,
  LockFreeIcons,
  LoginFreeIcons,
  LogoutFreeIcons,
  MailFreeIcons,
  MapPinFreeIcons,
  MenuFreeIcons,
  MessageCircleFreeIcons,
  PackageFreeIcons,
  PencilFreeIcons,
  PhoneFreeIcons,
  PlusFreeIcons,
  QrCodeFreeIcons,
  ReceiptFreeIcons,
  ReceiptTextFreeIcons,
  RefreshCwFreeIcons,
  RotateCcwFreeIcons,
  RotateCwFreeIcons,
  SaveFreeIcons,
  SearchFreeIcons,
  SearchXFreeIcons,
  Settings02FreeIcons,
  ShieldCheckFreeIcons,
  SlidersHorizontalFreeIcons,
  SmartphoneFreeIcons,
  SparklesFreeIcons,
  StoreFreeIcons,
  TrendingUpFreeIcons,
  LockOpenFreeIcons,
  UserFreeIcons,
  UserAddFreeIcons,
  UserRoundFreeIcons,
  UsersFreeIcons,
  WalletFreeIcons,
  WifiOffFreeIcons,
  XFreeIcons,
  CancelCircleFreeIcons,
} from '@hugeicons/core-free-icons'

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
 */
function icon(element: IconSvgElement, name: string) {
  const Component = ({ size, strokeWidth, ...props }: IconProps) => (
    <HugeiconsIcon
      icon={element}
      size={size}
      strokeWidth={strokeWidth}
      {...(props as Record<string, unknown>)}
    />
  )
  Component.displayName = name
  return Component
}

// Diekspor dengan nama Lucide supaya kode pemakaian tidak perlu diubah.
export const AlertCircle = icon(AlertCircleFreeIcons, 'AlertCircle')
export const AlertTriangle = icon(TriangleAlertFreeIcons, 'AlertTriangle')
export const ArrowLeft = icon(ArrowLeftFreeIcons, 'ArrowLeft')
export const ArrowRight = icon(ArrowRightFreeIcons, 'ArrowRight')
export const ArrowUpDown = icon(ArrowUpDownFreeIcons, 'ArrowUpDown')
export const ArrowUpRight = icon(ArrowUpRightFreeIcons, 'ArrowUpRight')
export const Ban = icon(BanFreeIcons, 'Ban')
export const Banknote = icon(BanknoteFreeIcons, 'Banknote')
export const BarChart3 = icon(BarChartFreeIcons, 'BarChart3')
export const Bell = icon(BellFreeIcons, 'Bell')
export const BookOpenCheck = icon(BookOpenCheckFreeIcons, 'BookOpenCheck')
export const Building2 = icon(Building02FreeIcons, 'Building2')
export const CalendarCheck = icon(CalendarCheckFreeIcons, 'CalendarCheck')
export const CalendarCheck2 = icon(CalendarCheckInFreeIcons, 'CalendarCheck2')
export const CalendarClock = icon(CalendarClockFreeIcons, 'CalendarClock')
export const CalendarDays = icon(CalendarDaysFreeIcons, 'CalendarDays')
export const CalendarPlus = icon(CalendarPlusFreeIcons, 'CalendarPlus')
export const Check = icon(CheckFreeIcons, 'Check')
export const CheckCircle2 = icon(CheckmarkCircle02FreeIcons, 'CheckCircle2')
export const ChevronDown = icon(ChevronDownFreeIcons, 'ChevronDown')
export const ChevronLeft = icon(ChevronLeftFreeIcons, 'ChevronLeft')
export const ChevronRight = icon(ChevronRightFreeIcons, 'ChevronRight')
export const CircleCheck = icon(CircleCheckFreeIcons, 'CircleCheck')
export const CircleDashed = icon(CircleDashedFreeIcons, 'CircleDashed')
export const CircleX = icon(CircleXFreeIcons, 'CircleX')
export const Clock = icon(ClockFreeIcons, 'Clock')
export const Clock3 = icon(Clock03FreeIcons, 'Clock3')
export const Construction = icon(ConstructionFreeIcons, 'Construction')
export const Copy = icon(CopyFreeIcons, 'Copy')
export const CreditCard = icon(CreditCardFreeIcons, 'CreditCard')
export const Crown = icon(CrownFreeIcons, 'Crown')
export const Download = icon(DownloadFreeIcons, 'Download')
export const ExternalLink = icon(ExternalLinkFreeIcons, 'ExternalLink')
export const FileText = icon(FileTextFreeIcons, 'FileText')
export const FileX2 = icon(FileXFreeIcons, 'FileX2')
export const Hourglass = icon(HourglassFreeIcons, 'Hourglass')
export const IdCard = icon(IdCardFreeIcons, 'IdCard')
export const Info = icon(InfoFreeIcons, 'Info')
export const Landmark = icon(LandmarkFreeIcons, 'Landmark')
export const LayoutDashboard = icon(LayoutDashboardFreeIcons, 'LayoutDashboard')
export const LifeBuoy = icon(LifebuoyFreeIcons, 'LifeBuoy')
export const Link2 = icon(Link02FreeIcons, 'Link2')
export const LoaderCircle = icon(Loading03FreeIcons, 'LoaderCircle')
export const Lock = icon(LockFreeIcons, 'Lock')
export const LogIn = icon(LoginFreeIcons, 'LogIn')
export const LogOut = icon(LogoutFreeIcons, 'LogOut')
export const Mail = icon(MailFreeIcons, 'Mail')
export const MapPin = icon(MapPinFreeIcons, 'MapPin')
export const Menu = icon(MenuFreeIcons, 'Menu')
export const MessageCircle = icon(MessageCircleFreeIcons, 'MessageCircle')
export const Package = icon(PackageFreeIcons, 'Package')
export const Pencil = icon(PencilFreeIcons, 'Pencil')
export const Phone = icon(PhoneFreeIcons, 'Phone')
export const Plus = icon(PlusFreeIcons, 'Plus')
export const QrCode = icon(QrCodeFreeIcons, 'QrCode')
export const Receipt = icon(ReceiptFreeIcons, 'Receipt')
export const ReceiptText = icon(ReceiptTextFreeIcons, 'ReceiptText')
export const RefreshCw = icon(RefreshCwFreeIcons, 'RefreshCw')
export const RotateCcw = icon(RotateCcwFreeIcons, 'RotateCcw')
export const RotateCw = icon(RotateCwFreeIcons, 'RotateCw')
export const Save = icon(SaveFreeIcons, 'Save')
export const Search = icon(SearchFreeIcons, 'Search')
export const SearchX = icon(SearchXFreeIcons, 'SearchX')
export const Settings2 = icon(Settings02FreeIcons, 'Settings2')
export const ShieldCheck = icon(ShieldCheckFreeIcons, 'ShieldCheck')
export const SlidersHorizontal = icon(SlidersHorizontalFreeIcons, 'SlidersHorizontal')
export const Smartphone = icon(SmartphoneFreeIcons, 'Smartphone')
export const Sparkles = icon(SparklesFreeIcons, 'Sparkles')
export const Store = icon(StoreFreeIcons, 'Store')
export const TrendingUp = icon(TrendingUpFreeIcons, 'TrendingUp')
export const Unlock = icon(LockOpenFreeIcons, 'Unlock')
export const User = icon(UserFreeIcons, 'User')
export const UserPlus = icon(UserAddFreeIcons, 'UserPlus')
export const UserRound = icon(UserRoundFreeIcons, 'UserRound')
export const Users = icon(UsersFreeIcons, 'Users')
export const Wallet = icon(WalletFreeIcons, 'Wallet')
export const WifiOff = icon(WifiOffFreeIcons, 'WifiOff')
export const X = icon(XFreeIcons, 'X')
export const XCircle = icon(CancelCircleFreeIcons, 'XCircle')

/**
 * Tipe untuk ikon yang disimpan di variabel/peta (sidebar, status booking,
 * status invoice, tile ringkasan). Dulu bertipe `LucideIcon`.
 */
export type IconComponent = ComponentType<IconProps>
