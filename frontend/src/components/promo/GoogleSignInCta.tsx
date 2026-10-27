import { Link } from 'react-router-dom'
import { GoogleMark } from '@/components/auth/GoogleMark'
import { cn } from '@/lib/cn'

/**
 * Ajakan "Masuk dengan Google" yang dipakai ulang di halaman promosi.
 *
 * Satu komponen untuk header, hero, dan CTA penutup agar label, ikon, dan gaya
 * tombol selalu sama. Selalu mengarah ke `/login` — dari sana alur OAuth
 * dimulai. `variant` membedakan CTA utama dari tautan sekunder.
 */

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800',
  secondary:
    'bg-white text-ink-800 ring-1 ring-ink-200 shadow-sm hover:bg-ink-50',
  ghost: 'text-ink-700 hover:bg-ink-100 hover:text-ink-900',
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-9 gap-2 px-3.5 text-body',
  md: 'h-10 gap-2 px-4 text-body',
  lg: 'h-11 gap-2.5 px-5 text-body',
}

export function GoogleSignInCta({
  label = 'Masuk dengan Google',
  variant = 'primary',
  size = 'md',
  block = false,
  className,
}: {
  label?: string
  variant?: Variant
  size?: Size
  /** Lebar penuh — dipakai di hero dan menu mobile. */
  block?: boolean
  className?: string
}) {
  return (
    <Link
      to="/login"
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        block && 'w-full',
        className,
      )}
    >
      <GoogleMark className={size === 'lg' ? 'size-4' : 'size-3.5'} />
      {label}
    </Link>
  )
}
