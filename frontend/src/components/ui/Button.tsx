import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '@/lib/cn'

/**
 * Tombol dasar aplikasi: tiga varian visual + tiga ukuran.
 *
 * `as` menentukan elemen yang dirender, jadi tombol aksi, tautan navigasi, dan
 * tombol di dalam form memakai gaya yang sama tanpa duplikasi kelas.
 */

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secondary:
    'bg-white text-ink-700 ring-1 ring-ink-200 shadow-sm hover:bg-ink-50 hover:text-ink-900 disabled:text-ink-400',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 disabled:text-ink-300',
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-9 gap-1.5 px-3 text-[13px]',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2 px-5 text-sm',
}

const BASE_CLASS =
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed'

interface CommonProps {
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
}

type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button className={buttonClass({ variant, size, className })} {...props}>
      {children}
    </button>
  )
}

/** Kelas tombol yang sama untuk elemen lain (mis. `<a>` biasa). */
export function buttonClass({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: Variant
  size?: Size
  className?: string
} = {}) {
  return cn(BASE_CLASS, VARIANT_CLASS[variant], SIZE_CLASS[size], className)
}

/** Versi string untuk tautan eksternal non-router. */
export function buttonLinkClass(options: { variant?: Variant; size?: Size; className?: string } = {}) {
  return buttonClass(options)
}

type ButtonLinkProps = CommonProps & Omit<LinkProps, 'className' | 'children'>

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={cn(BASE_CLASS, VARIANT_CLASS[variant], SIZE_CLASS[size], className)} {...props}>
      {children}
    </Link>
  )
}
