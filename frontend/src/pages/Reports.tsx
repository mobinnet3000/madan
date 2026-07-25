import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileSpreadsheet, Download, BarChart2, Activity as ActivityIcon,
  TrendingUp, TrendingDown, Clock, ArrowUp, ArrowDown, Minus,
} from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { useAuth } from '../store/AuthContext'
import { fetchAllLogs } from '../api/logs'
import { exportToExcel, exportToPdf } from '../utils'
import type { DeviceLog, LogFilters } from '../types'
import { Loading, EmptyState, ErrorBanner, TableSkeleton } from '../components/ui/States'
import Pagination from '../components/ui/Pagination'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import { formatDate, formatNumber, formatPercent, rangeBounds, ReportRange } from '../utils'
import {
  Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, AreaChart, Area, Legend, Line, ComposedChart, RadialBarChart, RadialBar,
} from 'recharts'

const C = { brand: '#f97316', emerald: '#10b981', sky: '#0ea5e9', violet: '#8b5cf6', amber: '#f59e0b', rose: '#f43f5e', slate: '#94a3b8', brandLight: '#fff7ed', emeraldLight: '#ecfdf5', skyLight: '#f0f9ff', violetLight: '#f5f3ff', roseLight: '#fff1f2' }

const PIE_COLORS = ['#0ea5e9', '#10b981', '#f97316', '#8b5cf6', '#ec4899', '#f59e0b']

const chartStyle = { fontFamily: 'Vazirmatn, sans-serif', borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 12, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)' }
const chartStyleDark = { fontFamily: 'Vazirmatn, sans-serif', borderRadius: 14, border: '1px solid #334155', fontSize: 12, background: 'rgba(15,23,42,0.95)' }

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

function TrendIcon({ value, invert }: { value: number; invert?: boolean }) {
  if (value === 0) return <Minus className="h-3.5 w-3.5 text-ink-400" />
  const positive = invert ? value < 0 : value > 0
  return positive
    ? <ArrowUp className="h-3.5 w-3.5 text-emerald-500" />
    : <ArrowDown className="h-3.5 w-3.5 text-rose-500" />
}

function KpiCard({ icon, label, value, decimals, suffix, trend, trendLabel, accentBg, delay }: {
  icon: React.ReactNode; label: string; value: number; decimals?: number; suffix?: string;
  trend?: number; trendLabel?: string; accentBg?: string; delay?: number
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay ?? 0, duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl border border-ink-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 hover:shadow-lg transition-shadow">
      <div className={`absolute -left-4 -top-4 h-24 w-24 rounded-full ${accentBg} opacity-40 blur-2xl`} />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentBg}`}>
            {icon}
          </div>
          {trend !== undefined && (
            <div className="flex items-center gap-1 text-xs font-semibold">
              <TrendIcon value={trend} />
              <span className={trend > 0 ? 'text-emerald-500' : trend < 0 ? 'text-rose-500' : 'text-ink-400'}>
                {Math.abs(Math.round(trend))}٪
              </span>
            </div>
          )}
        </div>
        <div className="text-xs font-medium text-ink-400 dark:text-slate-500">{label}</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <AnimatedNumber value={value} decimals={decimals ?? 0} className="text-2xl font-extrabold text-ink-900 dark:text-white" />
          {suffix && <span className="text-sm font-medium text-ink-500 dark:text-slate-400">{suffix}</span>}
        </div>
        {trendLabel && <div className="mt-1 text-[11px] text-ink-400 dark:text-slate-500">{trendLabel}</div>}
      </div>
    </motion.div>
  )
}

function computeStats(logs: DeviceLog[], range: ReportRange) {
  const totalFeed = logs.reduce((s, l) => s + (l.feed_tonnage || 0), 0)
  const totalProduct = logs.reduce((s, l) => s + (l.product_tonnage || 0), 0)
  const totalTailing = logs.reduce((s, l) => s + (l.tailing_tonnage || 0), 0)
  const totalDowntime = logs.reduce((s, l) => s + (l.downtime_hours || 0), 0)
  const totalRuntime = logs.reduce((s, l) => s + (l.runtime_hours || 0), 0)
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
  const lineEfficiency = Object.entries(efficiencyByLine).map(([name, v]) => ({ name, value: Math.round((v.sum / v.count) * 10) / 10 }))

  const shiftCounts = logs.reduce((acc, l) => { const s = l.shift?.name || 'بدون شیفت'; acc[s] = (acc[s] || 0) + 1; return acc }, {} as Record<string, number>)
  const shiftPieData = Object.entries(shiftCounts).map(([name, value]) => ({ name, value }))

  const failureStats = logs.reduce((acc, l) => {
    const cause = l.failure_cause?.title || null
    if (!cause) return acc
    if (!acc[cause]) acc[cause] = { name: cause, توقف: 0, count: 0 }
    acc[cause].توقف += l.downtime_hours
    acc[cause].count += 1
    return acc
  }, {} as Record<string, { name: string; توقف: number; count: number }>)
  const failureData = Object.values(failureStats).sort((a, b) => b.توقف - a.توقف)

  const lineUtil = logs.reduce((acc, l) => {
    if (!l.line?.name) return acc
    if (!acc[l.line.name]) acc[l.line.name] = { name: l.line.name, کارکرد: 0, توقف: 0 }
    acc[l.line.name].کارکرد += l.runtime_hours
    acc[l.line.name].توقف += l.downtime_hours
    return acc
  }, {} as Record<string, { name: string; کارکرد: number; توقف: number }>)

  const avgEffByDate = tonnageData.map(d => ({ name: d.name, راندمان: d.راندمان }))

  return { totalFeed, totalProduct, totalTailing, totalDowntime, totalRuntime, avgEff, tonnageData, lineEfficiency, shiftPieData, failureData, lineUtilData: Object.values(lineUtil), avgEffByDate, logCount: logs.length }
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
  const [filters] = useState<LogFilters>({})
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [range, setRange] = useState<ReportRange>('daily')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)

  const load = useCallback(async () => {
    setLoading(true)
    const bounds = rangeBounds(range)
    const merged: any = { ...filters, date_from: bounds.from, date_to: bounds.to }
    if (lineIds.length) merged.lines = lineIds.join(',')
    try {
      const data = await fetchAllLogs(tab === 'charts' ? merged : { ...filters, ...(lineIds.length ? { lines: lineIds.join(',') } : {}) }, 200)
      setLogs(data)
      setError(null)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [filters, range, tab, lineIds])

  useEffect(() => { if (selectedFactory) load() }, [load])

  const stats = useMemo(() => computeStats(logs, range), [logs, range])

  const pageLogs = useMemo(() => {
    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))
    return sorted.slice((page - 1) * pageSize, page * pageSize)
  }, [logs, page, pageSize])
  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize))

  const handleExport = async (type: 'excel' | 'pdf') => {
    setExporting(type)
    setExportOpen(false)
    try {
      const rows: Record<string, string | number>[] = logs.map(l => ({
        'کارخانه': l.line?.factory?.name || '—', 'خط': l.line?.name || '—',
        'شیفت': l.shift?.name || '—', 'دستگاه': l.device?.name || 'بدون',
        'علت خرابی': l.failure_cause?.title || '—', 'تاریخ': l.date,
        'کارکرد': l.runtime_hours, 'توقف': l.downtime_hours,
        'ورودی': l.feed_tonnage, 'خروجی': l.product_tonnage, 'باطله': l.tailing_tonnage,
        'راندمان': l.efficiency ?? 0,
      }))
      const name = `گزارشات_کارخانه_${selectedFactory?.name || ''}`
      if (type === 'excel') {
        await exportToExcel(rows, name)
      } else {
        await exportToPdf(rows, name, `گزارش عملکرد ${selectedFactory?.name || ''}`)
      }
    } finally {
      setExporting(null)
    }
  }

  if (!isAdmin) return <EmptyState icon={<ActivityIcon className="h-10 w-10" />} title="دسترسی غیرمجاز" description="فقط ادمین‌ها می‌توانند گزارش‌ها را مشاهده کنند." />

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900 dark:text-white">گزارش‌ها و تحلیل‌ها</h1>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-slate-400">{selectedFactory?.name} — تمام آمار عملکرد</p>
        </div>
        <div className="relative flex items-center gap-2">
          {exporting ? (
            <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white opacity-70">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              {exporting === 'excel' ? 'در حال خروجی Excel...' : 'در حال خروجی PDF...'}
            </span>
          ) : (
            <div className="relative">
              <button onClick={() => setExportOpen(o => !o)} disabled={logs.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 hover:shadow-md disabled:opacity-50 active:scale-[0.98]">
                <Download className="h-4 w-4" /> خروجی
                <svg className={`h-3.5 w-3.5 transition-transform ${exportOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              <AnimatePresence>
                {exportOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setExportOpen(false)} />
                    <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.12 }} className="absolute left-0 z-40 mt-2 w-48 overflow-hidden rounded-2xl border border-ink-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                      <button onClick={() => handleExport('excel')} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50 dark:text-slate-200 dark:hover:bg-slate-800">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> خروجی Excel
                      </button>
                      <button onClick={() => handleExport('pdf')} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50 dark:text-slate-200 dark:hover:bg-slate-800">
                        <svg className="h-4 w-4 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                        خروجی PDF
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Tab + Range */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 rounded-xl bg-ink-100 p-1 dark:bg-slate-800">
          {(['charts', 'logs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === t ? 'bg-white text-ink-900 shadow dark:bg-slate-700 dark:text-white' : 'text-ink-500 hover:text-ink-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
              {t === 'charts' ? 'نمودارها' : 'داده‌های خام'}
            </button>
          ))}
        </div>
        {tab === 'charts' && (
          <div className="flex gap-1.5 rounded-xl bg-ink-100 p-1 dark:bg-slate-800">
            {(['daily', 'weekly', 'monthly'] as const).map(r => (
              <button key={r} onClick={() => { setRange(r); setPage(1) }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${range === r ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-brand-400' : 'text-ink-500 hover:text-ink-700 dark:text-slate-400'}`}>
                {r === 'daily' ? '۳۰ روز' : r === 'weekly' ? '۱۲ هفته' : '۱۲ ماه'}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
              className="h-32 animate-pulse rounded-2xl border border-ink-100 bg-white dark:border-slate-700 dark:bg-slate-900" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard icon={<TrendingUp className="h-5 w-5 text-brand-600" />} label="تناژ ورودی" value={stats.totalFeed / 1000} decimals={1} suffix="هزار تن" trendLabel={`${formatNumber(stats.logCount)} رکورد`} accentBg="bg-brand-50 dark:bg-brand-950/30" delay={0} />
          <KpiCard icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} label="تناژ خروجی" value={stats.totalProduct / 1000} decimals={1} suffix="هزار تن"
            trend={stats.totalFeed > 0 ? ((stats.totalProduct / stats.totalFeed) - 0.7) * 100 : 0}
            trendLabel={`بازدهی ${formatPercent(stats.totalFeed > 0 ? (stats.totalProduct / stats.totalFeed) * 100 : null)}`}
            accentBg="bg-emerald-50 dark:bg-emerald-950/30" delay={0.05} />
          <KpiCard icon={<TrendingDown className="h-5 w-5 text-amber-600" />} label="تناژ باطله" value={stats.totalTailing / 1000} decimals={1} suffix="هزار تن"
            trendLabel={`${formatPercent(stats.totalFeed > 0 ? (stats.totalTailing / stats.totalFeed) * 100 : null)} کل ورودی`}
            accentBg="bg-amber-50 dark:bg-amber-950/30" delay={0.1} />
                    <KpiCard icon={<ActivityIcon className="h-5 w-5 text-sky-600" />} label="راندمان میانگین" value={stats.avgEff ?? 0} decimals={1} suffix="٪"
            trendLabel="بر اساس کل گزارش‌ها" accentBg="bg-sky-50 dark:bg-sky-950/30" delay={0.15} />
          <KpiCard icon={<Clock className="h-5 w-5 text-rose-600" />} label="توقف کل" value={stats.totalDowntime} decimals={0} suffix="ساعت"
            trendLabel={`${formatNumber(stats.totalRuntime)} ساعت کارکرد`}
            accentBg="bg-rose-50 dark:bg-rose-950/30" delay={0.2} />
          <KpiCard icon={<BarChart2 className="h-5 w-5 text-violet-600" />} label="گزارش ثبت‌شده" value={stats.logCount} decimals={0} suffix="مورد"
            trendLabel={`${Object.keys(stats.lineEfficiency).length} خط فعال`}
            accentBg="bg-violet-50 dark:bg-violet-950/30" delay={0.25} />
        </div>
      )}

      <AnimatePresence mode="wait">
        {tab === 'charts' ? (
          <motion.div key="charts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Main Tonnage Chart */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="border-b border-ink-100 px-6 py-4 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-ink-900 dark:text-white">روند تناژ تولید</h3>
                    <p className="text-xs text-ink-400 dark:text-slate-500">ورودی، خروجی و باطله بر اساس بازه زمانی</p>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: C.slate }} />ورودی</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: C.emerald }} />خروجی</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: C.amber }} />باطله</span>
                  </div>
                </div>
              </div>
              <div className="p-4">
                {loading ? <div className="h-80 animate-pulse bg-ink-50 dark:bg-slate-800 rounded-xl" /> :
                  stats.tonnageData.length === 0 ? <EmptyState icon={<BarChart2 className="h-8 w-8" />} title="داده‌ای وجود ندارد" /> : (
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={stats.tonnageData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradFeed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.slate} stopOpacity={0.9} /><stop offset="100%" stopColor={C.slate} stopOpacity={0.4} />
                        </linearGradient>
                        <linearGradient id="gradProduct" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.emerald} stopOpacity={0.9} /><stop offset="100%" stopColor={C.emerald} stopOpacity={0.4} />
                        </linearGradient>
                        <linearGradient id="gradTailing" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.amber} stopOpacity={0.9} /><stop offset="100%" stopColor={C.amber} stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => getGroupLabel(v, range)} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={chartStyle} labelFormatter={(v) => getGroupLabel(v, range)} formatter={(v: number, n: string) => [formatNumber(Math.round(v)) + ' تن', n]} cursor={{ fill: 'rgba(241,245,249,0.6)' }} />
                      <Bar dataKey="ورودی" fill="url(#gradFeed)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="خروجی" fill="url(#gradProduct)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="باطله" fill="url(#gradTailing)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>

            {/* Efficiency Trend + Line Efficiency */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-3">
                <div className="border-b border-ink-100 px-6 py-4 dark:border-slate-700">
                  <h3 className="text-sm font-bold text-ink-900 dark:text-white">روند راندمان</h3>
                  <p className="text-xs text-ink-400 dark:text-slate-500">میانگین راندمان در بازه انتخابی</p>
                </div>
                <div className="p-4">
                  {stats.avgEffByDate.length === 0 ? <EmptyState title="داده نیست" /> : (
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={stats.avgEffByDate} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gradEff" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={C.brand} stopOpacity={0.3} /><stop offset="100%" stopColor={C.brand} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => getGroupLabel(v, range)} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} domain={[0, 100]} />
                        <Tooltip contentStyle={chartStyle} labelFormatter={(v) => getGroupLabel(v, range)} formatter={(v: number) => [`${v}٪`, 'راندمان']} />
                        <Area type="monotone" dataKey="راندمان" stroke={C.brand} fill="url(#gradEff)" strokeWidth={2.5} dot={{ r: 3, fill: C.brand, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-2">
                <div className="border-b border-ink-100 px-6 py-4 dark:border-slate-700">
                  <h3 className="text-sm font-bold text-ink-900 dark:text-white">راندمان خطوط</h3>
                </div>
                <div className="p-4">
                  {stats.lineEfficiency.length === 0 ? <EmptyState title="داده نیست" /> : (
                    <div className="space-y-3">
                      {stats.lineEfficiency.sort((a, b) => b.value - a.value).map((item, i) => (
                        <div key={item.name}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="font-medium text-ink-700 dark:text-slate-300">{item.name}</span>
                            <span className="font-bold text-ink-800 dark:text-white">{item.value}٪</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-ink-100 dark:bg-slate-800">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(item.value, 100)}%` }}
                              transition={{ delay: 0.3 + i * 0.05, duration: 0.6, ease: 'easeOut' }}
                              className={`h-full rounded-full ${item.value >= 75 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : item.value >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-rose-400 to-rose-500'}`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Shift Pie + Failure + Line Util */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="border-b border-ink-100 px-6 py-4 dark:border-slate-700">
                  <h3 className="text-sm font-bold text-ink-900 dark:text-white">توزیع شیفت‌ها</h3>
                </div>
                <div className="flex flex-col items-center p-4">
                  {stats.shiftPieData.length === 0 ? <EmptyState title="داده نیست" /> : (
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={stats.shiftPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={4} stroke="none"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {stats.shiftPieData.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                          </Pie>
                          <Tooltip contentStyle={chartStyle} formatter={(v: number) => [`${v} رکورد`, '']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    {stats.shiftPieData.map((item, i) => (
                      <span key={i} className="flex items-center gap-1.5 text-xs text-ink-600 dark:text-slate-400">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {item.name}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="border-b border-ink-100 px-6 py-4 dark:border-slate-700">
                  <h3 className="text-sm font-bold text-ink-900 dark:text-white">توقف به تفکیک علت</h3>
                </div>
                <div className="p-4">
                  {stats.failureData.length === 0 ? <EmptyState title="داده نیست" /> : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.failureData.slice(0, 5)} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={90} />
                          <Tooltip contentStyle={chartStyle} formatter={(v: number) => [`${formatNumber(Math.round(v))} ساعت`, 'توقف']} />
                          <Bar dataKey="توقف" fill={C.rose} radius={[0, 8, 8, 0]} maxBarSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="border-b border-ink-100 px-6 py-4 dark:border-slate-700">
                  <h3 className="text-sm font-bold text-ink-900 dark:text-white">کارکرد / توقف خطوط</h3>
                </div>
                <div className="p-4">
                  {stats.lineUtilData.length === 0 ? <EmptyState title="داده نیست" /> : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.lineUtilData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={chartStyle} formatter={(v: number) => [`${formatNumber(Math.round(v))} ساعت`, '']} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="کارکرد" name="کارکرد" stackId="a" fill={C.emerald} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="توقف" name="توقف" stackId="a" fill={C.rose} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-600 dark:text-slate-400">{formatNumber(logs.length)} رکورد</span>
                <div className="flex gap-2">
                  <button onClick={() => handleExport('excel')} disabled={exporting !== null || logs.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 hover:shadow-md disabled:opacity-50 active:scale-[0.98]">
                    <FileSpreadsheet className="h-4 w-4" /> Excel
                  </button>
                  <button onClick={() => handleExport('pdf')} disabled={exporting !== null || logs.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 hover:shadow-md disabled:opacity-50 active:scale-[0.98]">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                    PDF
                  </button>
                </div>
              </div>
            </div>

            {loading ? <TableSkeleton columns={9} /> : logs.length === 0 ? (
              <EmptyState icon={<FileSpreadsheet className="h-10 w-10" />} title="گزارشی یافت نشد" description="داده‌ای با فیلترهای فعلی موجود نیست." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-100 bg-ink-50/80 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
                        <th className="px-4 py-3 font-semibold">تاریخ</th><th className="px-4 py-3 font-semibold">خط</th>
                        <th className="px-4 py-3 font-semibold">شیفت</th><th className="px-4 py-3 font-semibold">ورودی</th>
                        <th className="px-4 py-3 font-semibold">خروجی</th><th className="px-4 py-3 font-semibold">کارکرد</th>
                        <th className="px-4 py-3 font-semibold">توقف</th><th className="px-4 py-3 font-semibold">راندمان</th>
                        <th className="px-4 py-3 font-semibold">علت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 dark:divide-slate-700/50">
                      {pageLogs.map((l, i) => (
                        <motion.tr key={l.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.01, 0.3) }}
                          className={`transition-colors hover:bg-ink-50/60 dark:hover:bg-slate-800/40 ${l.efficiency != null && l.efficiency < 40 ? 'bg-rose-50/30 dark:bg-rose-950/10' : l.efficiency != null && l.efficiency > 80 ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''}`}>
                          <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">{formatDate(l.date)}</td>
                          <td className="px-4 py-3 dark:text-slate-300">{l.line?.name}</td>
                          <td className="px-4 py-3 dark:text-slate-400">{l.shift?.name}</td>
                          <td className="px-4 py-3 dark:text-slate-300">{formatNumber(l.feed_tonnage)}</td>
                          <td className="px-4 py-3 dark:text-slate-300">{formatNumber(l.product_tonnage)}</td>
                          <td className="px-4 py-3">{formatNumber(l.runtime_hours)}</td>
                          <td className="px-4 py-3">{l.downtime_hours > 0 ? <span className="font-semibold text-rose-600">{formatNumber(l.downtime_hours)}</span> : <span className="text-ink-300">—</span>}</td>
                          <td className="px-4 py-3">
                            {l.efficiency != null ? (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${l.efficiency >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : l.efficiency >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'}`}>
                                {l.efficiency.toFixed(1)}٪
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-ink-500 dark:text-slate-400">{l.failure_cause?.title || '—'}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {logs.length > pageSize && (
                  <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 dark:border-slate-700">
                    <span className="text-xs text-ink-400">صفحه {page} از {totalPages} — {formatNumber(logs.length)} رکورد</span>
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
