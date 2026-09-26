import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Loader2, AlertTriangle, Save, Settings2 } from 'lucide-react'
import { useFactory } from '../../store/FactoryContext'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../ui/Toast'
import { hasPerm } from '../../constants'
import { api } from '../../api/client'
import {
  createFactoryTab,
  deleteFactoryTab,
  getFactoryTabs,
  updateFactoryTab,
  validateTabFormula,
} from '../../api/factoryTabs'
import type { FactoryTabFull } from '../../types'

type TabInput = { id?: number; key: string; name: string; input_type: 'number' | 'text' | 'select'; options: string[]; unit: string; required: boolean; order: number }
type TabOutput = { id?: number; key: string; name: string; unit: string; formula: string; order: number }

const emptyInput = (order: number): TabInput => ({ key: '', name: '', input_type: 'number', options: [], unit: '', required: true, order })
const emptyOutput = (order: number): TabOutput => ({ key: '', name: '', unit: '', formula: '', order })

export default function TabDefinitionPanel({ initialTabId, hideSelector, onTabIdChange }: { initialTabId?: string; hideSelector?: boolean; onTabIdChange?: (id: string) => void } = {}) {
  const { selectedFactory, reload } = useFactory()
  const { user } = useAuth()
  const { notify } = useToast()
  const canEdit = hasPerm(user?.permissions, 'factory-tabs.manage')

  const tabs = useMemo(() => (selectedFactory?.report_tabs ?? []).filter((t) => t.is_active), [selectedFactory])
  const [tabId, setTabIdInner] = useState<string>(initialTabId ?? '')
  const setTabId = (id: string) => { setTabIdInner(id); onTabIdChange?.(id) }

  useEffect(() => {
    if (initialTabId !== undefined) setTabIdInner(initialTabId)
  }, [initialTabId])
  const [full, setFull] = useState<FactoryTabFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)

  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [description, setDescription] = useState('')
  const [recordType, setRecordType] = useState<'range' | 'daily'>('range')
  const [requireLine, setRequireLine] = useState(true)
  const [contractorRequired, setContractorRequired] = useState(false)
  const [inputs, setInputs] = useState<TabInput[]>([emptyInput(0)])
  const [outputs, setOutputs] = useState<TabOutput[]>([emptyOutput(0)])
  const [checks, setChecks] = useState<Record<number, { ok: boolean; errors: string[] }>>({})
  const [checking, setChecking] = useState<Record<number, boolean>>({})
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  const formulaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({})

  const load = useCallback(async () => {
    if (!selectedFactory) { setLoading(false); return }
    setLoading(true)
    setChecks({})
    try {
      const all = await getFactoryTabs({ factory: selectedFactory.id })
      const found = tabId ? all.find((t) => String(t.id) === tabId) : all[0]
      if (!tabId && found) setTabId(String(found.id))
      if (found) {
        setFull(found)
        setName(found.name)
        setKey(found.key)
        setDescription(found.description || '')
        setRecordType(found.record_type)
        setRequireLine(found.require_line)
        setContractorRequired(found.contractor_required)
        setInputs(found.inputs.length ? found.inputs.map((i, idx) => ({
          id: i.id, key: i.key, name: i.name, input_type: i.input_type,
          options: [...(i.options ?? [])], unit: i.unit, required: i.required,
          order: i.order ?? idx,
        })) : [emptyInput(0)])
        setOutputs(found.outputs.length ? found.outputs.map((o, idx) => ({
          id: o.id, key: o.key, name: o.name, unit: o.unit,
          formula: o.formula ?? '', order: o.order ?? idx,
        })) : [emptyOutput(0)])
      } else {
        setFull(null)
        setName(''); setKey(''); setDescription('')
        setRecordType('range'); setRequireLine(true); setContractorRequired(false)
        setInputs([emptyInput(0)]); setOutputs([emptyOutput(0)])
      }
    } catch (e: unknown) { notify(e instanceof Error ? e.message : 'خطا در دریافت تب‌ها', 'error') }
    finally { setLoading(false) }
  }, [selectedFactory, tabId, notify])

  useEffect(() => { load() }, [load])

  const setInput = (idx: number, patch: Partial<TabInput>) =>
    setInputs((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } as TabInput : r)))
  const setOutput = (idx: number, patch: Partial<TabOutput>) =>
    setOutputs((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } as TabOutput : r)))

  const variables = useMemo(() => {
    const vars: { var: string; label: string }[] = []
    inputs.forEach((i) => { if (i.input_type === 'number' && i.key.trim()) vars.push({ var: i.key.trim(), label: i.name || i.key }) })
    outputs.forEach((o) => { if (o.key.trim()) vars.push({ var: o.key.trim(), label: o.name || o.key }) })
    return vars
  }, [inputs, outputs])

  const insertVar = (v: string) => {
    if (focusIdx == null) return
    const ta = formulaRefs.current[focusIdx]
    if (!ta) return
    const start = ta.selectionStart ?? ta.value.length
    const end = ta.selectionEnd ?? ta.value.length
    const next = ta.value.slice(0, start) + v + ta.value.slice(end)
    setOutput(focusIdx, { formula: next })
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + v.length, start + v.length) })
  }

  const checkFormula = async (idx: number) => {
    const o = outputs[idx]
    if (!tabId) { notify('ابتدا تب را ذخیره کنید', 'error'); return }
    if (!o.formula.trim()) { notify('فرمول خالی است', 'error'); return }
    setChecking((p) => ({ ...p, [idx]: true }))
    try {
      const res = await validateTabFormula(Number(tabId), o.formula)
      setChecks((p) => ({ ...p, [idx]: res }))
    } catch (e: unknown) { notify(e instanceof Error ? e.message : 'خطا در اعتبارسنجی', 'error') }
    finally { setChecking((p) => ({ ...p, [idx]: false })) }
  }

  const parseOptions = (raw: string): string[] => {
    const arr = raw.replace(/،/g, ',').split(',').map((s) => s.trim()).filter(Boolean)
    return Array.from(new Set(arr))
  }

  const save = async () => {
    if (!selectedFactory) return
    if (!name.trim()) { notify('نام تب الزامی است', 'error'); return }
    if (!key.trim()) { notify('کلید تب الزامی است', 'error'); return }
    const cleanInputs = inputs.filter((i) => i.key.trim() || i.name.trim())
    const cleanOutputs = outputs.filter((o) => o.key.trim() || o.name.trim())
    const seen = new Set<string>()
    for (const i of cleanInputs) {
      if (!i.key.trim()) { notify('همه ورودی‌ها باید کلید داشته باشند', 'error'); return }
      if (seen.has(i.key)) { notify(`کلید ورودی تکراری «${i.key}»`, 'error'); return }
      seen.add(i.key)
      if (i.input_type === 'select' && !(i.options ?? []).length) { notify(`ورودی انتخابی «${i.key}» باید گزینه داشته باشد`, 'error'); return }
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
      const payload = {
        factory: selectedFactory.id,
        key: key.trim(), name: name.trim(), description,
        record_type: recordType, require_line: requireLine,
        contractor_required: contractorRequired, order: full?.order ?? tabs.length,
        is_active: true, inputs: cleanInputs, outputs: cleanOutputs,
      }
      if (full) {
        await updateFactoryTab(full.id, payload)
        notify('تب به‌روزرسانی شد')
      } else {
        const created = await createFactoryTab(payload)
        setTabId(String(created.id))
        notify('تب ساخته شد')
      }
      reload()
      load()
    } catch (e: unknown) { notify(e instanceof Error ? e.message : 'خطا در ذخیره تب', 'error') }
    finally { setSaving(false) }
  }

  const removeTab = async () => {
    if (!full || !window.confirm(`تب «${full.name}» با همه رکوردها و گزارش‌هایش حذف شود؟`)) return
    setSaving(true)
    try {
      await deleteFactoryTab(full.id)
      notify('تب حذف شد')
      setTabId('')
      reload()
    } catch (e: unknown) { notify(e instanceof Error ? e.message : 'خطا در حذف', 'error') }
    finally { setSaving(false) }
  }

  const newTab = () => {
    setTabId(''); setFull(null)
    setName(''); setKey(''); setDescription('')
    setRecordType('range'); setRequireLine(true); setContractorRequired(false)
    setInputs([emptyInput(0)]); setOutputs([emptyOutput(0)])
    setStep(1); setChecks({})
  }

  if (!selectedFactory) {
    return <div className="card p-6 text-center text-sm text-ink-500 dark:text-slate-400">ابتدا یک کارخانه را از نوار بالا انتخاب کنید.</div>
  }

  return (
    <div className="card p-4">
      {!hideSelector && (
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px] flex-1">
          <label className="label">تب کارخانه</label>
          <select className="input" value={tabId} onChange={(e) => setTabId(e.target.value)}>
            <option value="">تب جدید...</option>
            {tabs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        {canEdit && tabId && <button className="btn-ghost !h-10 !px-3 text-xs" onClick={newTab}><Plus className="h-4 w-4" /> تب جدید</button>}
        {canEdit && full && <button className="btn-ghost !h-10 !px-3 text-xs !text-rose-600" onClick={removeTab} disabled={saving}><Trash2 className="h-4 w-4" /> حذف تب</button>}
      </div>
      )}
      {!canEdit && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          شما دسترسی مدیریت تب‌ها را ندارید — فقط مشاهده.
        </div>
      )}

      <div className="mt-3 flex gap-1.5">
        {([1, 2] as const).map((s) => (
          <button key={s} type="button" onClick={() => setStep(s)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${step === s ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-950/40 dark:text-brand-300 dark:ring-brand-900/50' : 'bg-ink-50 text-ink-500 dark:bg-slate-800/60 dark:text-slate-400'}`}>
            {s === 1 ? '۱. مشخصات و ورودی‌ها' : '۲. خروجی‌ها و فرمول‌ها'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-8"><div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" /></div>
      ) : step === 1 ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">نام تب *</label>
              <input className="input" disabled={!canEdit} value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلا: تناژ تحویلی روزانه" />
            </div>
            <div>
              <label className="label">کلید (key) *</label>
              <input className="input font-mono" dir="ltr" disabled={!canEdit} value={key} onChange={(e) => setKey(e.target.value.replace(/\s+/g, '-'))} placeholder="tonnage-delivery" />
            </div>
            <div>
              <label className="label">نوع ثبت رکورد</label>
              <select className="input" disabled={!canEdit} value={recordType} onChange={(e) => setRecordType(e.target.value as 'range' | 'daily')}>
                <option value="range">بازه تاریخی (از تاریخ تا تاریخ)</option>
                <option value="daily">روزانه (چند رکورد در روز با ساعت)</option>
              </select>
            </div>
            <div className="flex items-center gap-4 pt-6">
              <label className="flex items-center gap-1.5 text-sm text-ink-600 dark:text-slate-300">
                <input type="checkbox" disabled={!canEdit} checked={requireLine} onChange={(e) => setRequireLine(e.target.checked)} /> خط تولید الزامی
              </label>
              <label className="flex items-center gap-1.5 text-sm text-ink-600 dark:text-slate-300">
                <input type="checkbox" disabled={!canEdit} checked={contractorRequired} onChange={(e) => setContractorRequired(e.target.checked)} /> پیمانکار الزامی
              </label>
            </div>
          </div>
          <div>
            <label className="label">توضیحات (اختیاری)</label>
            <textarea className="input min-h-[60px]" disabled={!canEdit} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="توضیح کوتاه درباره این تب" />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-600 dark:text-slate-300">ورودی‌های تب (متغیرهای فرمول و فرم ثبت)</span>
            {canEdit && <button className="btn-ghost !h-8 !px-2 text-xs" onClick={() => setInputs((p) => [...p, emptyInput(p.length)])}><Plus className="h-3.5 w-3.5" /> افزودن ورودی</button>}
          </div>
          <div className="space-y-2">
            {inputs.map((inp, idx) => (
              <div key={idx} className="rounded-xl border border-ink-100 p-2 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <input className="input !h-9 w-32 !py-0" disabled={!canEdit} placeholder="کلید (key)" value={inp.key} onChange={(e) => setInput(idx, { key: e.target.value.replace(/\s+/g, '_') })} />
                  <input className="input !h-9 w-40 !py-0" disabled={!canEdit} placeholder="نام نمایشی" value={inp.name} onChange={(e) => setInput(idx, { name: e.target.value })} />
                  <select className="input !h-9 w-28 !py-0" disabled={!canEdit} value={inp.input_type} onChange={(e) => setInput(idx, { input_type: e.target.value as TabInput['input_type'] })}>
                    <option value="number">عدد</option>
                    <option value="text">متن</option>
                    <option value="select">انتخابی (کشویی)</option>
                  </select>
                  <input className="input !h-9 w-24 !py-0" disabled={!canEdit} placeholder="واحد" value={inp.unit} onChange={(e) => setInput(idx, { unit: e.target.value })} />
                  <label className="flex items-center gap-1 text-xs text-ink-500 dark:text-slate-400">
                    <input type="checkbox" disabled={!canEdit} checked={inp.required} onChange={(e) => setInput(idx, { required: e.target.checked })} /> الزامی
                  </label>
                  <input type="number" className="input !h-9 w-16 !py-0" disabled={!canEdit} title="ترتیب" value={inp.order} onChange={(e) => setInput(idx, { order: Number(e.target.value) })} />
                  {canEdit && <button className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50" onClick={() => setInputs((p) => p.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></button>}
                </div>
                {inp.input_type === 'select' && (
                  <div className="mt-2">
                    <label className="label">گزینه‌های کشویی (با کاما جدا کنید) *</label>
                    <input
                      className="input !h-9"
                      disabled={!canEdit}
                      placeholder="کفی، بونوس، تریلی"
                      value={(inp.options ?? []).join('، ')}
                      onChange={(e) => setInput(idx, { options: parseOptions(e.target.value) })}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            {canEdit && <button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {full ? 'ذخیره تغییرات' : 'ساخت تب'}</button>}
            <button className="btn-ghost" onClick={() => setStep(2)}>مرحله بعد: خروجی‌ها</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-600 dark:text-slate-300">خروجی‌های محاسبه‌شده (با فرمول)</span>
            {canEdit && <button className="btn-ghost !h-8 !px-2 text-xs" onClick={() => setOutputs((p) => [...p, emptyOutput(p.length)])}><Plus className="h-3.5 w-3.5" /> افزودن خروجی</button>}
          </div>
          <div className="space-y-2">
            {outputs.map((out, idx) => (
              <div key={idx} className="rounded-xl border border-ink-100 p-2 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <input className="input !h-9 w-32 !py-0" disabled={!canEdit} placeholder="کلید (key)" value={out.key} onChange={(e) => setOutput(idx, { key: e.target.value.replace(/\s+/g, '_') })} />
                  <input className="input !h-9 w-40 !py-0" disabled={!canEdit} placeholder="نام نمایشی" value={out.name} onChange={(e) => setOutput(idx, { name: e.target.value })} />
                  <input className="input !h-9 w-24 !py-0" disabled={!canEdit} placeholder="واحد" value={out.unit} onChange={(e) => setOutput(idx, { unit: e.target.value })} />
                  <input type="number" className="input !h-9 w-16 !py-0" disabled={!canEdit} title="ترتیب" value={out.order} onChange={(e) => setOutput(idx, { order: Number(e.target.value) })} />
                  {canEdit && <button className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50" onClick={() => { setOutputs((p) => p.filter((_, i) => i !== idx)); setChecks((p) => { const n = { ...p }; delete n[idx]; return n }) }}><Trash2 className="h-4 w-4" /></button>}
                </div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <textarea
                    ref={(el) => { formulaRefs.current[idx] = el }}
                    className="input min-h-[80px] flex-1 font-mono text-xs leading-relaxed"
                    dir="ltr" rows={3} disabled={!canEdit}
                    value={out.formula}
                    onFocus={() => setFocusIdx(idx)}
                    onChange={(e) => setOutput(idx, { formula: e.target.value })}
                    placeholder="مثال: tonnage / cars"
                  />
                  {canEdit && (
                    <div className="w-full shrink-0 sm:w-56">
                      <button className="btn-ghost !h-8 w-full !px-2 text-xs" onClick={() => checkFormula(idx)} disabled={checking[idx]}>
                        {checking[idx] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'اعتبارسنجی فرمول'}
                      </button>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {variables.map((v) => (
                          <button key={v.var} type="button" className="chip" onClick={() => insertVar(v.var)} title={`افزودن ${v.var}`}>{v.label}</button>
                        ))}
                      </div>
                      <div className="mt-1 text-[10px] text-ink-400 dark:text-slate-500">فقط ورودی‌های عددی + خروجی‌ها مجازند (متن/کشویی نه)</div>
                    </div>
                  )}
                </div>
                {checks[idx] && (
                  <div className={`mt-1.5 rounded-lg px-3 py-1.5 text-xs ${checks[idx].ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}>
                    {checks[idx].ok ? 'فرمول معتبر است' : checks[idx].errors.join(' · ')}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button className="btn-ghost" onClick={() => setStep(1)} disabled={saving}>مرحله قبل: ورودی‌ها</button>
            {canEdit && <button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {full ? 'ذخیره تغییرات' : 'ساخت تب'}</button>}
          </div>
        </div>
      )}
    </div>
  )
}

export function TabIcon() {
  return <Settings2 className="h-4 w-4" />
}
