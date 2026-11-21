import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, X, Filter, Loader2, Layers, BarChart3, ListChecks, Download, FileText, FileSpreadsheet, FileJson, Globe, ChevronDown, ChevronUp, Calendar, Activity, Settings2, TableProperties, SlidersHorizontal, LayoutDashboard } from 'lucide-react'
import TabReportPanel from '../components/factoryTabs/TabReportPanel'
import TabSettingsPanel, { TabIconBadge } from '../components/factoryTabs/TabSettingsPanel'
import ReportBuilderPanel from '../components/factoryTabs/ReportBuilderPanel'
import { TabRecordForm, type TabFormState } from '../components/factoryTabs/TabRecordForm'
import BulkRecordModal from '../components/factoryTabs/BulkRecordModal'
import DailyAggregationsModal, {
  type AggregationMode,
  AGGREGATION_MODES,
  getDefaultAggMode,
} from '../components/factoryTabs/DailyAggregationsModal'
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
  getFactoryTabSchema,
  runFactoryTabReport,
  updateFactoryTabRecord,
} from '../api/factoryTabs'
import type { FactoryTabBrief, FactoryTabRecord, FactoryTabRecordFilters, FactoryTabRecordPayload, FactoryTabReport, FactoryTabReportRun, FactoryTabSchema } from '../types'
import { EmptyState, ErrorBanner, TableSkeleton } from '../components/ui/States'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import JalaliDateInput from '../components/ui/JalaliDateInput'
import { formatDate, formatDateWithWeekday, formatNumber, round2, todayISO } from '../utils'
import { tabOutputLabel } from '../utils/outputLabels'
import { exportData } from '../utils/exports'
import type { ExportFormat } from '../utils/exports'
import { addReportHistoryEntry } from '../features/reportHistory'
import { buildTabReportPdf } from '../templates/pdf/reports/tabReport'

const emptyForm: TabFormState = { tab: '', line: '', contractor: '', date_from: todayISO(), date_to: todayISO(), hour: '', note: '', values: {}, linked_records: {} }

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
  const lineMode = selectedTab?.line_mode ?? (selectedTab?.require_line ? 'required' : 'optional')
  const contractorMode = selectedTab?.contractor_mode ?? (selectedTab?.contractor_required ? 'required' : 'optional')
  const hourMode = selectedTab?.hour_mode ?? (isDaily ? 'required' : 'disabled')

  const [tab, setTab] = useState<'records' | 'report' | 'widgets' | 'settings'>('records')
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
  const [tabSchema, setTabSchema] = useState<FactoryTabSchema | null>(null)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [customAggModes, setCustomAggModes] = useState<Record<string, AggregationMode>>({})
  const [aggModalOpen, setAggModalOpen] = useState(false)
  const isSuperAdmin = Boolean(
    user?.is_superuser || user?.role === 'admin' || hasPerm(user?.permissions, 'factory-tabs.manage')
  )
  const canManage = isSuperAdmin

  useEffect(() => {
    if (!activeTabId) {
      setCustomAggModes({})
      return
    }
    try {
      const raw = localStorage.getItem(`tab_aggregations_${activeTabId}`)
      if (raw) {
        setCustomAggModes(JSON.parse(raw))
      } else {
        setCustomAggModes({})
      }
    } catch {
      setCustomAggModes({})
    }
  }, [activeTabId])

  const setOutputAggMode = useCallback((outputKey: string, mode: AggregationMode) => {
    setCustomAggModes((prev) => {
      const next = { ...prev, [outputKey]: mode }
      if (activeTabId) {
        try {
          localStorage.setItem(`tab_aggregations_${activeTabId}`, JSON.stringify(next))
        } catch (e) {
          console.error(e)
        }
      }
      return next
    })
  }, [activeTabId])

  const resetAggModes = useCallback(() => {
    if (activeTabId) {
      try {
        localStorage.removeItem(`tab_aggregations_${activeTabId}`)
      } catch {}
    }
    setCustomAggModes({})
    notify('تنظیمات تجمیع به حالت پیش‌فرض هوشمند بازنشانی شد')
  }, [activeTabId, notify])

  const cycleAggMode = useCallback((outputKey: string, name: string) => {
    const cycleList: AggregationMode[] = ['sum', 'avg', 'max', 'min', 'last']
    const current = customAggModes[outputKey] || getDefaultAggMode(outputKey, name)
    const idx = cycleList.indexOf(current)
    const next = cycleList[(idx + 1) % cycleList.length]
    setOutputAggMode(outputKey, next)
    const nextInfo = AGGREGATION_MODES.find((m) => m.key === next)
    notify(`نحوه محاسبه «${name}» به «${nextInfo?.label || next}» تغییر یافت`)
  }, [customAggModes, setOutputAggMode, notify])

  useEffect(() => {
    if (activeTabId) {
      getFactoryTabSchema(Number(activeTabId)).then(setTabSchema).catch(() => setTabSchema(null))
    } else {
      setTabSchema(null)
    }
  }, [activeTabId])

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
    setForm({
      ...emptyForm,
      tab: activeTabId,
      line: lineMode !== 'disabled' ? String(selectedFactory?.lines[0]?.id ?? '') : '',
    })
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
      linked_records: { ...(p.linked_records ?? {}) },
    })
    setModalOpen(true)
  }

  const submit = async () => {
    if (!selectedTab) { notify('تب یافت نشد', 'error'); return }
    if (!form.date_from || !form.date_to) { notify('بازه تاریخ الزامی است', 'error'); return }
    if (form.date_to < form.date_from) { notify('تاریخ پایان معتبر نیست', 'error'); return }
    if (hourMode === 'required' && !form.hour) { notify('ساعت ثبت الزامی است', 'error'); return }
    if (lineMode === 'required' && !form.line) { notify('خط تولید برای این تب الزامی است', 'error'); return }
    if (contractorMode === 'required' && !form.contractor) { notify('پیمانکار برای این تب الزامی است', 'error'); return }

    const selectedLineId = lineMode !== 'disabled' && form.line ? Number(form.line) : null
    const inputs: Record<string, number | string> = {}
    selectedTab.inputs.forEach((inp) => {
      const condLines = inp.conditions?.lines
      if (condLines && condLines.length > 0 && (!selectedLineId || !condLines.includes(selectedLineId))) {
        // شرط خط تولید برقرار نیست -> مقدار صفر در دیتابیس
        inputs[inp.key] = 0
      } else {
        const raw = form.values[inp.key]
        const v = (raw ?? '').trim()
        if (v !== '') inputs[inp.key] = isNaN(Number(v)) ? v : Number(v)
      }
    })
    Object.entries(form.values).forEach(([k, raw]) => {
      if (!(k in inputs)) {
        const v = (raw ?? '').trim()
        if (v !== '') inputs[k] = isNaN(Number(v)) ? v : Number(v)
      }
    })

    const linked_records: Record<string, number> = {}
    Object.entries(form.linked_records ?? {}).forEach(([k, v]) => {
      if (v !== '' && v != null && Number.isFinite(Number(v))) linked_records[k] = Number(v)
    })
    const payload: FactoryTabRecordPayload = {
      tab: selectedTab.id,
      line_id: lineMode !== 'disabled' && form.line ? Number(form.line) : null,
      contractor_id: contractorMode !== 'disabled' && form.contractor ? Number(form.contractor) : null,
      date_from: form.date_from,
      date_to: form.date_to,
      inputs,
      linked_records: Object.keys(linked_records).length ? linked_records : undefined,
      note: form.note,
    }
    if (hourMode !== 'disabled' && form.hour) payload.hour = form.hour
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
        }
        if (hourMode !== 'disabled') row['ساعت'] = (r.hour || '').slice(0, 5) || '—'
        if (lineMode !== 'disabled') row['خط'] = r.line?.name || '—'
        if (contractorMode !== 'disabled') row['پیمانکار'] = r.contractor?.name || '—'
        outputKeys.forEach(k => {
          const v = (r.outputs as Record<string, number>)[k]
          row[tabOutputLabel(selectedTab, k)] = typeof v === 'number' ? round2(v) : (v as string | number) ?? '—'
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

  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({})

  interface DayAggregatedOutput {
    key: string
    name: string
    unit: string
    mode: AggregationMode
    modeLabel: string
    value: number
    count: number
  }

  interface DayRecordGroup {
    date: string
    dateFormatted: string
    records: FactoryTabRecord[]
    aggregatedOutputs: DayAggregatedOutput[]
    lineNames: string[]
    contractorNames: string[]
  }

  const groupedByDay = useMemo(() => {
    const groups: DayRecordGroup[] = []
    const map = new Map<string, DayRecordGroup>()

    for (const rec of sorted) {
      const d = rec.date_from || 'unknown'
      let g = map.get(d)
      if (!g) {
        g = {
          date: d,
          dateFormatted: isDaily ? formatDate(d) : `${formatDate(rec.date_from)} تا ${formatDate(rec.date_to)}`,
          records: [],
          aggregatedOutputs: [],
          lineNames: [],
          contractorNames: [],
        }
        map.set(d, g)
        groups.push(g)
      }
      g.records.push(rec)
      if (rec.line?.name && !g.lineNames.includes(rec.line.name)) g.lineNames.push(rec.line.name)
      if (rec.contractor?.name && !g.contractorNames.includes(rec.contractor.name)) g.contractorNames.push(rec.contractor.name)
    }

    const outputDefs = selectedTab?.outputs ?? []
    // Collect all output keys present in definitions or records
    const allKeys = Array.from(new Set([
      ...outputDefs.map((o) => o.key),
      ...sorted.flatMap((r) => Object.keys(r.outputs || {})),
    ]))

    for (const g of groups) {
      const aggList: DayAggregatedOutput[] = []
      for (const k of allKeys) {
        const def = outputDefs.find((o) => o.key === k)
        const name = def?.name || tabOutputLabel(selectedTab, k)
        const unit = def?.unit || ''
        const mode = customAggModes[k] || getDefaultAggMode(k, name, unit)

        if (mode === 'none') continue

        const nums: number[] = []
        for (const rec of g.records) {
          const v = rec.outputs?.[k]
          if (typeof v === 'number' && !isNaN(v)) {
            nums.push(v)
          }
        }

        if (nums.length === 0) continue

        let val = 0
        if (mode === 'sum') {
          val = nums.reduce((acc, c) => acc + c, 0)
        } else if (mode === 'avg') {
          val = nums.reduce((acc, c) => acc + c, 0) / nums.length
        } else if (mode === 'max') {
          val = Math.max(...nums)
        } else if (mode === 'min') {
          val = Math.min(...nums)
        } else if (mode === 'last') {
          val = nums[nums.length - 1]
        }

        aggList.push({
          key: k,
          name,
          unit,
          mode,
          modeLabel: AGGREGATION_MODES.find((m) => m.key === mode)?.shortLabel || 'مجموع',
          value: round2(val),
          count: nums.length,
        })
      }
      g.aggregatedOutputs = aggList
    }

    return groups
  }, [sorted, isDaily, selectedTab, customAggModes])

  const toggleDate = (d: string) => {
    setExpandedDates((prev) => ({ ...prev, [d]: prev[d] === false ? true : false }))
  }

  const allExpanded = useMemo(() => {
    if (groupedByDay.length === 0) return false
    return groupedByDay.every((g) => expandedDates[g.date] !== false)
  }, [groupedByDay, expandedDates])

  const toggleAllDates = () => {
    const nextVal = !allExpanded
    const next: Record<string, boolean> = {}
    groupedByDay.forEach((g) => { next[g.date] = nextVal })
    setExpandedDates(next)
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div
        className="relative overflow-hidden rounded-3xl p-5 sm:p-6 text-white shadow-card"
        style={{
          background: 'linear-gradient(135deg, #0f1821 0%, #1e293b 60%, #0f1821 100%)',
          border: '1px solid rgba(239, 167, 63, 0.25)',
        }}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#efa73f]/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-[#c92127]/15 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-brand-glow text-[#0f1821]"
              style={{ background: 'linear-gradient(135deg, #f5b452, #efa73f)' }}
            >
              <TabIconBadge icon={selectedTab?.icon} color={selectedTab?.color} className="h-6 w-6" />
            </div>
            <div>
              <h1 className="flex items-center gap-2 text-lg font-black tracking-tight text-white sm:text-xl">
                {selectedTab?.name ?? 'تب کارخانه'}{' '}
                <span className="hidden rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-[#efa73f] sm:inline-flex ring-1 ring-[#efa73f]/30">
                  {selectedFactory?.name ?? '—'}
                </span>
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white ring-1 ring-white/15">
                  <Activity className="h-3 w-3 text-[#efa73f]" />
                  {formatNumber(totalCount)} رکورد
                </span>
                {selectedTab && (
                  <span className="rounded-full bg-white/10 border border-white/10 px-2.5 py-0.5 font-mono text-[11px] text-slate-300">
                    {selectedTab.key}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white ring-1 ring-white/15">
                  {isDaily ? 'ثبت روزانه' : 'ثبت بازه‌ای'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start">
            <div className="relative">
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20 transition disabled:opacity-50"
                onClick={() => setShowExportMenu(v => !v)}
                disabled={!canExport || exporting !== null || loading}
              >
                {exporting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Download className="h-4 w-4" />} خروجی <span className="hidden opacity-75 sm:inline">({totalCount})</span> <ChevronDown className={`h-3.5 w-3.5 opacity-70 transition ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>
              {showExportMenu && (
                <div className="absolute left-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-[#e4ddd2] bg-white p-1.5 shadow-modal text-[#0f1821] dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                  <div className="px-3 py-2 text-[11px] font-bold text-slate-400">خروجی حرفه‌ای — همین فیلتر</div>
                  <button onClick={() => handleExport('pdf')} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                    <FileText className="h-4 w-4 text-[#c92127]" /> PDF صنعتی
                  </button>
                  <button onClick={() => handleExport('xlsx')} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel (XLSX)
                  </button>
                  <button onClick={() => handleExport('csv')} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                    <FileJson className="h-4 w-4 text-[#efa73f]" /> CSV
                  </button>
                  <button onClick={() => handleExport('docx')} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                    <FileText className="h-4 w-4 text-sky-600" /> Word (DOCX)
                  </button>
                  <div className="h-px bg-slate-100 dark:bg-slate-800" />
                  <button onClick={() => handleExport('html')} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Globe className="h-4 w-4 text-sky-600" /> HTML
                  </button>
                  <button onClick={() => handleExport('json')} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                    <FileJson className="h-4 w-4 text-violet-600" /> JSON
                  </button>
                </div>
              )}
              {showExportMenu && <button className="fixed inset-0 z-10" aria-hidden onClick={() => setShowExportMenu(false)} tabIndex={-1} />}
            </div>
            {tab === 'records' && isSuperAdmin && selectedTab && (
              <button
                className="btn-secondary !h-9 !px-3.5 !text-xs font-bold shadow-sm"
                onClick={() => setBulkModalOpen(true)}
              >
                <TableProperties className="h-4 w-4" />
                ورود گروهی رکوردها
              </button>
            )}
            {tab === 'records' && canCreate && selectedTab && (
              <button className="btn-primary !h-9 !px-4 !text-xs font-bold shadow-brand-glow" onClick={openCreate}>
                <Plus className="h-4 w-4" /> ثبت رکورد جدید
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 rounded-2xl bg-[#ede7de]/70 p-1.5 dark:bg-slate-800">
        <button
          onClick={() => setTab('records')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            tab === 'records'
              ? 'bg-white text-[#0f1821] shadow-sm dark:bg-slate-700 dark:text-white'
              : 'text-slate-600 hover:text-[#0f1821] dark:text-slate-400'
          }`}
        >
          <ListChecks className="h-4 w-4 text-[#efa73f]" /> ثبت و مدیریت رکوردها
        </button>
        <button
          onClick={() => setTab('report')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            tab === 'report'
              ? 'bg-white text-[#0f1821] shadow-sm dark:bg-slate-700 dark:text-white'
              : 'text-slate-600 hover:text-[#0f1821] dark:text-slate-400'
          }`}
        >
          <BarChart3 className="h-4 w-4 text-[#efa73f]" /> گزارش و نمودار تحلیلی
        </button>
        {canManage && (
          <button
            onClick={() => setTab('widgets')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
              tab === 'widgets'
                ? 'bg-white text-[#0f1821] shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-[#0f1821] dark:text-slate-400'
            }`}
          >
            <LayoutDashboard className="h-4 w-4 text-[#efa73f]" /> طراحی گزارش و ویجت‌ها
          </button>
        )}
        {canManage && (
          <button
            onClick={() => setTab('settings')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
              tab === 'settings'
                ? 'bg-white text-[#0f1821] shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-[#0f1821] dark:text-slate-400'
            }`}
          >
            <Settings2 className="h-4 w-4 text-[#efa73f]" /> تنظیمات تب و فرمول‌ها
          </button>
        )}
      </div>

      {tab === 'widgets' && selectedTab ? (
        <ReportBuilderPanel tab={selectedTab} />
      ) : tab === 'settings' && selectedTab ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-200 bg-brand-50/60 p-3 text-xs text-brand-900 dark:border-brand-900/50 dark:bg-brand-950/20 dark:text-brand-200">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <span>قصد ایجاد یا ویرایش ویجت‌های تحلیلی، KPIها و نمودارهای این تب را دارید؟</span>
            </div>
            <button
              type="button"
              onClick={() => setTab('widgets')}
              className="btn-primary !h-7 !px-3 text-xs font-bold flex items-center gap-1"
            >
              <span>رفتن به طراحی گزارش و ویجت‌ها</span>
              <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
            </button>
          </div>
          <TabSettingsPanel tabId={selectedTab.id} onChanged={reload} />
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
            {lineMode !== 'disabled' && (
              <div className="min-w-[150px] flex-1">
                <label className="label">خط</label>
                <select className="input" value={filters.line ?? ''} onChange={(e) => setFilter('line', e.target.value)}>
                  <option value="">همه خطوط</option>
                  {selectedFactory?.lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}
            {contractorMode !== 'disabled' && (
              <div className="min-w-[140px]">
                <label className="label">پیمانکار</label>
                <select className="input" value={filters.contractor ?? ''} onChange={(e) => setFilter('contractor', e.target.value)}>
                  <option value="">همه پیمانکاران</option>
                  {selectedFactory?.contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="min-w-[130px]"><label className="label">از تاریخ</label><JalaliDateInput value={filters.date_from ?? ''} onChange={(iso) => setFilter('date_from', iso)} /></div>
            <div className="min-w-[130px]"><label className="label">تا تاریخ</label><JalaliDateInput value={filters.date_to ?? ''} onChange={(iso) => setFilter('date_to', iso)} /></div>
            <button className="btn-ghost" onClick={() => { setFilters({}); setPage(1) }}><X className="h-4 w-4" /> پاک کردن</button>
          </div>

          {tab === 'report' ? (
            <div className="space-y-3">
              <div className="card flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-ink-500 dark:text-slate-400">گزارش تب:</span>
                  {reports.length === 0 ? (
                    <span className="text-xs text-slate-400">هنوز گزارشی ایجاد نشده</span>
                  ) : (
                    reports.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setReportId(String(r.id))}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          reportId === String(r.id)
                            ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-300 dark:bg-brand-950/40 dark:text-brand-300'
                            : 'bg-ink-50 text-ink-500 hover:bg-slate-100 dark:bg-slate-800/60 dark:text-slate-400'
                        }`}
                      >
                        {r.name}{r.is_default ? ' (پیش‌فرض)' : ''}
                      </button>
                    ))
                  )}
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setTab('widgets')}
                    className="btn-secondary !h-8 !px-3 text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                    title="افزودن ویجت جدید یا ویرایش ویجت‌های این گزارش"
                  >
                    <Plus className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                    <span>افزودن و مدیریت ویجت‌ها</span>
                  </button>
                )}
              </div>
              {loadingReport ? (
                <TableSkeleton columns={6} />
              ) : !reportId ? (
                <EmptyState
                  icon={<BarChart3 className="h-10 w-10 text-brand-500" />}
                  title="گزارشی برای این تب تعریف نشده است"
                  description="برای این تب هنوز گزارشی با ویجت تعریف نشده است. از بخش «طراحی گزارش و ویجت‌ها» می‌توانید ویجت‌های تحلیلی را اضافه کنید."
                  action={
                    canManage ? (
                      <button
                        className="btn-primary mt-3 !h-9 !px-4 text-xs font-bold flex items-center gap-1.5 shadow-brand-glow"
                        onClick={() => setTab('widgets')}
                      >
                        <Plus className="h-4 w-4" />
                        <span>طراحی و ساخت ویجت‌های تب</span>
                      </button>
                    ) : undefined
                  }
                />
              ) : runData ? (
                <TabReportPanel run={runData} tab={selectedTab} onManageWidgets={() => setTab('widgets')} />
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
                  <div className="flex flex-wrap items-center justify-between border-b border-ink-100 bg-ink-50/50 px-4 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-800/40 gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                      <span className="font-bold text-ink-700 dark:text-slate-200">
                        نمایش دسته‌بندی‌شده بر اساس روز
                      </span>
                      <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {formatNumber(groupedByDay.length)} روز ثبت‌شده
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn-secondary !h-7 !px-2.5 text-xs font-semibold flex items-center gap-1.5"
                        onClick={() => setAggModalOpen(true)}
                        title="تنظیم نحوه محاسبه مجموع، میانگین، بیشینه و کمینه خروجی‌ها در خلاصه روز"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                        <span>تنظیم تجمیع روزانه</span>
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !h-7 !px-2.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-slate-800"
                        onClick={toggleAllDates}
                      >
                        {allExpanded ? 'بستن همه روزها' : 'باز کردن همه روزها'}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                          <th className="px-4 py-3 font-semibold">{isDaily ? 'تاریخ (روز)' : 'بازه تاریخ'}</th>
                          {hourMode !== 'disabled' && <th className="px-4 py-3 font-semibold">ساعت</th>}
                          {lineMode !== 'disabled' && <th className="px-4 py-3 font-semibold">خط تولید</th>}
                          {contractorMode !== 'disabled' && <th className="px-4 py-3 font-semibold">پیمانکار</th>}
                          <th className="px-4 py-3 font-semibold">خروجی‌ها (خلاصه روز / رکورد)</th>
                          <th className="px-4 py-3 font-semibold text-center">عملیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                        {groupedByDay.map((g) => {
                          const isExpanded = expandedDates[g.date] !== false
                          const hasMultiple = g.records.length > 1
                          return (
                            <Fragment key={g.date}>
                              {/* ردیف خلاصه روز */}
                              <tr
                                className="group cursor-pointer bg-slate-50/90 font-medium transition hover:bg-brand-50/40 dark:bg-slate-800/80 dark:hover:bg-slate-800"
                                onClick={() => toggleDate(g.date)}
                              >
                                <td className="px-4 py-3 text-ink-800 dark:text-slate-100">
                                  <div className="flex items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-ink-600 shadow-xs transition group-hover:bg-brand-100 group-hover:text-brand-700 dark:bg-slate-700 dark:text-slate-200">
                                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </span>
                                    <div>
                                      <span className="font-bold">{formatDateWithWeekday(g.date)}</span>
                                      <span className={`mr-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                        hasMultiple
                                          ? 'bg-brand-100 text-brand-800 dark:bg-brand-950/60 dark:text-brand-300'
                                          : 'bg-slate-200/70 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                      }`}>
                                        {formatNumber(g.records.length)} رکورد
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                {hourMode !== 'disabled' && (
                                  <td className="px-4 py-3 text-xs text-ink-500 dark:text-slate-400">
                                    {hasMultiple
                                      ? `${g.records.length} نوبت ثبت`
                                      : (g.records[0]?.hour || '').slice(0, 5) || '—'}
                                  </td>
                                )}
                                {lineMode !== 'disabled' && (
                                  <td className="px-4 py-3 text-xs text-ink-600 dark:text-slate-300">
                                    {g.lineNames.length ? g.lineNames.join('، ') : '—'}
                                  </td>
                                )}
                                {contractorMode !== 'disabled' && (
                                  <td className="px-4 py-3 text-xs text-ink-500 dark:text-slate-400">
                                    {g.contractorNames.length ? g.contractorNames.join('، ') : '—'}
                                  </td>
                                )}
                                <td className="px-4 py-3">
                                  <div className="flex max-w-[460px] flex-wrap gap-1.5">
                                    {g.aggregatedOutputs.length === 0 ? (
                                      <span className="text-xs text-slate-400">—</span>
                                    ) : (
                                      g.aggregatedOutputs.map((item) => (
                                        <button
                                          key={item.key}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            cycleAggMode(item.key, item.name)
                                          }}
                                          className="group/chip inline-flex items-center gap-1 rounded-xl border border-brand-200 bg-white px-2 py-1 text-xs font-medium text-brand-900 shadow-2xs transition hover:border-brand-500 hover:bg-brand-50/70 hover:shadow-xs dark:border-brand-800 dark:bg-slate-900 dark:text-brand-300 dark:hover:border-brand-600 dark:hover:bg-slate-800 cursor-pointer"
                                          title={`حالت محاسبه: ${item.modeLabel} (${item.name}) — برای تغییر سریع حالت کلیک کنید`}
                                        >
                                          <span className="text-ink-500 dark:text-slate-400">
                                            {hasMultiple && (
                                              <span className="font-bold text-brand-700 dark:text-brand-300">
                                                {item.modeLabel}{' '}
                                              </span>
                                            )}
                                            {item.name}:
                                          </span>
                                          <span className="font-bold text-brand-600 dark:text-brand-400">
                                            {formatNumber(item.value, 2)}
                                          </span>
                                          {item.unit && (
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                              {item.unit}
                                            </span>
                                          )}
                                        </button>
                                      ))
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">
                                    {isExpanded ? 'بستن ردیف‌ها' : 'مشاهده ردیف‌ها'}
                                  </span>
                                </td>
                              </tr>

                              {/* ردیف‌های بازشونده فرزند این روز */}
                              {isExpanded && g.records.map((p, idx) => (
                                <tr
                                  key={p.id}
                                  className="border-b border-ink-100/60 bg-white/70 transition hover:bg-ink-50/50 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-800/40"
                                >
                                  <td className="pr-10 pl-4 py-2.5 text-xs text-ink-600 dark:text-slate-300">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">#{idx + 1}</span>
                                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200" dir="ltr">
                                        {isDaily ? formatDate(p.date_from) : `${formatDate(p.date_from)} تا ${formatDate(p.date_to)}`}
                                      </span>
                                      {p.note ? (
                                        <span className="text-ink-600 italic text-[11px] dark:text-slate-400">({p.note})</span>
                                      ) : null}
                                    </div>
                                  </td>
                                  {hourMode !== 'disabled' && (
                                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300" dir="ltr">
                                      {(p.hour || '').slice(0, 5) || '—'}
                                    </td>
                                  )}
                                  {lineMode !== 'disabled' && (
                                    <td className="px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300">
                                      {p.line?.name ?? '—'}
                                    </td>
                                  )}
                                  {contractorMode !== 'disabled' && (
                                    <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400">
                                      {p.contractor?.name ?? '—'}
                                    </td>
                                  )}
                                  <td className="px-4 py-2.5">
                                    <div className="flex max-w-[380px] flex-wrap gap-1">
                                      {Object.entries(p.outputs || {}).map(([k, v]) => (
                                        <span key={k} className="chip text-[11px]" title={k}>
                                          {tabOutputLabel(selectedTab, k)}: <span className="font-semibold text-brand-600 dark:text-brand-400">{formatNumber(v, 2)}</span>
                                        </span>
                                      ))}
                                    </div>
                                    {p.linked_records_detail?.length ? (
                                      <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-amber-700 dark:text-amber-300">
                                        {p.linked_records_detail.map((d) => (
                                          <span key={d.tab_key} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 dark:border-amber-800 dark:bg-amber-950/30">
                                            {d.tab_name}: {formatDate(d.date_from!)}#{d.record_id}
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center justify-center gap-1">
                                      {canEdit && (
                                        <button
                                          className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-slate-800"
                                          onClick={() => openEdit(p)}
                                          title="ویرایش این رکورد"
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </button>
                                      )}
                                      {canDelete && (
                                        <button
                                          className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                                          onClick={() => setConfirmId(p.id)}
                                          title="حذف این رکورد"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      )}
                                      {!canEdit && !canDelete && <span className="text-xs text-slate-400">—</span>}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </Fragment>
                          )
                        })}
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

      {bulkModalOpen && selectedTab && (
        <BulkRecordModal
          open={bulkModalOpen}
          onClose={() => setBulkModalOpen(false)}
          tab={selectedTab}
          schema={tabSchema}
          onSuccess={load}
        />
      )}

      {selectedTab && (
        <DailyAggregationsModal
          open={aggModalOpen}
          onClose={() => setAggModalOpen(false)}
          tab={selectedTab}
          extraOutputKeys={Array.from(new Set(sorted.flatMap((r) => Object.keys(r.outputs || {}))))}
          customAggModes={customAggModes}
          onSetMode={setOutputAggMode}
          onReset={resetAggModes}
        />
      )}
    </div>
  )
}
