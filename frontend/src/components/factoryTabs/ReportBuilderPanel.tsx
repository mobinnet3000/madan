import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  Save,
  Pencil,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Sparkles,
  LayoutDashboard,
  BarChart3,
  SlidersHorizontal,
  ChevronRight,
  Info,
} from 'lucide-react'
import { useFactory } from '../../store/FactoryContext'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../ui/Toast'
import { hasPerm } from '../../constants'
import {
  createFactoryTabReport,
  createFactoryTabWidget,
  deleteFactoryTabReport,
  deleteFactoryTabWidget,
  getFactoryTabFormulaVars,
  getFactoryTabReports,
  updateFactoryTabReport,
  updateFactoryTabWidget,
  type TabFormulaVar,
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
const WIDGET_TYPES: { value: FactoryTabWidgetType; label: string; desc: string }[] = [
  { value: 'kpi', label: 'شاخص‌ها (KPI)', desc: 'کارت‌های آماری بزرگ برای نمایش مجموع، میانگین یا متریک‌ها' },
  { value: 'stat_table', label: 'جدول آماری فیلدها', desc: 'جدول تجمیعی مقادیر با ستون‌های جمع، میانگین، کمینه و بیشینه' },
  { value: 'group_table', label: 'جدول گروه‌بندی', desc: 'جدول گروه‌بندی داده‌ها بر اساس خط، پیمانکار، تاریخ یا فیلد دیگر' },
  { value: 'chart', label: 'نمودار تحلیلی', desc: 'نمودار میله‌ای، خطی یا دایره‌ای روندهای تولید و متغیرها' },
]
const METRIC_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

type KpiCard = { kind: 'count' | 'stat' | 'metric'; label: string; field: string; stat: string; sub: string[]; metric: string }

const emptyMetric = (): FactoryTabReportMetric => ({ key: '', label: '', formula: '', unit: '' })
const emptyCard = (): KpiCard => ({ kind: 'stat', label: '', field: '', stat: 'sum', sub: ['avg', 'min', 'max'], metric: '' })

export default function ReportBuilderPanel({ tab }: { tab: FactoryTabBrief | null }) {
  const { user } = useAuth()
  const { notify } = useToast()
  const canManage = Boolean(
    user?.is_superuser || user?.role === 'admin' || hasPerm(user?.permissions, 'factory-tabs.manage')
  )

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
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)

  const [metricKeys, setMetricKeys] = useState<string[]>([])
  const [formulaVars, setFormulaVars] = useState<TabFormulaVar[]>([])
  const editorRef = useRef<HTMLDivElement>(null)

  const report = useMemo(() => reports.find((r) => String(r.id) === reportId) ?? null, [reports, reportId])

  const numericRefs = useMemo(() => {
    if (!tab) return [] as { ref: string; label: string; group?: string }[]
    const out = tab.outputs.map((o) => ({ ref: `out.${o.key}`, label: o.name, group: 'خروجی‌های این تب' }))
    const inn = tab.inputs.filter((i) => i.input_type === 'number').map((i) => ({ ref: `in.${i.key}`, label: i.name, group: 'ورودی‌های عددی این تب' }))
    const cross = formulaVars
      .filter((v) => v.var.includes('.'))
      .map((v) => ({ ref: `${v.var.split('.')[0]}.in.${v.var.split('.').slice(1).join('.')}`, label: v.label, group: v.group }))
    return [...out, ...inn, ...cross]
  }, [tab, formulaVars])

  const catRefs = useMemo(() => {
    if (!tab) return [] as { ref: string; label: string }[]
    return tab.inputs.filter((i) => i.input_type === 'select' || i.input_type === 'text').map((i) => ({ ref: `in.${i.key}`, label: i.name }))
  }, [tab])

  useEffect(() => {
    setMetricKeys(metrics.map((m) => m.key.trim()).filter(Boolean))
  }, [metrics])

  const formulaVars2 = useMemo(() => {
    const vars: { var: string; label: string; group: string }[] = [
      { var: 'record_count', label: 'تعداد رکورد', group: 'پایه' },
    ]
    numericRefs.forEach((r) => {
      AGGS.forEach((a) => vars.push({
        var: `${r.ref}__${a}`,
        label: `${r.label} (${AGG_LABEL[a]})`,
        group: r.group ?? 'فیلدها',
      }))
    })
    metricKeys.forEach((k) => vars.push({ var: k, label: `متریک: ${k}`, group: 'متریک‌ها' }))
    return vars
  }, [numericRefs, metricKeys])

  const load = useCallback(async () => {
    if (!tab) { setLoading(false); setReports([]); setReportId(''); return }
    setLoading(true)
    try {
      const [list, vars] = await Promise.all([
        getFactoryTabReports({ tab: tab.id }),
        getFactoryTabFormulaVars(tab.id).catch(() => [] as TabFormulaVar[]),
      ])
      setFormulaVars(vars)
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
      setName(tab ? `گزارش جامع ${tab.name}` : '')
      setDescription('')
      setIsDefault(true)
      setFilters([...FILTERS])
      setMetrics([emptyMetric()])
    }
  }, [report, tab])

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

  // ایجاد خودکار گزارش کامل با ۳ ویجت هوشمند
  const createDefaultReportWithWidgets = async () => {
    if (!tab) return
    setSaving(true)
    try {
      const rep = await createFactoryTabReport({
        tab: tab.id,
        name: name.trim() || `گزارش جامع ${tab.name}`,
        description: 'گزارش تحلیلی همراه با ویجت‌های شاخص، نمودار و جدول',
        is_default: true,
        filters: [...FILTERS],
        metrics: [],
      })

      // 1. KPI Widget
      const kpiCards: KpiCard[] = [
        { kind: 'count', label: 'تعداد کل رکوردها', field: '', stat: 'sum', sub: [], metric: '' },
      ]
      const outList = (tab.outputs ?? []).slice(0, 3)
      for (const o of outList) {
        const text = (o.name + o.key + (o.unit || '')).toLowerCase()
        const isAvg = ['درصد', 'عیار', 'رطوبت', 'راندمان', '%'].some(k => text.includes(k))
        kpiCards.push({
          kind: 'stat',
          label: o.name,
          field: `out.${o.key}`,
          stat: isAvg ? 'avg' : 'sum',
          sub: ['avg', 'min', 'max'],
          metric: '',
        })
      }
      await createFactoryTabWidget(rep.id, {
        widget_type: 'kpi',
        title: 'شاخص‌های کلیدی عملکرد (KPI)',
        order: 0,
        is_active: true,
        config: {
          cards: kpiCards.map((c) => {
            if (c.kind === 'count') return { kind: 'count', label: c.label }
            return { kind: 'stat', label: c.label, field: c.field, stat: c.stat, sub_stats: c.sub }
          }),
        },
      })

      // 2. Chart Widget
      const firstNumRef = numericRefs[0]?.ref ?? (tab.outputs[0] ? `out.${tab.outputs[0].key}` : '')
      if (firstNumRef) {
        await createFactoryTabWidget(rep.id, {
          widget_type: 'chart',
          title: `نمودار روند روزانه ${numericRefs[0]?.label || 'خروجی'}`,
          order: 1,
          is_active: true,
          config: {
            chart: 'bar',
            group_by: 'date',
            value: { field: firstNumRef, stat: 'sum' },
            sort: 'label_asc',
            limit: 15,
          },
        })
      }

      // 3. Stat table Widget
      await createFactoryTabWidget(rep.id, {
        widget_type: 'stat_table',
        title: 'جدول آماری مقادیر و خروجی‌ها',
        order: 2,
        is_active: true,
        config: {
          sources: ['out', 'in'],
          stats: ['sum', 'avg', 'min', 'max'],
        },
      })

      notify('گزارش و ویجت‌های تحلیلی با موفقیت ایجاد شدند!')
      await load()
      setReportId(String(rep.id))
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'خطا در ایجاد گزارش و ویجت‌های پیش‌فرض', 'error')
    } finally {
      setSaving(false)
    }
  }

  const openNewWidget = async () => {
    let activeReport = report
    if (!activeReport) {
      if (!tab) return
      setSaving(true)
      try {
        const payload = {
          tab: tab.id,
          name: name.trim() || `گزارش تحلیلی ${tab.name}`,
          description: description || 'گزارش تحلیلی تب',
          is_default: true,
          filters: filters.length ? filters : [...FILTERS],
          metrics: [],
        }
        const created = await createFactoryTabReport(payload)
        notify(`گزارش «${created.name}» ساخته شد`)
        await load()
        setReportId(String(created.id))
        activeReport = created
      } catch (e: unknown) {
        notify(e instanceof Error ? e.message : 'خطا در ساخت گزارش برای ویجت', 'error')
        setSaving(false)
        return
      } finally {
        setSaving(false)
      }
    }

    setEditingWidget(null)
    setWType('kpi')
    setWTitle('')
    setWActive(true)
    setWCards([{ ...emptyCard(), field: numericRefs[0]?.ref ?? '' }])
    setWSources(['out', 'in'])
    setWFields([])
    setWStats(['sum', 'avg'])
    setWGroupBy('line')
    setWGroupField(catRefs[0]?.ref ?? '')
    setWSort('count_desc')
    setWSortField(numericRefs[0]?.ref ?? '')
    setWSortStat('sum')
    setWLimit(50)
    setWIncludeTotal(true)
    setWChart('bar')
    setWValueMode('count')
    setWValueField(numericRefs[0]?.ref ?? '')
    setWValueStat('sum')
    setEditorOpen(true)
    setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)
  }

  const openEditWidget = (w: FactoryTabWidget) => {
    setEditingWidget(w)
    setWType(w.widget_type)
    setWTitle(w.title)
    setWActive(w.is_active !== false)
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
      if (typeof v === 'string' || !v) {
        setWValueMode('count')
      } else {
        setWValueMode('field')
        setWValueField(v.field ?? '')
        setWValueStat(v.stat ?? 'sum')
      }
      setWSort(String(c.sort ?? 'label_asc'))
      setWLimit(Number(c.limit ?? 12))
    }
    setEditorOpen(true)
    setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)
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
    let activeReport = report
    if (!activeReport) {
      if (!tab) return
      setWSaving(true)
      try {
        activeReport = await createFactoryTabReport({
          tab: tab.id,
          name: name.trim() || `گزارش تحلیلی ${tab.name}`,
          description: description || '',
          is_default: true,
          filters: filters.length ? filters : [...FILTERS],
          metrics: [],
        })
        setReportId(String(activeReport.id))
      } catch (e: unknown) {
        notify(e instanceof Error ? e.message : 'خطا در ذخیره گزارش اولیه', 'error')
        setWSaving(false)
        return
      }
    }

    if (!wTitle.trim()) { notify('عنوان ویجت الزامی است', 'error'); return }
    if (wType === 'kpi') {
      if (!wCards.length) { notify('حداقل یک کارت شاخص لازم است', 'error'); return }
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
      const payload = {
        widget_type: wType,
        title: wTitle.trim(),
        order: editingWidget?.order ?? (activeReport.widgets?.length ?? 0),
        is_active: wActive,
        config: buildConfig(),
      }
      if (editingWidget) {
        await updateFactoryTabWidget(activeReport.id, editingWidget.id, payload)
        notify('ویجت به‌روزرسانی شد')
      } else {
        await createFactoryTabWidget(activeReport.id, payload)
        notify('ویجت با موفقیت اضافه شد')
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
    return <div className="card p-6 text-center text-sm text-ink-500 dark:text-slate-400">ابتدا یک تب را انتخاب کنید.</div>
  }

  const refLabel = (ref: string) => numericRefs.find((r) => r.ref === ref)?.label ?? catRefs.find((r) => r.ref === ref)?.label ?? ref

  return (
    <div className="space-y-5">
      {/* هدر بالایی: انتخاب یا ساخت گزارش */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <div>
              <h2 className="text-sm font-bold text-ink-800 dark:text-slate-100">
                طراحی و تنظیم ویجت‌های تحلیلی — تب «{tab.name}»
              </h2>
              <p className="text-[11px] text-ink-400 dark:text-slate-400">
                شاخص‌ها (KPI)، نمودارهای میله‌ای/خطی و جداول آماری را برای این تب تعریف و سازمان‌دهی کنید.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <>
                <button
                  type="button"
                  className="btn-primary !h-9 !px-3.5 text-xs font-bold flex items-center gap-1.5 shadow-brand-glow"
                  onClick={openNewWidget}
                  disabled={loading || saving}
                >
                  <Plus className="h-4 w-4" />
                  <span>افزودن ویجت جدید</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary !h-9 !px-3 text-xs font-semibold flex items-center gap-1.5"
                  onClick={createDefaultReportWithWidgets}
                  disabled={loading || saving}
                  title="ساخت خودکار یک گزارش کامل با شاخص‌های KPI، نمودار روند و جدول آماری"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>ایجاد ویجت‌های هوشمند</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* انتخاب گزارش */}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <label className="label">گزارش فعال این تب</label>
            <select
              className="input"
              value={reportId}
              onChange={(e) => setReportId(e.target.value)}
            >
              <option value="">گزارش جدید (یا بدون گزارش)...</option>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.is_default ? ' (پیش‌فرض تب)' : ''} ({r.widgets?.length ?? 0} ویجت)
                </option>
              ))}
            </select>
          </div>
          {canManage && report && (
            <button
              className="btn-ghost !h-10 !px-3 text-xs !text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              onClick={removeReport}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4" /> حذف کل گزارش
            </button>
          )}
        </div>

        {!canManage && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> شما دسترسی ویرایش گزارش‌ها را ندارید — حالت مشاهده.
          </div>
        )}
      </div>

      {/* بخش اصلی: لیست ویجت‌ها (همواره در دسترس و آشکار) */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <span className="font-bold text-sm text-ink-800 dark:text-slate-100">
              ویجت‌های فعال گزارش {report ? `«${report.name}»` : ''} ({report?.widgets?.length ?? 0} ویجت)
            </span>
          </div>
          {canManage && (
            <button
              type="button"
              className="btn-ghost !h-8 !px-2.5 text-xs font-bold text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-slate-800 flex items-center gap-1"
              onClick={openNewWidget}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>افزودن ویجت</span>
            </button>
          )}
        </div>

        {/* لیست ویجت‌ها */}
        {loading ? (
          <div className="py-6"><div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" /></div>
        ) : (
          <div className="space-y-2.5">
            {(!report || !(report.widgets?.length)) && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center dark:border-slate-700 dark:bg-slate-800/30">
                <LayoutDashboard className="mx-auto h-10 w-10 text-slate-400 mb-2" />
                <h4 className="font-bold text-sm text-ink-700 dark:text-slate-200">
                  {report ? 'هنوز ویجتی برای این گزارش تعریف نشده است.' : 'هنوز گزارشی با ویجت برای این تب تعریف نشده است.'}
                </h4>
                <p className="mt-1 text-xs text-ink-400 dark:text-slate-400 max-w-md mx-auto">
                  می‌توانید همین حالا با دکمه‌های زیر ویجت‌های شاخص‌های کلیدی (KPI)، جدول آماری یا نمودارهای تحلیلی اضافه کنید.
                </p>
                {canManage && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      className="btn-primary !h-9 !px-4 text-xs font-bold flex items-center gap-1.5"
                      onClick={openNewWidget}
                    >
                      <Plus className="h-4 w-4" />
                      <span>افزودن اولین ویجت</span>
                    </button>
                    <button
                      type="button"
                      className="btn-secondary !h-9 !px-3.5 text-xs font-semibold flex items-center gap-1.5"
                      onClick={createDefaultReportWithWidgets}
                      disabled={saving}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      <span>ایجاد بسته ویجت‌های آماده</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {[...(report?.widgets ?? [])].sort((a, b) => a.order - b.order).map((w, idx) => {
              const typeInfo = WIDGET_TYPES.find((t) => t.value === w.widget_type)
              return (
                <div
                  key={w.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3 transition ${
                    w.is_active === false
                      ? 'border-dashed border-slate-300 bg-slate-50/50 opacity-60 dark:border-slate-700 dark:bg-slate-800/30'
                      : 'border-ink-100 bg-white shadow-2xs hover:border-brand-200 dark:border-slate-700 dark:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {idx + 1}
                    </span>
                    <span className="rounded-lg bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                      {typeInfo?.label ?? w.widget_type}
                    </span>
                    <span className="text-sm font-bold text-ink-800 dark:text-slate-100">
                      {w.title}
                    </span>
                    {w.is_active === false && (
                      <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400 text-[10px]">
                        غیرفعال
                      </span>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 dark:hover:bg-slate-800"
                        title="جابه‌جایی به بالا"
                        onClick={() => moveWidget(w, -1)}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 dark:hover:bg-slate-800"
                        title="جابه‌جایی به پایین"
                        onClick={() => moveWidget(w, 1)}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 dark:hover:bg-slate-800"
                        title={w.is_active === false ? 'فعال‌سازی' : 'غیرفعال‌سازی'}
                        onClick={() => toggleWidgetActive(w)}
                      >
                        {w.is_active === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        className="btn-secondary !h-7 !px-2 text-xs font-bold flex items-center gap-1 hover:text-brand-600"
                        title="ویرایش ویجت"
                        onClick={() => openEditWidget(w)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>ویرایش</span>
                      </button>
                      <button
                        className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                        title="حذف ویجت"
                        onClick={() => removeWidget(w)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* فرم ویرایش / ساخت ویجت (در صورت باز بودن) */}
        {editorOpen && (
          <div
            ref={editorRef}
            className="rounded-2xl border-2 border-brand-300 bg-brand-50/40 p-4 shadow-sm dark:border-brand-800 dark:bg-brand-950/20 animate-fade-in"
          >
            <div className="mb-3 flex items-center justify-between border-b border-brand-200 pb-2 dark:border-brand-900/60">
              <span className="font-bold text-sm text-brand-900 dark:text-brand-200">
                {editingWidget ? `ویرایش ویجت: «${editingWidget.title}»` : 'افزودن ویجت جدید به گزارش'}
              </span>
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                onClick={() => setEditorOpen(false)}
              >
                بستن
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="label">نوع ویجت *</label>
                <select
                  className="input font-bold"
                  value={wType}
                  onChange={(e) => setWType(e.target.value as FactoryTabWidgetType)}
                >
                  {WIDGET_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] text-ink-400 dark:text-slate-400">
                  {WIDGET_TYPES.find((t) => t.value === wType)?.desc}
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className="label">عنوان ویجت *</label>
                <input
                  className="input"
                  value={wTitle}
                  onChange={(e) => setWTitle(e.target.value)}
                  placeholder="مثلا: شاخص‌های کلیدی تولید، نمودار تناژ روزانه و..."
                />
              </div>
            </div>

            {/* ویجت شاخص‌ها (KPI) */}
            {wType === 'kpi' && (
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-700 dark:text-slate-200">
                    کارت‌های شاخص این ویجت ({wCards.length})
                  </span>
                  <button
                    type="button"
                    className="btn-ghost !h-7 !px-2 text-xs font-bold text-brand-600"
                    onClick={() => setWCards((p) => [...p, { ...emptyCard(), field: numericRefs[0]?.ref ?? '' }])}
                  >
                    <Plus className="h-3.5 w-3.5" /> افزودن کارت شاخص
                  </button>
                </div>

                {wCards.map((c, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2.5 shadow-2xs dark:bg-slate-900">
                    <select
                      className="input !h-9 w-28 !py-0"
                      value={c.kind}
                      onChange={(e) => setWCards((p) => p.map((x, i) => (i === idx ? { ...x, kind: e.target.value as KpiCard['kind'] } : x)))}
                    >
                      <option value="count">تعداد رکورد</option>
                      <option value="stat">آمار فیلد</option>
                      <option value="metric">متریک محاسباتی</option>
                    </select>

                    {c.kind === 'stat' && (
                      <>
                        <select
                          className="input !h-9 w-44 !py-0"
                          value={c.field}
                          onChange={(e) => setWCards((p) => p.map((x, i) => (i === idx ? { ...x, field: e.target.value } : x)))}
                        >
                          <option value="">انتخاب فیلد...</option>
                          {numericRefs.map((r) => (
                            <option key={r.ref} value={r.ref}>{r.label}</option>
                          ))}
                        </select>
                        <select
                          className="input !h-9 w-28 !py-0"
                          value={c.stat}
                          onChange={(e) => setWCards((p) => p.map((x, i) => (i === idx ? { ...x, stat: e.target.value } : x)))}
                        >
                          {AGGS.map((a) => (
                            <option key={a} value={a}>{AGG_LABEL[a]}</option>
                          ))}
                        </select>
                      </>
                    )}

                    {c.kind === 'metric' && (
                      <select
                        className="input !h-9 w-44 !py-0"
                        value={c.metric}
                        onChange={(e) => setWCards((p) => p.map((x, i) => (i === idx ? { ...x, metric: e.target.value } : x)))}
                      >
                        <option value="">انتخاب متریک...</option>
                        {metricKeys.map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    )}

                    {c.kind !== 'count' && (
                      <input
                        className="input !h-9 w-36 !py-0"
                        placeholder="برچسب کارت (اختیاری)"
                        value={c.label}
                        onChange={(e) => setWCards((p) => p.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))}
                      />
                    )}

                    {c.kind === 'stat' && (
                      <div className="flex flex-wrap gap-1">
                        {AGGS.filter((a) => a !== 'count').map((a) => (
                          <label key={a} className="flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={c.sub.includes(a)}
                              onChange={() => setWCards((p) => p.map((x, i) => (i === idx ? { ...x, sub: x.sub.includes(a) ? x.sub.filter((s) => s !== a) : [...x.sub, a] } : x)))}
                            />
                            <span className={c.sub.includes(a) ? 'font-bold text-brand-600' : ''}>{AGG_LABEL[a]}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    <button
                      className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                      onClick={() => setWCards((p) => p.filter((_, i) => i !== idx))}
                      title="حذف کارت"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* جدول آماری فیلدها */}
            {wType === 'stat_table' && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">منابع فیلدها</label>
                  <div className="flex gap-2">
                    {['out', 'in'].map((s) => (
                      <label key={s} className="flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        <input type="checkbox" checked={wSources.includes(s)} onChange={() => toggle(wSources, s, setWSources)} />
                        {s === 'out' ? 'خروجی‌های تب' : 'ورودی‌های تب'}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">عملیات تجمیعی آماری</label>
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
                  <label className="label">انتخاب فیلدها (در صورت خالی بودن، تمام فیلدها درج می‌شوند)</label>
                  <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
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

            {/* جدول گروه‌بندی یا نمودار */}
            {(wType === 'group_table' || wType === 'chart') && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {wType === 'chart' && (
                  <div>
                    <label className="label">نوع نمودار</label>
                    <select className="input" value={wChart} onChange={(e) => setWChart(e.target.value)}>
                      <option value="bar">میله‌ای (Bar)</option>
                      <option value="line">خطی (Line)</option>
                      <option value="pie">دایره‌ای (Pie)</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="label">مبنای گروه‌بندی</label>
                  <select className="input" value={wGroupBy} onChange={(e) => setWGroupBy(e.target.value)}>
                    {GROUP_BYS.map((g) => (
                      <option key={g} value={g}>{GROUP_LABEL[g]}</option>
                    ))}
                  </select>
                </div>
                {wGroupBy === 'field_value' && (
                  <div>
                    <label className="label">فیلد گروه‌بندی</label>
                    <select className="input" value={wGroupField} onChange={(e) => setWGroupField(e.target.value)}>
                      <option value="">انتخاب فیلد...</option>
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
                          <label className="label">فیلد مقدار</label>
                          <select className="input" value={wValueField} onChange={(e) => setWValueField(e.target.value)}>
                            <option value="">انتخاب فیلد...</option>
                            {numericRefs.map((r) => <option key={r.ref} value={r.ref}>{r.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label">تجمیع مقدار</label>
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
                      <label className="label">فیلدهای جدول (خالی = همه)</label>
                      <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
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
                    <label className="flex items-center gap-1.5 text-xs text-ink-600 dark:text-slate-300">
                      <input type="checkbox" checked={wIncludeTotal} onChange={(e) => setWIncludeTotal(e.target.checked)} /> نمایش ردیف جمع کل
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
                        <option value="">انتخاب فیلد...</option>
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
                  <label className="label">سقف تعداد نمایش (Limit)</label>
                  <input type="number" className="input" min={1} max={wType === 'chart' ? 100 : 200} value={wLimit} onChange={(e) => setWLimit(Number(e.target.value))} />
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-brand-200/80 pt-3 dark:border-brand-900/60">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-700 dark:text-slate-300">
                <input type="checkbox" checked={wActive} onChange={(e) => setWActive(e.target.checked)} />
                <span>ویجت فعال باشد و در گزارش نمایش داده شود</span>
              </label>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost" onClick={() => setEditorOpen(false)}>
                  انصراف
                </button>
                <button type="button" className="btn-primary" onClick={saveWidget} disabled={wSaving}>
                  {wSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>{editingWidget ? 'ذخیره تغییرات ویجت' : 'ثبت و افزودن ویجت'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* بخش تنظیمات عمومی گزارش و متریک‌های محاسباتی */}
      <div className="card p-4 space-y-4">
        <div
          className="flex cursor-pointer items-center justify-between"
          onClick={() => setShowAdvancedSettings((p) => !p)}
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-slate-500" />
            <span className="font-bold text-xs text-ink-700 dark:text-slate-300">
              تنظیمات عمومی گزارش، فیلترها و متریک‌های پیشرفته
            </span>
          </div>
          <span className="text-xs text-brand-600 font-semibold flex items-center gap-1">
            {showAdvancedSettings ? 'بستن تنظیمات' : 'مشاهده و ویرایش تنظیمات'}
            <ChevronDown className={`h-4 w-4 transition ${showAdvancedSettings ? 'rotate-180' : ''}`} />
          </span>
        </div>

        {showAdvancedSettings && (
          <div className="border-t border-ink-100 pt-4 space-y-4 dark:border-slate-800 animate-fade-in">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">نام گزارش *</label>
                <input
                  className="input"
                  disabled={!canManage}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثلا: گزارش جامع تب"
                />
              </div>
              <div className="flex items-center gap-4 pt-6">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!canManage}
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                  />
                  <span>گزارش پیش‌فرض این تب باشد</span>
                </label>
              </div>
            </div>

            <div>
              <label className="label">توضیحات اختیاری گزارش</label>
              <textarea
                className="input min-h-[50px]"
                disabled={!canManage}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="label">فیلترهای مجاز گزارش</label>
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <label
                    key={f}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                      filters.includes(f)
                        ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300'
                        : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      disabled={!canManage}
                      checked={filters.includes(f)}
                      onChange={() => toggle(filters, f, setFilters)}
                    />
                    {FILTER_LABEL[f]}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-ink-600 dark:text-slate-300">متریک‌های محاسباتی اختصاصی (فرمول)</span>
                  <p className="text-[11px] text-ink-400 dark:text-slate-500">برای محاسبه نسبت‌ها، درصدها و بازدهی‌های فرمولی در گزارش</p>
                </div>
                {canManage && (
                  <button
                    className="btn-ghost !h-7 !px-2 text-xs"
                    onClick={() => setMetrics((p) => [...p, emptyMetric()])}
                  >
                    <Plus className="h-3.5 w-3.5" /> افزودن متریک
                  </button>
                )}
              </div>
              <div className="mt-2 space-y-2">
                {metrics.map((m, idx) => (
                  <div key={idx} className="rounded-xl border border-ink-100 p-2.5 dark:border-slate-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="input !h-9 w-32 !py-0 font-mono"
                        dir="ltr"
                        disabled={!canManage}
                        placeholder="key"
                        value={m.key}
                        onChange={(e) => setMetrics((p) => p.map((x, i) => (i === idx ? { ...x, key: e.target.value.replace(/\s+/g, '_') } : x)))}
                      />
                      <input
                        className="input !h-9 w-40 !py-0"
                        disabled={!canManage}
                        placeholder="نام نمایشی متریک"
                        value={m.label}
                        onChange={(e) => setMetrics((p) => p.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))}
                      />
                      <input
                        className="input !h-9 w-24 !py-0"
                        disabled={!canManage}
                        placeholder="واحد"
                        value={m.unit}
                        onChange={(e) => setMetrics((p) => p.map((x, i) => (i === idx ? { ...x, unit: e.target.value } : x)))}
                      />
                      {canManage && (
                        <button
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                          onClick={() => setMetrics((p) => p.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <textarea
                        ref={(el) => { metricRefs.current[idx] = el }}
                        className="input min-h-[60px] flex-1 font-mono text-xs"
                        dir="ltr"
                        rows={2}
                        disabled={!canManage}
                        value={m.formula}
                        onFocus={() => setFocusMetric(idx)}
                        onChange={(e) => setMetrics((p) => p.map((x, i) => (i === idx ? { ...x, formula: e.target.value } : x)))}
                        placeholder="مثلا: out.recovery_pct__avg * 100"
                      />
                      {canManage && (
                        <div className="w-full shrink-0 sm:w-64">
                          <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                            {formulaVars2.map((v) => (
                              <button
                                key={v.var}
                                type="button"
                                className="chip"
                                onClick={() => insertMetricVar(v.var)}
                                title={`${v.group} · ${v.var}`}
                              >
                                {v.label}
                              </button>
                            ))}
                          </div>
                          <div className="mt-1 text-[10px] text-ink-400 dark:text-slate-500">کلیک برای درج در فرمول</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              {canManage && (
                <button
                  className="btn-primary !h-9 !px-4 text-xs font-bold"
                  onClick={saveReport}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>{report ? 'ذخیره تنظیمات گزارش' : 'ساخت گزارش'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
