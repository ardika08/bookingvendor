import { cn } from '@/lib/cn'

/** Placeholder isi tabel saat data sedang diambil dari API. */
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-ink-100" aria-hidden>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-4 py-4 sm:px-5">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <div
              key={colIndex}
              className={cn(
                'h-3.5 animate-pulse rounded bg-ink-100',
                colIndex === 0 ? 'w-40' : 'w-24',
                colIndex > 2 ? 'hidden sm:block' : '',
              )}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
