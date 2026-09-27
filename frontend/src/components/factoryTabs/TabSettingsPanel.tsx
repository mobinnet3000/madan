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
} from '../../types'
import { TAB_COLOR_BG, tabColorBg, tabIcon } from '../../utils/tabIcons'

type TabInput = {
  id?: number; key: string; name: string
  input_type: 'number' | 'text' | 'select'; options: string[]
  unit: string; required: boolean; order: number
}
type TabOutput = { id?: number; key: string; name: string; unit: string; formula: string; order: number }

const emptyInput = (order: number): TabInput => ({
  key: '', name: '', input_type: 'number', options: [], unit: '', required: true, order,
})
const emptyOutput = (order: number): TabOutput => ({ key: '', name: '', unit: '', formula: '', order })

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
  const [requireLine, setRequireLine] = useState(true)
  const [contractorRequired, setContractorRequired] = useState(false)
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
        setRequireLine(found.require_line)
        setContractorRequired(found.contractor_required)
        setIsActive(found.is_active)
        setInputs(found.inputs.length
          ? found.inputs.map((i, idx) => ({
            id: i.id, key: i.key, name: i.name, input_type: i.input_type,
            options: [...(i.options ?? [])], unit: i.unit, required: i.required,
            order: i.order ?? idx,
          }))
          : [emptyInput(0)])
        setOutputs(found.outputs.length
          ? found.outputs.map((o, idx) => ({
            id: o.id, key: o.key, name: o.name, unit: o.unit,
            formula: o.formula ?? '', order: o.order ?? idx,
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
    const cleanInputs = inputs.filter((i) => i.key.trim() || i.name.trim())
    const cleanOutputs = outputs.filter((o) => o.key.trim() || o.name.trim())
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
        require_line: requireLine, contractor_required: contractorRequired,
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
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-1.5 text-sm text-ink-600 dark:text-slate-300">
                  <input type="checkbox" checked={requireLine} onChange={(e) => setRequireLine(e.target.checked)} /> خط تولید الزامی
                </label>
                <label className="flex items-center gap-1.5 text-sm text-ink-600 dark:text-slate-300">
                  <input type="checkbox" checked={contractorRequired} onChange={(e) => setContractorRequired(e.target.checked)} /> پیمانکار الزامی
                </label>
                <label className="flex items-center gap-1.5 text-sm text-ink-600 dark:text-slate-300">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> تب فعال
                </label>
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
