import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Filter, X, ClipboardList, Layers, Search, ArrowUpDown, Download, FileText, FileSpreadsheet, FileJson, Globe, ChevronDown, Sparkles, Clock, Activity, BarChart3 } from 'lucide-react'
import DowntimeReportPanel from '../components/downtime/DowntimeReportPanel'
import { useFactory } from '../store/FactoryContext'
import { useAuth } from '../store/AuthContext'
import { hasPerm } from '../constants'
import { addReportHistoryEntry } from '../features/reportHistory'
import { createLog, updateLog, deleteLog } from '../api/logs'
import type { DeviceLog, DeviceLogPayload } from '../types'
import { useToast } from '../components/ui/Toast'
import { ErrorBanner, EmptyState, TableSkeleton } from '../components/ui/States'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import JalaliDateInput from '../components/ui/JalaliDateInput'
import { formatDate, formatNumber, todayISO, shiftHours, formatHours, parseHoursHM } from '../utils'
import { useReportState } from '../features/reports/useReportState'
import { PRESETS } from '../features/reports/reportFilters'
import { buildDowntimeReport } from '../templates/pdf/reports/downtimeReport'
import { buildPdfHtml } from '../utils/pdf/renderer'
import { htmlToPdf } from '../utils/pdf/printer'
import { exportData } from '../utils/exports'
import type { ExportFormat } from '../utils/exports'

type RowState = { device: string; failure_cause: string; downtime_hours: string; failure_description: string; repair_description: string }
type FormState = { line: string; shift: string; date: string; rows: RowState[] }
const emptyRow: RowState = { device: '', failure_cause: '', downtime_hours: '0:00', failure_description: '', repair_description: '' }
const emptyForm: FormState = { line: '', shift: '', date: todayISO(), rows: [{ ...emptyRow }] }

function LogForm({ form, setForm, editing }: { form: FormState; setForm: (f: FormState) => void; editing: DeviceLog | null }) {
  const { selectedFactory } = useFactory()
  const selectedLine = useMemo(() => selectedFactory?.lines.find((l) => l.id === Number(form.line)), [form.line, selectedFactory])
  const shifts = useMemo(() => selectedLine?.shifts ?? selectedFactory?.shifts ?? [], [selectedLine, selectedFactory])
  const lineDevices = useMemo(() => selectedLine?.devices ?? [], [selectedLine])
  const selectedShift = useMemo(() => shifts.find((s) => s.id === Number(form.shift)), [shifts, form.shift])
  const totalShiftHours = useMemo(() => shiftHours(selectedShift?.start_time, selectedShift?.end_time), [selectedShift])
  const totalDowntime = useMemo(() => form.rows.reduce((s, r) => s + parseHoursHM(r.downtime_hours), 0), [form.rows])
  const runtime = Math.max(0, totalShiftHours - totalDowntime)
  const downtimeWarning = totalDowntime > totalShiftHours
  const onLineChange = (v: string) => setForm({ ...form, line: v, shift: '' })
  const setRow = (idx: number, k: keyof RowState, v: string) => {
    let nv = v
    if (k === 'downtime_hours') {
      const cleaned = v.replace(/[^0-9:۰-۹٠-٩]/g, '')
      nv = cleaned
    }
    setForm({ ...form, rows: form.rows.map((r, i) => (i === idx ? { ...r, [k]: nv } : r)) })
  }
  const addRow = () => setForm({ ...form, rows: [...form.rows, { ...emptyRow }] })
  const removeRow = (idx: number) => { if (form.rows.length <= 1) return; setForm({ ...form, rows: form.rows.filter((_, i) => i !== idx) }) }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label">خط تولید *</label>
          <select className="input" value={form.line} onChange={(e) => onLineChange(e.target.value)}>
            <option value="">انتخاب خط</option>
            {selectedFactory?.lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">شیفت *</label>
          <select className="input" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} disabled={!form.line}>
            <option value="">انتخاب شیفت</option>
            {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.start_time.slice(0, 5)}-{s.end_time.slice(0, 5)})</option>)}
          </select>
        </div>
        <div>
          <label className="label">تاریخ *</label>
          <JalaliDateInput value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} />
        </div>
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-sm font-bold text-ink-700 dark:text-slate-200"><Layers className="h-4 w-4 text-brand-600" /> توقف‌های این گزارش <span className="chip">برای این خط/شیفت/تاریخ</span></div>
          {!editing && <button type="button" className="btn-ghost !h-9 !px-3 text-xs" onClick={addRow}><Plus className="h-4 w-4" /> افزودن ردیف توقف</button>}
        </div>
        {form.rows.map((row, idx) => (
          <div key={idx} className="mb-3 rounded-xl border border-ink-100 p-3 dark:border-slate-700">
            <div className="mb-2 flex items-center justify-between">
              <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">توقف {idx + 1}</span>
              {!editing && form.rows.length > 1 && <button type="button" className="rounded-lg p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => removeRow(idx)} title="حذف ردیف"><Trash2 className="h-4 w-4" /></button>}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="label">دستگاه</label>
                <select className="input" value={row.device} onChange={(e) => setRow(idx, 'device', e.target.value)} disabled={!form.line}>
                  <option value="">بدون دستگاه</option>
                  {lineDevices.map((d) => <option key={d.id} value={d.id}>{d.code ? `${d.code} - ${d.name}` : d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">علت خرابی</label>
                <select className="input" value={row.failure_cause} onChange={(e) => setRow(idx, 'failure_cause', e.target.value)}>
                  <option value="">بدون علت</option>
                  {selectedFactory?.failure_reasons.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
                </select>
              </div>
              <div>
                <label className="label">ساعت توقف</label>
                <input type="text" inputMode="numeric" placeholder="0:00" dir="ltr" className="input text-center tracking-widest" value={row.downtime_hours} onChange={(e) => setRow(idx, 'downtime_hours', e.target.value)} />
                <span className="mt-1 block text-[11px] text-ink-400">فرمت HH:MM — مثال 1:30</span>
              </div>
              <div className="sm:col-span-3"><label className="label">توضیحات خرابی</label><textarea className="input min-h-[56px]" value={row.failure_description} onChange={(e) => setRow(idx, 'failure_description', e.target.value)} /></div>
              <div className="sm:col-span-3"><label className="label">شرح اقدامات / تعمیرات</label><textarea className="input min-h-[56px]" value={row.repair_description} onChange={(e) => setRow(idx, 'repair_description', e.target.value)} /></div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/50">
        <div className="mb-1 flex flex-wrap items-center justify-between text-xs text-ink-500 dark:text-slate-400">
          <span>طول شیفت: {formatHours(totalShiftHours)}</span>
          <span>مجموع توقف: {formatHours(totalDowntime)} ({form.rows.length} ردیف)</span>
        </div>
        <div className="flex items-center justify-between"><span className="font-medium text-ink-700 dark:text-slate-200">ساعت کارکرد مفید</span><span className="text-lg font-extrabold tabular-nums text-emerald-600" dir="ltr">{formatHours(runtime)}</span></div>
        {downtimeWarning && <div className="mt-2 rounded-md bg-rose-50 px-3 py-1.5 text-xs text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">مجموع توقف از طول شیفت بیشتر است.</div>}
      </div>
    </div>
  )
}

export default function Logs() {
  const { selectedFactory } = useFactory()
  const { user } = useAuth()
  const { notify } = useToast()
  const canExport = hasPerm(user?.permissions, 'reports.export') || hasPerm(user?.permissions, 'reports.view')
  const canCreate = hasPerm(user?.permissions, 'logs.create')
  const canEdit = hasPerm(user?.permissions, 'logs.edit')
  const canDelete = hasPerm(user?.permissions, 'logs.delete')
  const report = useReportState({}, 30)
  const [tab, setTab] = useState<'list' | 'report'>('list')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DeviceLog | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const allDevices = useMemo(() => (selectedFactory?.lines ?? []).flatMap((l) => l.devices.map((d) => ({ ...d, lineName: l.name }))), [selectedFactory])

  const stats = useMemo(() => {
    const rows = report.sorted
    const totalDown = rows.reduce((s, r) => s + (r.downtime_hours || 0), 0)
    const totalRun = rows.reduce((s, r) => s + (r.runtime_hours || 0), 0)
    const withDown = rows.filter((r) => r.downtime_hours > 0).length
    return { total: rows.length, totalDown, totalRun, withDown, withoutDown: rows.length - withDown }
  }, [report.sorted])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, line: String(selectedFactory?.lines[0]?.id ?? ''), rows: [{ ...emptyRow }] })
    setModalOpen(true)
  }
  const openEdit = (log: DeviceLog) => {
    setEditing(log)
    setForm({
      line: String(log.line.id), shift: String(log.shift.id), date: log.date,
      rows: [{ device: log.device ? String(log.device.id) : '', failure_cause: log.failure_cause ? String(log.failure_cause.id) : '', downtime_hours: formatHours(log.downtime_hours), failure_description: log.failure_description ?? '', repair_description: log.repair_description ?? '' }],
    })
    setModalOpen(true)
  }
  const computeShift = (shiftId: number, down: number): number => {
    const allShifts = selectedFactory ? [...(selectedFactory.shifts ?? []), ...selectedFactory.lines.flatMap(l => (l as any).shifts ?? [])] : []
    const shift = allShifts.find((s) => s.id === shiftId)
    return Math.max(0, shiftHours(shift?.start_time, shift?.end_time) - down)
  }
  const submit = async () => {
    if (!form.line || !form.shift || !form.date) { notify('خط، شیفت و تاریخ الزامی هستند', 'error'); return }
    if (form.rows.length === 0) { notify('حداقل یک ردیف توقف وارد کنید', 'error'); return }
    const line = Number(form.line); const shift = Number(form.shift)
    const buildPayload = (row: RowState): DeviceLogPayload => {
      const down = parseHoursHM(row.downtime_hours)
      return {
        line, shift, date: form.date,
        device: row.device ? Number(row.device) : null,
        failure_cause: row.failure_cause ? Number(row.failure_cause) : null,
        runtime_hours: computeShift(shift, down),
        downtime_hours: down,
        failure_description: row.failure_description,
        repair_description: row.repair_description,
      }
    }
    setSaving(true)
    try {
      if (editing) { await updateLog(editing.id, buildPayload(form.rows[0])); notify('توقف خط تولید با موفقیت ویرایش شد') }
      else { for (const row of form.rows) await createLog(buildPayload(row)); notify(`توقف خط تولید ثبت شد (${form.rows.length} ردیف توقف)`) }
      setModalOpen(false); report.reload()
    } catch (e: unknown) { notify(e instanceof Error ? e.message : 'خطا در ذخیره‌سازی', 'error') } finally { setSaving(false) }
  }
  const confirmDelete = async () => {
    if (confirmId == null) return
    try { await deleteLog(confirmId); notify('توقف حذف شد'); setConfirmId(null); report.reload() }
    catch (e: unknown) { notify(e instanceof Error ? e.message : 'خطا در حذف', 'error') }
  }

  const handleExport = async (fmt: ExportFormat) => {
    if (!canExport) { notify('شما دسترسی خروجی ندارید', 'error'); return }
    if (!report.sorted.length) { notify('داده‌ای برای خروجی وجود ندارد', 'error'); return }
    setExporting(fmt); setShowExportMenu(false)
    const hasDate = !!report.filters.date_from || !!report.filters.date_to
    const baseName = `توقفات_${selectedFactory?.name ?? 'گزارش'}_${hasDate ? `${report.filters.date_from || 'همه'}_${report.filters.date_to || 'همه'}` : 'همه_داده'}`
    const titleDate = hasDate ? `${report.filters.date_from ? formatDate(report.filters.date_from) : 'ابتدا'} تا ${report.filters.date_to ? formatDate(report.filters.date_to) : 'اکنون'}` : 'همه داده‌ها'
    const title = `توقفات خط تولید — ${selectedFactory?.name ?? ''} — ${titleDate}`
    const chips = report.chips.map(c => ({ label: c.label, value: c.value }))
    const filtersRec: Record<string, unknown> = {
      line: report.filters.line, shift: report.filters.shift, device: report.filters.device, failure_cause: report.filters.failure_cause,
      date_from: report.filters.date_from, date_to: report.filters.date_to, search: report.filters.search, sortKey: report.filters.sortKey, sortDir: report.filters.sortDir,
    }
    try {
      if (fmt === 'pdf') {
        const rows = report.sorted.map((l) => ({
          date: l.date, line: l.line.name, shift: l.shift.name,
          device: l.device?.name ?? '—', cause: l.failure_cause?.title ?? '—',
          downtime_hours: l.downtime_hours, runtime_hours: l.runtime_hours, efficiency: l.efficiency ?? 0,
        }))
        const opts = buildDowntimeReport({
          title, factoryName: selectedFactory?.name ?? '', factoryAddress: selectedFactory?.address,
          dateFrom: report.filters.date_from || '', dateTo: report.filters.date_to || '', rows,
          chips,
        })
        const html = buildPdfHtml(opts)
        htmlToPdf(html, baseName, { title })
      } else {
        const rows: Record<string, string | number>[] = report.sorted.map((l) => ({
          'تاریخ': formatDate(l.date),
          'خط': l.line?.name || '—',
          'شیفت': l.shift?.name || '—',
          'دستگاه': l.device ? `${l.device.code ? l.device.code + ' - ' : ''}${l.device.name}` : '—',
          'علت توقف': l.failure_cause?.title || '—',
          'توقف': formatHours(l.downtime_hours),
          'کارکرد': formatHours(l.runtime_hours),
          'راندمان': l.efficiency ?? 0,
          'توضیحات': l.failure_description || '—',
        }))
        await exportData(rows, { fileName: baseName, title, factoryName: selectedFactory?.name ?? '', dateFrom: report.filters.date_from || undefined, dateTo: report.filters.date_to || undefined, format: fmt })
      }
      addReportHistoryEntry({
        kind: 'downtime', factoryName: selectedFactory?.name, fileName: `${baseName}.${fmt}`, title, format: fmt,
        recordCount: report.sorted.length,
        dateFrom: report.filters.date_from || undefined, dateTo: report.filters.date_to || undefined,
        chips, filters: filtersRec,
      })
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'خطا در خروجی', 'error')
    } finally { setExporting(null) }
  }

  const isFiltered = report.chips.length > 0 || !!report.filters.date_from || !!report.filters.date_to
  const activePreset = useMemo(() => {
    if (!report.filters.date_from && !report.filters.date_to) return 'all'
    return null
  }, [report.filters.date_from, report.filters.date_to])

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 sm:flex"><Layers className="h-5 w-5" /></div>
            <div>
              <h1 className="flex items-center gap-2 text-[17px] font-extrabold tracking-tight text-slate-900 dark:text-white">توقفات خط تولید <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:inline-flex">{selectedFactory?.name ?? '—'}</span></h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><Activity className="h-3 w-3" />{formatNumber(stats.total)} رکورد</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300" dir="ltr"><Clock className="h-3 w-3" />{formatHours(stats.totalDown)}</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start">
            <div className="relative">
              <button className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-black disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100" onClick={() => setShowExportMenu((v) => !v)} disabled={!canExport || exporting !== null || report.loading}>
                {exporting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-slate-900 dark:border-t-transparent" /> : <Download className="h-4 w-4" />} خروجی <span className="hidden opacity-70 sm:inline">({stats.total})</span> <ChevronDown className={`h-4 w-4 opacity-60 transition ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>
              {showExportMenu && (
                <div className="absolute left-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400">خروجی حرفه‌ای — همین دیتاست</div>
                  <button onClick={() => handleExport('pdf')} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><FileText className="h-4 w-4 text-rose-600" /> PDF صنعتی <span className="mr-auto text-xs text-slate-400">هدر/فوتر هر صفحه</span></button>
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
            {canCreate && <button className="btn-primary !h-[42px] !px-5 !text-sm shadow-sm" onClick={openCreate}><Plus className="h-4 w-4" /> ثبت توقف</button>}
          </div>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-200/60 p-1 dark:bg-slate-800">
        <button onClick={() => setTab('list')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'list' ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
          <ClipboardList className="h-4 w-4" /> لیست توقفات
        </button>
        <button onClick={() => setTab('report')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'report' ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
          <BarChart3 className="h-4 w-4" /> گزارش و نمودار
        </button>
      </div>

      {tab === 'report' ? (
        <DowntimeReportPanel records={report.sorted} />
      ) : (
        <>
      {report.error && <ErrorBanner message={report.error} onRetry={report.reload} />}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200"><Filter className="h-4 w-4 text-slate-400" /> فیلترها</span>
              <span className="hidden h-4 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
              <div className="relative min-w-[180px] flex-1 max-w-[420px]">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className="input !h-9 !rounded-xl !py-0 pr-9 leading-9 !text-sm" placeholder="جستجو: خط، دستگاه، علت، توضیحات..." value={report.filters.search} onChange={(e) => report.setSearch(e.target.value)} />
                {report.filters.search && <button onClick={() => report.setSearch('')} className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-3.5 w-3.5" /></button>}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <span className="hidden whitespace-nowrap text-xs leading-9 text-slate-500 dark:text-slate-400 sm:inline">مرتب‌سازی:</span>
                <select className="input !h-9 !w-[126px] !rounded-xl !py-0 leading-9 !text-sm" value={report.filters.sortKey} onChange={(e) => report.setSort(e.target.value as never)}><option value="date">تاریخ</option><option value="downtime">توقف</option><option value="runtime">کارکرد</option><option value="line">خط</option><option value="efficiency">راندمان</option></select>
                <button className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" onClick={() => report.setFilter('sortDir', report.filters.sortDir === 'asc' ? 'desc' : 'asc')} title={report.filters.sortDir === 'asc' ? 'صعودی' : 'نزولی'}><ArrowUpDown className="h-4 w-4" /></button>
              </div>
              {(isFiltered || report.filters.search) && <button className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300" onClick={report.clearFilters}><X className="h-3.5 w-3.5" /> پاک کردن همه</button>}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <select className="input !h-9 !rounded-xl !py-0 leading-9 !text-sm" value={report.filters.line ?? ''} onChange={(e) => report.setFilter('line', e.target.value)}><option value="">همه خطوط</option>{selectedFactory?.lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
              <select className="input !h-9 !rounded-xl !py-0 leading-9 !text-sm" value={report.filters.shift ?? ''} onChange={(e) => report.setFilter('shift', e.target.value)}><option value="">همه شیفت‌ها</option>{selectedFactory?.shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <select className="input !h-9 !rounded-xl !py-0 leading-9 !text-sm" value={report.filters.device ?? ''} onChange={(e) => report.setFilter('device', e.target.value)}><option value="">همه دستگاه‌ها</option>{allDevices.map((d) => <option key={d.id} value={String(d.id)}>{d.code ? `${d.code} - ${d.name}` : d.name} · {d.lineName}</option>)}</select>
              <select className="input !h-9 !rounded-xl !py-0 leading-9 !text-sm" value={report.filters.failure_cause ?? ''} onChange={(e) => report.setFilter('failure_cause', e.target.value)}><option value="">همه علل</option>{selectedFactory?.failure_reasons.map((f) => <option key={f.id} value={String(f.id)}>{f.title}</option>)}</select>
              <div className="flex items-center gap-1"><span className="shrink-0 whitespace-nowrap text-xs leading-9 text-slate-500">از</span><JalaliDateInput value={report.filters.date_from} onChange={(iso) => report.setFilter('date_from', iso)} /></div>
              <div className="flex items-center gap-1"><span className="shrink-0 whitespace-nowrap text-xs leading-9 text-slate-500">تا</span><JalaliDateInput value={report.filters.date_to} onChange={(iso) => report.setFilter('date_to', iso)} /></div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {PRESETS.map((p) => {
                const isAll = p.key === 'all'
                const active = isAll ? activePreset === 'all' : false
                return <button key={p.key} onClick={() => report.applyPreset(p.key)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{p.label}</button>
              })}
              <span className="mr-2 hidden text-xs text-slate-400 dark:text-slate-500 sm:inline">· برای اعمال بازه سریع</span>
            </div>

            {report.chips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                <Sparkles className="h-3.5 w-3.5 text-brand-500" />
                {report.chips.map((c, i) => <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-slate-900">{c.label}: {c.value} <button onClick={c.onRemove} className="rounded-full bg-white/20 p-0.5 hover:bg-white/30 dark:bg-slate-900/10"><X className="h-3 w-3" /></button></span>)}
                <span className="text-xs text-slate-500 dark:text-slate-400">{formatNumber(report.totalCount)} رکورد</span>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">{report.loading ? 'در حال بارگذاری...' : `${formatNumber(report.totalCount)} رکورد · ${formatNumber(stats.withDown)} با توقف · ${formatNumber(stats.withoutDown)} بدون توقف`}</span>
          </div>
        </div>
      </div>

      {report.loading ? <TableSkeleton columns={7} /> : report.sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <ClipboardList className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <div className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">توقفی یافت نشد</div>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">با فیلترهای فعلی رکوردی یافت نشد.</p>
          <div className="mt-4 flex justify-center gap-2"><button className="btn-ghost" onClick={report.clearFilters}><X className="h-4 w-4" /> پاک کردن فیلترها</button><button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> ثبت اولین توقف</button></div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 bg-slate-50/80 text-right text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400"><th className="whitespace-nowrap px-4 py-3">تاریخ</th><th className="whitespace-nowrap px-4 py-3">خط</th><th className="whitespace-nowrap px-4 py-3">شیفت</th><th className="px-4 py-3">دستگاه / علت</th><th className="whitespace-nowrap px-4 py-3">کارکرد</th><th className="whitespace-nowrap px-4 py-3">توقف</th><th className="whitespace-nowrap px-4 py-3 text-center">عملیات</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.paginated.map((l) => (
                  <tr key={l.id} className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800 dark:text-slate-200"><div>{formatDate(l.date)}</div><div className="text-[11px] font-normal text-slate-400 dark:text-slate-500">{l.day_of_week || ''}</div></td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-300">{l.line.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-400">{l.shift.name}</td>
                    <td className="px-4 py-3"><div className="font-medium text-slate-700 dark:text-slate-300">{l.device ? `${l.device.code ? l.device.code + ' - ' : ''}${l.device.name}` : '—'}</div>{l.failure_cause ? <span className="mt-1 inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/50">{l.failure_cause.title}</span> : <span className="text-xs text-slate-400">—</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3"><span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400" dir="ltr">{formatHours(l.runtime_hours)}</span></td>
                    <td className="whitespace-nowrap px-4 py-3"><span className={l.downtime_hours > 0 ? 'font-extrabold tabular-nums text-rose-600 dark:text-rose-400' : 'tabular-nums text-slate-300 dark:text-slate-600'} dir="ltr">{formatHours(l.downtime_hours)}</span></td>
                    <td className="whitespace-nowrap px-4 py-3"><div className="flex items-center justify-center gap-1">{canEdit && <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white" onClick={() => openEdit(l)} title="ویرایش"><Pencil className="h-4 w-4" /></button>}{canDelete && <button className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40" onClick={() => setConfirmId(l.id)} title="حذف"><Trash2 className="h-4 w-4" /></button>}{!canEdit && !canDelete && <span className="text-xs text-slate-400">—</span>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">نمایش {Math.min((report.page - 1) * report.pageSize + 1, report.totalCount)} تا {Math.min(report.page * report.pageSize, report.totalCount)} از {formatNumber(report.totalCount)} رکورد — مرتب: {report.filters.sortKey} ({report.filters.sortDir})</span>
            <Pagination currentPage={report.page} totalPages={report.totalPages} onPageChange={report.setPage} />
          </div>
        </div>
      )}
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'ویرایش توقف خط تولید' : 'ثبت توقف خط تولید'} subtitle={selectedFactory?.name} size="lg" footer={<><button className="btn-ghost" onClick={() => setModalOpen(false)}>انصراف</button><button className="btn-primary" onClick={submit} disabled={saving}>{saving ? 'در حال ذخیره...' : editing ? 'ذخیره تغییرات' : 'ثبت توقف'}</button></>}>
        <LogForm form={form} setForm={setForm} editing={editing} />
      </Modal>
      <Modal open={confirmId != null} onClose={() => setConfirmId(null)} title="حذف توقف" footer={<><button className="btn-ghost" onClick={() => setConfirmId(null)}>انصراف</button><button className="btn-danger" onClick={confirmDelete}><Trash2 className="h-4 w-4" /> حذف قطعی</button></>}>
        <p className="text-sm text-ink-600 dark:text-slate-300">آیا از حذف این توقف خط تولید اطمینان دارید؟ این عمل قابل بازگشت نیست.</p>
      </Modal>
    </div>
  )
}
