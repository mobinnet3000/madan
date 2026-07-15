import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

export default function Pagination({ currentPage, totalPages, onPageChange, disabled = false }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = []
  const maxVisible = 5
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages, start + maxVisible - 1)
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1)
  }

  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <nav className="flex items-center justify-center gap-1.5" aria-label="صفحه‌بندی">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || disabled}
        className="btn-ghost h-8 w-8 !px-0"
        aria-label="صفحه قبلی"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {start > 1 && (
        <>
          <button onClick={() => onPageChange(1)} disabled={disabled} className="btn-ghost h-8 w-8 !px-0">
            1
          </button>
          {start > 2 && (
            <span className="h-8 w-8 flex items-center justify-center text-ink-400 dark:text-slate-500">…</span>
          )}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          disabled={disabled}
          className={`btn-ghost h-8 w-8 !px-0 transition ${
            p === currentPage
              ? 'bg-brand-500 text-white shadow-sm'
              : 'text-ink-700 hover:bg-ink-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          {p}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && (
            <span className="h-8 w-8 flex items-center justify-center text-ink-400 dark:text-slate-500">…</span>
          )}
          <button onClick={() => onPageChange(totalPages)} disabled={disabled} className="btn-ghost h-8 w-8 !px-0">
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || disabled}
        className="btn-ghost h-8 w-8 !px-0"
        aria-label="صفحه بعدی"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
    </nav>
  )
}