import { Loader2, Inbox, AlertTriangle } from 'lucide-react'

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />
}

export function Loading({ label = 'در حال بارگذاری...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-ink-400 dark:text-slate-400">
      <Spinner className="h-8 w-8 text-brand-500" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-ink-200/70 dark:bg-slate-700/70 ${className}`} />
  )
}

export function CardSkeleton() {
  return (
    <div className="card p-5 space-y-4">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <div className="flex gap-3">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-ink-100 bg-ink-50/60 px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-ink-100 px-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 py-3">
            {Array.from({ length: columns }).map((__, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-ink-300 bg-ink-50/50 py-20 text-center dark:border-slate-700 dark:bg-slate-900/50">
      {icon ? (
        <div className="text-ink-300 dark:text-slate-600">{icon}</div>
      ) : (
        <Inbox className="h-12 w-12 text-ink-300 dark:text-slate-600" />
      )}
      <div className="text-sm font-bold text-ink-600 dark:text-slate-300">{title}</div>
      {description && (
        <p className="max-w-sm text-xs leading-relaxed text-ink-400 dark:text-slate-500">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline">
          تلاش مجدد
        </button>
      )}
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink-200 border-t-brand-500 dark:border-slate-700 dark:border-t-brand-400" />
        <span className="text-xs font-medium text-ink-400 dark:text-slate-500">در حال بارگذاری...</span>
      </div>
    </div>
  )
}
