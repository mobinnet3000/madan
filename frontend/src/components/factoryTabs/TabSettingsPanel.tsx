import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Loader2, AlertTriangle, Save } from 'lucide-react'
import { useFactory } from '../../store/FactoryContext'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../ui/Toast'
import { hasPerm } from '../../constants'
import {
  createFactoryTab,
  deleteFactoryTab,
  getFactoryTabFormulaVars,
  getFactoryTabs,
  updateFactoryTab,
  validateTabFormula,
  type TabFormulaVar,
} from '../../api/factoryTabs'
import {
  FACTORY_TAB_COLORS,
  FACTORY_TAB_ICONS,
  type FactoryTabColor,
  type FactoryTabFull,
  type FactoryTabIcon,
  type TabFieldMode,
} from '../../types'
import { TAB_COLOR_BG, tabColorBg, tabIcon } from '../../utils/tabIcons'

type TabInput = {
  id?: number; key: string; name: string
  input_type: 'number' | 'text' | 'select'; options: string[]
  unit: string; required: boolean; order: number
  conditions?: { lines?: number[] }
}
type TabOutput = {
  id?: number; key: string; name: string; unit: string; formula: string; order: number
  conditions?: { lines?: number[] }
}

const emptyInput = (order: number): TabInput => ({
  key: '', name: '', input_type: 'number', options: [], unit: '', required: true, order,
  conditions: {},
})
const emptyOutput = (order: number): TabOutput => ({
  key: '', name: '', unit: '', formula: '', order,
  conditions: {},
})

export function TabIconBadge({ icon, color, className = 'h-5 w-5' }: {
  icon?: string
  color?: string
  className?: string
}) {
  const Ico = tabIcon(icon)
  return (
    <span className={`inline-flex items-center justify-center rounded-xl p-2 ${tabColorBg(color)}`}>
      <Ico className={className} />
    </span>
  )
}

function LineConditionPicker({
  lines,
  selectedLineIds,
  onChange,
  disabled,
}: {
  lines: { id: number; name: string }[]
  selectedLineIds?: number[]
  onChange: (lineIds: number[]) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const current = selectedLineIds ?? []
  const hasCondition = current.length > 0

  if (disabled || lines.length === 0) return null

  const toggleLine = (id: number) => {
    if (current.includes(id)) {
      onChange(current.filter((x) => x !== id))
    } else {
      onChange([...current, id])
    }
  }

  const selectedNames = lines.filter((l) => current.includes(l.id)).map((l) => l.name)

  return (
    <div className="mt-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
            hasCondition
              ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300'
              : 'border-slate-200 bg-slate-50 text-ink-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          <span>شرط خط تولید:</span>
          <b>{hasCondition ? `فقط برای: ${selectedNames.join('، ')}` : 'همه خطوط (بدون شرط)'}</b>
          <span className="text-[10px] opacity-60">{open ? '▲' : '▼'}</span>
        </button>
        {hasCondition && (
          <button
            type="button"
            className="text-[10px] text-rose-600 hover:underline"
            onClick={() => onChange([])}
          >
            حذف شرط (فعال برای همه خطوط)
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 rounded-xl border border-brand-200 bg-brand-50/50 p-2.5 dark:border-brand-900/50 dark:bg-brand-950/20">
          <div className="mb-1.5 text-[11px] font-bold text-ink-700 dark:text-slate-200">
            انتخاب خطوطی که این فیلد در آن‌ها نمایش داده می‌شود:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {lines.map((l) => {
              const checked = current.includes(l.id)
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleLine(l.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    checked
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'border border-slate-200 bg-white text-ink-700 hover:border-brand-200 hover:bg-brand-50/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {checked ? '✓ ' : '+ '} {l.name}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[10px] text-ink-400 dark:text-slate-400">
            💡 اگر خطوطی انتخاب شوند، این فیلد تنها در صورت انتخاب یکی از این خطوط نمایش داده شده و مقدار می‌گیرد؛ در غیر این صورت پنهان بوده و مقدار آن ۰ ذخیره خواهد شد.
          </p>
        </div>
      )}
    </div>
  )
}

export default function TabSettingsPanel({ tabId, onChanged }: { tabId: number; onChanged?: () => void }) {
  const { selectedFactory, reload } = useFactory()
  const { user } = useAuth()
  const { notify } = useToast()
  const canEdit = hasPerm(user?.permissions, 'factory-tabs.manage')

  const [full, setFull] = useState<FactoryTabFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState<FactoryTabIcon>('layers')
  const [color, setColor] = useState<FactoryTabColor>('slate')
  const [recordType, setRecordType] = useState<'range' | 'daily'>('range')
  const [lineMode, setLineMode] = useState<TabFieldMode>('required')
  const [contractorMode, setContractorMode] = useState<TabFieldMode>('optional')
  const [hourMode, setHourMode] = useState<TabFieldMode>('disabled')
  const [isActive, setIsActive] = useState(true)
  const [inputs, setInputs] = useState<TabInput[]>([emptyInput(0)])
  const [outputs, setOutputs] = useState<TabOutput[]>([emptyOutput(0)])
  const [checks, setChecks] = useState<Record<number, { ok: boolean; errors: string[] }>>({})
  const [checking, setChecking] = useState<Record<number, boolean>>({})
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  const [formulaVars, setFormulaVars] = useState<TabFormulaVar[]>([])
  const formulaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({})

  const load = useCallback(async () => {
    if (!selectedFactory) { setLoading(false); return }
    setLoading(true)
    setChecks({})
    try {
      const all = await getFactoryTabs({ factory: selectedFactory.id })
      const found = all.find((t) => t.id === tabId) ?? null
      if (found) {
        setFull(found)
        setName(found.name)
        setKey(found.key)
        setDescription(found.description || '')
        setIcon((found.icon as FactoryTabIcon) ?? 'layers')
        setColor((found.color as FactoryTabColor) ?? 'slate')
        setRecordType(found.record_type)
        setLineMode(found.line_mode ?? (found.require_line ? 'required' : 'optional'))
        setContractorMode(found.contractor_mode ?? (found.contractor_required ? 'required' : 'optional'))
        setHourMode(found.hour_mode ?? (found.record_type === 'daily' ? 'required' : 'disabled'))
        setIsActive(found.is_active)
        setInputs(found.inputs.length
          ? found.inputs.map((i, idx) => ({
            id: i.id, key: i.key, name: i.name, input_type: i.input_type,
            options: [...(i.options ?? [])], unit: i.unit, required: i.required,
            order: i.order ?? idx,
            conditions: i.conditions ?? {},
          }))
          : [emptyInput(0)])
        setOutputs(found.outputs.length
          ? found.outputs.map((o, idx) => ({
            id: o.id, key: o.key, name: o.name, unit: o.unit,
            formula: o.formula ?? '', order: o.order ?? idx,
            conditions: o.conditions ?? {},
          }))
          : [emptyOutput(0)])
        try {
          setFormulaVars(await getFactoryTabFormulaVars(found.id))
        } catch { setFormulaVars([]) }
      } else {
        setFull(null)
      }
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'خطا در دریافت تب', 'error')
    } finally { setLoading(false) }
  }, [selectedFactory, tabId, notify])

  useEffect(() => { load() }, [load])

  const setInput = (idx: number, patch: Partial<TabInput>) =>
    setInputs((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } as TabInput : r)))
  const setOutput = (idx: number, patch: Partial<TabOutput>) =>
    setOutputs((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } as TabOutput : r)))

  const insertVar = (v: string) => {
    if (focusIdx == null) return
    const ta = formulaRefs.current[focusIdx]
    if (!ta) return
    const s = ta.selectionStart ?? ta.value.length
    const e = ta.selectionEnd ?? ta.value.length
    setOutput(focusIdx, { formula: ta.value.slice(0, s) + v + ta.value.slice(e) })
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + v.length, s + v.length) })
  }

  const checkFormula = async (idx: number) => {
    const o = outputs[idx]
    if (!o.formula.trim()) { notify('فرمول خالی است', 'error'); return }
    setChecking((p) => ({ ...p, [idx]: true }))
    try {
      const res = await validateTabFormula(tabId, o.formula)
      setChecks((p) => ({ ...p, [idx]: res }))
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'خطا در اعتبارسنجی', 'error')
    } finally { setChecking((p) => ({ ...p, [idx]: false })) }
  }

  const parseOptions = (raw: string): string[] =>
    Array.from(new Set(raw.replace(/،/g, ',').split(',').map((s) => s.trim()).filter(Boolean)))

  const save = async () => {
    if (!selectedFactory || !full) return
    if (!name.trim()) { notify('نام تب الزامی است', 'error'); return }
    if (!key.trim()) { notify('کلید تب الزامی است', 'error'); return }
    const cleanInputs = inputs
      .filter((i) => i.key.trim() || i.name.trim())
      .map((i) => ({
        ...i,
        conditions: (i.conditions?.lines?.length ?? 0) > 0 ? { lines: i.conditions!.lines } : {},
      }))
    const cleanOutputs = outputs
      .filter((o) => o.key.trim() || o.name.trim())
      .map((o) => ({
        ...o,
        conditions: (o.conditions?.lines?.length ?? 0) > 0 ? { lines: o.conditions!.lines } : {},
      }))
    const seen = new Set<string>()
    for (const i of cleanInputs) {
      if (!i.key.trim()) { notify('همه ورودی‌ها باید کلید داشته باشند', 'error'); return }
      if (seen.has(i.key)) { notify(`کلید ورودی تکراری «${i.key}»`, 'error'); return }
      seen.add(i.key)
      if (i.input_type === 'select' && !(i.options ?? []).length) {
        notify(`ورودی انتخابی «${i.key}» باید گزینه داشته باشد`, 'error'); return
      }
    }
    seen.clear()
    for (const o of cleanOutputs) {
      if (!o.key.trim()) { notify('همه خروجی‌ها باید کلید داشته باشند', 'error'); return }
      if (seen.has(o.key)) { notify(`کلید خروجی تکراری «${o.key}»`, 'error'); return }
      seen.add(o.key)
      if (!o.formula.trim()) { notify(`فرمول خروجی «${o.key}» خالی است`, 'error'); return }
    }
    setSaving(true)
    try {
      await updateFactoryTab(full.id, {
        factory: selectedFactory.id,
        key: key.trim(), name: name.trim(), description,
        icon, color, record_type: recordType,
        line_mode: lineMode,
        contractor_mode: contractorMode,
        hour_mode: hourMode,
        require_line: lineMode === 'required',
        contractor_required: contractorMode === 'required',
        order: full.order, is_active: isActive,
        inputs: cleanInputs, outputs: cleanOutputs,
      })
      notify('تنظیمات تب ذخیره شد')
      reload()
      onChanged?.()
      load()
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'خطا در ذخیره', 'error')
    } finally { setSaving(false) }
  }

  const removeTab = async () => {
    if (!full || !window.confirm(`تب «${full.name}» با همه رکوردها و گزارش‌هایش حذف شود؟`)) return
    setSaving(true)
    try {
      await deleteFactoryTab(full.id)
      notify('تب حذف شد')
      reload()
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'خطا در حذف', 'error')
    } finally { setSaving(false) }
  }

  const varGroups = useMemo(() => {
    const map = new Map<string, TabFormulaVar[]>()
    formulaVars.forEach((v) => {
      if (!map.has(v.group)) map.set(v.group, [])
      map.get(v.group)!.push(v)
    })
    return Array.from(map.entries())
  }, [formulaVars])

  if (!canEdit) {
    return (
      <div className="card flex items-start gap-2 p-4 text-sm text-amber-700 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        برای ویرایش تنظیمات تب به دسترسی <b>factory-tabs.manage</b> نیاز دارید — فقط مشاهده.
      </div>
    )
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TabIconBadge icon={icon} color={color} />
        <div className="flex-1 text-sm font-bold text-ink-700 dark:text-slate-200">
          تنظیمات تب «{full?.name ?? '—'}»
        </div>
        {canEdit && full && (
          <button className="btn-ghost !h-8 !px-2 text-xs !text-rose-600" onClick={removeTab} disabled={saving}>
            <Trash2 className="h-3.5 w-3.5" /> حذف تب
          </button>
        )}
      </div>

      <div className="flex gap-1.5">
        {([
          [1, '۱. مشخصات و آیکون'],
          [2, '۲. ورودی‌ها'],
          [3, '۳. خروجی‌ها و فرمول‌ها'],
        ] as const).map(([s, l]) => (
          <button key={s} type="button" onClick={() => setStep(s)}
            className={`flex-1 rounded-xl px-2 py-2 text-xs font-bold transition sm:text-sm ${step === s ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-950/40 dark:text-brand-300 dark:ring-brand-900/50' : 'bg-ink-50 text-ink-500 dark:bg-slate-800/60 dark:text-slate-400'}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-8"><div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" /></div>
      ) : step === 1 ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">نام تب *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلا: تناژ تحویلی روزانه" />
              <p className="mt-1 text-[11px] text-ink-400 dark:text-slate-500">نامی که در سایدبار و هدر صفحه تب دیده می‌شود.</p>
            </div>
            <div>
              <label className="label">کلید (key) *</label>
              <input className="input font-mono" dir="ltr" value={key} onChange={(e) => setKey(e.target.value.replace(/\s+/g, '-'))} placeholder="tonnage-delivery" />
              <p className="mt-1 text-[11px] text-ink-400 dark:text-slate-500">انگلیسی و یکتا در کارخانه. در فرمول تب‌های دیگر با زیرخط صدا زده می‌شود.</p>
            </div>
            <div>
              <label className="label">نوع ثبت رکورد</label>
              <select className="input" value={recordType} onChange={(e) => setRecordType(e.target.value as 'range' | 'daily')}>
                <option value="range">بازه تاریخی (از تاریخ تا تاریخ)</option>
                <option value="daily">روزانه (چند رکورد در روز با ساعت)</option>
              </select>
              <p className="mt-1 text-[11px] text-ink-400 dark:text-slate-500">«روزانه» هنگام ثبت رکورد ساعت هم می‌خواهد.</p>
            </div>
            <div className="col-span-1 sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-ink-700 dark:text-slate-200">تنظیم فیلدهای پایه در فرم ثبت رکورد</span>
                <label className="flex items-center gap-1.5 text-xs text-ink-600 dark:text-slate-300 font-semibold cursor-pointer">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> تب فعال
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-white p-2.5 shadow-xs dark:bg-slate-800">
                  <label className="label mb-1 text-xs font-bold">خط تولید</label>
                  <select className="input !h-9 text-xs" value={lineMode} onChange={(e) => setLineMode(e.target.value as TabFieldMode)}>
                    <option value="required">الزامی (باید انتخاب شود)</option>
                    <option value="optional">اختیاری (انتخاب دلخواه)</option>
                    <option value="disabled">غیرفعال (حذف کامل از تب)</option>
                  </select>
                  <p className="mt-1 text-[10px] text-ink-400 dark:text-slate-400">
                    {lineMode === 'disabled' ? 'در این تب خط تولید نمایش داده نمی‌شود.' : lineMode === 'required' ? 'انتخاب خط برای ثبت رکورد اجباری است.' : 'ثبت رکورد می‌تواند بدون خط باشد.'}
                  </p>
                </div>

                <div className="rounded-lg bg-white p-2.5 shadow-xs dark:bg-slate-800">
                  <label className="label mb-1 text-xs font-bold">پیمانکار</label>
                  <select className="input !h-9 text-xs" value={contractorMode} onChange={(e) => setContractorMode(e.target.value as TabFieldMode)}>
                    <option value="required">الزامی (باید انتخاب شود)</option>
                    <option value="optional">اختیاری (انتخاب دلخواه)</option>
                    <option value="disabled">غیرفعال (حذف کامل از تب)</option>
                  </select>
                  <p className="mt-1 text-[10px] text-ink-400 dark:text-slate-400">
                    {contractorMode === 'disabled' ? 'در این تب پیمانکار نمایش داده نمی‌شود.' : contractorMode === 'required' ? 'انتخاب پیمانکار اجباری است.' : 'ثبت رکورد می‌تواند بدون پیمانکار باشد.'}
                  </p>
                </div>

                <div className="rounded-lg bg-white p-2.5 shadow-xs dark:bg-slate-800">
                  <label className="label mb-1 text-xs font-bold">ساعت ثبت / ورود</label>
                  <select className="input !h-9 text-xs" value={hourMode} onChange={(e) => setHourMode(e.target.value as TabFieldMode)}>
                    <option value="required">الزامی (باید وارد شود)</option>
                    <option value="optional">اختیاری (دلخواه)</option>
                    <option value="disabled">غیرفعال (حذف کامل از تب)</option>
                  </select>
                  <p className="mt-1 text-[10px] text-ink-400 dark:text-slate-400">
                    {hourMode === 'disabled' ? 'فیلد ساعت در فرم ثبت نمایش داده نمی‌شود.' : hourMode === 'required' ? 'ورود ساعت برای ثبت رکورد اجباری است.' : 'ورود ساعت اختیاری است.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="label">توضیحات</label>
            <textarea className="input min-h-[60px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="توضیح کوتاه درباره این تب" />
          </div>

          <div>
            <label className="label">آیکون تب</label>
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 p-2 dark:border-slate-700">
              {FACTORY_TAB_ICONS.map((ic) => {
                const Ico = tabIcon(ic)
                return (
                  <button key={ic} type="button" title={ic} onClick={() => setIcon(ic)}
                    className={`rounded-lg p-1.5 transition ${icon === ic ? 'bg-brand-600 text-white' : 'text-ink-500 hover:bg-ink-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
                    <Ico className="h-4 w-4" />
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label">رنگ تب</label>
            <div className="flex flex-wrap gap-1.5">
              {FACTORY_TAB_COLORS.map((c) => (
                <button key={c} type="button" title={c} onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-lg ${TAB_COLOR_BG[c]} transition ${color === c ? 'ring-2 ring-brand-500 ring-offset-1 dark:ring-offset-slate-900' : ''}`} />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <TabIconBadge icon={icon} color={color} />
              <span className="text-sm text-ink-600 dark:text-slate-300">پیش‌نمایش: {name || 'تب بدون نام'}</span>
            </div>
          </div>

          <div className="flex justify-end">
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} ذخیره تنظیمات
            </button>
          </div>
        </div>
      ) : step === 2 ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-ink-600 dark:text-slate-300">ورودی‌های تب</span>
              <p className="text-[11px] text-ink-400 dark:text-slate-500">فیلدهایی که هنگام ثبت رکورد پر می‌شوند. فقط «عدد»ها در فرمول قابل استفاده‌اند.</p>
            </div>
            <button className="btn-ghost !h-8 !px-2 text-xs" onClick={() => setInputs((p) => [...p, emptyInput(p.length)])}>
              <Plus className="h-3.5 w-3.5" /> افزودن ورودی
            </button>
          </div>
          <div className="space-y-2">
            {inputs.map((inp, idx) => (
              <div key={idx} className="rounded-xl border border-ink-100 p-2 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <input className="input !h-9 w-32 !py-0 font-mono" dir="ltr" placeholder="key" value={inp.key} onChange={(e) => setInput(idx, { key: e.target.value.replace(/\s+/g, '_') })} />
                  <input className="input !h-9 w-40 !py-0" placeholder="نام نمایشی" value={inp.name} onChange={(e) => setInput(idx, { name: e.target.value })} />
                  <select className="input !h-9 w-32 !py-0" value={inp.input_type} onChange={(e) => setInput(idx, { input_type: e.target.value as TabInput['input_type'] })}>
                    <option value="number">عدد</option>
                    <option value="text">متن</option>
                    <option value="select">انتخابی (کشویی)</option>
                  </select>
                  <input className="input !h-9 w-24 !py-0" placeholder="واحد" value={inp.unit} onChange={(e) => setInput(idx, { unit: e.target.value })} />
                  <label className="flex items-center gap-1 text-xs text-ink-500 dark:text-slate-400">
                    <input type="checkbox" checked={inp.required} onChange={(e) => setInput(idx, { required: e.target.checked })} /> الزامی
                  </label>
                  <input type="number" className="input !h-9 w-14 !py-0" title="ترتیب" value={inp.order} onChange={(e) => setInput(idx, { order: Number(e.target.value) })} />
                  <button className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setInputs((p) => p.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {inp.input_type === 'select' && (
                  <div className="mt-2">
                    <label className="label">گزینه‌های کشویی (با کاما جدا کنید) *</label>
                    <input className="input !h-9" placeholder="کفی، بونوس، تریلی"
                      value={(inp.options ?? []).join('، ')}
                      onChange={(e) => setInput(idx, { options: parseOptions(e.target.value) })} />
                    <p className="mt-1 text-[11px] text-ink-400 dark:text-slate-500">در فرم ثبت رکورد به‌صورت کشویی نمایش داده می‌شود؛ در فرمول عددی مجاز نیست.</p>
                  </div>
                )}
                <LineConditionPicker
                  lines={selectedFactory?.lines ?? []}
                  selectedLineIds={inp.conditions?.lines}
                  onChange={(lineIds) =>
                    setInput(idx, {
                      conditions: lineIds.length ? { lines: lineIds } : {},
                    })
                  }
                  disabled={lineMode === 'disabled'}
                />
              </div>
            ))}
            {inputs.length === 0 && <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-400 dark:bg-slate-800/60">ورودی‌ای تعریف نشده است.</div>}
          </div>
          <div className="flex justify-between">
            <button className="btn-ghost" onClick={() => setStep(1)}>مرحله قبل</button>
            <button className="btn-primary" onClick={() => { setStep(3) }}>
              مرحله بعد: خروجی‌ها
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-ink-600 dark:text-slate-300">خروجی‌ها (با فرمول)</span>
              <p className="text-[11px] text-ink-400 dark:text-slate-500">می‌توانید از ورودی/خروجی همین تب یا تب‌های دیگر استفاده کنید.</p>
            </div>
            <button className="btn-ghost !h-8 !px-2 text-xs" onClick={() => setOutputs((p) => [...p, emptyOutput(p.length)])}>
              <Plus className="h-3.5 w-3.5" /> افزودن خروجی
            </button>
          </div>
          <div className="space-y-2">
            {outputs.map((out, idx) => (
              <div key={idx} className="rounded-xl border border-ink-100 p-2 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <input className="input !h-9 w-32 !py-0 font-mono" dir="ltr" placeholder="key" value={out.key} onChange={(e) => setOutput(idx, { key: e.target.value.replace(/\s+/g, '_') })} />
                  <input className="input !h-9 w-40 !py-0" placeholder="نام نمایشی" value={out.name} onChange={(e) => setOutput(idx, { name: e.target.value })} />
                  <input className="input !h-9 w-24 !py-0" placeholder="واحد" value={out.unit} onChange={(e) => setOutput(idx, { unit: e.target.value })} />
                  <input type="number" className="input !h-9 w-14 !py-0" title="ترتیب" value={out.order} onChange={(e) => setOutput(idx, { order: Number(e.target.value) })} />
                  <button className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => { setOutputs((p) => p.filter((_, i) => i !== idx)); setChecks((p) => { const n = { ...p }; delete n[idx]; return n }) }}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex flex-col gap-2 lg:flex-row">
                  <textarea ref={(el) => { formulaRefs.current[idx] = el }}
                    className="input min-h-[80px] flex-1 font-mono text-xs leading-relaxed"
                    dir="ltr" rows={3} value={out.formula}
                    onFocus={() => setFocusIdx(idx)}
                    onChange={(e) => setOutput(idx, { formula: e.target.value })}
                    placeholder="مثلا: tonnage / cars  یا  tonnage_delivery.tonnage / feed_t" />
                  <div className="w-full shrink-0 lg:w-72">
                    <button className="btn-ghost !h-8 w-full !px-2 text-xs" onClick={() => checkFormula(idx)} disabled={checking[idx]}>
                      {checking[idx] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'اعتبارسنجی فرمول'}
                    </button>
                    <div className="mt-1.5 max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-1.5 dark:border-slate-700">
                      {varGroups.map(([grp, items]) => (
                        <div key={grp}>
                          <div className="mb-0.5 text-[10px] font-bold text-ink-400 dark:text-slate-500">{grp}</div>
                          <div className="flex flex-wrap gap-1">
                            {items.map((v) => (
                              <button key={v.var} type="button" className="chip" title={v.var} onClick={() => insertVar(v.var)}>
                                {v.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      {varGroups.length === 0 && (
                        <p className="text-[11px] text-ink-400 dark:text-slate-500">هنوز تب ذخیره نشده — اول تنظیمات پایه را ذخیره کنید.</p>
                      )}
                    </div>
                  </div>
                </div>
                {checks[idx] && (
                  <div className={`mt-1.5 rounded-lg px-3 py-1.5 text-xs ${checks[idx].ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}>
                    {checks[idx].ok ? 'فرمول معتبر است' : checks[idx].errors.join(' · ')}
                  </div>
                )}
                <LineConditionPicker
                  lines={selectedFactory?.lines ?? []}
                  selectedLineIds={out.conditions?.lines}
                  onChange={(lineIds) =>
                    setOutput(idx, {
                      conditions: lineIds.length ? { lines: lineIds } : {},
                    })
                  }
                  disabled={lineMode === 'disabled'}
                />
              </div>
            ))}
            {outputs.length === 0 && <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-400 dark:bg-slate-800/60">خروجی‌ای تعریف نشده است.</div>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button className="btn-ghost" onClick={() => setStep(2)}>مرحله قبل: ورودی‌ها</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} ذخیره تنظیمات
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
