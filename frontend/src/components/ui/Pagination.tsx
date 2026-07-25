import { ChevronLeft, ChevronRight } from 'lucide-react'
import { classNames } from '../../utils'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

export default function Pagination({ currentPage, totalPages, onPageChange, disabled = false }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages: (number | 'dots')[] = []
  const maxVisible = 5
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages, start + maxVisible - 1)
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1)
  }
  if (start > 1) { pages.push(1); if (start > 2) pages.push('dots') }
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < totalPages) { if (end < totalPages - 1) pages.push('dots'); pages.push(totalPages) }

  return (
    <nav className="flex items-center justify-center gap-1.5" aria-label="صفحه‌بندی">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || disabled}
        className="btn-ghost h-9 w-9 !px-0 rounded-xl"
        aria-label="صفحه قبلی"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {pages.map((p, i) =>
        p === 'dots' ? (
          <span key={`dots-${i}`} className="flex h-9 w-9 items-center justify-center text-xs text-ink-400 dark:text-slate-500">
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            disabled={disabled}
            className={classNames(
              'h-9 min-w-[36px] rounded-xl px-2 text-sm font-medium transition',
              p === currentPage
                ? 'bg-brand-500 text-white shadow-sm hover:bg-brand-600'
                : 'text-ink-600 hover:bg-ink-100 dark:text-slate-300 dark:hover:bg-slate-800',
            )}
          >
            {p}
          </button>
        ),
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || disabled}
        className="btn-ghost h-9 w-9 !px-0 rounded-xl"
        aria-label="صفحه بعدی"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
    </nav>
  )
}
