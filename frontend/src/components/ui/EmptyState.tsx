import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Wadah state kosong / belum ada data.
 *
 * Dipakai saat filter tidak menghasilkan baris maupun saat vendor baru belum
 * punya booking — selalu menyertakan satu aksi lanjutan yang jelas.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon ? (
        <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-ink-100 text-ink-500">
          {icon}
        </div>
      ) : null}
      <p className="text-lead font-semibold text-ink-800">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-body leading-relaxed text-ink-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
