import { useEffect, useMemo, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Filter, Loader2, Truck, BarChart3, ListChecks, AlertTriangle, Download, FileText, FileSpreadsheet, FileJson, Globe, ChevronDown, Activity, Settings2 } from 'lucide-react'
import TonnageDefinitionPanel from '../components/tonnage/TonnageDefinitionPanel'
import { useFactory } from '../store/FactoryContext'
import { useAuth } from '../store/AuthContext'
import { hasPerm } from '../constants'
import { useToast } from '../components/ui/Toast'
import {
  getDeliveredTonnages, fetchAllDeliveredTonnages, createDeliveredTonnage,
  updateDeliveredTonnage, deleteDeliveredTonnage, getTonnageSchema,
} from '../api/tonnage'
import type { DeliveredTonnage, DeliveredTonnagePayload, DeliveredTonnageFilters, TonnageSchema } from '../types'
import { EmptyState, ErrorBanner, TableSkeleton } from '../components/ui/States'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import JalaliDateInput from '../components/ui/JalaliDateInput'
import { formatDate, formatNumber, todayISO } from '../utils'
import { lineTonnageOutputLabel } from '../utils/outputLabels'
import { exportData } from '../utils/exports'
import type { ExportFormat } from '../utils/exports'
import { addReportHistoryEntry } from '../features/reportHistory'
import TonnageReportPanel from '../components/tonnage/TonnageReportPanel'

type FormState = {
  line: string
  contractor: string
  date: string
  hour: string
  note: string
  values: Record<string, string>
}

const emptyForm: FormState = { line: '', contractor: '', date: todayISO(), hour: '', note: '', values: {} }

function TonnageForm({ form, setForm, editing }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; editing: DeliveredTonnage | null }) {
  const { selectedFactory } = useFactory()
  const [schema, setSchema] = useState<TonnageSchema | null>(null)
  const [loadingSchema, setLoadingSchema] = useState(false)

  const set = (k: keyof FormState, v: string) => setForm((prev) => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!form.line) {
      setSchema(null)
      return
    }
    setLoadingSchema(true)
    getTonnageSchema(Number(form.line))
      .then((s) => {
        setSchema(s)
        if (editing) {
          const seed: Record<string, string> = {}
          s.inputs.forEach((inp) => {
            const v = editing.inputs?.[inp.key]
            if (v !== undefined && v !== null && v !== '') seed[inp.key] = String(v)
          })
          setForm((prev) => ({ ...prev, values: seed }))
        } else {
          setForm((prev) => ({ ...prev, values: {} }))
        }
      })
      .catch(() => setSchema(null))
      .finally(() => setLoadingSchema(false))
  }, [form.line]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">خط تولید *</label>
          <select className="input" value={form.line} onChange={(e) => set('line', e.target.value)}>
            <option value="">انتخاب خط</option>
            {selectedFactory?.lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">پیمانکار</label>
          <select className="input" value={form.contractor} onChange={(e) => set('contractor', e.target.value)}>
            <option value="">بدون پیمانکار</option>
            {selectedFactory?.contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">تاریخ تحویل (بازه مجاز: چند رکورد در روز) *</label>
          <JalaliDateInput value={form.date} onChange={(iso) => set('date', iso)} />
        </div>
        <div>
          <label className="label">ساعت تحویل *</label>
          <input type="time" className="input" value={form.hour} onChange={(e) => set('hour', e.target.value)} />
        </div>
      </div>

      {loadingSchema && (
        <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> در حال بارگذاری تعریف تناژ خط...
        </div>
      )}

      {schema && !schema.defined && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          برای این خط تولید تعریف تناژ تحویلی (ورودی\u200cها/خروجی\u200cها و فرمول\u200cها) ثبت نشده است.
        </div>
      )}

      {schema?.defined && schema.inputs.length === 0 && (
        <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-500 dark:bg-slate-800/60 dark:text-slate-400">
          ورودی\u200cای برای این خط تعریف نشده است.
        </div>
      )}

      {schema?.defined && schema.inputs.length > 0 && (
        <fieldset className="rounded-xl border border-ink-100 p-3 dark:border-slate-700">
          <legend className="rounded-lg bg-ink-50 px-2 py-0.5 text-xs font-bold text-ink-700 dark:bg-slate-800 dark:text-slate-200">
            ورودی\u200cهای تناژ تحویلی
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {schema.inputs.map((inp) => (
              <div key={inp.id}>
                <label className="label">
                  {inp.name} {inp.required && <span className="text-rose-500">*</span>}
                  {inp.unit && <span className="mr-1 badge bg-ink-100 text-ink-500 dark:bg-slate-700 dark:text-slate-300">{inp.unit}</span>}
                </label>
                <input
                  type={inp.type === 'number' ? 'number' : 'text'}
                  step={inp.type === 'number' ? 'any' : undefined}
                  className="input"
                  value={form.values[inp.key] ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, values: { ...prev.values, [inp.key]: e.target.value } }))}
                  placeholder={inp.type === 'number' ? 'عدد...' : 'متن...'}
                />
              </div>
            ))}
          </div>
        </fieldset>
      )}

      {schema?.defined && schema.outputs.length > 0 && (
        <div className="rounded-lg border border-dashed border-brand-200 bg-brand-50/40 p-3 dark:border-brand-900/50 dark:bg-brand-950/20">
          <div className="mb-1.5 text-xs font-bold text-brand-700 dark:text-brand-300">خروجی\u200cهای خودکار (پس از ثبت محاسبه می\u200cشوند)</div>
          <div className="flex flex-wrap gap-1.5">
            {schema.outputs.map((o) => (
              <span key={o.id} className="chip">{o.name} {o.unit && <span className="text-[10px] text-ink-400">{o.unit}</span>}</span>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="label">توضیحات / ملاحظات</label>
        <textarea className="input min-h-[70px]" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="اختیاری" />
      </div>
    </div>
  )
}

export default function Tonnage() {
  const { selectedFactory } = useFactory()
  const { user } = useAuth()
  const { notify } = useToast()
  const canCreate = hasPerm(user?.permissions, 'tonnage.create') || hasPerm(user?.permissions, 'production.create')
  const canEdit = hasPerm(user?.permissions, 'tonnage.edit') || hasPerm(user?.permissions, 'production.edit')
  const canDelete = hasPerm(user?.permissions, 'tonnage.delete') || hasPerm(user?.permissions, 'production.delete')
  const canExport = hasPerm(user?.permissions, 'reports.export') || hasPerm(user?.permissions, 'reports.view') || hasPerm(user?.permissions, 'tonnage.view')

  const [tab, setTab] = useState<'records' | 'report' | 'definition'>('records')
  const [items, setItems] = useState<DeliveredTonnage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<DeliveredTonnageFilters>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DeliveredTonnage | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(30)
  const [totalCount, setTotalCount] = useState(0)

  const [reportRecords, setReportRecords] = useState<DeliveredTonnage[]>([])
  const [loadingReport, setLoadingReport] = useState(false)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const lineIds = useMemo(() => (selectedFactory?.lines ?? []).map((l) => l.id), [selectedFactory])

  const load = useCallback(() => {
    setLoading(true)
    const merged = { ...filters } as any
    if (lineIds.length) merged.lines = lineIds.join(',')
    getDeliveredTonnages(merged, page, pageSize)
      .then((data) => { setItems(data.results); setTotalCount(data.count); setError(null) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filters, page, pageSize, lineIds])

  const loadReport = useCallback(() => {
    setLoadingReport(true)
    const merged: Record<string, unknown> = { ...filters }
    if (lineIds.length) merged.lines = lineIds.join(',')
    fetchAllDeliveredTonnages(merged as DeliveredTonnageFilters, 500)
      .then(setReportRecords)
      .catch((e) => notify(e.message || 'خطا در دریافت داده گزارش', 'error'))
      .finally(() => setLoadingReport(false))
  }, [filters, lineIds, notify])

  useEffect(() => { if (selectedFactory) load() }, [selectedFactory, load])
  useEffect(() => { if (tab === 'report' && selectedFactory) loadReport() }, [tab, selectedFactory, loadReport])

  const onSaved = () => {
    load()
    if (tab === 'report') loadReport()
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, line: String(selectedFactory?.lines[0]?.id ?? '') })
    setModalOpen(true)
  }

  const openEdit = (p: DeliveredTonnage) => {
    setEditing(p)
    setForm({
      line: String(p.line.id),
      contractor: p.contractor ? String(p.contractor.id) : '',
      date: p.date,
      hour: p.hour.slice(0, 5),
      note: p.note || '',
      values: {},
    })
    setModalOpen(true)
  }

  const submit = async () => {
    if (!form.line || !form.date) { notify('خط تولید و تاریخ الزامی هستند', 'error'); return }
    if (!form.hour) { notify('ساعت تحویل الزامی است', 'error'); return }
    const inputs: Record<string, number | string> = {}
    Object.entries(form.values).forEach(([k, raw]) => {
      const v = (raw ?? '').trim()
      if (v !== '') inputs[k] = isNaN(Number(v)) ? v : Number(v)
    })
    const payload: DeliveredTonnagePayload = {
      line_id: Number(form.line),
      contractor_id: form.contractor ? Number(form.contractor) : null,
      date: form.date,
      hour: form.hour,
      inputs,
      note: form.note,
    }
    setSaving(true)
    try {
      if (editing) { await updateDeliveredTonnage(editing.id, payload); notify('تناژ تحویلی ویرایش شد') }
      else { await createDeliveredTonnage(payload); notify('تناژ تحویلی ثبت شد') }
      setModalOpen(false); onSaved()
    } catch (e: any) { notify(e.message || 'خطا در ذخیره\u200cسازی', 'error') }
    finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (confirmId == null) return
    try { await deleteDeliveredTonnage(confirmId); notify('رکورد حذف شد'); setConfirmId(null); onSaved() }
    catch (e: any) { notify(e.message || 'خطا در حذف', 'error') }
  }

  const setFilter = (k: keyof DeliveredTonnageFilters, v: string) => { setPage(1); setFilters((prev) => ({ ...prev, [k]: v === '' ? undefined : (v as any) })) }

  const handleExport = async (fmt: ExportFormat) => {
    if (!canExport) { notify('شما دسترسی خروجی ندارید', 'error'); return }
    const src = tab === 'report' ? reportRecords : items
    const total = tab === 'report' ? reportRecords.length : totalCount
    if (!src.length && !total) { notify('داده‌ای برای خروجی وجود ندارد', 'error'); return }
    setExporting(fmt); setShowExportMenu(false)
    try {
      const merged: Record<string, unknown> = { ...filters } as any
      if (lineIds.length) merged.lines = lineIds.join(',')
      let allRecords: DeliveredTonnage[] = tab === 'report' ? reportRecords : src as DeliveredTonnage[]
      if (tab !== 'report' && totalCount > (src as DeliveredTonnage[]).length) {
        allRecords = await fetchAllDeliveredTonnages(merged as unknown as DeliveredTonnageFilters, 500)
      } else if (tab === 'report' && !allRecords.length) {
        allRecords = await fetchAllDeliveredTonnages(merged as unknown as DeliveredTonnageFilters, 500)
      }
      if (!allRecords.length) { notify('داده‌ای برای خروجی وجود ندارد', 'error'); return }
      const dateFrom = (filters.date_from as string) || ''
      const dateTo = (filters.date_to as string) || ''
      const hasDate = !!dateFrom || !!dateTo
      const baseName = `تناژ_تحویلی_${selectedFactory?.name ?? 'گزارش'}_${hasDate ? `${dateFrom || 'ابتدا'}_${dateTo || 'اکنون'}` : 'همه'}`
      const titleDate = hasDate ? `${dateFrom ? formatDate(dateFrom) : 'ابتدا'} تا ${dateTo ? formatDate(dateTo) : 'اکنون'}` : 'همه داده‌ها'
      const title = `تناژ تحویلی خطوط تولید — ${selectedFactory?.name ?? ''} — ${titleDate}`
      const lineName = filters.line ? (selectedFactory?.lines.find(l => l.id === Number(filters.line))?.name ?? String(filters.line)) : ''
      const contractorName = filters.contractor ? (selectedFactory?.contractors.find(c => c.id === Number(filters.contractor))?.name ?? String(filters.contractor)) : ''
      const chips: { label: string; value: string }[] = []
      if (lineName) chips.push({ label: 'خط', value: lineName })
      if (contractorName) chips.push({ label: 'پیمانکار', value: contractorName })
      if (dateFrom) chips.push({ label: 'از تاریخ', value: formatDate(dateFrom) })
      if (dateTo) chips.push({ label: 'تا تاریخ', value: formatDate(dateTo) })
      if (!chips.length) chips.push({ label: 'بازه', value: titleDate })
      let outputKeys2: string[] = []
      if (fmt === 'pdf') {
        const { buildTonnageReport } = await import('../templates/pdf/reports/tonnageReport')
        const { buildPdfHtml } = await import('../utils/pdf/renderer')
        const { htmlToPdf } = await import('../utils/pdf/printer')
        const opts = buildTonnageReport({ title, factoryName: selectedFactory?.name ?? '', factoryAddress: selectedFactory?.address, dateFrom, dateTo, records: allRecords, chips })
        const html = buildPdfHtml(opts)
        htmlToPdf(html, baseName, { title })
      } else {
        outputKeys2 = Array.from(new Set(allRecords.flatMap(r => Object.keys(r.outputs || {})))).sort((a, b) => a.localeCompare(b, 'fa'))
        const rows: Record<string, string | number>[] = allRecords.map(r => {
          const row: Record<string, string | number> = {
            'تاریخ': formatDate(r.date),
            'ساعت': (r.hour || '').slice(0, 5),
            'خط': r.line?.name || '—',
            'پیمانکار': r.contractor?.name || '—',
          }
          outputKeys2.forEach(k => {
            const v = (r.outputs as Record<string, number>)[k]
            row[lineTonnageOutputLabel(selectedFactory, r.line?.id, k)] = typeof v === 'number' ? Math.round(v * 10) / 10 : (v as string | number) ?? '—'
          })
          if (r.note) row['یادداشت'] = r.note.slice(0, 60)
          return row
        })
        await exportData(rows, { fileName: baseName, title, factoryName: selectedFactory?.name ?? '', dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, format: fmt, outputLabelMap: Object.fromEntries(outputKeys2.map(k => [k, lineTonnageOutputLabel(selectedFactory, allRecords[0]?.line?.id, k)])) })
      }
      addReportHistoryEntry({
        kind: 'tonnage', factoryName: selectedFactory?.name, fileName: `${baseName}.${fmt}`, title, format: fmt,
        recordCount: allRecords.length,
        dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
        chips, filters: { line: filters.line as any, contractor: filters.contractor as any, date_from: dateFrom, date_to: dateTo },
      })
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'خطا در خروجی', 'error')
    } finally { setExporting(null) }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const sorted = [...items].sort((a, b) => (b.date + b.hour).localeCompare(a.date + a.hour))

  return (
    <div className="animate-fade-in space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 sm:flex"><Truck className="h-5 w-5" /></div>
            <div>
              <h1 className="flex items-center gap-2 text-[17px] font-extrabold tracking-tight text-slate-900 dark:text-white">تناژ تحویلی خطوط تولید <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:inline-flex">{selectedFactory?.name ?? '—'}</span></h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><Activity className="h-3 w-3" />{formatNumber(totalCount)} رکورد</span>
                {sorted.length > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"><Truck className="h-3 w-3" />{Object.keys(sorted[0]?.outputs || {}).length} خروجی</span>}
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
                  <button onClick={() => handleExport('pdf')} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><FileText className="h-4 w-4 text-rose-600" /> PDF صنعتی <span className="mr-auto text-xs text-slate-400">KPI + نمودار</span></button>
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
            {tab === 'records' && canCreate && <button className="btn-primary !h-[42px] !px-5 !text-sm shadow-sm" onClick={openCreate}><Plus className="h-4 w-4" /> ثبت تناژ تحویلی</button>}
          </div>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl bg-ink-100/60 p-1 dark:bg-slate-800">
        <button
          onClick={() => setTab('records')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'records' ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-brand-400' : 'text-ink-500 dark:text-slate-400'}`}
        >
          <ListChecks className="h-4 w-4" /> ثبت / مدیریت تناژ
        </button>
        <button
          onClick={() => setTab('report')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'report' ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-brand-400' : 'text-ink-500 dark:text-slate-400'}`}
        >
          <BarChart3 className="h-4 w-4" /> گزارش تناژ تحویلی
        </button>
        <button
          onClick={() => setTab('definition')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'definition' ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-brand-400' : 'text-ink-500 dark:text-slate-400'}`}
        >
          <Settings2 className="h-4 w-4" /> تعریف ورودی/خروجی
        </button>
      </div>

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

      {tab === 'definition' ? (
        <TonnageDefinitionPanel />
      ) : tab === 'records' ? (
        <>
          {error && <ErrorBanner message={error} onRetry={load} />}
          {loading ? (
            <TableSkeleton columns={6} />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={<Truck className="h-10 w-10" />}
              title="رکوردی یافت نشد"
              description="برای این فیلترها تناژ تحویلی ثبت نشده است."
              action={<button className="btn-primary mt-2" onClick={openCreate}><Plus className="h-4 w-4" /> ثبت اولین تناژ</button>}
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                      <th className="px-4 py-3 font-semibold">تاریخ</th>
                      <th className="px-4 py-3 font-semibold">ساعت</th>
                      <th className="px-4 py-3 font-semibold">خط</th>
                      <th className="px-4 py-3 font-semibold">پیمانکار</th>
                      <th className="px-4 py-3 font-semibold">خروجی های محاسبه شده</th>
                      <th className="px-4 py-3 font-semibold text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                    {sorted.map((p) => (
                      <tr key={p.id} className="transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">
                          {formatDate(p.date)}
                          {p.note && <div className="text-[11px] font-normal text-ink-400">{p.note}</div>}
                        </td>
                        <td className="px-4 py-3 dark:text-slate-300" dir="ltr">{p.hour.slice(0, 5)}</td>
                        <td className="px-4 py-3 dark:text-slate-300">{p.line.name}</td>
                        <td className="px-4 py-3 text-ink-600 dark:text-slate-400">{p.contractor?.name ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex max-w-[380px] flex-wrap gap-1">
                            {Object.entries(p.outputs || {}).map(([k, v]) => (
                              <span key={k} className="chip" title={k}>
                                {lineTonnageOutputLabel(selectedFactory, p.line?.id, k)}: <span className="font-semibold text-brand-600">{formatNumber(v)}</span>
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
      ) : (
        <div className="space-y-3">
          {loadingReport ? (
            <TableSkeleton columns={6} />
          ) : reportRecords.length === 0 ? (
            <EmptyState icon={<BarChart3 className="h-10 w-10" />} title="داده‌ای برای گزارش نیست" description="برای فیلترهای بالا رکوردی یافت نشد. فیلترها را تغییر دهید." />
          ) : (
            <TonnageReportPanel records={reportRecords} />
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'ویرایش تناژ تحویلی' : 'ثبت تناژ تحویلی'} subtitle={selectedFactory?.name} size="lg"
        footer={<><button className="btn-ghost" onClick={() => setModalOpen(false)}>انصراف</button><button className="btn-primary" onClick={submit} disabled={saving}>{saving ? 'در حال ذخیره...' : editing ? 'ذخیره تغییرات' : 'ثبت تناژ'}</button></>}>
        <TonnageForm form={form} setForm={setForm} editing={editing} />
      </Modal>

      <Modal open={confirmId != null} onClose={() => setConfirmId(null)} title="حذف رکورد تناژ"
        footer={<><button className="btn-ghost" onClick={() => setConfirmId(null)}>انصراف</button><button className="btn-danger" onClick={confirmDelete}><Trash2 className="h-4 w-4" /> حذف قطعی</button></>}>
        <p className="text-sm text-ink-700 dark:text-slate-300">آیا از حذف این رکورد تناژ تحویلی اطمینان دارید؟</p>
      </Modal>
    </div>
  )
}