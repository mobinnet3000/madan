import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileSpreadsheet, Download, BarChart2, Activity as ActivityIcon,
  TrendingUp, Clock, ChevronDown, FileText, Building2, Calendar,
} from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { useAuth } from '../store/AuthContext'
import { fetchAllLogs } from '../api/logs'
import { fetchAllAnalyses } from '../api/analysis'
import { exportToExcel, exportToPdf } from '../utils'
import type { DeviceLog, LogFilters, DeviceDailyAnalysis, AnalysisFilters } from '../types'
import { Loading, EmptyState, ErrorBanner, CardSkeleton, TableSkeleton } from '../components/ui/States'
import Pagination from '../components/ui/Pagination'
import AnimatedNumber from '../components/ui/AnimatedNumber'
import { formatDate, formatNumber, formatPercent, todayISO } from '../utils'

const C = { brand: '#f97316', emerald: '#10b981', sky: '#0ea5e9', violet: '#8b5cf6', amber: '#f59e0b', rose: '#f43f5e', slate: '#94a3b8' }
const PIE = ['#0ea5e9', '#10b981', '#f97316', '#8b5cf6', '#ec4899']

type DataType = 'logs' | 'analysis'
type ReportPeriod = '1d' | '1w' | '1m' | '3m' | '6m' | '1y' | 'all' | 'custom'

const PERIOD_LABELS: Record<ReportPeriod, string> = { '1d': '۱ روز', '1w': '۱ هفته', '1m': '۱ ماه', '3m': '۳ ماه', '6m': '۶ ماه', '1y': '۱ سال', 'all': 'همه', 'custom': 'سفارشی' }

function getDateRange(p: ReportPeriod): { from: string; to: string } {
  const to = todayISO()
  const d = new Date()
  const days = { '1d': 1, '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365, 'all': 3650, 'custom': 30 }
  d.setDate(d.getDate() - (days[p] || 30))
  return { from: d.toISOString().split('T')[0], to }
}

function KpiCard({ icon, label, value, suffix, accentBg, delay }: { icon: React.ReactNode; label: string; value: string; suffix?: string; accentBg?: string; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay ?? 0, duration: 0.35 }}
      className="relative overflow-hidden rounded-2xl border border-ink-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 hover:shadow-lg transition-shadow">
      <div className={`absolute -left-4 -top-4 h-24 w-24 rounded-full ${accentBg || 'bg-brand-50'} opacity-30 blur-2xl`} />
      <div className="relative">
        <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${accentBg || 'bg-brand-50'}`}>{icon}</div>
        <div className="text-xs font-medium text-ink-400 dark:text-slate-500">{label}</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-ink-900 dark:text-white">{value}</span>
          {suffix && <span className="text-sm font-medium text-ink-500 dark:text-slate-400">{suffix}</span>}
        </div>
      </div>
    </motion.div>
  )
}

function ReportHeader({ factoryName, factoryAddress, dateFrom, dateTo, dataType, period }: { factoryName: string; factoryAddress?: string; dateFrom: string; dateTo: string; dataType: DataType; period: ReportPeriod }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-gradient-to-br from-brand-50 to-white p-6 dark:border-slate-700 dark:from-slate-900 dark:to-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg">
            <Building2 className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-ink-900 dark:text-white">{factoryName}</h2>
            {factoryAddress && <p className="mt-0.5 text-sm text-ink-500 dark:text-slate-400">{factoryAddress}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-ink-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> بازه: {formatDate(dateFrom)} تا {formatDate(dateTo)}</span>
              <span className="flex items-center gap-1.5"><ActivityIcon className="h-3.5 w-3.5" /> {dataType === 'logs' ? 'گزارش عملکرد خطوط' : 'گزارش آنالیز دستگاه‌ها'}</span>
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {PERIOD_LABELS[period]}</span>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-white/80 px-4 py-2 text-left text-xs text-ink-400 shadow-sm dark:bg-slate-800/80 dark:text-slate-500">
          <div>تاریخ خروجی: {new Date().toLocaleDateString('fa-IR')}</div>
          <div>ساعت: {new Date().toLocaleTimeString('fa-IR')}</div>
        </div>
      </div>
    </div>
  )
}

function getRangeDays(p: ReportPeriod): number {
  return { '1d': 1, '1w': 7, '1m': 30, '3m': 90, '6m': 180, '1y': 365, 'all': 3650, 'custom': 30 }[p] || 30
}

export default function Reports() {
  const { selectedFactory } = useFactory()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.is_superuser
  const lineIds = useMemo(() => (selectedFactory?.lines ?? []).map(l => l.id), [selectedFactory])
  const analyzerIds = useMemo(() => (selectedFactory?.lines ?? []).flatMap(l => l.devices).filter(d => d.is_analyzer).map(d => d.id), [selectedFactory])

  const [dataType, setDataType] = useState<DataType>('logs')
  const [tab, setTab] = useState<'charts' | 'logs'>('charts')
  const [period, setPeriod] = useState<ReportPeriod>('1m')
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const [logs, setLogs] = useState<DeviceLog[]>([])
  const [analyses, setAnalyses] = useState<DeviceDailyAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const pageSize = 50

  const loadLogs = useCallback(async () => {
    const { from, to } = getDateRange(period)
    const q: any = { date_from: from, date_to: to }
    if (lineIds.length) q.lines = lineIds.join(',')
    const data = await fetchAllLogs(q, 200)
    return data.filter((l: DeviceLog) => !lineIds.length || lineIds.includes(l.line.id))
  }, [period, lineIds])

  const loadAnalyses = useCallback(async () => {
    const { from, to } = getDateRange(period)
    const q: any = { date_from: from, date_to: to }
    if (analyzerIds.length) q.devices = analyzerIds.join(',')
    const data = await fetchAllAnalyses(q, 200)
    return data.filter((a: DeviceDailyAnalysis) => !analyzerIds.length || analyzerIds.includes(a.device.id))
  }, [period, analyzerIds])

  const load = useCallback(async () => {
    setLoading(true)
    setPage(1)
    try {
      if (dataType === 'logs') setLogs(await loadLogs())
      else setAnalyses(await loadAnalyses())
      setError(null)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [dataType, loadLogs, loadAnalyses])

  useEffect(() => { if (selectedFactory) load() }, [selectedFactory, load])

  const logsStats = useMemo(() => {
    const totalFeed = logs.reduce((s, l) => s + (l.feed_tonnage || 0), 0)
    const totalProduct = logs.reduce((s, l) => s + (l.product_tonnage || 0), 0)
    const totalDowntime = logs.reduce((s, l) => s + (l.downtime_hours || 0), 0)
    const effs = logs.filter(l => l.efficiency != null).map(l => l.efficiency!)
    const avgEff = effs.length ? effs.reduce((a, b) => a + b, 0) / effs.length : null

    const byDate = logs.reduce((acc, l) => {
      if (!acc[l.date]) acc[l.date] = { name: l.date, feed: 0, product: 0, tailing: 0, effs: [] as number[] }
      acc[l.date].feed += l.feed_tonnage
      acc[l.date].product += l.product_tonnage
      acc[l.date].tailing += l.tailing_tonnage
      if (l.efficiency != null) acc[l.date].effs.push(l.efficiency)
      return acc
    }, {} as Record<string, any>)
    const trend = Object.values(byDate).map((d: any) => ({ ...d, efficiency: d.effs.length ? Math.round(d.effs.reduce((a: number, b: number) => a + b, 0) / d.effs.length * 10) / 10 : null })).sort((a: any, b: any) => a.name.localeCompare(b.name))

    const byLine = logs.reduce((acc, l) => {
      if (!l.line?.name || l.efficiency == null) return acc
      if (!acc[l.line.name]) acc[l.line.name] = { sum: 0, count: 0 }
      acc[l.line.name].sum += l.efficiency; acc[l.line.name].count += 1
      return acc
    }, {} as Record<string, { sum: number; count: number }>)
    const lineEff = Object.entries(byLine).map(([n, v]) => ({ name: n, value: Math.round(v.sum / v.count * 10) / 10 }))

    const byShift = logs.reduce((acc, l) => { const s = l.shift?.name || 'بدون'; acc[s] = (acc[s] || 0) + 1; return acc }, {} as Record<string, number>)
    const shiftData = Object.entries(byShift).map(([n, v]) => ({ name: n, value: v }))

    const byFailure = logs.reduce((acc, l) => {
      const c = l.failure_cause?.title; if (!c) return acc
      if (!acc[c]) acc[c] = 0; acc[c] += l.downtime_hours; return acc
    }, {} as Record<string, number>)
    const failureData = Object.entries(byFailure).map(([n, v]) => ({ name: n, توقف: Math.round(v) })).sort((a, b) => b.توقف - a.توقف)

    return { totalFeed, totalProduct, totalDowntime, avgEff, trend, lineEff, shiftData, failureData, count: logs.length }
  }, [logs])

  const anStats = useMemo(() => {
    const byDate = analyses.reduce((acc, a) => {
      if (!acc[a.date]) acc[a.date] = { name: a.date, feed: 0, tailing: 0, product: 0, count: 0 }
      if (a.sample_point === 'feed') acc[a.date].feed += a.value_1 || 0
      if (a.sample_point === 'tailing') acc[a.date].tailing += a.value_1 || 0
      if (a.sample_point === 'product') acc[a.date].product += a.value_1 || 0
      acc[a.date].count += 1
      return acc
    }, {} as Record<string, any>)
    const trend = Object.values(byDate).sort((a: any, b: any) => a.name.localeCompare(b.name))

    const byDevice = analyses.reduce((acc, a) => {
      const n = a.device?.name || 'بدون'; if (!acc[n]) acc[n] = { count: 0, avg1: 0, avg2: 0 }
      acc[n].count += 1; acc[n].avg1 += a.value_1 || 0; acc[n].avg2 += a.value_2 || 0
      return acc
    }, {} as Record<string, { count: number; avg1: number; avg2: number }>)
    const deviceData = Object.entries(byDevice).map(([n, v]) => ({ name: n, value: Math.round(v.avg1 / v.count * 10) / 10 }))

    const byPoint = analyses.reduce((acc, a) => {
      const p = a.sample_point || 'بدون'
      if (!acc[p]) acc[p] = 0; acc[p] += 1; return acc
    }, {} as Record<string, number>)
    const pointData = Object.entries(byPoint).map(([n, v]) => ({ name: n === 'feed' ? 'خوراک' : n === 'tailing' ? 'باطله' : n === 'product' ? 'محصول' : n, value: v }))

    return { trend, deviceData, pointData, count: analyses.length }
  }, [analyses])

  const { from, to } = getDateRange(period)

  const pageItems = useMemo(() => {
    const items = dataType === 'logs' ? logs : analyses
    const sorted = [...items].sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''))
    return sorted.slice((page - 1) * pageSize, page * pageSize)
  }, [dataType, logs, analyses, page, pageSize])
  const totalItems = dataType === 'logs' ? logs.length : analyses.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentData = dataType === 'logs' ? logsStats : anStats

  const handleExport = async (type: 'excel' | 'pdf') => {
    setExporting(type); setExportOpen(false)
    try {
      const name = `${dataType === 'logs' ? 'گزارش_عملکرد' : 'گزارش_آنالیز'}_${selectedFactory?.name || ''}`
      const title = `${selectedFactory?.name || ''} — ${dataType === 'logs' ? 'گزارش عملکرد خطوط' : 'گزارش آنالیز دستگاه‌ها'} — بازه ${formatDate(from)} تا ${formatDate(to)}`

      if (dataType === 'logs') {
        const rows: Record<string, string | number>[] = logs.map(l => ({
          'تاریخ': l.date, 'خط': l.line?.name || '—', 'شیفت': l.shift?.name || '—',
          'دستگاه': l.device?.name || '—', 'علت خرابی': l.failure_cause?.title || '—',
          'کارکرد': l.runtime_hours, 'توقف': l.downtime_hours,
          'ورودی': l.feed_tonnage, 'خروجی': l.product_tonnage, 'باطله': l.tailing_tonnage,
          'راندمان': l.efficiency ?? 0,
        }))
        if (type === 'excel') await exportToExcel(rows, name)
        else await exportToPdf(rows, name, title)
      } else {
        const rows: Record<string, string | number>[] = analyses.map(a => ({
          'تاریخ': a.date, 'دستگاه': a.device?.name || '—', 'شیفت': a.shift?.name || '—',
          'نقطه نمونه': a.sample_point || '—', 'پارامتر ۱': a.value_1 ?? 0, 'پارامتر ۲': a.value_2 ?? 0,
          'شرح': a.analysis_text || '—',
        }))
        if (type === 'excel') await exportToExcel(rows, name)
        else await exportToPdf(rows, name, title)
      }
    } finally { setExporting(null) }
  }

  if (!isAdmin) return <EmptyState icon={<ActivityIcon className="h-10 w-10" />} title="دسترسی غیرمجاز" description="فقط ادمین‌ها می‌توانند گزارش‌ها را مشاهده کنند." />

  return (
    <div className="animate-fade-in space-y-6">
      {/* Report Header */}
      <ReportHeader factoryName={selectedFactory?.name || ''} factoryAddress={selectedFactory?.address} dateFrom={from} dateTo={to} dataType={dataType} period={period} />

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 rounded-xl bg-ink-100 p-1 dark:bg-slate-800">
          {(['logs', 'analysis'] as const).map(t => (
            <button key={t} onClick={() => setDataType(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${dataType === t ? 'bg-white text-ink-900 shadow dark:bg-slate-700 dark:text-white' : 'text-ink-500 hover:text-ink-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
              {t === 'logs' ? 'گزارش عملکرد' : 'گزارش آنالیز'}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 rounded-xl bg-ink-100 p-1 dark:bg-slate-800">
          {(['charts', 'logs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${tab === t ? 'bg-white text-ink-900 shadow dark:bg-slate-700 dark:text-white' : 'text-ink-500 hover:text-ink-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
              {t === 'charts' ? 'نمودارها' : 'داده‌ها'}
            </button>
          ))}
        </div>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-1.5">
        {(['1d', '1w', '1m', '3m', '6m', '1y', 'all'] as ReportPeriod[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${period === p ? 'bg-brand-500 text-white shadow-sm' : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : dataType === 'logs' ? (
        <AnimatePresence mode="wait">
          <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {tab === 'charts' ? (
              <div className="space-y-6">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <KpiCard icon={<TrendingUp className="h-5 w-5 text-brand-600" />} label="مجموع تناژ ورودی" value={formatNumber(Math.round(logsStats.totalFeed / 1000)) + ' هزار'} suffix="تن" accentBg="bg-brand-50" delay={0} />
                  <KpiCard icon={<ActivityIcon className="h-5 w-5 text-emerald-600" />} label="میانگین راندمان" value={formatPercent(logsStats.avgEff)} accentBg="bg-emerald-50" delay={0.05} />
                  <KpiCard icon={<Clock className="h-5 w-5 text-rose-600" />} label="مجموع ساعات توقف" value={formatNumber(Math.round(logsStats.totalDowntime))} suffix="ساعت" accentBg="bg-rose-50" delay={0.1} />
                  <KpiCard icon={<FileText className="h-5 w-5 text-sky-600" />} label="تعداد رکوردها" value={formatNumber(logsStats.count)} suffix="مورد" accentBg="bg-sky-50" delay={0.15} />
                </motion.div>
                {logsStats.count === 0 ? <EmptyState icon={<BarChart2 className="h-10 w-10" />} title="داده‌ای وجود ندارد" description={`برای بازه ${PERIOD_LABELS[period]} داده‌ای ثبت نشده است.`} /> : (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <h4 className="mb-3 text-sm font-bold text-ink-800 dark:text-slate-200">روند راندمان</h4>
                      {logsStats.trend.length === 0 ? <div className="py-10 text-center text-xs text-ink-400">داده نیست</div> : (
                        <div className="space-y-2">
                          {logsStats.trend.slice(-14).map((d: any) => (
                            <div key={d.name} className="flex items-center gap-3 text-xs">
                              <span className="w-20 shrink-0 text-ink-500">{formatDate(d.name)}</span>
                              <div className="flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-slate-800">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(d.efficiency || 0, 100)}%` }}
                                  transition={{ duration: 0.5 }} className={`h-2.5 rounded-full ${(d.efficiency || 0) >= 75 ? 'bg-emerald-400' : (d.efficiency || 0) >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`} />
                              </div>
                              <span className="w-12 text-right font-bold text-ink-700 dark:text-slate-300">{d.efficiency != null ? `${d.efficiency}٪` : '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <h4 className="mb-3 text-sm font-bold text-ink-800 dark:text-slate-200">راندمان خطوط</h4>
                      {logsStats.lineEff.length === 0 ? <div className="py-10 text-center text-xs text-ink-400">داده نیست</div> : (
                        <div className="space-y-3">
                          {logsStats.lineEff.sort((a, b) => b.value - a.value).map((item, i) => (
                            <div key={item.name}>
                              <div className="mb-1 flex justify-between text-xs"><span className="text-ink-600 dark:text-slate-400">{item.name}</span><span className="font-bold text-ink-800 dark:text-white">{item.value}٪</span></div>
                              <div className="h-2.5 overflow-hidden rounded-full bg-ink-100 dark:bg-slate-800">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(item.value, 100)}%` }} transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
                                  className={`h-full rounded-full ${item.value >= 75 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : item.value >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-rose-400 to-rose-500'}`} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <span className="text-sm font-semibold text-ink-600 dark:text-slate-400">{formatNumber(totalItems)} رکورد</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleExport('excel')} disabled={exporting !== null || logs.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-600 disabled:opacity-50"><FileSpreadsheet className="h-4 w-4" /> Excel</button>
                    <button onClick={() => handleExport('pdf')} disabled={exporting !== null || logs.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-rose-600 disabled:opacity-50"><FileText className="h-4 w-4" /> PDF</button>
                  </div>
                </div>
                {totalItems === 0 ? <EmptyState title="گزارشی یافت نشد" /> : (
                  <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-ink-100 bg-ink-50/80 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
                          <th className="px-4 py-3 font-semibold">تاریخ</th><th className="px-4 py-3 font-semibold">خط</th><th className="px-4 py-3 font-semibold">شیفت</th>
                          <th className="px-4 py-3 font-semibold">ورودی</th><th className="px-4 py-3 font-semibold">خروجی</th>
                          <th className="px-4 py-3 font-semibold">کارکرد</th><th className="px-4 py-3 font-semibold">توقف</th><th className="px-4 py-3 font-semibold">راندمان</th>
                        </tr></thead>
                        <tbody className="divide-y divide-ink-100 dark:divide-slate-700/50">
                          {(pageItems as DeviceLog[]).map(l => (
                            <tr key={l.id} className={`transition hover:bg-ink-50/40 dark:hover:bg-slate-800/40 ${l.efficiency != null && l.efficiency < 40 ? 'bg-rose-50/30' : l.efficiency != null && l.efficiency > 80 ? 'bg-emerald-50/30' : ''}`}>
                              <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">{formatDate(l.date)}</td>
                              <td className="px-4 py-3 dark:text-slate-300">{l.line?.name}</td>
                              <td className="px-4 py-3 dark:text-slate-400">{l.shift?.name}</td>
                              <td className="px-4 py-3 dark:text-slate-300">{formatNumber(l.feed_tonnage)}</td>
                              <td className="px-4 py-3 dark:text-slate-300">{formatNumber(l.product_tonnage)}</td>
                              <td className="px-4 py-3">{formatNumber(l.runtime_hours)}</td>
                              <td className="px-4 py-3">{l.downtime_hours > 0 ? <span className="font-semibold text-rose-600">{formatNumber(l.downtime_hours)}</span> : '—'}</td>
                              <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${(l.efficiency || 0) >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40' : (l.efficiency || 0) >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40'}`}>{l.efficiency != null ? `${l.efficiency.toFixed(1)}٪` : '—'}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 dark:border-slate-700"><span className="text-xs text-ink-400">صفحه {page} از {totalPages}</span><Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} /></div>}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key="analysis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {tab === 'charts' ? (
              <div className="space-y-6">
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <KpiCard icon={<TrendingUp className="h-5 w-5 text-violet-600" />} label="مجموع آنالیزها" value={formatNumber(anStats.count)} suffix="مورد" accentBg="bg-violet-50" delay={0} />
                  <KpiCard icon={<ActivityIcon className="h-5 w-5 text-emerald-600" />} label="دستگاه‌های آنالایزور" value={formatNumber(analyzerIds.length)} suffix="دستگاه" accentBg="bg-emerald-50" delay={0.05} />
                  <KpiCard icon={<Clock className="h-5 w-5 text-sky-600" />} label="نقاط نمونه‌برداری" value={formatNumber(anStats.pointData.length)} suffix="نقطه" accentBg="bg-sky-50" delay={0.1} />
                  <KpiCard icon={<Calendar className="h-5 w-5 text-brand-600" />} label="بازه زمانی" value={`${getRangeDays(period)} روز`} accentBg="bg-brand-50" delay={0.15} />
                </motion.div>
                {anStats.count === 0 ? <EmptyState icon={<BarChart2 className="h-10 w-10" />} title="داده‌ای وجود ندارد" /> : (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <h4 className="mb-3 text-sm font-bold text-ink-800 dark:text-slate-200">میانگین پارامتر ۱ به تفکیک دستگاه</h4>
                      {anStats.deviceData.length === 0 ? <EmptyState title="داده نیست" /> : (
                        <div className="space-y-3">
                          {anStats.deviceData.sort((a, b) => b.value - a.value).map((item, i) => (
                            <div key={item.name}>
                              <div className="mb-1 flex justify-between text-xs"><span className="text-ink-600 dark:text-slate-400">{item.name}</span><span className="font-bold text-ink-800 dark:text-white">{item.value}</span></div>
                              <div className="h-2.5 overflow-hidden rounded-full bg-ink-100 dark:bg-slate-800">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(item.value * 10, 100)}%` }} transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
                                  className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-500" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <h4 className="mb-3 text-sm font-bold text-ink-800 dark:text-slate-200">توزیع نقاط نمونه‌برداری</h4>
                      {anStats.pointData.length === 0 ? <EmptyState title="داده نیست" /> : (
                        <div className="space-y-3">
                          {anStats.pointData.map((item, i) => (
                            <div key={item.name}>
                              <div className="mb-1 flex justify-between text-xs"><span className="text-ink-600 dark:text-slate-400">{item.name}</span><span className="font-bold text-ink-800 dark:text-white">{item.value} مورد</span></div>
                              <div className="h-3 overflow-hidden rounded-full bg-ink-100 dark:bg-slate-800">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${(item.value / Math.max(...anStats.pointData.map(d => d.value))) * 100}%` }} transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
                                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-500" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <span className="text-sm font-semibold text-ink-600 dark:text-slate-400">{formatNumber(totalItems)} رکورد</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleExport('excel')} disabled={exporting !== null || analyses.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-600 disabled:opacity-50"><FileSpreadsheet className="h-4 w-4" /> Excel</button>
                    <button onClick={() => handleExport('pdf')} disabled={exporting !== null || analyses.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-rose-600 disabled:opacity-50"><FileText className="h-4 w-4" /> PDF</button>
                  </div>
                </div>
                {totalItems === 0 ? <EmptyState title="آنالیزی یافت نشد" /> : (
                  <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-ink-100 bg-ink-50/80 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
                          <th className="px-4 py-3 font-semibold">تاریخ</th><th className="px-4 py-3 font-semibold">دستگاه</th><th className="px-4 py-3 font-semibold">شیفت</th>
                          <th className="px-4 py-3 font-semibold">نقطه</th><th className="px-4 py-3 font-semibold">پارامتر ۱</th><th className="px-4 py-3 font-semibold">پارامتر ۲</th><th className="px-4 py-3 font-semibold">شرح</th>
                        </tr></thead>
                        <tbody className="divide-y divide-ink-100 dark:divide-slate-700/50">
                          {(pageItems as DeviceDailyAnalysis[]).map(a => (
                            <tr key={a.id} className="transition hover:bg-ink-50/40 dark:hover:bg-slate-800/40">
                              <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">{formatDate(a.date)}</td>
                              <td className="px-4 py-3 dark:text-slate-300">{a.device?.name}</td>
                              <td className="px-4 py-3 dark:text-slate-400">{a.shift?.name || '—'}</td>
                              <td className="px-4 py-3"><span className={`badge ${a.sample_point === 'feed' ? 'bg-amber-100 text-amber-700' : a.sample_point === 'tailing' ? 'bg-rose-100 text-rose-700' : a.sample_point === 'product' ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>{a.sample_point === 'feed' ? 'خوراک' : a.sample_point === 'tailing' ? 'باطله' : a.sample_point === 'product' ? 'محصول' : '—'}</span></td>
                              <td className="px-4 py-3 dark:text-slate-300">{a.value_1 != null ? a.value_1 : '—'}</td>
                              <td className="px-4 py-3 dark:text-slate-300">{a.value_2 != null ? a.value_2 : '—'}</td>
                              <td className="max-w-[200px] truncate px-4 py-3 text-ink-500 dark:text-slate-400" title={a.analysis_text || ''}>{a.analysis_text || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 dark:border-slate-700"><span className="text-xs text-ink-400">صفحه {page} از {totalPages}</span><Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} /></div>}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Export Loading Overlay */}
      <AnimatePresence>
        {exporting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/30 backdrop-blur-sm">
            <div className="flex items-center gap-4 rounded-2xl bg-white px-8 py-6 shadow-2xl dark:bg-slate-900">
              <svg className="h-6 w-6 animate-spin text-brand-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              <div>
                <div className="text-sm font-bold text-ink-800 dark:text-slate-200">در حال خروجی‌گیری...</div>
                <div className="text-xs text-ink-500">{exporting === 'excel' ? 'فایل Excel در حال آماده‌سازی' : 'فایل PDF در حال آماده‌سازی'}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
