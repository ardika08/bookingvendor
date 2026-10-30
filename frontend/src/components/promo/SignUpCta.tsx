import { Link } from 'react-router-dom'
import { ArrowRight } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

/**
 * Ajakan mendaftar — CTA utama halaman promosi.
 *
 * Halaman promosi sebelumnya hanya menawarkan "Masuk dengan Google", dan
 * calon vendor yang belum punya akun harus menemukan sendiri tautan kecil
 * "Belum punya akun?" di halaman masuk. Untuk produk yang sedang mencari
 * pengguna baru, pendaftaran justru harus jadi tombol paling menonjol.
 *
 * Tidak memakai ikon Google: mendaftar bukan tindakan "masuk", dan ikon itu
 * membuat tombol ini terlihat sama dengan tombol login di sebelahnya.
 */

type Variant = 'primary' | 'secondary'
type Size = 'md' | 'lg'

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-brand-400 text-ink-900 shadow-sm hover:bg-brand-500 active:bg-brand-600',
  secondary: 'bg-white text-ink-800 ring-1 ring-ink-200 shadow-sm hover:bg-ink-50',
}

const SIZE_CLASS: Record<Size, string> = {
  md: 'h-10 gap-2 px-4 text-body',
  lg: 'h-11 gap-2.5 px-5 text-body',
}

export function SignUpCta({
  label = 'Daftar gratis 30 hari',
  variant = 'primary',
  size = 'md',
  block = false,
  className,
}: {
  label?: string
  variant?: Variant
  size?: Size
  block?: boolean
  className?: string
}) {
  return (
    <Link
      to="/daftar"
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        block && 'w-full',
        className,
      )}
    >
      {label}
      <ArrowRight className={size === 'lg' ? 'size-4' : 'size-3.5'} />
    </Link>
  )
}
