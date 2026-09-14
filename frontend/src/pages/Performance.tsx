import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Filter, X, Gauge, BarChart3, ListChecks, RefreshCw, Download, FileText, FileSpreadsheet, FileJson, Globe, ChevronDown, Settings2 } from 'lucide-react'
import TonnageAnalysisDefinitionPanel from '../components/performance/TonnageAnalysisDefinitionPanel'
import { useFactory } from '../store/FactoryContext'
import { useAuth } from '../store/AuthContext'
import { hasPerm } from '../constants'
import { useToast } from '../components/ui/Toast'
import { getActualAnalyses, fetchAllActualAnalyses, deleteActualAnalysis } from '../api/actual'
import type { ActualAnalysis, ActualAnalysisFilters } from '../types'
import { ErrorBanner, EmptyState, TableSkeleton } from '../components/ui/States'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import DynamicAnalysisForm from '../components/performance/DynamicAnalysisForm'
import PerformanceReportPanel from '../components/performance/PerformanceReportPanel'
import { formatDate, formatNumber, todayISO } from '../utils'
import { useOutputLabelMap, labelFor } from '../hooks/useOutputLabelMap'
import JalaliDateInput from '../components/ui/JalaliDateInput'
import { buildPerformanceReport } from '../templates/pdf/reports/performanceReport'
import { buildPdfHtml } from '../utils/pdf/renderer'
import { htmlToPdf } from '../utils/pdf/printer'
import { exportData } from '../utils/exports'
import type { ExportFormat } from '../utils/exports'
import { addReportHistoryEntry } from '../features/reportHistory'

export default function Performance() {
  const { selectedFactory } = useFactory()
  const { user } = useAuth()
  const { notify } = useToast()
  const canCreate = hasPerm(user?.permissions, 'analysis.create')
  const canEdit = hasPerm(user?.permissions, 'analysis.edit')
  const canDelete = hasPerm(user?.permissions, 'analysis.delete')
  const canExport = hasPerm(user?.permissions, 'reports.export') || hasPerm(user?.permissions, 'reports.view') || hasPerm(user?.permissions, 'analysis.view')

  const [tab, setTab] = useState<'list' | 'report' | 'definition'>('list')
  const [filters, setFilters] = useState<ActualAnalysisFilters>({})
  const [records, setRecords] = useState<ActualAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(30)
  const [total, setTotal] = useState(0)

  const [reportRecords, setReportRecords] = useState<ActualAnalysis[]>([])
  const [loadingReport, setLoadingReport] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ActualAnalysis | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const lineIds = useMemo(() => (selectedFactory?.lines ?? []).map((l) => l.id), [selectedFactory])
  const primaryLineId = useMemo(() => (filters.line ? Number(filters.line) : lineIds[0] ?? null) as number | null, [filters.line, lineIds])
  const outputLabelMap = useOutputLabelMap(primaryLineId)
  const lab = (k: string) => labelFor(outputLabelMap, k)

  const loadList = useCallback(() => {
    setLoading(true)
    const merged: Record<string, unknown> = { ...filters }
    if (lineIds.length) merged.lines = lineIds.join(',')
    getActualAnalyses(merged as ActualAnalysisFilters, page, pageSize)
      .then((d) => {
        setRecords(d.results)
        setTotal(d.count)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filters, page, pageSize, lineIds])

  const loadReport = useCallback(() => {
    setLoadingReport(true)
    const merged: Record<string, unknown> = { ...filters }
    if (lineIds.length) merged.lines = lineIds.join(',')
    fetchAllActualAnalyses(merged as unknown as ActualAnalysisFilters, 500)
      .then(setReportRecords)
      .catch((e) => notify(e.message || 'خطا در دریافت داده گزارش', 'error'))
      .finally(() => setLoadingReport(false))
  }, [filters, lineIds, notify])

  useEffect(() => {
    if (selectedFactory) loadList()
  }, [selectedFactory, loadList])

  useEffect(() => {
    if (tab === 'report' && selectedFactory) loadReport()
  }, [tab, selectedFactory, loadReport])

  const onSaved = () => {
    loadList()
    if (tab === 'report') loadReport()
  }

  const setFilter = (k: keyof ActualAnalysisFilters, v: string) => {
    setPage(1)
    setFilters((prev) => ({ ...prev, [k]: v === '' ? undefined : (v as any) }))
  }

  const confirmDelete = async () => {
    if (confirmId == null) return
    try {
      await deleteActualAnalysis(confirmId)
      notify('عملکرد حذف شد')
      setConfirmId(null)
      loadList()
    } catch (e: any) {
      notify(e.message || 'خطا در حذف', 'error')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleExport = async (fmt: ExportFormat) => {
    if (!canExport) { notify('شما دسترسی خروجی ندارید', 'error'); return }
    if (!reportRecords.length) { notify('داده‌ای برای خروجی وجود ندارد', 'error'); return }
    setExporting(fmt); setShowExportMenu(false)
    try {
      const dateFrom = filters.date_from || ''
      const dateTo = filters.date_to || ''
      const hasDate = !!dateFrom || !!dateTo
      const baseName = `ریز_عملکرد_${selectedFactory?.name ?? 'گزارش'}_${hasDate ? `${dateFrom || 'ابتدا'}_${dateTo || 'اکنون'}` : 'همه'}`
      const titleDate = hasDate ? `${dateFrom ? formatDate(dateFrom) : 'ابتدا'} تا ${dateTo ? formatDate(dateTo) : 'اکنون'}` : 'همه داده‌ها'
      const title = `ریز عملکرد بخش تولید — ${selectedFactory?.name ?? ''} — ${titleDate}`
      const lineName = filters.line ? (selectedFactory?.lines.find(l => l.id === Number(filters.line))?.name ?? String(filters.line)) : ''
      const contractorName = filters.contractor ? (selectedFactory?.contractors.find(c => c.id === Number(filters.contractor))?.name ?? String(filters.contractor)) : ''
      const chips: { label: string; value: string }[] = []
      if (lineName) chips.push({ label: 'خط', value: lineName })
      if (contractorName) chips.push({ label: 'پیمانکار', value: contractorName })
      if (dateFrom) chips.push({ label: 'از تاریخ', value: formatDate(dateFrom) })
      if (dateTo) chips.push({ label: 'تا تاریخ', value: formatDate(dateTo) })
      if (!chips.length) chips.push({ label: 'بازه', value: titleDate })
      if (fmt === 'pdf') {
        const opts = buildPerformanceReport({ title, factoryName: selectedFactory?.name ?? '', factoryAddress: selectedFactory?.address, dateFrom, dateTo, records: reportRecords, chips, outputLabelMap })
        const html = buildPdfHtml(opts)
        htmlToPdf(html, baseName, { title })
      } else {
        const outputKeys = Array.from(new Set(reportRecords.flatMap(r => Object.keys(r.outputs || {})))).sort((a, b) => a.localeCompare(b, 'fa'))
        const rows: Record<string, string | number>[] = reportRecords.map(r => {
          const row: Record<string, string | number> = {
            'بازه': `${formatDate(r.date_from)} تا ${formatDate(r.date_to)}`,
            'خط': r.line?.name || '—',
            'پیمانکار': r.contractor?.name || '—',
          }
          outputKeys.forEach(k => {
            const v = r.outputs?.[k]
            row[lab(k)] = typeof v === 'number' ? Math.round(v * 10) / 10 : (v as string | number) ?? '—'
          })
          return row
        })
        await exportData(rows, { fileName: baseName, title, factoryName: selectedFactory?.name ?? '', dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, format: fmt, outputLabelMap })
      }
      addReportHistoryEntry({
        kind: 'performance', factoryName: selectedFactory?.name, fileName: `${baseName}.${fmt}`, title, format: fmt,
        recordCount: reportRecords.length,
        dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
        chips, filters: { line: filters.line as any, contractor: filters.contractor as any, date_from: dateFrom, date_to: dateTo },
      })
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'خطا در خروجی', 'error')
    } finally { setExporting(null) }
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 sm:flex"><Gauge className="h-5 w-5" /></div>
            <div>
              <h1 className="flex items-center gap-2 text-[17px] font-extrabold tracking-tight text-slate-900 dark:text-white">عملکرد بخش تولید <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:inline-flex">{selectedFactory?.name ?? '—'}</span></h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{formatNumber(total)} رکورد</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start">
            <div className="relative">
              <button className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-black disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100" onClick={() => setShowExportMenu(v => !v)} disabled={!canExport || exporting !== null || !reportRecords.length}>
                {exporting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-slate-900 dark:border-t-transparent" /> : <Download className="h-4 w-4" />} خروجی <span className="hidden opacity-70 sm:inline">({reportRecords.length || total})</span> <ChevronDown className={`h-4 w-4 opacity-60 transition ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>
              {showExportMenu && (
                <div className="absolute left-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400">خروجی — همین فیلتر</div>
                  <button onClick={() => handleExport('pdf')} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><FileText className="h-4 w-4 text-rose-600" /> PDF کامل</button>
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
            {canCreate && <button className="btn-primary !h-[42px] !px-5 !text-sm shadow-sm" onClick={() => { setEditing(null); setModalOpen(true) }}>
              <Plus className="h-4 w-4" /> ثبت عملکرد جدید
            </button>}
          </div>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl bg-ink-100/60 p-1 dark:bg-slate-800">
        <button
          onClick={() => setTab('list')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'list' ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-brand-400' : 'text-ink-500 dark:text-slate-400'}`}
        >
          <ListChecks className="h-4 w-4" /> عملکردهای ثبت‌شده
        </button>
        <button
          onClick={() => setTab('report')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'report' ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-brand-400' : 'text-ink-500 dark:text-slate-400'}`}
        >
          <BarChart3 className="h-4 w-4" /> گزارش و نمودار
        </button>
        <button
          onClick={() => setTab('definition')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'definition' ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-brand-400' : 'text-ink-500 dark:text-slate-400'}`}
        >
          <Settings2 className="h-4 w-4" /> تعریف ورودی/خروجی
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadList} />}

      {tab !== 'definition' && (
        <div className="card flex flex-wrap items-end gap-3 p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-600 dark:text-slate-300">
            <Filter className="h-4 w-4" /> فیلترها
          </div>
          <div className="min-w-[150px] flex-1">
            <label className="label">خط تولید</label>
            <select className="input" value={filters.line ?? ''} onChange={(e) => setFilter('line', e.target.value)}>
              <option value="">همه خطوط</option>
              {selectedFactory?.lines.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px]">
            <label className="label">پیمانکار</label>
            <select className="input" value={filters.contractor ?? ''} onChange={(e) => setFilter('contractor', e.target.value)}>
              <option value="">همه پیمانکاران</option>
              {selectedFactory?.contractors.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[130px]">
            <label className="label">از تاریخ</label>
            <JalaliDateInput value={filters.date_from ?? ''} onChange={(iso) => setFilter('date_from', iso)} />
          </div>
          <div className="min-w-[130px]">
            <label className="label">تا تاریخ</label>
            <JalaliDateInput value={filters.date_to ?? ''} onChange={(iso) => setFilter('date_to', iso)} />
          </div>
          <button className="btn-ghost" onClick={() => { setFilters({}); setPage(1) }}>
            <X className="h-4 w-4" /> پاک کردن
          </button>
        </div>
      )}

      {tab === 'definition' ? (
        <TonnageAnalysisDefinitionPanel />
      ) : tab === 'list' ? (
        <>
          <div className="flex items-center justify-end">
            <span className="text-xs text-ink-400">تعداد رکوردها: {formatNumber(total)}</span>
          </div>
          {loading ? (
            <TableSkeleton columns={7} />
          ) : records.length === 0 ? (
            <EmptyState
              icon={<Gauge className="h-10 w-10" />}
              title="عملکردی یافت نشد"
              description="با فیلترهای فعلی رکوردی وجود ندارد یا هنوز عملکردی ثبت نشده است."
              action={canCreate ? <button className="btn-primary mt-2" onClick={() => { setEditing(null); setModalOpen(true) }}><Plus className="h-4 w-4" /> ثبت اولین عملکرد</button> : undefined}
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                      <th className="px-4 py-3 font-semibold">بازه تاریخ</th>
                      <th className="px-4 py-3 font-semibold">خط</th>
                      <th className="px-4 py-3 font-semibold">پیمانکار</th>
                      <th className="px-4 py-3 font-semibold">خروجی‌ها</th>
                      <th className="px-4 py-3 font-semibold text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                    {records.map((r) => (
                      <tr key={r.id} className="transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">
                          <div>{formatDate(r.date_from)} تا {formatDate(r.date_to)}</div>
                          {r.date_from === r.date_to && (
                            <div className="text-[11px] text-ink-400">{formatDate(r.date_to)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 dark:text-slate-300">{r.line.name}</td>
                        <td className="px-4 py-3 text-ink-600 dark:text-slate-400">{r.contractor?.name ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex max-w-[360px] flex-wrap gap-1">
                            {Object.entries(r.outputs || {}).map(([k, v]) => (
                              <span key={k} className="chip" title={k}>
                                {lab(k)}: <span className="font-semibold text-brand-600">{formatNumber(v)}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {canEdit && <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-slate-800" title="ویرایش" onClick={() => { setEditing(r); setModalOpen(true) }}><Pencil className="h-4 w-4" /></button>}
                            {canDelete && <button className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50" title="حذف" onClick={() => setConfirmId(r.id)}><Trash2 className="h-4 w-4" /></button>}
                            {!canEdit && !canDelete && <span className="text-xs text-slate-400">—</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 dark:border-slate-700">
                <span className="text-xs text-ink-400">
                  نمایش {Math.min((page - 1) * pageSize + 1, total)} تا {Math.min(page * pageSize, total)} از {total} رکورد
                </span>
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => { setPage(p); loadList() }} />
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="card flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500 dark:text-slate-400">
              <span className="hidden sm:inline">گزارش بر اساس فیلترهای بالا</span>
              <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold text-white dark:bg-white dark:text-slate-900">{formatNumber(reportRecords.length)} رکورد</span>
              <span className="hidden text-slate-400 sm:inline">· {formatDate(filters.date_from || todayISO())} تا {formatDate(filters.date_to || todayISO())}</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-ghost !h-9 !px-3" onClick={loadReport} title="بارگذاری مجدد">
                <RefreshCw className="h-4 w-4" />
              </button>
              <div className="relative">
                <button
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-black disabled:opacity-50 dark:bg-white dark:text-slate-900"
                  onClick={() => setShowExportMenu(v => !v)}
                  disabled={!canExport || exporting !== null || loadingReport || !reportRecords.length}
                >
                  {exporting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-slate-900 dark:border-t-transparent" /> : <Download className="h-4 w-4" />}
                  خروجی
                  <ChevronDown className={`h-4 w-4 opacity-60 transition ${showExportMenu ? 'rotate-180' : ''}`} />
                </button>
                {showExportMenu && (
                  <div className="absolute left-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400">گزارش کامل — همین فیلتر</div>
                    <button onClick={() => handleExport('pdf')} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><FileText className="h-4 w-4 text-rose-600" /> PDF کامل <span className="mr-auto text-[11px] text-slate-400">KPI + نمودار + ۲ جدول</span></button>
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
          {loadingReport ? (
            <TableSkeleton columns={4} />
          ) : (
            <PerformanceReportPanel records={reportRecords} />
          )}
        </div>
      )}

      <DynamicAnalysisForm
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
      />

      <Modal open={confirmId != null} onClose={() => setConfirmId(null)} title="حذف عملکرد"
        footer={<>
          <button className="btn-ghost" onClick={() => setConfirmId(null)}>انصراف</button>
          <button className="btn-danger" onClick={confirmDelete}><Trash2 className="h-4 w-4" /> حذف قطعی</button>
        </>}>
        <p className="text-sm text-ink-700 dark:text-slate-300">آیا از حذف این رکورد عملکرد اطمینان دارید؟ این عمل قابل بازگشت نیست.</p>
      </Modal>
    </div>
  )
}
