import { createContext, useCallback, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'
interface Toast { id: number; type: ToastType; message: string }

interface ToastContextValue { notify: (message: string, type?: ToastType) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  const barRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = barRef.current
    if (!el) return
    el.style.transition = 'width 4s linear'
    requestAnimationFrame(() => { el.style.width = '0%' })
  }, [])

  const Icon = toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? AlertCircle : Info
  const c = toast.type === 'success' ? 'border-stock-300/60 bg-stock-50/90 text-stock-800 dark:border-stock-800/50 dark:bg-stock-950/60 dark:text-stock-300'
    : toast.type === 'error' ? 'border-rose-200/60 bg-rose-50/90 text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/60 dark:text-rose-300'
    : 'border-sky-200/60 bg-sky-50/90 text-sky-800 dark:border-sky-800/50 dark:bg-sky-950/60 dark:text-sky-300'
  const bar = toast.type === 'success' ? 'bg-stock-400' : toast.type === 'error' ? 'bg-rose-400' : 'bg-sky-400'

  return (
    <motion.div initial={{ opacity: 0, x: 80, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={`relative flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-xl ${c}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <span className="flex-1 text-sm leading-snug">{toast.message}</span>
      <button onClick={() => onRemove(toast.id)} className="shrink-0 opacity-60 hover:opacity-100 transition"><X className="h-4 w-4" /></button>
      <div ref={barRef} className={`absolute bottom-0 left-0 h-0.5 w-full rounded-full ${bar}`} />
    </motion.div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const notify = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])
  const remove = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), [])

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-[60] flex items-start justify-end p-4 sm:p-6">
        <div className="pointer-events-auto flex w-full max-w-sm flex-col gap-2">
          <AnimatePresence>{toasts.map((t) => <ToastItem key={t.id} toast={t} onRemove={remove} />)}</AnimatePresence>
        </div>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() { const ctx = useContext(ToastContext); if (!ctx) throw new Error('useToast must be used within ToastProvider'); return ctx }
