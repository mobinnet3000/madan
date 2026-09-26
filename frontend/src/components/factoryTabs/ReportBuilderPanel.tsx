import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Loader2, AlertTriangle, Save, Pencil, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react'
import { useFactory } from '../../store/FactoryContext'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../ui/Toast'
import { hasPerm } from '../../constants'
import {
  createFactoryTabReport,
  createFactoryTabWidget,
  deleteFactoryTabReport,
  deleteFactoryTabWidget,
  getFactoryTabReports,
  updateFactoryTabReport,
  updateFactoryTabWidget,
} from '../../api/factoryTabs'
import type {
  FactoryTabBrief,
  FactoryTabReport,
  FactoryTabReportMetric,
  FactoryTabWidget,
  FactoryTabWidgetType,
} from '../../types'

const AGGS = ['sum', 'avg', 'min', 'max', 'count'] as const
const AGG_LABEL: Record<string, string> = { sum: 'جمع', avg: 'میانگین', min: 'کمینه', max: 'بیشینه', count: 'تعداد' }
const GROUP_BYS = ['line', 'contractor', 'date', 'week', 'month', 'hour', 'field_value'] as const
const GROUP_LABEL: Record<string, string> = {
  line: 'خط تولید', contractor: 'پیمانکار', date: 'روز', week: 'هفته',
  month: 'ماه', hour: 'ساعت', field_value: 'مقدار یک فیلد',
}
const FILTERS = ['line', 'contractor', 'date_from', 'date_to'] as const
const FILTER_LABEL: Record<string, string> = { line: 'خط', contractor: 'پیمانکار', date_from: 'از تاریخ', date_to: 'تا تاریخ' }
const WIDGET_TYPES: { value: FactoryTabWidgetType; label: string }[] = [
  { value: 'kpi', label: 'شاخص‌ها (KPI)' },
  { value: 'stat_table', label: 'جدول آماری فیلدها' },
  { value: 'group_table', label: 'جدول گروه‌بندی' },
  { value: 'chart', label: 'نمودار' },
]
const METRIC_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

type KpiCard = { kind: 'count' | 'stat' | 'metric'; label: string; field: string; stat: string; sub: string[]; metric: string }

const emptyMetric = (): FactoryTabReportMetric => ({ key: '', label: '', formula: '', unit: '' })
const emptyCard = (): KpiCard => ({ kind: 'stat', label: '', field: '', stat: 'sum', sub: ['avg', 'min', 'max'], metric: '' })

export default function ReportBuilderPanel({ tab }: { tab: FactoryTabBrief | null }) {
  const { user } = useAuth()
  const { notify } = useToast()
  const canManage = hasPerm(user?.permissions, 'factory-tabs.manage')

  const [reports, setReports] = useState<FactoryTabReport[]>([])
  const [reportId, setReportId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [filters, setFilters] = useState<string[]>([...FILTERS])
  const [metrics, setMetrics] = useState<FactoryTabReportMetric[]>([emptyMetric()])
  const [focusMetric, setFocusMetric] = useState<number | null>(null)
  const metricRefs = useRef<Record<number, HTMLTextAreaElement | null>>({})

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingWidget, setEditingWidget] = useState<FactoryTabWidget | null>(null)
  const [wType, setWType] = useState<FactoryTabWidgetType>('kpi')
  const [wTitle, setWTitle] = useState('')
  const [wCards, setWCards] = useState<KpiCard[]>([emptyCard()])
  const [wSources, setWSources] = useState<string[]>(['out', 'in'])
  const [wFields, setWFields] = useState<string[]>([])
  const [wStats, setWStats] = useState<string[]>(['sum', 'avg'])
  const [wGroupBy, setWGroupBy] = useState<string>('line')
  const [wGroupField, setWGroupField] = useState('')
  const [wSort, setWSort] = useState('count_desc')
  const [wSortField, setWSortField] = useState('')
  const [wSortStat, setWSortStat] = useState('sum')
  const [wLimit, setWLimit] = useState(50)
  const [wIncludeTotal, setWIncludeTotal] = useState(true)
  const [wChart, setWChart] = useState('bar')
  const [wValueMode, setWValueMode] = useState<'count' | 'field'>('count')
  const [wValueField, setWValueField] = useState('')
  const [wValueStat, setWValueStat] = useState('sum')
  const [wActive, setWActive] = useState(true)
  const [wSaving, setWSaving] = useState(false)

  const report = useMemo(() => reports.find((r) => String(r.id) === reportId) ?? null, [reports, reportId])

  const numericRefs = useMemo(() => {
    if (!tab) return [] as { ref: string; label: string }[]
    const out = tab.outputs.map((o) => ({ ref: `out.${o.key}`, label: o.name }))
    const inn = tab.inputs.filter((i) => i.input_type === 'number').map((i) => ({ ref: `in.${i.key}`, label: i.name }))
    return [...out, ...inn]
  }, [tab])
  const catRefs = useMemo(() => {
    if (!tab) return [] as { ref: string; label: string }[]
    return tab.inputs.filter((i) => i.input_type === 'select' || i.input_type === 'text').map((i) => ({ ref: `in.${i.key}`, label: i.name }))
  }, [tab])
  const metricKeys = useMemo(() => metrics.map((m) => m.key.trim()).filter(Boolean), [metrics])
  const formulaVars = useMemo(() => {
    const vars: { var: string; label: string }[] = [{ var: 'record_count', label: 'تعداد رکورد' }]
    numericRefs.forEach((r) => AGGS.forEach((a) => vars.push({ var: `${r.ref}__${a}`, label: `${r.label} (${AGG_LABEL[a]})` })))
    metricKeys.forEach((k) => vars.push({ var: k, label: `متریک: ${k}` }))
    return vars
  }, [numericRefs, metricKeys])

  const load = useCallback(async () => {
    if (!tab) { setLoading(false); setReports([]); setReportId(''); return }
    setLoading(true)
    try {
      const list = await getFactoryTabReports({ tab: tab.id })
      setReports(list)
      setReportId((prev) => {
        if (list.some((r) => String(r.id) === prev)) return prev
        const def = list.find((r) => r.is_default) ?? list[0]
        return def ? String(def.id) : ''
      })
    } catch (e: unknown) { notify(e instanceof Error ? e.message : 'خطا در دریافت گزارش‌ها', 'error') }
    finally { setLoading(false) }
  }, [tab, notify])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (report) {
      setName(report.name)
      setDescription(report.description || '')
      setIsDefault(report.is_default)
      setFilters(report.filters.length ? [...report.filters] : [...FILTERS])
      setMetrics(report.metrics.length ? report.metrics.map((m) => ({ ...m })) : [emptyMetric()])
    } else {
      setName(''); setDescription(''); setIsDefault(false)
      setFilters([...FILTERS]); setMetrics([emptyMetric()])
    }
  }, [report])

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const insertMetricVar = (v: string) => {
    if (focusMetric == null) return
    const ta = metricRefs.current[focusMetric]
    if (!ta) return
    const s = ta.selectionStart ?? ta.value.length
    const e = ta.selectionEnd ?? ta.value.length
    const next = ta.value.slice(0, s) + v + ta.value.slice(e)
    setMetrics((prev) => prev.map((m, i) => (i === focusMetric ? { ...m, formula: next } : m)))
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + v.length, s + v.length) })
  }

  const saveReport = async () => {
    if (!tab) return
    if (!name.trim()) { notify('نام گزارش الزامی است', 'error'); return }
    const cleanMetrics = metrics.filter((m) => m.key.trim() || m.label.trim() || m.formula.trim())
    const seen = new Set<string>()
    for (const m of cleanMetrics) {
      if (!m.key.trim() || !METRIC_KEY_RE.test(m.key.trim())) { notify('کلید متریک باید انگلیسی (حروف/عدد/_) باشد', 'error'); return }
      if (seen.has(m.key)) { notify(`کلید متریک تکراری «${m.key}»`, 'error'); return }
      seen.add(m.key)
      if (!m.formula.trim()) { notify(`فرمول متریک «${m.key}» خالی است`, 'error'); return }
    }
    setSaving(true)
    try {
      const payload = {
        tab: tab.id, name: name.trim(), description,
        is_default: isDefault, filters, metrics: cleanMetrics,
      }
      if (report) {
        await updateFactoryTabReport(report.id, payload)
        notify('گزارش به‌روزرسانی شد')
      } else {
        const created = await createFactoryTabReport(payload)
        setReportId(String(created.id))
        notify('گزارش ساخته شد')
      }
      load()
    } catch (e: unknown) { notify(e instanceof Error ? e.message : 'خطا در ذخیره گزارش', 'error') }
    finally { setSaving(false) }
  }

  const removeReport = async () => {
    if (!report || !window.confirm(`گزارش «${report.name}» حذف شود؟`)) return
    setSaving(true)
    try {
      await deleteFactoryTabReport(report.id)
      notify('گزارش حذف شد')
      setReportId('')
      load()
    } catch (e: unknown) { notify(e instanceof Error ? e.message : 'خطا در حذف', 'error') }
    finally { setSaving(false) }
  }

  const openNewWidget = () => {
    setEditingWidget(null)
    setWType('kpi'); setWTitle(''); setWActive(true)
    setWCards([{ ...emptyCard(), field: numericRefs[0]?.ref ?? '' }])
    setWSources(['out', 'in']); setWFields([]); setWStats(['sum', 'avg'])
    setWGroupBy('line'); setWGroupField(catRefs[0]?.ref ?? ''); setWSort('count_desc')
    setWSortField(numericRefs[0]?.ref ?? ''); setWSortStat('sum'); setWLimit(50); setWIncludeTotal(true)
    setWChart('bar'); setWValueMode('count'); setWValueField(numericRefs[0]?.ref ?? ''); setWValueStat('sum')
    setEditorOpen(true)
  }

  const openEditWidget = (w: FactoryTabWidget) => {
    setEditingWidget(w)
    setWType(w.widget_type); setWTitle(w.title); setWActive(w.is_active !== false)
    const c = (w.config ?? {}) as Record<string, unknown>
    if (w.widget_type === 'kpi') {
      const cards = (c.cards as KpiCard[] | undefined) ?? []
      setWCards(cards.length ? cards.map((x) => ({ ...emptyCard(), ...x, sub: [...(x.sub ?? [])] })) : [emptyCard()])
    } else if (w.widget_type === 'stat_table') {
      setWSources((c.sources as string[] | undefined) ?? ['out', 'in'])
      setWFields((c.fields as string[] | undefined) ?? [])
      setWStats((c.stats as string[] | undefined) ?? ['sum', 'avg'])
    } else if (w.widget_type === 'group_table') {
      setWGroupBy(String(c.group_by ?? 'line'))
      setWGroupField(String(c.field ?? ''))
      setWFields((c.fields as string[] | undefined) ?? [])
      setWStats((c.stats as string[] | undefined) ?? ['sum', 'avg'])
      setWSort(String(c.sort ?? 'count_desc'))
      setWSortField(String(c.sort_field ?? ''))
      setWSortStat(String(c.sort_stat ?? 'sum'))
      setWLimit(Number(c.limit ?? 50))
      setWIncludeTotal(c.include_total !== false)
    } else {
      setWChart(String(c.chart ?? 'bar'))
      setWGroupBy(String(c.group_by ?? 'date'))
      setWGroupField(String(c.field ?? ''))
      const v = c.value as { field?: string; stat?: string } | string | undefined
      if (typeof v === 'string' || !v) { setWValueMode('count') } else { setWValueMode('field'); setWValueField(v.field ?? ''); setWValueStat(v.stat ?? 'sum') }
      setWSort(String(c.sort ?? 'label_asc'))
      setWLimit(Number(c.limit ?? 12))
    }
    setEditorOpen(true)
  }

  const buildConfig = (): Record<string, unknown> => {
    if (wType === 'kpi') {
      return {
        cards: wCards.map((c) => {
          if (c.kind === 'count') return { kind: 'count', label: c.label || 'تعداد رکورد' }
          if (c.kind === 'metric') return { kind: 'metric', label: c.label || c.metric, metric: c.metric }
          return { kind: 'stat', label: c.label, field: c.field, stat: c.stat, sub_stats: c.sub }
        }),
      }
    }
    if (wType === 'stat_table') {
      const cfg: Record<string, unknown> = { sources: wSources, stats: wStats }
      if (wFields.length) cfg.fields = wFields
      return cfg
    }
    if (wType === 'group_table') {
      const cfg: Record<string, unknown> = {
        group_by: wGroupBy, stats: wStats, sort: wSort,
        limit: wLimit, include_total: wIncludeTotal,
      }
      if (wGroupBy === 'field_value') cfg.field = wGroupField
      if (wFields.length) cfg.fields = wFields
      if (wSort === 'value_desc') { cfg.sort_field = wSortField; cfg.sort_stat = wSortStat }
      return cfg
    }
    const cfg: Record<string, unknown> = {
      chart: wChart, group_by: wGroupBy,
      value: wValueMode === 'count' ? 'count' : { field: wValueField, stat: wValueStat },
      sort: wSort, limit: wChart === 'pie' ? Math.min(wLimit, 12) : wLimit,
    }
    if (wGroupBy === 'field_value') cfg.field = wGroupField
    return cfg
  }

  const saveWidget = async () => {
    if (!report) { notify('ابتدا گزارش را ذخیره کنید', 'error'); return }
    if (!wTitle.trim()) { notify('عنوان ویجت الزامی است', 'error'); return }
    if (wType === 'kpi') {
      if (!wCards.length) { notify('حداقل یک کارت لازم است', 'error'); return }
      for (const c of wCards) {
        if (c.kind === 'stat' && !c.field) { notify('فیلد کارت شاخص الزامی است', 'error'); return }
        if (c.kind === 'metric' && !metricKeys.includes(c.metric)) { notify(`متریک «${c.metric}» در این گزارش تعریف نشده است`, 'error'); return }
      }
    }
    if (wType === 'group_table' && wGroupBy === 'field_value' && !wGroupField) { notify('فیلد گروه‌بندی الزامی است', 'error'); return }
    if (wType === 'group_table' && wSort === 'value_desc' && !wSortField) { notify('sort_field برای مرتب‌سازی مقداری الزامی است', 'error'); return }
    if (wType === 'chart' && wGroupBy === 'field_value' && !wGroupField) { notify('فیلد گروه‌بندی الزامی است', 'error'); return }
    if (wType === 'chart' && wValueMode === 'field' && !wValueField) { notify('فیلد مقدار نمودار الزامی است', 'error'); return }
    setWSaving(true)
    try {
      const payload = { widget_type: wType, title: wTitle.trim(), order: editingWidget?.order ?? (report.widgets?.length ?? 0), is_active: wActive, config: buildConfig() }
      if (editingWidget) {
        await updateFactoryTabWidget(report.id, editingWidget.id, payload)
        notify('ویجت به‌روزرسانی شد')
      } else {
        await createFactoryTabWidget(report.id, payload)
        notify('ویجت اضافه شد')
      }
      setEditorOpen(false)
      load()
    } catch (e: unknown) { notify(e instanceof Error ? e.message : 'خطا در ذخیره ویجت', 'error') }
    finally { setWSaving(false) }
  }

  const removeWidget = async (w: FactoryTabWidget) => {
    if (!report || !window.confirm(`ویجت «${w.title}» حذف شود؟`)) return
    try {
      await deleteFactoryTabWidget(report.id, w.id)
      notify('ویجت حذف شد')
      load()
    } catch (e: unknown) { notify(e instanceof Error ? e.message : 'خطا در حذف', 'error') }
  }

  const moveWidget = async (w: FactoryTabWidget, dir: -1 | 1) => {
    if (!report) return
    const list = [...(report.widgets ?? [])].sort((a, b) => a.order - b.order)
    const idx = list.findIndex((x) => x.id === w.id)
    const other = list[idx + dir]
    if (!other) return
    try {
      await updateFactoryTabWidget(report.id, w.id, { order: other.order })
      await updateFactoryTabWidget(report.id, other.id, { order: w.order })
      load()
    } catch (e: unknown) { notify(e instanceof Error ? e.message : 'خطا در جابه‌جایی', 'error') }
  }

  const toggleWidgetActive = async (w: FactoryTabWidget) => {
    if (!report) return
    try {
      await updateFactoryTabWidget(report.id, w.id, { is_active: !w.is_active })
      load()
    } catch (e: unknown) { notify(e instanceof Error ? e.message : 'خطا', 'error') }
  }

  if (!tab) {
    return <div className="card p-6 text-center text-sm text-ink-500 dark:text-slate-400">ابتدا یک تب بسازید تا برایش گزارش تعریف کنید.</div>
  }

  const refLabel = (ref: string) => numericRefs.find((r) => r.ref === ref)?.label ?? catRefs.find((r) => r.ref === ref)?.label ?? ref

  return (
    <div className="card space-y-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px] flex-1">
          <label className="label">گزارش تب «{tab.name}»</label>
          <select className="input" value={reportId} onChange={(e) => setReportId(e.target.value)}>
            <option value="">گزارش جدید...</option>
            {reports.map((r) => <option key={r.id} value={r.id}>{r.name}{r.is_default ? ' (پیش‌فرض)' : ''}</option>)}
          </select>
        </div>
        {canManage && report && <button className="btn-ghost !h-10 !px-3 text-xs !text-rose-600" onClick={removeReport} disabled={saving}><Trash2 className="h-4 w-4" /> حذف گزارش</button>}
      </div>
      {!canManage && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> شما دسترسی مدیریت گزارش‌ها را ندارید — فقط مشاهده.
        </div>
      )}

      {loading ? (
        <div className="py-6"><div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">نام گزارش *</label>
              <input className="input" disabled={!canManage} value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلا: گزارش جامع" />
            </div>
            <div className="flex items-center gap-4 pt-6">
              <label className="flex items-center gap-1.5 text-sm text-ink-600 dark:text-slate-300">
                <input type="checkbox" disabled={!canManage} checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> پیش‌فرض تب
              </label>
            </div>
          </div>
          <div>
            <label className="label">توضیحات</label>
            <textarea className="input min-h-[50px]" disabled={!canManage} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="label">فیلترهای مجاز گزارش</label>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <label key={f} className={`flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm ${filters.includes(f) ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300' : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'}`}>
                  <input type="checkbox" className="hidden" disabled={!canManage} checked={filters.includes(f)} onChange={() => toggle(filters, f, setFilters)} />
                  {FILTER_LABEL[f]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-600 dark:text-slate-300">متریک‌های محاسباتی (درصد، نسبت، ...)</span>
              {canManage && <button className="btn-ghost !h-8 !px-2 text-xs" onClick={() => setMetrics((p) => [...p, emptyMetric()])}><Plus className="h-3.5 w-3.5" /> افزودن متریک</button>}
            </div>
            <div className="mt-2 space-y-2">
              {metrics.map((m, idx) => (
                <div key={idx} className="rounded-xl border border-ink-100 p-2 dark:border-slate-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <input className="input !h-9 w-32 !py-0 font-mono" dir="ltr" disabled={!canManage} placeholder="key" value={m.key} onChange={(e) => setMetrics((p) => p.map((x, i) => (i === idx ? { ...x, key: e.target.value.replace(/\s+/g, '_') } : x)))} />
                    <input className="input !h-9 w-40 !py-0" disabled={!canManage} placeholder="نام نمایشی" value={m.label} onChange={(e) => setMetrics((p) => p.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))} />
                    <input className="input !h-9 w-24 !py-0" disabled={!canManage} placeholder="واحد" value={m.unit} onChange={(e) => setMetrics((p) => p.map((x, i) => (i === idx ? { ...x, unit: e.target.value } : x)))} />
                    {canManage && <button className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50" onClick={() => setMetrics((p) => p.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></button>}
                  </div>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <textarea
                      ref={(el) => { metricRefs.current[idx] = el }}
                      className="input min-h-[60px] flex-1 font-mono text-xs"
                      dir="ltr" rows={2} disabled={!canManage}
                      value={m.formula}
                      onFocus={() => setFocusMetric(idx)}
                      onChange={(e) => setMetrics((p) => p.map((x, i) => (i === idx ? { ...x, formula: e.target.value } : x)))}
                      placeholder="in.tonnage__sum / in.cars__sum"
                    />
                    {canManage && (
                      <div className="w-full shrink-0 sm:w-64">
                        <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                          {formulaVars.map((v) => (
                            <button key={v.var} type="button" className="chip" onClick={() => insertMetricVar(v.var)} title={v.var}>{v.label}</button>
                          ))}
                        </div>
                        <div className="mt-1 text-[10px] text-ink-400 dark:text-slate-500">کلیک = درج متغیر در فرمول</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            {canManage && <button className="btn-primary" onClick={saveReport} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {report ? 'ذخیره گزارش' : 'ساخت گزارش'}</button>}
          </div>

          {report && (
            <div className="border-t border-ink-100 pt-4 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink-600 dark:text-slate-300">ویجت‌های گزارش ({report.widgets?.length ?? 0})</span>
                {canManage && <button className="btn-ghost !h-8 !px-2 text-xs" onClick={openNewWidget}><Plus className="h-3.5 w-3.5" /> افزودن ویجت</button>}
              </div>
              <div className="mt-2 space-y-2">
                {[...(report.widgets ?? [])].sort((a, b) => a.order - b.order).map((w) => (
                  <div key={w.id} className={`flex flex-wrap items-center gap-2 rounded-xl border p-2 ${w.is_active === false ? 'border-dashed opacity-60' : 'border-ink-100 dark:border-slate-700'}`}>
                    <span className="badge bg-ink-100 text-ink-600 dark:bg-slate-700 dark:text-slate-300">{WIDGET_TYPES.find((t) => t.value === w.widget_type)?.label ?? w.widget_type}</span>
                    <span className="flex-1 text-sm font-semibold text-ink-700 dark:text-slate-200">{w.title}</span>
                    {canManage && (
                      <>
                        <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 dark:hover:bg-slate-800" title="بالا" onClick={() => moveWidget(w, -1)}><ChevronUp className="h-4 w-4" /></button>
                        <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 dark:hover:bg-slate-800" title="پایین" onClick={() => moveWidget(w, 1)}><ChevronDown className="h-4 w-4" /></button>
                        <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 dark:hover:bg-slate-800" title={w.is_active === false ? 'فعال‌سازی' : 'غیرفعال‌سازی'} onClick={() => toggleWidgetActive(w)}>{w.is_active === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                        <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-slate-800" title="ویرایش" onClick={() => openEditWidget(w)}><Pencil className="h-4 w-4" /></button>
                        <button className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50" title="حذف" onClick={() => removeWidget(w)}><Trash2 className="h-4 w-4" /></button>
                      </>
                    )}
                  </div>
                ))}
                {!(report.widgets?.length) && <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-400 dark:bg-slate-800/60 dark:text-slate-500">ویجتی تعریف نشده است.</div>}
              </div>

              {editorOpen && (
                <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/30 p-3 dark:border-brand-900/50 dark:bg-brand-950/10">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="label">نوع ویجت</label>
                      <select className="input" value={wType} onChange={(e) => setWType(e.target.value as FactoryTabWidgetType)}>
                        {WIDGET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">عنوان</label>
                      <input className="input" value={wTitle} onChange={(e) => setWTitle(e.target.value)} placeholder="مثلا: شاخص‌ها" />
                    </div>
                  </div>

                  {wType === 'kpi' && (
                    <div className="mt-3 space-y-2">
                      {wCards.map((c, idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 dark:bg-slate-900">
                          <select className="input !h-9 w-28 !py-0" value={c.kind} onChange={(e) => setWCards((p) => p.map((x, i) => (i === idx ? { ...x, kind: e.target.value as KpiCard['kind'] } : x)))}>
                            <option value="count">تعداد رکورد</option>
                            <option value="stat">آمار فیلد</option>
                            <option value="metric">متریک</option>
                          </select>
                          {c.kind === 'stat' && (
                            <>
                              <select className="input !h-9 w-44 !py-0" value={c.field} onChange={(e) => setWCards((p) => p.map((x, i) => (i === idx ? { ...x, field: e.target.value } : x)))}>
                                <option value="">فیلد...</option>
                                {numericRefs.map((r) => <option key={r.ref} value={r.ref}>{r.label}</option>)}
                              </select>
                              <select className="input !h-9 w-28 !py-0" value={c.stat} onChange={(e) => setWCards((p) => p.map((x, i) => (i === idx ? { ...x, stat: e.target.value } : x)))}>
                                {AGGS.map((a) => <option key={a} value={a}>{AGG_LABEL[a]}</option>)}
                              </select>
                            </>
                          )}
                          {c.kind === 'metric' && (
                            <select className="input !h-9 w-44 !py-0" value={c.metric} onChange={(e) => setWCards((p) => p.map((x, i) => (i === idx ? { ...x, metric: e.target.value } : x)))}>
                              <option value="">متریک...</option>
                              {metricKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                            </select>
                          )}
                          {c.kind !== 'count' && <input className="input !h-9 w-40 !py-0" placeholder="برچسب (اختیاری)" value={c.label} onChange={(e) => setWCards((p) => p.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))} />}
                          {c.kind === 'stat' && (
                            <div className="flex flex-wrap gap-1">
                              {AGGS.filter((a) => a !== 'count').map((a) => (
                                <label key={a} className="flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                  <input type="checkbox" className="hidden" checked={c.sub.includes(a)} onChange={() => setWCards((p) => p.map((x, i) => (i === idx ? { ...x, sub: x.sub.includes(a) ? x.sub.filter((s) => s !== a) : [...x.sub, a] } : x)))} />
                                  <span className={c.sub.includes(a) ? 'font-bold text-brand-600' : ''}>{AGG_LABEL[a]}</span>
                                </label>
                              ))}
                            </div>
                          )}
                          <button className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setWCards((p) => p.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                      <button className="btn-ghost !h-8 !px-2 text-xs" onClick={() => setWCards((p) => [...p, { ...emptyCard(), field: numericRefs[0]?.ref ?? '' }])}><Plus className="h-3.5 w-3.5" /> افزودن کارت</button>
                    </div>
                  )}

                  {wType === 'stat_table' && (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="label">منابع</label>
                        <div className="flex gap-2">
                          {['out', 'in'].map((s) => (
                            <label key={s} className="flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                              <input type="checkbox" checked={wSources.includes(s)} onChange={() => toggle(wSources, s, setWSources)} /> {s === 'out' ? 'خروجی‌ها' : 'ورودی‌ها'}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="label">تجمیع‌ها</label>
                        <div className="flex flex-wrap gap-1.5">
                          {AGGS.map((a) => (
                            <label key={a} className="flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                              <input type="checkbox" className="hidden" checked={wStats.includes(a)} onChange={() => toggle(wStats, a, setWStats)} />
                              <span className={wStats.includes(a) ? 'font-bold text-brand-600' : ''}>{AGG_LABEL[a]}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label">فیلدها (خالی = همه)</label>
                        <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                          {numericRefs.filter((r) => wSources.includes(r.ref.split('.')[0])).map((r) => (
                            <label key={r.ref} className="flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                              <input type="checkbox" className="hidden" checked={wFields.includes(r.ref)} onChange={() => toggle(wFields, r.ref, setWFields)} />
                              <span className={wFields.includes(r.ref) ? 'font-bold text-brand-600' : ''}>{r.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {(wType === 'group_table' || wType === 'chart') && (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {wType === 'chart' && (
                        <div>
                          <label className="label">نوع نمودار</label>
                          <select className="input" value={wChart} onChange={(e) => setWChart(e.target.value)}>
                            <option value="bar">میله‌ای</option>
                            <option value="line">خطی</option>
                            <option value="pie">دایره‌ای</option>
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="label">گروه‌بندی</label>
                        <select className="input" value={wGroupBy} onChange={(e) => setWGroupBy(e.target.value)}>
                          {GROUP_BYS.map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
                        </select>
                      </div>
                      {wGroupBy === 'field_value' && (
                        <div>
                          <label className="label">فیلد گروه‌بندی (متن/کشویی)</label>
                          <select className="input" value={wGroupField} onChange={(e) => setWGroupField(e.target.value)}>
                            <option value="">انتخاب...</option>
                            {catRefs.map((r) => <option key={r.ref} value={r.ref}>{r.label}</option>)}
                            {numericRefs.map((r) => <option key={r.ref} value={r.ref}>{r.label} (عدد)</option>)}
                          </select>
                        </div>
                      )}
                      {wType === 'chart' ? (
                        <>
                          <div>
                            <label className="label">مقدار نمودار</label>
                            <select className="input" value={wValueMode} onChange={(e) => setWValueMode(e.target.value as 'count' | 'field')}>
                              <option value="count">تعداد رکورد</option>
                              <option value="field">آمار یک فیلد</option>
                            </select>
                          </div>
                          {wValueMode === 'field' && (
                            <>
                              <div>
                                <label className="label">فیلد</label>
                                <select className="input" value={wValueField} onChange={(e) => setWValueField(e.target.value)}>
                                  <option value="">انتخاب...</option>
                                  {numericRefs.map((r) => <option key={r.ref} value={r.ref}>{r.label}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="label">تجمیع</label>
                                <select className="input" value={wValueStat} onChange={(e) => setWValueStat(e.target.value)}>
                                  {AGGS.map((a) => <option key={a} value={a}>{AGG_LABEL[a]}</option>)}
                                </select>
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="sm:col-span-2">
                            <label className="label">فیلدها (خالی = همه)</label>
                            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                              {numericRefs.map((r) => (
                                <label key={r.ref} className="flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                  <input type="checkbox" className="hidden" checked={wFields.includes(r.ref)} onChange={() => toggle(wFields, r.ref, setWFields)} />
                                  <span className={wFields.includes(r.ref) ? 'font-bold text-brand-600' : ''}>{r.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="label">تجمیع‌ها</label>
                            <div className="flex flex-wrap gap-1.5">
                              {AGGS.map((a) => (
                                <label key={a} className="flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                  <input type="checkbox" className="hidden" checked={wStats.includes(a)} onChange={() => toggle(wStats, a, setWStats)} />
                                  <span className={wStats.includes(a) ? 'font-bold text-brand-600' : ''}>{AGG_LABEL[a]}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <label className="flex items-center gap-1.5 text-sm text-ink-600 dark:text-slate-300">
                            <input type="checkbox" checked={wIncludeTotal} onChange={(e) => setWIncludeTotal(e.target.checked)} /> ردیف جمع کل
                          </label>
                        </>
                      )}
                      <div>
                        <label className="label">مرتب‌سازی</label>
                        <select className="input" value={wSort} onChange={(e) => setWSort(e.target.value)}>
                          <option value="count_desc">تعداد (نزولی)</option>
                          <option value="label_asc">برچسب (صعودی)</option>
                          <option value="value_desc">مقدار (نزولی)</option>
                        </select>
                      </div>
                      {wType === 'group_table' && wSort === 'value_desc' && (
                        <>
                          <div>
                            <label className="label">فیلد مرتب‌سازی</label>
                            <select className="input" value={wSortField} onChange={(e) => setWSortField(e.target.value)}>
                              <option value="">انتخاب...</option>
                              {numericRefs.map((r) => <option key={r.ref} value={r.ref}>{r.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="label">تجمیع مرتب‌سازی</label>
                            <select className="input" value={wSortStat} onChange={(e) => setWSortStat(e.target.value)}>
                              {AGGS.map((a) => <option key={a} value={a}>{AGG_LABEL[a]}</option>)}
                            </select>
                          </div>
                        </>
                      )}
                      <div>
                        <label className="label">سقف نمایش (limit)</label>
                        <input type="number" className="input" min={1} max={wType === 'chart' ? 100 : 200} value={wLimit} onChange={(e) => setWLimit(Number(e.target.value))} />
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-sm text-ink-600 dark:text-slate-300">
                      <input type="checkbox" checked={wActive} onChange={(e) => setWActive(e.target.checked)} /> فعال
                    </label>
                    <div className="flex gap-2">
                      <button className="btn-ghost" onClick={() => setEditorOpen(false)}>انصراف</button>
                      <button className="btn-primary" onClick={saveWidget} disabled={wSaving}>
                        {wSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {editingWidget ? 'ذخیره ویجت' : 'افزودن ویجت'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
