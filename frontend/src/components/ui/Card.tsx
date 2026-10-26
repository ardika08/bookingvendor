import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Kartu putih standar dashboard: radius besar, border tipis, tanpa bayangan berat. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('rounded-xl border border-ink-200/80 bg-white', className)}>{children}</section>
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 border-b border-ink-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] text-ink-500">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  )
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-4 py-4 sm:px-5', className)}>{children}</div>
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <footer
      className={cn(
        'flex flex-col gap-3 border-t border-ink-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5',
        className,
      )}
    >
      {children}
    </footer>
  )
}
