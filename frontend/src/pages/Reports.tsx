import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FileSpreadsheet, FileText, FileJson, Globe, Building2, Search, ArrowUpDown, X, Download, Clock, Activity as ActivityIcon, BarChart2, ChevronDown, History, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { useFactory } from '../store/FactoryContext'
import { useAuth } from '../store/AuthContext'
import type { DeviceLog } from '../types'
import { ErrorBanner, EmptyState, CardSkeleton } from '../components/ui/States'
import Pagination from '../components/ui/Pagination'
import { formatDate, formatNumber, formatHours } from '../utils'
import JalaliDateInput from '../components/ui/JalaliDateInput'
import { useReportState } from '../features/reports/useReportState'
import { PRESETS } from '../features/reports/reportFilters'
import { buildDowntimeReport } from '../templates/pdf/reports/downtimeReport'
import { buildPdfHtml } from '../utils/pdf/renderer'
import { htmlToPdf } from '../utils/pdf/printer'
import { exportData } from '../utils/exports'
import type { ExportFormat } from '../utils/exports'
import DowntimeReportPanel from '../components/downtime/DowntimeReportPanel'
import ReportHistoryPanel from '../components/reports/ReportHistoryPanel'
import { addReportHistoryEntry } from '../features/reportHistory'

export default function Reports() {
  const { selectedFactory } = useFactory()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.is_superuser
  const factoryName = selectedFactory?.name ?? ''
  const factoryAddr = selectedFactory?.address ?? ''
  const report = useReportState({}, 50)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const allDevices = useMemo(() => (selectedFactory?.lines ?? []).flatMap(l => l.devices.map(d => ({ ...d, lineName: l.name }))), [selectedFactory])

  const isFiltered = report.chips.length > 0 || !!report.filters.date_from || !!report.filters.date_to || !!report.filters.search
  const activePreset = useMemo(() => {
    if (!report.filters.date_from && !report.filters.date_to) return 'all'
    return null
  }, [report.filters.date_from, report.filters.date_to])

  const handleExport = async (fmt: ExportFormat) => {
    if (!report.sorted.length) return
    setExporting(fmt); setShowExportMenu(false)
    const hasDate = !!report.filters.date_from || !!report.filters.date_to
    const baseName = `گزارش_کلی_${factoryName || 'گزارش'}_${hasDate ? `${report.filters.date_from || 'ابتدا'}_${report.filters.date_to || 'اکنون'}` : 'همه'}`
    const titleDate = hasDate ? `${report.filters.date_from ? formatDate(report.filters.date_from) : 'ابتدا'} تا ${report.filters.date_to ? formatDate(report.filters.date_to) : 'اکنون'}` : 'همه داده‌ها'
    const title = `گزارش کلی — ${factoryName || ''} — ${titleDate}`
    const chips = report.chips.map(c => ({ label: c.label, value: c.value }))
    const filtersRec: Record<string, unknown> = {
      line: report.filters.line, shift: report.filters.shift, device: report.filters.device, failure_cause: report.filters.failure_cause,
      date_from: report.filters.date_from, date_to: report.filters.date_to, search: report.filters.search, sortKey: report.filters.sortKey, sortDir: report.filters.sortDir,
    }
    try {
      if (fmt === 'pdf') {
        const rows = report.sorted.map(l => ({
          date: l.date, line: l.line?.name ?? '—', shift: l.shift?.name ?? '—', device: l.device?.name ?? '—', cause: l.failure_cause?.title ?? '—',
          downtime_hours: l.downtime_hours, runtime_hours: l.runtime_hours, efficiency: l.efficiency ?? 0,
        }))
        const opts = buildDowntimeReport({
          title, factoryName, factoryAddress: factoryAddr,
          dateFrom: report.filters.date_from || '', dateTo: report.filters.date_to || '',
          rows, chips,
        })
        const html = buildPdfHtml(opts)
        htmlToPdf(html, baseName, { title })
      } else {
        const rows: Record<string, string | number>[] = report.sorted.map(l => ({
          'تاریخ': formatDate(l.date),
          'خط': l.line?.name || '—',
          'شیفت': l.shift?.name || '—',
          'دستگاه': l.device ? `${l.device.code ? l.device.code + ' - ' : ''}${l.device.name}` : '—',
          'علت توقف': l.failure_cause?.title || '—',
          'توقف': formatHours(l.downtime_hours),
          'کارکرد': formatHours(l.runtime_hours),
          'ورودی': l.feed_tonnage,
          'خروجی': l.product_tonnage,
          'باطله': l.tailing_tonnage,
          'راندمان': l.efficiency ?? 0,
          'توضیحات': l.failure_description || '—',
        }))
        await exportData(rows, { fileName: baseName, title, factoryName, dateFrom: report.filters.date_from || undefined, dateTo: report.filters.date_to || undefined, format: fmt })
      }
      addReportHistoryEntry({
        kind: 'general', factoryName, fileName: `${baseName}.${fmt}`, title, format: fmt,
        recordCount: report.sorted.length,
        dateFrom: report.filters.date_from || undefined, dateTo: report.filters.date_to || undefined,
        chips, filters: filtersRec,
      })
    } finally { setExporting(null) }
  }

  if (!isAdmin) return <EmptyState icon={<ActivityIcon className="h-10 w-10" />} title="دسترسی غیرمجاز" description="فقط ادمین‌ها می‌توانند گزارش‌ها را مشاهده کنند." />

  return (
    <div className="animate-fade-in space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 sm:flex"><Building2 className="h-5 w-5" /></div>
            <div>
              <h1 className="flex items-center gap-2 text-[17px] font-extrabold tracking-tight text-slate-900 dark:text-white">گزارش‌ها و خروجی — گزارش کلی <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:inline-flex">{factoryName || '—'}</span></h1>
              <p className="mt-1 max-w-[580px] text-sm leading-5 text-slate-500 dark:text-slate-400">گزارش یکپارچهٔ توقفات — KPI، نمودار و جداول بازه‌ای (روزانه/هفتگی/ماهانه) + تفکیک خط/دستگاه/علت/شیفت. همین فیلتر دقیقاً داخل PDF و همه خروجی‌ها اعمال می‌شود.</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><ActivityIcon className="h-3 w-3" />{formatNumber(report.totalCount)} رکورد</span>
                {report.sorted.length !== report.logs.length && <span className="text-xs text-slate-500">· فیلتر: {formatNumber(report.sorted.length)} / {formatNumber(report.logs.length)}</span>}
                <span className="hidden text-xs text-slate-400 sm:inline">· مرتب: {report.filters.sortKey} ({report.filters.sortDir})</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start">
            <div className="relative">
              <button className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-black disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100" onClick={() => setShowExportMenu(v => !v)} disabled={exporting !== null || report.loading || !report.sorted.length}>
                {exporting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-slate-900 dark:border-t-transparent" /> : <Download className="h-4 w-4" />} خروجی کلی <span className="hidden opacity-70 sm:inline">({report.sorted.length})</span> <ChevronDown className={`h-4 w-4 opacity-60 transition ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>
              {showExportMenu && (
                <div className="absolute left-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400">گزارش کامل — همین فیلتر (KPI + نمودار + ۷ جدول)</div>
                  <button onClick={() => handleExport('pdf')} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><FileText className="h-4 w-4 text-rose-600" /> PDF صنعتی <span className="mr-auto text-[11px] text-slate-400">همه جداول</span></button>
                  <div className="h-px bg-slate-100 dark:bg-slate-800" />
                  <button onClick={() => handleExport('xlsx')} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel (XLSX)</button>
                  <button onClick={() => handleExport('csv')} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><FileJson className="h-4 w-4 text-amber-600" /> CSV</button>
                  <button onClick={() => handleExport('docx')} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><FileText className="h-4 w-4 text-blue-600" /> Word (DOCX)</button>
                  <div className="h-px bg-slate-100 dark:bg-slate-800" />
                  <button onClick={() => handleExport('html')} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><Globe className="h-4 w-4 text-sky-600" /> HTML</button>
                  <button onClick={() => handleExport('json')} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><FileJson className="h-4 w-4 text-violet-600" /> JSON</button>
                </div>
              )}
              {showExportMenu && <button className="fixed inset-0 z-10" aria-hidden onClick={() => setShowExportMenu(false)} tabIndex={-1} />}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1 max-w-[380px]">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input !h-9 !rounded-xl !py-0 pr-9 text-sm" placeholder="جستجو خط، دستگاه، علت..." value={report.filters.search} onChange={e => report.setSearch(e.target.value)} />
              {report.filters.search && <button onClick={() => report.setSearch('')} className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <select className="input !h-9 !w-[126px] !rounded-xl !py-0 text-sm" value={report.filters.sortKey} onChange={e => report.setSort(e.target.value as never)}><option value="date">تاریخ</option><option value="downtime">توقف</option><option value="runtime">کارکرد</option><option value="line">خط</option><option value="efficiency">راندمان</option></select>
            <button className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" onClick={() => report.setFilter('sortDir', report.filters.sortDir === 'asc' ? 'desc' : 'asc')} title="جهت مرتب‌سازی"><ArrowUpDown className="h-4 w-4" /></button>
            {(isFiltered) && <button className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300" onClick={report.clearFilters}><X className="h-3.5 w-3.5" /> پاک کردن همه</button>}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <select className="input !h-9 !rounded-xl !py-0 text-sm" value={report.filters.line ?? ''} onChange={e => report.setFilter('line', e.target.value)}><option value="">همه خطوط</option>{selectedFactory?.lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
            <select className="input !h-9 !rounded-xl !py-0 text-sm" value={report.filters.shift ?? ''} onChange={e => report.setFilter('shift', e.target.value)}><option value="">همه شیفت‌ها</option>{selectedFactory?.shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <select className="input !h-9 !rounded-xl !py-0 text-sm" value={report.filters.device ?? ''} onChange={e => report.setFilter('device', e.target.value)}><option value="">همه دستگاه‌ها</option>{allDevices.map(d => <option key={d.id} value={String(d.id)}>{d.code ? `${d.code} - ${d.name}` : d.name} · {d.lineName}</option>)}</select>
            <select className="input !h-9 !rounded-xl !py-0 text-sm" value={report.filters.failure_cause ?? ''} onChange={e => report.setFilter('failure_cause', e.target.value)}><option value="">همه علل</option>{selectedFactory?.failure_reasons.map(f => <option key={f.id} value={String(f.id)}>{f.title}</option>)}</select>
            <div className="flex items-center gap-1"><span className="shrink-0 text-xs text-slate-500">از</span><JalaliDateInput value={report.filters.date_from} onChange={iso => report.setFilter('date_from', iso)} /></div>
            <div className="flex items-center gap-1"><span className="shrink-0 text-xs text-slate-500">تا</span><JalaliDateInput value={report.filters.date_to} onChange={iso => report.setFilter('date_to', iso)} /></div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map(p => {
              const isAll = p.key === 'all'
              const active = isAll ? activePreset === 'all' : false
              return <button key={p.key} onClick={() => report.applyPreset(p.key)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{p.label}</button>
            })}
          </div>

          {report.chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
              {report.chips.map((c, i) => <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-slate-900">{c.label}: {c.value} <button onClick={c.onRemove} className="rounded-full bg-white/20 p-0.5 hover:bg-white/30 dark:bg-slate-900/10"><X className="h-3 w-3" /></button></span>)}
              <span className="text-xs text-slate-500">{formatNumber(report.totalCount)} رکورد · مرتب {report.filters.sortKey} ({report.filters.sortDir})</span>
            </div>
          )}
        </div>
      </div>

      {report.error && <ErrorBanner message={report.error} onRetry={report.reload} />}

      {report.loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : report.sorted.length === 0 ? (
        <EmptyState icon={<BarChart2 className="h-10 w-10" />} title="داده‌ای وجود ندارد" description="برای فیلتر/بازهٔ انتخابی رکوردی یافت نشد. فیلترها را پاک کنید یا بازه را تغییر دهید." />
      ) : (
        <div className="space-y-6">
          <DowntimeReportPanel records={report.sorted} />

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">جدول جزئیات — صفحه‌بندی ({formatNumber(report.totalCount)} رکورد)</span>
              <span className="text-xs text-slate-500">مرتب: {report.filters.sortKey} ({report.filters.sortDir})</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 bg-slate-50/80 text-right text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400"><th className="whitespace-nowrap px-4 py-3">تاریخ</th><th className="whitespace-nowrap px-4 py-3">خط</th><th className="whitespace-nowrap px-4 py-3">شیفت</th><th className="px-4 py-3">دستگاه / علت</th><th className="whitespace-nowrap px-4 py-3">کارکرد</th><th className="whitespace-nowrap px-4 py-3">توقف</th><th className="whitespace-nowrap px-4 py-3">راندمان</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {report.paginated.map(l => (
                    <tr key={l.id} className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{formatDate(l.date)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-300">{l.line?.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">{l.shift?.name}</td>
                      <td className="px-4 py-3"><div className="font-medium text-slate-700 dark:text-slate-300">{l.device ? `${l.device.code ? l.device.code + ' - ' : ''}${l.device.name}` : '—'}</div>{l.failure_cause ? <span className="mt-1 inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300">{l.failure_cause.title}</span> : <span className="text-xs text-slate-400">—</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums" dir="ltr">{formatHours(l.runtime_hours)}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums" dir="ltr">{l.downtime_hours > 0 ? <span className="font-semibold text-rose-600">{formatHours(l.downtime_hours)}</span> : '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${(l.efficiency || 0) >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : (l.efficiency || 0) >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'}`}>{l.efficiency != null ? `${l.efficiency.toFixed(1)}٪` : '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-slate-500">نمایش {Math.min((report.page - 1) * report.pageSize + 1, report.totalCount)} تا {Math.min(report.page * report.pageSize, report.totalCount)} از {formatNumber(report.totalCount)} — همین فیلتر در PDF/Excel</span>
              <Pagination currentPage={report.page} totalPages={report.totalPages} onPageChange={report.setPage} />
            </div>
          </div>

          <ReportHistoryPanel />
        </div>
      )}
      {!report.loading && report.sorted.length === 0 && <ReportHistoryPanel />}
    </div>
  )
}
