import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, X, Filter, Loader2, Layers, BarChart3, ListChecks, Download, FileText, FileSpreadsheet, FileJson, Globe, ChevronDown, Activity, Settings2 } from 'lucide-react'
import TabReportPanel from '../components/factoryTabs/TabReportPanel'
import TabSettingsPanel, { TabIconBadge } from '../components/factoryTabs/TabSettingsPanel'
import ReportBuilderPanel from '../components/factoryTabs/ReportBuilderPanel'
import { TabRecordForm, type TabFormState } from '../components/factoryTabs/TabRecordForm'
import { useFactory } from '../store/FactoryContext'
import { useAuth } from '../store/AuthContext'
import { hasPerm } from '../constants'
import { useToast } from '../components/ui/Toast'
import {
  createFactoryTabRecord,
  deleteFactoryTabRecord,
  fetchAllFactoryTabRecords,
  getFactoryTabRecords,
  getFactoryTabReports,
  runFactoryTabReport,
  updateFactoryTabRecord,
} from '../api/factoryTabs'
import type { FactoryTabBrief, FactoryTabRecord, FactoryTabRecordFilters, FactoryTabRecordPayload, FactoryTabReport, FactoryTabReportRun } from '../types'
import { EmptyState, ErrorBanner, TableSkeleton } from '../components/ui/States'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import JalaliDateInput from '../components/ui/JalaliDateInput'
import { formatDate, formatNumber, todayISO } from '../utils'
import { tabOutputLabel } from '../utils/outputLabels'
import { exportData } from '../utils/exports'
import type { ExportFormat } from '../utils/exports'
import { addReportHistoryEntry } from '../features/reportHistory'
import { buildTabReportPdf } from '../templates/pdf/reports/tabReport'

const emptyForm: TabFormState = { tab: '', line: '', contractor: '', date_from: todayISO(), date_to: todayISO(), hour: '', note: '', values: {} }

export default function FactoryTabs() {
  const { tabId: routeTabId } = useParams<{ tabId: string }>()
  const { selectedFactory, reload } = useFactory()
  const { user } = useAuth()
  const { notify } = useToast()
  const canCreate = hasPerm(user?.permissions, 'factory-tabs.create')
  const canEdit = hasPerm(user?.permissions, 'factory-tabs.edit')
  const canDelete = hasPerm(user?.permissions, 'factory-tabs.delete')
  const canExport = hasPerm(user?.permissions, 'reports.export') || hasPerm(user?.permissions, 'reports.view') || hasPerm(user?.permissions, 'factory-tabs.view')

  const tabs = useMemo(() => (selectedFactory?.report_tabs ?? []).filter((t) => t.is_active), [selectedFactory])
  const selectedTab: FactoryTabBrief | null = useMemo(
    () => tabs.find((t) => String(t.id) === routeTabId) ?? null,
    [tabs, routeTabId],
  )
  const activeTabId = selectedTab ? String(selectedTab.id) : ''
  const isDaily = selectedTab?.record_type === 'daily'

  const [tab, setTab] = useState<'records' | 'report' | 'settings'>('records')
  const [items, setItems] = useState<FactoryTabRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FactoryTabRecordFilters>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FactoryTabRecord | null>(null)
  const [form, setForm] = useState<TabFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(30)
  const [totalCount, setTotalCount] = useState(0)

  const [reports, setReports] = useState<FactoryTabReport[]>([])
  const [reportId, setReportId] = useState<string>('')
  const [runData, setRunData] = useState<FactoryTabReportRun | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const load = useCallback(() => {
    if (!activeTabId) { setItems([]); setTotalCount(0); setLoading(false); return }
    setLoading(true)
    const merged = { ...filters, tab: Number(activeTabId) } as FactoryTabRecordFilters
    getFactoryTabRecords(merged, page, pageSize)
      .then((data) => { setItems(data.results); setTotalCount(data.count); setError(null) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filters, page, pageSize, activeTabId])

  const loadReports = useCallback(() => {
    if (!activeTabId) { setReports([]); setReportId(''); return }
    getFactoryTabReports({ tab: Number(activeTabId), active: 1 })
      .then((list) => {
        setReports(list)
        const def = list.find((r) => r.is_default) ?? list[0]
        setReportId((prev) => (list.some((r) => String(r.id) === prev) ? prev : def ? String(def.id) : ''))
      })
      .catch((e) => notify(e.message || 'خطا در دریافت گزارش‌ها', 'error'))
  }, [activeTabId, notify])

  const loadReport = useCallback(() => {
    if (!reportId) { setRunData(null); return }
    setLoadingReport(true)
    const params: Record<string, unknown> = {}
    if (filters.line) params.line = filters.line
    if (filters.contractor) params.contractor = filters.contractor
    if (filters.date_from) params.date_from = filters.date_from
    if (filters.date_to) params.date_to = filters.date_to
    runFactoryTabReport(Number(reportId), params)
      .then(setRunData)
      .catch((e) => notify(e.message || 'خطا در اجرای گزارش', 'error'))
      .finally(() => setLoadingReport(false))
  }, [reportId, filters, notify])

  useEffect(() => { if (selectedFactory) load() }, [selectedFactory, load])
  useEffect(() => { if (selectedFactory) loadReports() }, [selectedFactory, loadReports])
  useEffect(() => { if (tab === 'report' && reportId) loadReport() }, [tab, reportId, loadReport])
  useEffect(() => { setTab('records'); setPage(1); setFilters({}); setReportId(''); setRunData(null) }, [routeTabId])

  const onSaved = () => {
    load()
    if (tab === 'report') loadReport()
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, tab: activeTabId, line: String(selectedFactory?.lines[0]?.id ?? '') })
    setModalOpen(true)
  }

  const openEdit = (p: FactoryTabRecord) => {
    setEditing(p)
    setForm({
      tab: String(p.tab.id),
      line: p.line ? String(p.line.id) : '',
      contractor: p.contractor ? String(p.contractor.id) : '',
      date_from: p.date_from,
      date_to: p.date_to,
      hour: (p.hour || '').slice(0, 5),
      note: p.note || '',
      values: {},
    })
    setModalOpen(true)
  }

  const submit = async () => {
    if (!selectedTab) { notify('تب یافت نشد', 'error'); return }
    if (!form.date_from || !form.date_to) { notify('بازه تاریخ الزامی است', 'error'); return }
    if (form.date_to < form.date_from) { notify('تاریخ پایان معتبر نیست', 'error'); return }
    if (selectedTab.record_type === 'daily' && !form.hour) { notify('ساعت ثبت الزامی است', 'error'); return }
    if (selectedTab.require_line && !form.line) { notify('خط تولید برای این تب الزامی است', 'error'); return }
    const inputs: Record<string, number | string> = {}
    Object.entries(form.values).forEach(([k, raw]) => {
      const v = (raw ?? '').trim()
      if (v !== '') inputs[k] = isNaN(Number(v)) ? v : Number(v)
    })
    const payload: FactoryTabRecordPayload = {
      tab: selectedTab.id,
      line_id: form.line ? Number(form.line) : null,
      contractor_id: form.contractor ? Number(form.contractor) : null,
      date_from: form.date_from,
      date_to: form.date_to,
      inputs,
      note: form.note,
    }
    if (selectedTab.record_type === 'daily') payload.hour = form.hour
    setSaving(true)
    try {
      if (editing) { await updateFactoryTabRecord(editing.id, payload); notify('رکورد ویرایش شد') }
      else { await createFactoryTabRecord(payload); notify('رکورد ثبت شد') }
      setModalOpen(false); onSaved()
    } catch (e: unknown) { notify(e instanceof Error ? e.message : 'خطا در ذخیره‌سازی', 'error') }
    finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (confirmId == null) return
    try { await deleteFactoryTabRecord(confirmId); notify('رکورد حذف شد'); setConfirmId(null); onSaved() }
    catch (e: unknown) { notify(e instanceof Error ? e.message : 'خطا در حذف', 'error') }
  }

  const setFilter = (k: keyof FactoryTabRecordFilters, v: string) => { setPage(1); setFilters((prev) => ({ ...prev, [k]: v === '' ? undefined : (v as never) })) }

  const reportParams = useCallback(() => {
    const params: Record<string, unknown> = {}
    if (filters.line) params.line = filters.line
    if (filters.contractor) params.contractor = filters.contractor
    if (filters.date_from) params.date_from = filters.date_from
    if (filters.date_to) params.date_to = filters.date_to
    return params
  }, [filters])

  const handleExport = async (fmt: ExportFormat) => {
    if (!canExport) { notify('شما دسترسی خروجی ندارید', 'error'); return }
    if (!selectedTab) { notify('تبی انتخاب نشده است', 'error'); return }
    setExporting(fmt); setShowExportMenu(false)
    try {
      const merged = { ...filters, tab: Number(activeTabId) } as FactoryTabRecordFilters
      let allRecords: FactoryTabRecord[] = items
      if (totalCount > items.length || tab === 'report') {
        allRecords = await fetchAllFactoryTabRecords(merged, 500)
      }
      if (!allRecords.length) { notify('داده‌ای برای خروجی وجود ندارد', 'error'); return }
      const dateFrom = filters.date_from || ''
      const dateTo = filters.date_to || ''
      const hasDate = !!dateFrom || !!dateTo
      const baseName = `${selectedTab.name}_${selectedFactory?.name ?? 'گزارش'}_${hasDate ? `${dateFrom || 'ابتدا'}_${dateTo || 'اکنون'}` : 'همه'}`
      const titleDate = hasDate ? `${dateFrom ? formatDate(dateFrom) : 'ابتدا'} تا ${dateTo ? formatDate(dateTo) : 'اکنون'}` : 'همه داده‌ها'
      const title = `${selectedTab.name} — ${selectedFactory?.name ?? ''} — ${titleDate}`
      const chips: { label: string; value: string }[] = [{ label: 'تب', value: selectedTab.name }]
      const lineName = filters.line ? (selectedFactory?.lines.find(l => l.id === Number(filters.line))?.name ?? String(filters.line)) : ''
      const contractorName = filters.contractor ? (selectedFactory?.contractors.find(c => c.id === Number(filters.contractor))?.name ?? String(filters.contractor)) : ''
      if (lineName) chips.push({ label: 'خط', value: lineName })
      if (contractorName) chips.push({ label: 'پیمانکار', value: contractorName })
      if (dateFrom) chips.push({ label: 'از تاریخ', value: formatDate(dateFrom) })
      if (dateTo) chips.push({ label: 'تا تاریخ', value: formatDate(dateTo) })
      const outputKeys = Array.from(new Set(allRecords.flatMap(r => Object.keys(r.outputs || {})))).sort((a, b) => a.localeCompare(b, 'fa'))
      const rows: Record<string, string | number>[] = allRecords.map(r => {
        const row: Record<string, string | number> = {
          'تاریخ': isDaily ? formatDate(r.date_from) : `${formatDate(r.date_from)} تا ${formatDate(r.date_to)}`,
          'خط': r.line?.name || '—',
          'پیمانکار': r.contractor?.name || '—',
        }
        if (isDaily) row['ساعت'] = (r.hour || '').slice(0, 5)
        outputKeys.forEach(k => {
          const v = (r.outputs as Record<string, number>)[k]
          row[tabOutputLabel(selectedTab, k)] = typeof v === 'number' ? Math.round(v * 10) / 10 : (v as string | number) ?? '—'
        })
        if (r.note) row['یادداشت'] = r.note.slice(0, 60)
        return row
      })

      if (fmt === 'pdf') {
        // PDF گزارش‌محور: KPI/نمودار/جدول‌های گزارش اول، جدول رکوردها آخر
        const { buildPdfHtml } = await import('../utils/pdf/renderer')
        const { htmlToPdf } = await import('../utils/pdf/printer')
        let run: FactoryTabReportRun | null = runData
        if (!run) {
          try { run = await runFactoryTabReport(Number(reportId), reportParams()) }
          catch { run = null }
        }
        const opts = buildTabReportPdf({
          title, factoryName: selectedFactory?.name ?? '',
          factoryAddress: selectedFactory?.address,
          dateFrom, dateTo, tab: selectedTab, run: run!, detailRows: rows, chips,
        })
        htmlToPdf(buildPdfHtml(opts), baseName, { title })
      } else {
        await exportData(rows, {
          fileName: baseName, title, factoryName: selectedFactory?.name ?? '',
          dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, format: fmt,
          outputLabelMap: Object.fromEntries(outputKeys.map(k => [k, tabOutputLabel(selectedTab, k)])),
        })
      }

      addReportHistoryEntry({
        kind: 'general', factoryName: selectedFactory?.name, fileName: `${baseName}.${fmt}`, title, format: fmt,
        recordCount: allRecords.length,
        dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
        chips, filters: { tab: activeTabId, line: filters.line as never, contractor: filters.contractor as never, date_from: dateFrom, date_to: dateTo },
      })
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'خطا در خروجی', 'error')
    } finally { setExporting(null) }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const sorted = [...items].sort((a, b) => (b.date_from + (b.hour || '')).localeCompare(a.date_from + (a.hour || '')))

  return (
    <div className="animate-fade-in space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <TabIconBadge icon={selectedTab?.icon} color={selectedTab?.color} className="h-5 w-5" />
            <div>
              <h1 className="flex items-center gap-2 text-[17px] font-extrabold tracking-tight text-slate-900 dark:text-white">{selectedTab?.name ?? 'تب کارخانه'} <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:inline-flex">{selectedFactory?.name ?? '—'}</span></h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><Activity className="h-3 w-3" />{formatNumber(totalCount)} رکورد</span>
                {selectedTab && <span className="rounded-full border border-slate-200 px-2.5 py-1 font-mono text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">{selectedTab.key}</span>}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start">
            <div className="relative">
              <button className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-black disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100" onClick={() => setShowExportMenu(v => !v)} disabled={!canExport || exporting !== null || loading}>
                {exporting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-slate-900 dark:border-t-transparent" /> : <Download className="h-4 w-4" />} خروجی <span className="hidden opacity-70 sm:inline">({totalCount})</span> <ChevronDown className={`h-4 w-4 opacity-60 transition ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>
              {showExportMenu && (
                <div className="absolute left-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400">خروجی حرفه‌ای — همین فیلتر</div>
                  <button onClick={() => handleExport('pdf')} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><FileText className="h-4 w-4 text-rose-600" /> PDF صنعتی</button>
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
            {tab === 'records' && canCreate && selectedTab && <button className="btn-primary !h-[42px] !px-5 !text-sm shadow-sm" onClick={openCreate}><Plus className="h-4 w-4" /> ثبت رکورد جدید</button>}
          </div>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl bg-ink-100/60 p-1 dark:bg-slate-800">
        <button
          onClick={() => setTab('records')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'records' ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-brand-400' : 'text-ink-500 dark:text-slate-400'}`}
        >
          <ListChecks className="h-4 w-4" /> ثبت / مدیریت رکوردها
        </button>
        <button
          onClick={() => setTab('report')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'report' ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-brand-400' : 'text-ink-500 dark:text-slate-400'}`}
        >
          <BarChart3 className="h-4 w-4" /> گزارش و نمودار
        </button>
        {hasPerm(user?.permissions, 'factory-tabs.manage') && (
          <button
            onClick={() => setTab('settings')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'settings' ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-brand-400' : 'text-ink-500 dark:text-slate-400'}`}
          >
            <Settings2 className="h-4 w-4" /> تنظیمات تب
          </button>
        )}
      </div>

      {tab === 'settings' && selectedTab ? (
        <div className="space-y-5">
          <TabSettingsPanel tabId={selectedTab.id} onChanged={reload} />
          <ReportBuilderPanel tab={selectedTab} />
        </div>
      ) : !selectedTab ? (
        <EmptyState
          icon={<Layers className="h-10 w-10" />}
          title="این تب یافت نشد"
          description="این تب برای کارخانه فعلی تعریف نشده یا غیرفعال است."
        />
      ) : (
        <>
          <div className="card flex flex-wrap items-end gap-3 p-4">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-600 dark:text-slate-300"><Filter className="h-4 w-4" /> فیلترها</div>
            <div className="min-w-[150px] flex-1">
              <label className="label">خط</label>
              <select className="input" value={filters.line ?? ''} onChange={(e) => setFilter('line', e.target.value)}>
                <option value="">همه خطوط</option>
                {selectedFactory?.lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="min-w-[140px]">
              <label className="label">پیمانکار</label>
              <select className="input" value={filters.contractor ?? ''} onChange={(e) => setFilter('contractor', e.target.value)}>
                <option value="">همه پیمانکاران</option>
                {selectedFactory?.contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="min-w-[130px]"><label className="label">از تاریخ</label><JalaliDateInput value={filters.date_from ?? ''} onChange={(iso) => setFilter('date_from', iso)} /></div>
            <div className="min-w-[130px]"><label className="label">تا تاریخ</label><JalaliDateInput value={filters.date_to ?? ''} onChange={(iso) => setFilter('date_to', iso)} /></div>
            <button className="btn-ghost" onClick={() => { setFilters({}); setPage(1) }}><X className="h-4 w-4" /> پاک کردن</button>
          </div>

          {tab === 'report' ? (
            <div className="space-y-3">
              {reports.length > 1 && (
                <div className="card flex flex-wrap items-center gap-2 p-3">
                  <span className="text-xs font-bold text-ink-500 dark:text-slate-400">گزارش:</span>
                  {reports.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setReportId(String(r.id))}
                      className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${reportId === String(r.id) ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-950/40 dark:text-brand-300' : 'bg-ink-50 text-ink-500 dark:bg-slate-800/60 dark:text-slate-400'}`}
                    >
                      {r.name}{r.is_default ? ' (پیش‌فرض)' : ''}
                    </button>
                  ))}
                </div>
              )}
              {loadingReport ? (
                <TableSkeleton columns={6} />
              ) : !reportId ? (
                <EmptyState icon={<BarChart3 className="h-10 w-10" />} title="گزارشی برای این تب تعریف نشده است" description="از بخش «تعریف تب و گزارش» یک گزارش با ویجت بسازید." />
              ) : runData ? (
                <TabReportPanel run={runData} tab={selectedTab} />
              ) : null}
            </div>
          ) : (
            <>
              {error && <ErrorBanner message={error} onRetry={load} />}
              {loading ? (
                <TableSkeleton columns={6} />
              ) : sorted.length === 0 ? (
                <EmptyState
                  icon={<Layers className="h-10 w-10" />}
                  title="رکوردی یافت نشد"
                  description="برای این فیلترها رکوردی ثبت نشده است."
                  action={canCreate ? <button className="btn-primary mt-2" onClick={openCreate}><Plus className="h-4 w-4" /> ثبت اولین رکورد</button> : undefined}
                />
              ) : (
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                          <th className="px-4 py-3 font-semibold">{isDaily ? 'تاریخ' : 'بازه تاریخ'}</th>
                          {isDaily && <th className="px-4 py-3 font-semibold">ساعت</th>}
                          <th className="px-4 py-3 font-semibold">خط</th>
                          <th className="px-4 py-3 font-semibold">پیمانکار</th>
                          <th className="px-4 py-3 font-semibold">خروجی‌های محاسبه‌شده</th>
                          <th className="px-4 py-3 font-semibold text-center">عملیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                        {sorted.map((p) => (
                          <tr key={p.id} className="transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                            <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">
                              {isDaily ? formatDate(p.date_from) : `${formatDate(p.date_from)} تا ${formatDate(p.date_to)}`}
                              {p.note && <div className="text-[11px] font-normal text-ink-400">{p.note}</div>}
                            </td>
                            {isDaily && <td className="px-4 py-3 dark:text-slate-300" dir="ltr">{(p.hour || '').slice(0, 5)}</td>}
                            <td className="px-4 py-3 dark:text-slate-300">{p.line?.name ?? '—'}</td>
                            <td className="px-4 py-3 text-ink-600 dark:text-slate-400">{p.contractor?.name ?? '—'}</td>
                            <td className="px-4 py-3">
                              <div className="flex max-w-[380px] flex-wrap gap-1">
                                {Object.entries(p.outputs || {}).map(([k, v]) => (
                                  <span key={k} className="chip" title={k}>
                                    {tabOutputLabel(selectedTab, k)}: <span className="font-semibold text-brand-600">{formatNumber(v)}</span>
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                {canEdit && <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-slate-800" onClick={() => openEdit(p)} title="ویرایش"><Pencil className="h-4 w-4" /></button>}
                                {canDelete && <button className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50" onClick={() => setConfirmId(p.id)} title="حذف"><Trash2 className="h-4 w-4" /></button>}
                                {!canEdit && !canDelete && <span className="text-xs text-slate-400">—</span>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 dark:border-slate-700">
                    <span className="text-xs text-ink-400">نمایش {Math.min((page - 1) * pageSize + 1, totalCount)} تا {Math.min(page * pageSize, totalCount)} از {totalCount} رکورد</span>
                    <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => { setPage(p); load() }} />
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'ویرایش رکورد تب' : 'ثبت رکورد جدید'} subtitle={`${selectedTab?.name ?? ''} — ${selectedFactory?.name ?? ''}`} size="lg"
        footer={<><button className="btn-ghost" onClick={() => setModalOpen(false)}>انصراف</button><button className="btn-primary" onClick={submit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'ذخیره تغییرات' : 'ثبت رکورد'}</button></>}>
        <TabRecordForm form={form} setForm={setForm} editing={editing} fixedTab={selectedTab ? { id: selectedTab.id, name: selectedTab.name } : null} />
      </Modal>

      <Modal open={confirmId != null} onClose={() => setConfirmId(null)} title="حذف رکورد"
        footer={<><button className="btn-ghost" onClick={() => setConfirmId(null)}>انصراف</button><button className="btn-danger" onClick={confirmDelete}><Trash2 className="h-4 w-4" /> حذف قطعی</button></>}>
        <p className="text-sm text-ink-700 dark:text-slate-300">آیا از حذف این رکورد اطمینان دارید؟</p>
      </Modal>
    </div>
  )
}
