import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FileSpreadsheet, FileText, BarChart2, Activity as ActivityIcon, TrendingUp, Clock, Building2, Calendar, Search, ArrowUpDown, X, Download } from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { useAuth } from '../store/AuthContext'
import type { DeviceLog } from '../types'
import { Loading, EmptyState, ErrorBanner, CardSkeleton } from '../components/ui/States'
import Pagination from '../components/ui/Pagination'
import { formatDate, formatNumber, formatPercent, formatHours } from '../utils'
import JalaliDateInput from '../components/ui/JalaliDateInput'
import { useReportState } from '../features/reports/useReportState'
import { PRESETS } from '../features/reports/reportFilters'
import { buildDowntimeReport } from '../templates/pdf/reports/downtimeReport'
import { buildPdfHtml } from '../utils/pdf/renderer'
import { htmlToPdf } from '../utils/pdf/printer'
import { exportData } from '../utils/exports'

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
  const factoryName = selectedFactory?.name ?? ''
  const factoryAddr = selectedFactory?.address ?? ''
  const report = useReportState({}, 50)
  const [exporting, setExporting] = useState<string | null>(null)

  const logsStats = useMemo(() => {
    const logs = report.sorted
    const totalFeed = logs.reduce((s, l) => s + (l.feed_tonnage || 0), 0)
    const totalProduct = logs.reduce((s, l) => s + (l.product_tonnage || 0), 0)
    const totalDowntime = logs.reduce((s, l) => s + (l.downtime_hours || 0), 0)
    const effs = logs.filter((l) => l.efficiency != null).map((l) => l.efficiency as number)
    const avgEff = effs.length ? effs.reduce((a, b) => a + b, 0) / effs.length : null
    const byDate = logs.reduce((acc: Record<string, { name: string; feed: number; product: number; tailing: number; effs: number[] }>, l) => {
      if (!acc[l.date]) acc[l.date] = { name: l.date, feed: 0, product: 0, tailing: 0, effs: [] }
      acc[l.date].feed += l.feed_tonnage; acc[l.date].product += l.product_tonnage; acc[l.date].tailing += l.tailing_tonnage
      if (l.efficiency != null) acc[l.date].effs.push(l.efficiency)
      return acc
    }, {})
    const trend = Object.values(byDate).map((d) => ({ ...d, efficiency: d.effs.length ? Math.round(d.effs.reduce((a, b) => a + b, 0) / d.effs.length * 10) / 10 : null })).sort((a, b) => a.name.localeCompare(b.name))
    const byLine = logs.reduce((acc: Record<string, { sum: number; count: number }>, l) => {
      if (!l.line?.name || l.efficiency == null) return acc
      if (!acc[l.line.name]) acc[l.line.name] = { sum: 0, count: 0 }
      acc[l.line.name].sum += l.efficiency; acc[l.line.name].count += 1
      return acc
    }, {})
    const lineEff = Object.entries(byLine).map(([n, v]) => ({ name: n, value: Math.round(v.sum / v.count * 10) / 10 }))
    return { totalFeed, totalProduct, totalDowntime, avgEff, trend, lineEff, count: logs.length }
  }, [report.sorted])

  const handleExport = async (type: 'pdf' | 'xlsx' | 'csv' | 'docx' | 'html' | 'json') => {
    setExporting(type)
    try {
      if (type === 'pdf') {
        const rows = report.sorted.map((l) => ({ date: l.date, line: l.line?.name ?? '—', shift: l.shift?.name ?? '—', device: l.device?.name ?? '—', cause: l.failure_cause?.title ?? '—', downtime_hours: l.downtime_hours, runtime_hours: l.runtime_hours, efficiency: l.efficiency ?? 0 }))
        const opts = buildDowntimeReport({ title: `${factoryName} — توقفات خط تولید — ${formatDate(report.filters.date_from)} تا ${formatDate(report.filters.date_to)}`, factoryName, factoryAddress: factoryAddr, dateFrom: report.filters.date_from, dateTo: report.filters.date_to, rows, chips: report.chips.map((c) => ({ label: c.label, value: c.value })) })
        const html = buildPdfHtml(opts)
        htmlToPdf(html, `توقفات_${factoryName}_${report.filters.date_from}_${report.filters.date_to}`)
      } else {
        const rows: Record<string, string | number>[] = report.sorted.map((l) => ({
          'تاریخ': l.date, 'خط': l.line?.name || '—', 'شیفت': l.shift?.name || '—', 'دستگاه': l.device?.name || '—', 'علت خرابی': l.failure_cause?.title || '—', 'کارکرد': formatHours(l.runtime_hours), 'توقف': formatHours(l.downtime_hours), 'ورودی': l.feed_tonnage, 'خروجی': l.product_tonnage, 'باطله': l.tailing_tonnage, 'راندمان': l.efficiency ?? 0,
        }))
        await exportData(rows, { fileName: `توقفات_${factoryName}`, title: `${factoryName} — توقفات`, factoryName, dateFrom: report.filters.date_from, dateTo: report.filters.date_to, format: type as never })
      }
    } finally { setExporting(null) }
  }

  if (!isAdmin) return <EmptyState icon={<ActivityIcon className="h-10 w-10" />} title="دسترسی غیرمجاز" description="فقط ادمین‌ها می‌توانند گزارش‌ها را مشاهده کنند." />

  return (
    <div className="animate-fade-in space-y-6">
      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-slate-900 dark:bg-white"><Building2 className="h-6 w-6 sm:h-7 sm:w-7 text-white dark:text-slate-900" /></div>
            <div><h2 className="text-lg sm:text-xl font-extrabold text-ink-900 dark:text-white">{factoryName || '—'}</h2>{factoryAddr && <p className="text-sm text-ink-500">{factoryAddr}</p>}<p className="mt-1 text-xs text-ink-400">{formatNumber(report.totalCount)} رکورد</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => handleExport('pdf')} disabled={exporting !== null} className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-50">{exporting === 'pdf' ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <FileText className="h-4 w-4" />} PDF</button>
            <button onClick={() => handleExport('xlsx')} disabled={exporting !== null} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-50">{exporting === 'xlsx' ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <FileSpreadsheet className="h-4 w-4" />} Excel</button>
            <button onClick={() => handleExport('csv')} disabled={exporting !== null} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"><Download className="h-3.5 w-3.5" /> CSV</button>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative"><Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input className="input h-8 pr-8 text-xs" placeholder="جستجو خط، دستگاه، علت..." value={report.filters.search} onChange={(e) => report.setSearch(e.target.value)} /></div>
          <select className="input h-8 min-w-[110px] text-xs" value={report.filters.sortKey} onChange={(e) => report.setSort(e.target.value as never)}><option value="date">تاریخ</option><option value="downtime">توقف</option><option value="runtime">کارکرد</option><option value="line">خط</option><option value="efficiency">راندمان</option></select>
          <button className="btn-ghost !h-8 !px-2" onClick={() => report.setFilter('sortDir', report.filters.sortDir === 'asc' ? 'desc' : 'asc')} title="جهت مرتب‌سازی"><ArrowUpDown className="h-4 w-4" /></button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => <button key={p.key} onClick={() => report.applyPreset(p.key)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{p.label}</button>)}
          <span className="mx-1 self-center text-slate-300 dark:text-slate-600">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">از</span><JalaliDateInput value={report.filters.date_from} onChange={(iso) => report.setFilter('date_from', iso)} />
            <span className="text-xs text-slate-500">تا</span><JalaliDateInput value={report.filters.date_to} onChange={(iso) => report.setFilter('date_to', iso)} />
            {report.chips.length > 0 && <button className="btn-ghost !h-7 !px-2 text-xs" onClick={report.clearFilters}><X className="h-3 w-3" /> پاک کردن</button>}
          </div>
        </div>
        {report.chips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-700">
            {report.chips.map((c, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white dark:bg-white dark:text-slate-900">{c.label}: {c.value} <button onClick={c.onRemove} className="rounded-full p-0.5 hover:bg-white/20"><X className="h-3 w-3" /></button></span>)}
            <span className="text-xs text-slate-500">{formatNumber(report.totalCount)} رکورد</span>
          </div>
        )}
      </div>

      {report.error && <ErrorBanner message={report.error} onRetry={report.reload} />}

      {report.loading ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard icon={<TrendingUp className="h-5 w-5 text-brand-600" />} label="تناژ ورودی" value={formatNumber(Math.round(logsStats.totalFeed / 1000)) + ' هزار'} suffix="تن" accentBg="bg-brand-50" />
            <KpiCard icon={<ActivityIcon className="h-5 w-5 text-emerald-600" />} label="میانگین راندمان" value={formatPercent(logsStats.avgEff)} accentBg="bg-emerald-50" />
            <KpiCard icon={<Clock className="h-5 w-5 text-rose-600" />} label="ساعات توقف" value={formatHours(logsStats.totalDowntime)} accentBg="bg-rose-50" />
            <KpiCard icon={<FileText className="h-5 w-5 text-sky-600" />} label="تعداد رکورد" value={formatNumber(logsStats.count)} suffix="مورد" accentBg="bg-sky-50" />
          </div>

          {logsStats.count === 0 ? <EmptyState icon={<BarChart2 className="h-10 w-10" />} title="داده‌ای وجود ندارد" description={`برای بازه انتخابی داده‌ای ثبت نشده است.`} /> : (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="card-glass p-4 sm:p-5">
                  <h4 className="mb-3 text-sm font-bold text-ink-800 dark:text-slate-200">روند راندمان روزانه</h4>
                  <div className="space-y-1.5">
                    {logsStats.trend.slice(-14).map((d: { name: string; efficiency: number | null }) => (
                      <div key={d.name} className="flex items-center gap-3 text-xs">
                        <span className="w-16 shrink-0 text-ink-500">{formatDate(d.name)}</span>
                        <div className="flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-slate-800" style={{ height: '10px' }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(d.efficiency || 0, 100)}%`, background: (d.efficiency || 0) >= 75 ? 'linear-gradient(90deg, #10b981, #34d399)' : (d.efficiency || 0) >= 50 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #f43f5e, #fb7185)' }} />
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
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(item.value, 100)}%` }} transition={{ delay: 0.1 + i * 0.05, duration: 0.5 }} className="h-full rounded-full" style={{ background: item.value >= 75 ? 'linear-gradient(90deg, #10b981, #34d399)' : item.value >= 50 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #f43f5e, #fb7185)' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="card-glass overflow-hidden">
                <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5" style={{ borderColor: 'rgba(148,163,184,0.15)' }}>
                  <span className="text-xs font-semibold text-ink-500"><span className="text-ink-800 dark:text-white">{formatNumber(report.totalCount)}</span> رکورد (صفحه {report.page} از {report.totalPages} — مرتب: {report.filters.sortKey})</span>
                  <button onClick={() => handleExport('pdf')} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-600"><FileText className="h-3.5 w-3.5" /> PDF از داده مرتب‌شده</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-right text-xs text-slate-500 dark:text-slate-400" style={{ background: 'rgba(241,245,249,0.4)' }}><th className="px-4 py-3 font-semibold">تاریخ</th><th className="px-4 py-3 font-semibold">خط</th><th className="px-4 py-3 font-semibold">شیفت</th><th className="px-4 py-3 font-semibold">ورودی</th><th className="px-4 py-3 font-semibold">خروجی</th><th className="px-4 py-3 font-semibold">کارکرد</th><th className="px-4 py-3 font-semibold">توقف</th><th className="px-4 py-3 font-semibold">راندمان</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {report.paginated.map((l: DeviceLog) => (
                        <tr key={l.id} className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{formatDate(l.date)}</td>
                          <td className="px-4 py-3 dark:text-slate-300">{l.line?.name}</td>
                          <td className="px-4 py-3 dark:text-slate-400">{l.shift?.name}</td>
                          <td className="px-4 py-3 dark:text-slate-300">{formatNumber(l.feed_tonnage)}</td>
                          <td className="px-4 py-3 dark:text-slate-300">{formatNumber(l.product_tonnage)}</td>
                          <td className="px-4 py-3 tabular-nums" dir="ltr">{formatHours(l.runtime_hours)}</td>
                          <td className="px-4 py-3 tabular-nums" dir="ltr">{l.downtime_hours > 0 ? <span className="font-semibold text-rose-600">{formatHours(l.downtime_hours)}</span> : '—'}</td>
                          <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${(l.efficiency || 0) >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : (l.efficiency || 0) >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'}`}>{l.efficiency != null ? `${l.efficiency.toFixed(1)}٪` : '—'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {report.totalPages > 1 && <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: 'rgba(148,163,184,0.15)' }}><span className="text-xs text-ink-400">صفحه {report.page} از {report.totalPages}</span><Pagination currentPage={report.page} totalPages={report.totalPages} onPageChange={report.setPage} /></div>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
