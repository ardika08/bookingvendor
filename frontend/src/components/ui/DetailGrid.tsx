import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Grid dua kolom responsif untuk pasangan label–nilai di panel detail. */
export function DetailGrid({ className, children }: { className?: string; children: ReactNode }) {
  return <dl className={cn('grid gap-x-6 gap-y-3.5 sm:grid-cols-2', className)}>{children}</dl>
}

/** Satu baris label–nilai; `href` membuat nilainya bisa diklik (mis. WhatsApp). */
export function DetailItem({
  label,
  value,
  href,
  icon,
  muted,
  className,
}: {
  label: string
  value: ReactNode
  href?: string
  icon?: ReactNode
  muted?: boolean
  className?: string
}) {
  const body = (
    <span
      className={cn(
        'block text-body leading-snug',
        muted ? 'text-ink-400' : 'text-ink-800',
        href && 'text-brand-700 hover:underline',
      )}
    >
      {value}
    </span>
  )

  return (
    <div className={cn('min-w-0', className)}>
      <dt className="flex items-center gap-1.5 text-caption font-medium uppercase tracking-wide text-ink-400">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 flex items-start gap-1.5">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="min-w-0">
            {body}
          </a>
        ) : (
          body
        )}
      </dd>
    </div>
  )
}
