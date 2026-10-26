import { cn } from '@/lib/cn'

/** Badge netral untuk metadata ringan (kuota, jumlah invoice, dsb). */
export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-600',
        className,
      )}
    >
      {children}
    </span>
  )
}
