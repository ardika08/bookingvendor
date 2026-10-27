import { AlertCircle, AlertTriangle } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

/**
 * Primitif form reusable: Field (label + hint + error), TextInput, TextArea,
 * Select, dan SectionTitle. Semua input uncontrolled-compatible sehingga
 * dipakai bersama state form biasa maupun library form di backend nanti.
 */

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-4', className)}>
      <div>
        <h2 className="text-body font-semibold uppercase tracking-wide text-ink-500">{title}</h2>
        {description ? <p className="mt-0.5 text-meta text-ink-400">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="flex items-center gap-1 text-meta font-medium text-ink-700">
        {label}
        {required ? <span className="text-brand-600">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-caption font-medium text-rose-600">
          <AlertCircle className="size-3" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-caption text-ink-400">{hint}</p>
      ) : null}
    </div>
  )
}

const CONTROL_CLASS =
  'w-full rounded-lg border border-ink-200 bg-white px-3 text-body text-ink-800 placeholder:text-ink-400 transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-ink-50 disabled:text-ink-400'

export const inputClass = (hasError?: boolean) =>
  cn(CONTROL_CLASS, 'h-10', hasError && 'border-rose-300 focus:border-rose-400 focus:ring-rose-100')

export const textareaClass = (hasError?: boolean) =>
  cn(CONTROL_CLASS, 'min-h-[84px] py-2 leading-relaxed', hasError && 'border-rose-300')

export function InlineWarning({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
      <div className="text-meta leading-relaxed text-amber-800">{children}</div>
    </div>
  )
}
