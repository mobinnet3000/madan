import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileSpreadsheet, Download, BarChart2, Activity as ActivityIcon, TrendingUp, Clock } from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { useAuth } from '../store/AuthContext'
import { fetchAllLogs } from '../api/logs'
import { exportToExcel } from '../utils'
import type { DeviceLog, LogFilters } from '../types'
import { Loading, EmptyState, ErrorBanner, CardSkeleton, TableSkeleton } from '../components/ui/States'
import Pagination from '../components/ui/Pagination'
import { formatDate, formatNumber, formatPercent, rangeBounds, ReportRange } from '../utils'
import {
  Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts'

const COLORS = { brand: '#f97316', emerald: '#10b981', sky: '#0ea5e9', violet: '#8b5cf6', amber: '#f59e0b', rose: '#f43f5e', slate: '#94a3b8' }
const PIE_COLORS = ['#0ea5e9', '#10b981', '#f97316', '#8b5cf6', '#ec4899']

const tooltipStyle = { fontFamily: 'Vazirmatn, sans-serif', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, background: '#fff' }

function SummaryCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="card flex items-center gap-4 p-4 transition hover:shadow-md">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-ink-400">{label}</div>
        <div className="truncate text-xl font-extrabold text-ink-800 dark:text-slate-100">{value}</div>
        {sub && <div className="text-[11px] text-ink-400">{sub}</div>}
      </div>
    </div>
  )
}

function getGroupKey(date: string, range: ReportRange): string {
  if (range === 'daily') return date
  const d = new Date(date)
  if (range === 'weekly') {
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const day = tmp.getUTCDay() || 7
    tmp.setUTCDate(tmp.getUTCDate() + 4 - day)
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
    const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getGroupLabel(key: string, range: ReportRange): string {
  if (range === 'daily') return formatDate(key)
  if (range === 'weekly') { const [, w] = key.split('-W'); return `هفته ${w}` }
  const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
  const [, m] = key.split('-')
  return `${months[Number(m) - 1] || ''}`
}

function computeStats(logs: DeviceLog[], range: ReportRange) {
  const totalFeed = logs.reduce((s, l) => s + (l.feed_tonnage || 0), 0)
  const totalProduct = logs.reduce((s, l) => s + (l.product_tonnage || 0), 0)
  const totalDowntime = logs.reduce((s, l) => s + (l.downtime_hours || 0), 0)
  const effs = logs.filter(l => l.efficiency != null).map(l => l.efficiency!)
  const avgEff = effs.length ? effs.reduce((a, b) => a + b, 0) / effs.length : null

  const tonnageByDate = logs.reduce((acc, l) => {
    const key = getGroupKey(l.date, range)
    if (!acc[key]) acc[key] = { name: key, ورودی: 0, خروجی: 0, باطله: 0, راندمان: [] as number[] }
    acc[key].ورودی += l.feed_tonnage
    acc[key].خروجی += l.product_tonnage
    acc[key].باطله += l.tailing_tonnage
    if (l.efficiency != null) acc[key].راندمان.push(l.efficiency)
    return acc
  }, {} as Record<string, any>)

  const tonnageData = Object.values(tonnageByDate)
    .map((d: any) => ({ ...d, راندمان: d.راندمان.length ? Math.round((d.راندمان.reduce((a: number, b: number) => a + b, 0) / d.راندمان.length) * 10) / 10 : null }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name))

  const efficiencyByLine = logs.reduce((acc, l) => {
    if (!l.line?.name || l.efficiency == null) return acc
    if (!acc[l.line.name]) acc[l.line.name] = { sum: 0, count: 0 }
    acc[l.line.name].sum += l.efficiency
    acc[l.line.name].count += 1
    return acc
  }, {} as Record<string, { sum: number; count: number }>)

  const lineEfficiency = Object.entries(efficiencyByLine).map(([name, v]) => ({ name, راندمان: Math.round((v.sum / v.count) * 10) / 10 }))

  const shiftCounts = logs.reduce((acc, l) => {
    const s = l.shift?.name || 'بدون شیفت'
    acc[s] = (acc[s] || 0) + 1; return acc
  }, {} as Record<string, number>)
  const shiftPieData = Object.entries(shiftCounts).map(([name, value]) => ({ name, value }))

  const failureStats = logs.reduce((acc, l) => {
    const cause = l.failure_cause?.title || 'بدون خرابی'
    if (!acc[cause]) acc[cause] = { name: cause, توقف: 0, تناژ_ازدست: 0 }
    acc[cause].توقف += l.downtime_hours
    acc[cause].تناژ_ازدست += l.downtime_hours > 0 ? (l.feed_tonnage * (l.downtime_hours / 8)) : 0
    return acc
  }, {} as Record<string, { name: string; توقف: number; تناژ_ازدست: number }>)
  const failureData = Object.values(failureStats).sort((a, b) => b.توقف - a.توقف)

  const downtimeByLine = logs.reduce((acc, l) => {
    if (!l.line?.name) return acc
    if (!acc[l.line.name]) acc[l.line.name] = { name: l.line.name, توقف: 0, کارکرد: 0 }
    acc[l.line.name].توقف += l.downtime_hours
    acc[l.line.name].کارکرد += l.runtime_hours
    return acc
  }, {} as Record<string, { name: string; توقف: number; کارکرد: number }>)
  const lineUtilData = Object.values(downtimeByLine)

  return { totalFeed, totalProduct, totalDowntime, avgEff, tonnageData, lineEfficiency, shiftPieData, failureData, lineUtilData, logCount: logs.length }
}

export default function Reports() {
  const { selectedFactory } = useFactory()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.is_superuser
  const lineIds = useMemo(() => (selectedFactory?.lines ?? []).map(l => l.id), [selectedFactory])

  const [tab, setTab] = useState<'charts' | 'logs'>('charts')
  const [logs, setLogs] = useState<DeviceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<LogFilters>({})
  const [exporting, setExporting] = useState(false)
  const [range, setRange] = useState<ReportRange>('daily')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)

  const load = useCallback(async () => {
    setLoading(true)
    const bounds = rangeBounds(range)
    const merged: any = { ...filters, date_from: bounds.from, date_to: bounds.to }
    if (lineIds.length) merged.lines = lineIds.join(',')

    if (tab === 'logs') {
      const q = { ...filters }
      if (lineIds.length) (q as any).lines = lineIds.join(',')
      try {
        const data = await fetchAllLogs(q, 200)
        setLogs(data.filter(l => !lineIds.length || lineIds.includes(l.line.id)))
        setError(null)
      } catch (e: any) { setError(e.message) }
      finally { setLoading(false) }
    } else {
      try {
        const data = await fetchAllLogs(merged, 120)
        setLogs(data)
        setError(null)
      } catch (e: any) { setError(e.message) }
      finally { setLoading(false) }
    }
  }, [selectedFactory, filters, range, tab, lineIds])

  useEffect(() => { if (selectedFactory) load() }, [load])

  const stats = useMemo(() => computeStats(logs, range), [logs, range])

  const pageLogs = useMemo(() => {
    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))
    const start = (page - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [logs, page, pageSize])

  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize))

  const handleExport = async () => {
    setExporting(true)
    try {
      const rows: Record<string, string | number>[] = logs.map(l => ({
        'کارخانه': l.line?.factory?.name || '—',
        'خط': l.line?.name || '—',
        'شیفت': l.shift?.name || '—',
        'دستگاه': l.device?.name || 'بدون',
        'علت خرابی': l.failure_cause?.title || '—',
        'تاریخ': l.date,
        'کارکرد': l.runtime_hours,
        'توقف': l.downtime_hours,
        'ورودی': l.feed_tonnage,
        'خروجی': l.product_tonnage,
        'باطله': l.tailing_tonnage,
        'راندمان': l.efficiency ?? 0,
      }))
      await exportToExcel(rows, `گزارشات_کارخانه_${selectedFactory?.name || ''}`)
    } finally { setExporting(false) }
  }

  if (!isAdmin) {
    return <EmptyState icon={<ActivityIcon className="h-10 w-10" />} title="دسترسی غیرمجاز" description="فقط ادمین‌ها می‌توانند گزارش‌ها را مشاهده کنند." />
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900 dark:text-slate-100">گزارش‌ها و تحلیل‌ها</h1>
          <p className="text-sm text-ink-500">آمار تجمیعی، نمودارهای عملکرد و خروجی Excel برای {selectedFactory?.name}</p>
        </div>
        <div className="flex gap-2">
          {(['charts', 'logs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`btn-outline ${tab === t ? 'bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-950/30 dark:border-brand-600 dark:text-brand-400' : ''}`}>
              {t === 'charts' ? 'نمودارها' : 'داده‌های خام'}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div> : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard icon={<TrendingUp className="h-6 w-6 text-brand-600" />} label="تناژ ورودی" value={`${formatNumber(Math.round(stats.totalFeed / 1000))} هزار تن`} sub={formatNumber(stats.logCount) + ' رکورد'} accent="bg-brand-50 dark:bg-brand-950/30" />
          <SummaryCard icon={<TrendingUp className="h-6 w-6 text-emerald-600" />} label="تناژ خروجی" value={`${formatNumber(Math.round(stats.totalProduct / 1000))} هزار تن`} sub={`${formatPercent(stats.totalProduct / (stats.totalFeed || 1) * 100)} بازدهی`} accent="bg-emerald-50 dark:bg-emerald-950/30" />
          <SummaryCard icon={<ActivityIcon className="h-6 w-6 text-sky-600" />} label="میانگین راندمان" value={formatPercent(stats.avgEff)} sub={`از ${stats.logCount} گزارش`} accent="bg-sky-50 dark:bg-sky-950/30" />
          <SummaryCard icon={<Clock className="h-6 w-6 text-rose-600" />} label="مجموع توقف" value={`${formatNumber(Math.round(stats.totalDowntime))} ساعت`} sub={stats.totalFeed ? `${formatPercent(stats.totalDowntime / (stats.totalFeed / 200))}٪ توقف` : '—'} accent="bg-rose-50 dark:bg-rose-950/30" />
        </div>
      )}

      <AnimatePresence mode="wait">
        {tab === 'charts' ? (
          <motion.div key="charts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="card p-5">
              <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-base font-bold text-ink-900 dark:text-slate-100">نمودارهای عملکرد</h2>
                  <p className="text-xs text-ink-500">روند تناژ و راندمان بر اساس بازه زمانی</p>
                </div>
                <div className="flex gap-2">
                  {(['daily', 'weekly', 'monthly'] as const).map(r => (
                    <button key={r} onClick={() => { setRange(r); setPage(1) }}
                      className={`btn-outline !py-1.5 !px-3 text-xs ${range === r ? 'bg-brand-50 border-brand-500 text-brand-700 dark:bg-brand-950/30 dark:border-brand-600 dark:text-brand-400' : ''}`}>
                      {r === 'daily' ? '۳۰ روز' : r === 'weekly' ? '۱۲ هفته' : '۱۲ ماه'}
                    </button>
                  ))}
                </div>
              </div>

              {stats.tonnageData.length === 0 ? <EmptyState icon={<BarChart2 className="h-10 w-10" />} title="داده‌ای وجود ندارد" description={`برای بازه ${range === 'daily' ? '۳۰ روزه' : range === 'weekly' ? '۱۲ هفته' : '۱۲ ماهه'} داده‌ای ثبت نشده.`} /> : (
                <>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.tonnageData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => getGroupLabel(v, range)} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => getGroupLabel(v, range)} formatter={(v: number, n) => [formatNumber(Math.round(v)) + ' تن', n]} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="ورودی" name="ورودی" fill={COLORS.slate} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="خروجی" name="خروجی" fill={COLORS.emerald} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="باطله" name="باطله" fill={COLORS.amber} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-5 h-56">
                    <h4 className="mb-2 text-xs font-bold text-ink-600 dark:text-slate-400">روند راندمان</h4>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.tonnageData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => getGroupLabel(v, range)} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, 100]} />
                        <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => getGroupLabel(v, range)} formatter={(v: number) => [`${v}٪`, 'راندمان']} />
                        <Area type="monotone" dataKey="راندمان" stroke={COLORS.brand} fill={COLORS.brand} fillOpacity={0.1} strokeWidth={2.5} dot={{ r: 3 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="card p-5">
                <h3 className="mb-4 text-sm font-bold text-ink-700 dark:text-slate-200">راندمان به تفکیک خط</h3>
                {stats.lineEfficiency.length === 0 ? <EmptyState title="داده نیست" /> : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.lineEfficiency} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, 100]} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}٪`, 'راندمان']} />
                        <Bar dataKey="راندمان" fill={COLORS.brand} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="card p-5">
                <h3 className="mb-4 text-sm font-bold text-ink-700 dark:text-slate-200">توزیع شیفت‌ها</h3>
                {stats.shiftPieData.length === 0 ? <EmptyState title="داده نیست" /> : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stats.shiftPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                          {stats.shiftPieData.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="card p-5">
                <h3 className="mb-4 text-sm font-bold text-ink-700 dark:text-slate-200">ساعات توقف به تفکیک علت</h3>
                {stats.failureData.length === 0 ? <EmptyState title="داده نیست" /> : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.failureData} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} width={100} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${formatNumber(Math.round(v))} ساعت`, '']} />
                        <Bar dataKey="توقف" fill={COLORS.rose} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="card p-5">
                <h3 className="mb-4 text-sm font-bold text-ink-700 dark:text-slate-200">کارکرد / توقف به تفکیک خط</h3>
                {stats.lineUtilData.length === 0 ? <EmptyState title="داده نیست" /> : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.lineUtilData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${formatNumber(Math.round(v))} ساعت`, '']} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="کارکرد" name="کارکرد" stackId="a" fill={COLORS.emerald} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="توقف" name="توقف" stackId="a" fill={COLORS.rose} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-600"><FileSpreadsheet className="h-4 w-4" /> {formatNumber(stats.logCount)} رکورد</div>
              <div className="flex gap-2">
                <button onClick={handleExport} className="btn-outline" disabled={exporting || logs.length === 0}>
                  <Download className="h-4 w-4" /> {exporting ? 'در حال خروجی...' : 'خروجی Excel'}
                </button>
              </div>
            </div>

            {loading ? <TableSkeleton columns={9} /> : logs.length === 0 ? (
              <EmptyState icon={<FileSpreadsheet className="h-10 w-10" />} title="گزارشی یافت نشد" description="با فیلترهای فعلی رکوردی وجود ندارد." />
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                        <th className="px-4 py-3 font-semibold">تاریخ</th><th className="px-4 py-3 font-semibold">خط</th>
                        <th className="px-4 py-3 font-semibold">شیفت</th><th className="px-4 py-3 font-semibold">ورودی</th>
                        <th className="px-4 py-3 font-semibold">خروجی</th><th className="px-4 py-3 font-semibold">کارکرد</th>
                        <th className="px-4 py-3 font-semibold">توقف</th><th className="px-4 py-3 font-semibold">راندمان</th>
                        <th className="px-4 py-3 font-semibold">علت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                      {pageLogs.map(l => (
                        <tr key={l.id} className={`transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50 ${l.efficiency != null && l.efficiency < 40 ? 'bg-rose-50/40 dark:bg-rose-950/20' : l.efficiency != null && l.efficiency > 80 ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''}`}>
                          <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">{formatDate(l.date)}</td>
                          <td className="px-4 py-3 dark:text-slate-300">{l.line?.name}</td>
                          <td className="px-4 py-3 dark:text-slate-400">{l.shift?.name}</td>
                          <td className="px-4 py-3 dark:text-slate-300">{formatNumber(l.feed_tonnage)}</td>
                          <td className="px-4 py-3 dark:text-slate-300">{formatNumber(l.product_tonnage)}</td>
                          <td className="px-4 py-3">{formatNumber(l.runtime_hours)}</td>
                          <td className="px-4 py-3">{l.downtime_hours > 0 ? <span className="text-rose-600">{formatNumber(l.downtime_hours)}</span> : '—'}</td>
                          <td className="px-4 py-3"><span className={`font-bold ${l.efficiency != null && l.efficiency < 40 ? 'text-rose-600' : l.efficiency != null && l.efficiency > 80 ? 'text-emerald-600' : 'text-ink-600 dark:text-slate-300'}`}>{formatPercent(l.efficiency)}</span></td>
                          <td className="px-4 py-3 text-ink-500 dark:text-slate-400">{l.failure_cause?.title || <span className="text-ink-300">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {logs.length > pageSize && (
                  <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 dark:border-slate-700">
                    <span className="text-xs text-ink-400">نمایش {Math.min((page - 1) * pageSize + 1, logs.length)} تا {Math.min(page * pageSize, logs.length)} از {formatNumber(logs.length)} رکورد</span>
                    <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
