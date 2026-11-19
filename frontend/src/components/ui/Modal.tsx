import { useEffect, useRef, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { classNames } from '../../utils'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg' | 'xl' | '2xl' | 'full'
}

export default function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm dark:bg-slate-950/70" onClick={onClose} />
          <motion.div ref={panelRef} initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }} transition={{ duration: 0.2, ease: 'easeOut' }}
            role="dialog" aria-modal="true" aria-label={title}
            className={classNames(
              'relative z-10 w-full rounded-2xl bg-white/95 shadow-2xl backdrop-blur-xl dark:bg-slate-900/95 dark:border dark:border-slate-700/50 flex flex-col',
              size === 'full' ? 'max-w-[97vw] w-[97vw] h-[94vh] max-h-[94vh]' : size === '2xl' ? 'max-w-6xl max-h-[90vh]' : size === 'xl' ? 'max-w-4xl max-h-[85vh]' : size === 'lg' ? 'max-w-2xl max-h-[85vh]' : 'max-w-lg max-h-[85vh]',
            )}>
            <div className="flex shrink-0 items-start justify-between border-b border-ink-100/60 px-6 py-4 dark:border-slate-700/40">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-ink-800 dark:text-slate-100">{title}</h3>
                {subtitle && <p className="mt-0.5 text-xs text-ink-500 truncate">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="mr-3 rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100/50 hover:text-ink-700 dark:hover:bg-slate-800/50 dark:hover:text-slate-200" aria-label="بستن">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className={classNames("px-6 py-5 overflow-y-auto", size === 'full' ? "flex-1 min-h-0" : "max-h-[70vh]")}>{children}</div>
            {footer && <div className="shrink-0 flex items-center justify-end gap-2 border-t border-ink-100/60 px-6 py-4 dark:border-slate-700/40">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
