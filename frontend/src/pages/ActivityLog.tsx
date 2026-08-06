import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ScrollText, Search, ShieldCheck, Filter, X, Activity as ActivityIcon } from 'lucide-react'
import { useAuth } from '../store/AuthContext'
import { api } from '../api/client'
import type { ActivityLogEntry } from '../types'
import { Loading, EmptyState, ErrorBanner } from '../components/ui/States'
import { formatDate } from '../utils'
import { ROLE_BADGE } from '../constants'

const ACTION_LABELS: Record<string, string> = {
  login: 'ورود', logout: 'خروج', create: 'ایجاد', update: 'ویرایش', delete: 'حذف',
}

const ACTION_STYLE: Record<string, string> = {
  login: 'bg-emerald-100 text-emerald-700', logout: 'bg-slate-100 text-slate-600',
  create: 'bg-brand-100 text-brand-700', update: 'bg-sky-100 text-sky-700',
  delete: 'bg-rose-100 text-rose-700',
}

export default function ActivityLog() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.is_superuser

  const [logs, setLogs] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [action, setAction] = useState('')

  const load = () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (action) params.action = action
    api.get('/activity-logs/', { params })
      .then((res) => setLogs(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (isAdmin) load() }, [isAdmin, action])

  const filtered = useMemo(() => {
    if (!q) return logs
    const term = q.trim().toLowerCase()
    return logs.filter(
      (l) =>
        (l.username || '').toLowerCase().includes(term) ||
        (l.model_name || '').toLowerCase().includes(term) ||
        (l.object_repr || '').toLowerCase().includes(term) ||
        (l.description || '').toLowerCase().includes(term),
    )
  }, [logs, q])

  if (!isAdmin) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-10 w-10" />}
        title="دسترسی غیرمجاز"
        description="فقط ادمین می‌تواند لاگ فعالیت‌های سیستم را مشاهده کند."
      />
    )
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900 dark:text-slate-100">لاگ فعالیت‌ها (Audit Trail)</h1>
          <p className="text-sm text-ink-500">ثبت تمام عملیات کاربران برای ممیزی و پایش دسترسی‌ها</p>
        </div>
        <span className="badge bg-rose-100 text-rose-700">مدیریت کامل</span>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input className="input pr-10" placeholder="جستجو در کاربر، مدل، شرح..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="min-w-[140px]">
          <label className="label">نوع عملیات</label>
          <select className="input" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">همه</option>
            <option value="create">ایجاد</option><option value="update">ویرایش</option>
            <option value="delete">حذف</option><option value="login">ورود</option><option value="logout">خروج</option>
          </select>
        </div>
        <button className="btn-ghost" onClick={() => { setQ(''); setAction('') }}><X className="h-4 w-4" /> پاک کردن</button>
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-10 w-10" />} title="رکوردی یافت نشد"
          description="هنوز فعالیتی ثبت نشده یا با فیلترهای فعلی هم‌خوانی ندارد." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">زمان</th><th className="px-4 py-3 font-semibold">کاربر</th>
                  <th className="px-4 py-3 font-semibold">نقش</th><th className="px-4 py-3 font-semibold">عملیات</th>
                  <th className="px-4 py-3 font-semibold">مدل</th><th className="px-4 py-3 font-semibold">شرح</th>
                  <th className="px-4 py-3 font-semibold">کارخانه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                {filtered.map((l, i) => (
                  <motion.tr
                    key={l.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.01, 0.2) }}
                    className="transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3 text-[11px] text-ink-600 dark:text-slate-400">{l.timestamp_jalali || new Date(l.timestamp).toLocaleString('fa-IR')}</td>
                    <td className="px-4 py-3"><div className="font-medium text-ink-800 dark:text-slate-200">{l.username}</div></td>
                    <td className="px-4 py-3"><span className={`badge ${ROLE_BADGE[(l.role || 'operator') as keyof typeof ROLE_BADGE] || ROLE_BADGE.operator}`}>{l.role || 'اپراتور'}</span></td>
                    <td className="px-4 py-3"><span className={`badge ${ACTION_STYLE[l.action] || 'bg-ink-100 text-ink-600'}`}>{ACTION_LABELS[l.action] || l.action}</span></td>
                    <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-300">{l.model_name}</td>
                    <td className="max-w-[280px] truncate px-4 py-3 text-ink-600 dark:text-slate-400" title={l.description}>{l.description || l.object_repr || '—'}</td>
                    <td className="px-4 py-3 text-ink-500 dark:text-slate-500">{l.factory_name || 'همه'}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
