import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  FileSpreadsheet, FileText, BarChart2, Activity as ActivityIcon,
  TrendingUp, Clock, Building2, Calendar,
} from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { useAuth } from '../store/AuthContext'
import { fetchAllLogs } from '../api/logs'
import { fetchAllAnalyses } from '../api/analysis'
import { downloadPerformanceReport, downloadAnalysisReport } from '../api/reports'
import type { DeviceLog, DeviceDailyAnalysis } from '../types'
import { Loading, EmptyState, ErrorBanner, CardSkeleton } from '../components/ui/States'
import Pagination from '../components/ui/Pagination'
import { formatDate, formatNumber, formatPercent, todayISO } from '../utils'

type DataType = 'logs' | 'analysis'

// ── بازه‌های زمانی مشخص ──
const PRESETS = [
  { label: 'امروز',           key: 'today' as const },
  { label: 'دیروز',           key: 'yesterday' as const },
  { label: 'این هفته',        key: 'this_week' as const },
  { label: 'هفته قبل',        key: 'last_week' as const },
  { label: 'این ماه',         key: 'this_month' as const },
  { label: 'ماه قبل',         key: 'last_month' as const },
  { label: 'امسال',           key: 'this_year' as const },
  { label: '۷ روز',           key: '7days' as const },
  { label: '۳۰ روز',          key: '30days' as const },
  { label: '۹۰ روز',          key: '90days' as const },
  { label: 'یک سال',          key: '365days' as const },
  { label: 'همه',             key: 'all' as const },
]

function KpiCard({ icon, label, value, suffix, accentBg }: { icon: React.ReactNode; label: string; value: string; suffix?: string; accentBg?: string }) {
  return (
    <div className="card-glass overflow-hidden p-4 sm:p-5">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${accentBg || 'bg-brand-50'}`}>{icon}</div>
      <div className="text-xs font-medium text-ink-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-xl sm:text-2xl font-extrabold text-ink-900 dark:text-white">{value}</span>
        {suffix && <span className="text-sm font-medium text-ink-500">{suffix}</span>}
      </div>
    </div>
  )
}

export default function Reports() {
  const { selectedFactory } = useFactory()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.is_superuser
  const factoryId = selectedFactory?.id ?? null
  const factoryName = selectedFactory?.name ?? ''
  const factoryAddr = selectedFactory?.address ?? ''
  const lineIds = useMemo(() => (selectedFactory?.lines ?? []).map(l => l.id), [selectedFactory])
  const analyzerIds = useMemo(() => (selectedFactory?.lines ?? []).flatMap(l => l.devices).filter(d => d.is_analyzer).map(d => d.id), [selectedFactory])

  const [dataType, setDataType] = useState<DataType>('logs')
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)

  const todayStr = useMemo(() => todayISO(), [])
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })
  const [dateTo, setDateTo] = useState(todayStr)
  const [activePreset, setActivePreset] = useState<string>('30days')

  const [logs, setLogs] = useState<DeviceLog[]>([])
  const [analyses, setAnalyses] = useState<DeviceDailyAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 50

  // ── انتخاب بازه ──
  const applyPreset = (key: string) => {
    setActivePreset(key)
    setPage(1)
    // dateFrom/dateTo توسط بک‌اند بر اساس range key اعمال می‌شود
  }

  const applyCustomDate = (from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
    setActivePreset('custom')
    setPage(1)
  }

  const loadLogs = useCallback(async () => {
    const q: any = { date_from: dateFrom, date_to: dateTo }
    if (lineIds.length) q.lines = lineIds.join(',')
    const data = await fetchAllLogs(q, 200)
    return data.filter((l: DeviceLog) => !lineIds.length || lineIds.includes(l.line.id))
  }, [dateFrom, dateTo, lineIds])

  const loadAnalyses = useCallback(async () => {
    const q: any = { date_from: dateFrom, date_to: dateTo }
    if (analyzerIds.length) q.devices = analyzerIds.join(',')
    const data = await fetchAllAnalyses(q, 200)
    return data.filter((a: DeviceDailyAnalysis) => !analyzerIds.length || analyzerIds.includes(a.device.id))
  }, [dateFrom, dateTo, analyzerIds])

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
      acc[l.date].feed += l.feed_tonnage; acc[l.date].product += l.product_tonnage; acc[l.date].tailing += l.tailing_tonnage
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
    return { totalFeed, totalProduct, totalDowntime, avgEff, trend, lineEff, count: logs.length }
  }, [logs])

  const anStats = useMemo(() => {
    const byDevice = analyses.reduce((acc, a) => {
      const n = a.device?.name || 'بدون'; if (!acc[n]) acc[n] = { count: 0, avg1: 0 }
      acc[n].count += 1; acc[n].avg1 += a.value_1 || 0
      return acc
    }, {} as Record<string, { count: number; avg1: number }>)
    const deviceData = Object.entries(byDevice).map(([n, v]) => ({ name: n, value: Math.round(v.avg1 / v.count * 10) / 10 }))
    const byPoint = analyses.reduce((acc, a) => {
      const p = a.sample_point || 'بدون'; if (!acc[p]) acc[p] = 0; acc[p] += 1; return acc
    }, {} as Record<string, number>)
    const pointData = Object.entries(byPoint).map(([n, v]) => ({ name: n === 'feed' ? 'خوراک' : n === 'tailing' ? 'باطله' : n === 'product' ? 'محصول' : n, value: v }))
    return { deviceData, pointData, count: analyses.length }
  }, [analyses])

  const pageItems = useMemo(() => {
    const items = dataType === 'logs' ? logs : analyses
    const sorted = [...items].sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''))
    return sorted.slice((page - 1) * pageSize, page * pageSize)
  }, [dataType, logs, analyses, page, pageSize])
  const totalItems = dataType === 'logs' ? logs.length : analyses.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  const handleExport = async (type: 'excel' | 'pdf') => {
    setExporting(type)
    try {
      if (dataType === 'logs') {
        await downloadPerformanceReport(factoryId, activePreset, type, dateFrom, dateTo)
      } else {
        await downloadAnalysisReport(factoryId, activePreset, type, dateFrom, dateTo)
      }
    } finally { setExporting(null) }
  }

  if (!isAdmin) return <EmptyState icon={<ActivityIcon className="h-10 w-10" />} title="دسترسی غیرمجاز" description="فقط ادمین‌ها می‌توانند گزارش‌ها را مشاهده کنند." />

  return (
    <div className="animate-fade-in space-y-6">

      {/* ── هدر ── */}
      <div className="card-glass p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, #1e3a5f, #2563eb)' }}>
              <Building2 className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-ink-900 dark:text-white">{factoryName || 'همه کارخانه‌ها'}</h2>
              {factoryAddr && <p className="text-sm text-ink-500">{factoryAddr}</p>}
            </div>
          </div>
          {/* دکمه‌های مستقیم PDF / Excel */}
          <div className="flex items-center gap-2">
            <button onClick={() => handleExport('pdf')} disabled={exporting !== null}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-50">
              {exporting === 'pdf' ? <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <FileText className="h-4 w-4" />}
              PDF
            </button>
            <button onClick={() => handleExport('excel')} disabled={exporting !== null}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-50">
              {exporting === 'excel' ? <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <FileSpreadsheet className="h-4 w-4" />}
              Excel
            </button>
          </div>
        </div>
      </div>

      {/* ── انتخاب نوع گزارش + بازه ── */}
      <div className="card-glass p-5">
        {/* نوع داده */}
        <div className="flex gap-1.5 rounded-xl p-1 w-fit mb-5" style={{ background: 'rgba(241,245,249,0.6)' }}>
          {(['logs', 'analysis'] as const).map(t => (
            <button key={t} onClick={() => setDataType(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${dataType === t ? 'bg-white text-ink-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-ink-500 hover:text-ink-700 dark:text-slate-400'}`}>
              {t === 'logs' ? '📊 گزارش عملکرد' : '🧪 گزارش آنالیز'}
            </button>
          ))}
        </div>

        {/* برچسب بازه */}
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-ink-400" />
          <span className="text-sm font-bold text-ink-700 dark:text-slate-200">بازه گزارش:</span>
          <span className="text-sm text-ink-500">
            {activePreset === 'custom' ? `${formatDate(dateFrom)} تا ${formatDate(dateTo)}` : PRESETS.find(p => p.key === activePreset)?.label || dateFrom}
          </span>
        </div>

        {/* دکمه‌های بازه */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(p => (
            <button key={p.key} onClick={() => applyPreset(p.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${activePreset === p.key ? 'bg-brand-500 text-white shadow-sm' : 'bg-ink-100/70 text-ink-600 hover:bg-ink-200/70 dark:bg-slate-800/70 dark:text-slate-300'}`}>
              {p.label}
            </button>
          ))}
          {/* ورودی سفارشی */}
          <span className="mx-1 self-center text-ink-300 dark:text-slate-600">|</span>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-ink-500">از</label>
            <input type="date" value={dateFrom}
              onChange={e => applyCustomDate(e.target.value, dateTo)}
              className="rounded-lg border px-2 py-1.5 text-xs outline-none transition focus:border-brand-400"
              style={{ background: 'rgba(241,245,249,0.5)', borderColor: activePreset === 'custom' ? '#f97316' : 'rgba(148,163,184,0.3)' }} />
            <label className="text-xs text-ink-500">تا</label>
            <input type="date" value={dateTo}
              onChange={e => applyCustomDate(dateFrom, e.target.value)}
              className="rounded-lg border px-2 py-1.5 text-xs outline-none transition focus:border-brand-400"
              style={{ background: 'rgba(241,245,249,0.5)', borderColor: activePreset === 'custom' ? '#f97316' : 'rgba(148,163,184,0.3)' }} />
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* ── محتوای اصلی ── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : dataType === 'logs' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard icon={<TrendingUp className="h-5 w-5 text-brand-600" />} label="تناژ ورودی" value={formatNumber(Math.round(logsStats.totalFeed / 1000)) + ' هزار'} suffix="تن" accentBg="bg-brand-50" />
            <KpiCard icon={<ActivityIcon className="h-5 w-5 text-emerald-600" />} label="میانگین راندمان" value={formatPercent(logsStats.avgEff)} accentBg="bg-emerald-50" />
            <KpiCard icon={<Clock className="h-5 w-5 text-rose-600" />} label="ساعات توقف" value={formatNumber(Math.round(logsStats.totalDowntime))} suffix="ساعت" accentBg="bg-rose-50" />
            <KpiCard icon={<FileText className="h-5 w-5 text-sky-600" />} label="تعداد رکورد" value={formatNumber(logsStats.count)} suffix="مورد" accentBg="bg-sky-50" />
          </div>

          {logsStats.count === 0 ? <EmptyState icon={<BarChart2 className="h-10 w-10" />} title="داده‌ای وجود ندارد" description={`برای بازه انتخابی داده‌ای ثبت نشده است.`} /> : (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="card-glass p-4 sm:p-5">
                  <h4 className="mb-3 text-sm font-bold text-ink-800 dark:text-slate-200">روند راندمان روزانه</h4>
                  <div className="space-y-1.5">
                    {logsStats.trend.slice(-14).map((d: any) => (
                      <div key={d.name} className="flex items-center gap-3 text-xs">
                        <span className="w-16 shrink-0 text-ink-500">{formatDate(d.name)}</span>
                        <div className="flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-slate-800" style={{ height: '10px' }}>
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(d.efficiency || 0, 100)}%`, background: (d.efficiency || 0) >= 75 ? 'linear-gradient(90deg, #10b981, #34d399)' : (d.efficiency || 0) >= 50 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #f43f5e, #fb7185)' }} />
                        </div>
                        <span className="w-10 text-right font-bold text-ink-700 dark:text-slate-300">{d.efficiency != null ? `${d.efficiency}٪` : '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card-glass p-4 sm:p-5">
                  <h4 className="mb-3 text-sm font-bold text-ink-800 dark:text-slate-200">میانگین راندمان خطوط</h4>
                  {logsStats.lineEff.length === 0 ? <div className="py-10 text-center text-xs text-ink-400">داده نیست</div> : (
                    <div className="space-y-3">
                      {logsStats.lineEff.sort((a, b) => b.value - a.value).map((item, i) => (
                        <div key={item.name}>
                          <div className="mb-1 flex justify-between text-xs"><span className="text-ink-600">{item.name}</span><span className="font-bold text-ink-800 dark:text-white">{item.value}٪</span></div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-ink-100 dark:bg-slate-800">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(item.value, 100)}%` }} transition={{ delay: 0.1 + i * 0.05, duration: 0.5 }}
                              className="h-full rounded-full"
                              style={{ background: item.value >= 75 ? 'linear-gradient(90deg, #10b981, #34d399)' : item.value >= 50 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #f43f5e, #fb7185)' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="card-glass overflow-hidden">
                <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5" style={{ borderColor: 'rgba(148,163,184,0.15)' }}>
                  <span className="text-xs font-semibold text-ink-500"><span className="text-ink-800 dark:text-white">{formatNumber(totalItems)}</span> رکورد</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-right text-xs text-ink-500" style={{ background: 'rgba(241,245,249,0.4)' }}>
                        <th className="px-4 py-3 font-semibold">تاریخ</th><th className="px-4 py-3 font-semibold">خط</th><th className="px-4 py-3 font-semibold">شیفت</th>
                        <th className="px-4 py-3 font-semibold">ورودی</th><th className="px-4 py-3 font-semibold">خروجی</th>
                        <th className="px-4 py-3 font-semibold">کارکرد</th><th className="px-4 py-3 font-semibold">توقف</th><th className="px-4 py-3 font-semibold">راندمان</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'rgba(148,163,184,0.1)' }}>
                      {(pageItems as DeviceLog[]).map(l => (
                        <tr key={l.id} className="transition hover:bg-ink-50/40 dark:hover:bg-white/5"
                          style={(l.efficiency != null && l.efficiency < 40) ? { background: 'rgba(244,63,94,0.04)' } : (l.efficiency != null && l.efficiency > 80) ? { background: 'rgba(16,185,129,0.04)' } : {}}>
                          <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">{formatDate(l.date)}</td>
                          <td className="px-4 py-3 dark:text-slate-300">{l.line?.name}</td>
                          <td className="px-4 py-3 dark:text-slate-400">{l.shift?.name}</td>
                          <td className="px-4 py-3 dark:text-slate-300">{formatNumber(l.feed_tonnage)}</td>
                          <td className="px-4 py-3 dark:text-slate-300">{formatNumber(l.product_tonnage)}</td>
                          <td className="px-4 py-3">{formatNumber(l.runtime_hours)}</td>
                          <td className="px-4 py-3">{l.downtime_hours > 0 ? <span className="font-semibold text-rose-600">{formatNumber(l.downtime_hours)}</span> : '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${(l.efficiency || 0) >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : (l.efficiency || 0) >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'}`}>
                              {l.efficiency != null ? `${l.efficiency.toFixed(1)}٪` : '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: 'rgba(148,163,184,0.15)' }}>
                    <span className="text-xs text-ink-400">صفحه {page} از {totalPages}</span>
                    <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard icon={<BarChart2 className="h-5 w-5 text-violet-600" />} label="کل آنالیزها" value={formatNumber(anStats.count)} suffix="مورد" accentBg="bg-violet-50" />
            <KpiCard icon={<ActivityIcon className="h-5 w-5 text-emerald-600" />} label="دستگاه‌های آنالایزور" value={formatNumber(analyzerIds.length)} suffix="دستگاه" accentBg="bg-emerald-50" />
            <KpiCard icon={<FileText className="h-5 w-5 text-sky-600" />} label="نقاط نمونه‌برداری" value={formatNumber(anStats.pointData.length)} suffix="نقطه" accentBg="bg-sky-50" />
            <KpiCard icon={<Calendar className="h-5 w-5 text-brand-600" />} label="بازه" value={`${formatDate(dateFrom)} تا ${formatDate(dateTo)}`} accentBg="bg-brand-50" />
          </div>

          {anStats.count === 0 ? <EmptyState icon={<BarChart2 className="h-10 w-10" />} title="داده‌ای وجود ندارد" /> : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="card-glass p-5">
                <h4 className="mb-3 text-sm font-bold text-ink-800 dark:text-slate-200">میانگین پارامتر به تفکیک دستگاه</h4>
                <div className="space-y-3">
                  {anStats.deviceData.sort((a, b) => b.value - a.value).map((item, i) => (
                    <div key={item.name}>
                      <div className="mb-1 flex justify-between text-xs"><span className="text-ink-600">{item.name}</span><span className="font-bold text-ink-800">{item.value}</span></div>
                      <div className="h-2.5 rounded-full bg-ink-100 dark:bg-slate-800">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(item.value * 10, 100)}%` }} transition={{ delay: 0.1 + i * 0.05, duration: 0.5 }}
                          className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card-glass p-5">
                <h4 className="mb-3 text-sm font-bold text-ink-800 dark:text-slate-200">توزیع نقاط نمونه‌برداری</h4>
                <div className="space-y-3">
                  {anStats.pointData.map((item, i) => (
                    <div key={item.name}>
                      <div className="mb-1 flex justify-between text-xs"><span className="text-ink-600">{item.name}</span><span className="font-bold text-ink-800">{item.value} مورد</span></div>
                      <div className="h-3 rounded-full bg-ink-100 dark:bg-slate-800">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(item.value / Math.max(...anStats.pointData.map(d => d.value))) * 100}%` }}
                          transition={{ delay: 0.1 + i * 0.05, duration: 0.5 }}
                          className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #06b6d4, #22d3ee)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="card-glass overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5" style={{ borderColor: 'rgba(148,163,184,0.15)' }}>
              <span className="text-xs font-semibold text-ink-500"><span className="text-ink-800 dark:text-white">{formatNumber(totalItems)}</span> رکورد</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right text-xs text-ink-500" style={{ background: 'rgba(241,245,249,0.4)' }}>
                    <th className="px-4 py-3 font-semibold">تاریخ</th><th className="px-4 py-3 font-semibold">دستگاه</th><th className="px-4 py-3 font-semibold">شیفت</th>
                    <th className="px-4 py-3 font-semibold">نقطه</th><th className="px-4 py-3 font-semibold">پارامتر ۱</th><th className="px-4 py-3 font-semibold">پارامتر ۲</th><th className="px-4 py-3 font-semibold">شرح</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'rgba(148,163,184,0.1)' }}>
                  {(pageItems as DeviceDailyAnalysis[]).map(a => (
                    <tr key={a.id} className="transition hover:bg-ink-50/40 dark:hover:bg-white/5">
                      <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">{formatDate(a.date)}</td>
                      <td className="px-4 py-3 dark:text-slate-300">{a.device?.name}</td>
                      <td className="px-4 py-3 dark:text-slate-400">{a.shift?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${a.sample_point === 'feed' ? 'bg-amber-100 text-amber-700' : a.sample_point === 'tailing' ? 'bg-rose-100 text-rose-700' : a.sample_point === 'product' ? 'bg-emerald-100 text-emerald-700' : ''}`}>
                          {a.sample_point === 'feed' ? 'خوراک' : a.sample_point === 'tailing' ? 'باطله' : a.sample_point === 'product' ? 'محصول' : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 dark:text-slate-300">{a.value_1 != null ? a.value_1 : '—'}</td>
                      <td className="px-4 py-3 dark:text-slate-300">{a.value_2 != null ? a.value_2 : '—'}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-ink-500 dark:text-slate-400" title={a.analysis_text || ''}>{a.analysis_text || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: 'rgba(148,163,184,0.15)' }}>
                <span className="text-xs text-ink-400">صفحه {page} از {totalPages}</span>
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
