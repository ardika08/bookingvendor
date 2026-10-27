import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'

/**
 * Toast ringan tanpa dependensi.
 *
 * Dipakai untuk umpan balik aksi yang tidak punya tempat alami di layout —
 * terutama perubahan status booking dari tabel: vendor harus tahu apakah
 * perubahan tersimpan atau dikembalikan (rollback) karena server menolak.
 */

type ToastTone = 'success' | 'error' | 'info'

interface Toast {
  id: number
  tone: ToastTone
  message: string
  /** Aksi opsional, mis. "Coba lagi". */
  action?: { label: string; onClick: () => void }
}

interface ToastContextValue {
  notify: (message: string, options?: { tone?: ToastTone; action?: Toast['action'] }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback<ToastContextValue['notify']>((message, options) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [
      ...prev.slice(-2),
      { id, tone: options?.tone ?? 'info', message, action: options?.action },
    ])
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, toast.tone === 'error' ? 6000 : 3500)
    return () => window.clearTimeout(timeout)
  }, [toast.id, toast.tone, onDismiss])

  const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertCircle : Info

  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl px-3.5 py-2.5 shadow-lg ring-1',
        toast.tone === 'success' && 'bg-emerald-50 text-emerald-900 ring-emerald-200',
        toast.tone === 'error' && 'bg-rose-50 text-rose-900 ring-rose-200',
        toast.tone === 'info' && 'bg-white text-ink-800 ring-ink-200',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 size-4 shrink-0',
          toast.tone === 'success' && 'text-emerald-600',
          toast.tone === 'error' && 'text-rose-600',
          toast.tone === 'info' && 'text-ink-400',
        )}
      />
      <p className="min-w-0 flex-1 text-meta leading-snug">{toast.message}</p>
      {toast.action ? (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick()
            onDismiss()
          }}
          className="shrink-0 text-meta font-semibold underline underline-offset-2 hover:opacity-80"
        >
          {toast.action.label}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded p-0.5 opacity-50 hover:opacity-100"
        aria-label="Tutup notifikasi"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast harus dipakai di dalam <ToastProvider>')
  return context
}
