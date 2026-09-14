import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Loader2, AlertTriangle, Save } from 'lucide-react'
import { useFactory } from '../../store/FactoryContext'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../ui/Toast'
import { hasPerm } from '../../constants'
import { api } from '../../api/client'

interface TonnageInput { id?: number; key: string; name: string; input_type: 'number' | 'text'; unit: string; required: boolean; order: number }
interface TonnageOutput { id?: number; key: string; name: string; unit: string; formula: string; order: number }
interface TonnageDef { id: number; line: number; description: string; inputs: TonnageInput[]; outputs: TonnageOutput[] }

const emptyInput = (order: number): TonnageInput => ({ key: '', name: '', input_type: 'number', unit: '', required: true, order })
const emptyOutput = (order: number): TonnageOutput => ({ key: '', name: '', unit: '', formula: '', order })

async function fetchDefinition(lineId: number): Promise<TonnageDef | null> {
  try {
    const { data } = await api.get(`/production-lines/${lineId}/tonnage-definition/`)
    return data
  } catch (e: any) {
    if (e.response?.status === 404) return null
    throw e
  }
}

export default function TonnageDefinitionPanel() {
  const { selectedFactory } = useFactory()
  const { user } = useAuth()
  const { notify } = useToast()
  const canEdit = hasPerm(user?.permissions, 'tonnage.manage') || hasPerm(user?.permissions, 'analysis.manage')
  const [step, setStep] = useState<1 | 2>(1)
  const [lineId, setLineId] = useState<string>(() => String(selectedFactory?.lines[0]?.id ?? ''))
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [description, setDescription] = useState('')
  const [inputs, setInputs] = useState<TonnageInput[]>([])
  const [outputs, setOutputs] = useState<TonnageOutput[]>([])
  const [defined, setDefined] = useState(false)
  const [checks, setChecks] = useState<Record<number, { ok: boolean; errors: string[] }>>({})
  const [checking, setChecking] = useState<Record<number, boolean>>({})
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  const refs = useRef<Record<number, HTMLTextAreaElement | null>>({})

  useEffect(() => {
    if (!selectedFactory?.lines.length) return
    if (!lineId) setLineId(String(selectedFactory.lines[0].id))
  }, [selectedFactory, lineId])

  const load = useCallback(async () => {
    if (!lineId) { setLoading(false); return }
    setLoading(true); setChecks({})
    try {
      const def = await fetchDefinition(Number(lineId))
      if (def) {
        setDescription(def.description || '')
        setInputs(def.inputs?.length ? def.inputs.map(i => ({ ...i })) : [emptyInput(0)])
        setOutputs(def.outputs?.length ? def.outputs.map(o => ({ ...o })) : [emptyOutput(0)])
        setDefined(true)
      } else {
        setDescription('')
        setInputs([emptyInput(0)])
        setOutputs([emptyOutput(0)])
        setDefined(false)
      }
    } catch (e: any) {
      notify(e.message || 'خطا در دریافت تعریف تناژ', 'error')
    } finally { setLoading(false) }
  }, [lineId, notify])

  useEffect(() => { load() }, [load])

  const setInput = (idx: number, patch: Partial<TonnageInput>) => setInputs(p => p.map((r, i) => i === idx ? { ...r, ...patch } : r))
  const setOutput = (idx: number, patch: Partial<TonnageOutput>) => setOutputs(p => p.map((r, i) => i === idx ? { ...r, ...patch } : r))

  const variables = useMemo(() => {
    const vars: { var: string; label: string }[] = []
    inputs.forEach(i => { if (i.key.trim()) vars.push({ var: i.key.trim(), label: i.name || i.key }) })
    outputs.forEach(o => { if (o.key.trim()) vars.push({ var: o.key.trim(), label: o.name || o.key }) })
    return vars
  }, [inputs, outputs])

  const insertVar = (v: string) => {
    if (focusIdx == null) return
    const ta = refs.current[focusIdx]
    if (!ta) return
    const s = ta.selectionStart ?? ta.value.length
    const e = ta.selectionEnd ?? ta.value.length
    const next = ta.value.slice(0, s) + v + ta.value.slice(e)
    setOutput(focusIdx, { formula: next })
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + v.length, s + v.length) })
  }

  const validateFormula = async (idx: number) => {
    if (!lineId) return
    const o = outputs[idx]
    if (!o.formula.trim()) { notify('فرمول خالی است', 'error'); return }
    setChecking(p => ({ ...p, [idx]: true }))
    try {
      const { data } = await api.post('/formula/validate-tonnage/', { line_id: Number(lineId), expression: o.formula })
      setChecks(p => ({ ...p, [idx]: data }))
    } catch (e: any) { notify(e.message || 'خطا در اعتبارسنجی', 'error') }
    finally { setChecking(p => ({ ...p, [idx]: false })) }
  }

  const save = async () => {
    if (!lineId) return
    const cleanInputs = inputs.filter(i => i.key.trim() || i.name.trim())
    const cleanOutputs = outputs.filter(o => o.key.trim() || o.name.trim())
    const seen = new Set<string>()
    for (const i of cleanInputs) {
      if (!i.key.trim()) { notify('کلید ورودی خالی است', 'error'); return }
      if (seen.has(i.key)) { notify(`کلید تکراری «${i.key}»`, 'error'); return }
      seen.add(i.key)
    }
    seen.clear()
    for (const o of cleanOutputs) {
      if (!o.key.trim()) { notify('کلید خروجی خالی است', 'error'); return }
      if (seen.has(o.key)) { notify(`کلید تکراری «${o.key}»`, 'error'); return }
      seen.add(o.key)
      if (!o.formula.trim()) { notify(`فرمول «${o.key}» خالی است`, 'error'); return }
    }
    setSaving(true)
    try {
      await api.put(`/production-lines/${lineId}/tonnage-definition/`, { description, inputs: cleanInputs, outputs: cleanOutputs })
      notify('تعریف تناژ ذخیره شد'); setDefined(true)
    } catch (e: any) { notify(e.message || 'خطا در ذخیره', 'error') }
    finally { setSaving(false) }
  }

  const remove = async () => {
    if (!lineId || !confirm('تعریف تناژ این خط حذف شود؟')) return
    setSaving(true)
    try {
      await api.delete(`/production-lines/${lineId}/tonnage-definition/`)
      notify('تعریف حذف شد')
      setDescription(''); setInputs([emptyInput(0)]); setOutputs([emptyOutput(0)]); setDefined(false); setStep(1)
    } catch (e: any) { notify(e.message || 'خطا در حذف', 'error') }
    finally { setSaving(false) }
  }

  const lineName = selectedFactory?.lines.find(l => l.id === Number(lineId))?.name || ''

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1">
            <label className="label">خط تولید</label>
            <select className="input" value={lineId} onChange={e => setLineId(e.target.value)}>
              {selectedFactory?.lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">{lineName ? `تعریف تناژ: ${lineName}` : ''}</span>
        </div>
        {!canEdit && <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> شما دسترسی مدیریت تعریف تناژ را ندارید — فقط مشاهده.</div>}
        <div className="mt-3 flex gap-1.5">
          {([1, 2] as const).map(s => (
            <button key={s} type="button" onClick={() => setStep(s)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${step === s ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-950/40 dark:text-brand-300 dark:ring-brand-900/50' : 'bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400'}`}>{s === 1 ? '۱. ورودی‌ها' : '۲. خروجی‌ها و فرمول‌ها'}</button>
          ))}
        </div>
        {defined && <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-emerald-600">ثبت شده ({inputs.filter(i => i.key).length} ورودی، {outputs.filter(o => o.key).length} خروجی)</span>{canEdit && <button className="btn-ghost !h-8 !px-2 text-xs" onClick={remove} disabled={saving}><Trash2 className="h-3.5 w-3.5" /> حذف تعریف</button>}</div>}
        {loading ? <div className="py-8"><div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" /></div> : step === 1 ? (
          <div className="mt-4 space-y-3">
            <div><label className="label">توضیحات (اختیاری)</label><textarea className="input min-h-[60px]" disabled={!canEdit} value={description} onChange={e => setDescription(e.target.value)} placeholder="مثال: تناژ تحویلی خط ..." /></div>
            <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-600 dark:text-slate-300">ورودی‌های تناژ (متغیرهای فرمول)</span>{canEdit && <button className="btn-ghost !h-8 !px-2 text-xs" onClick={() => setInputs(p => [...p, emptyInput(p.length)])}><Plus className="h-3.5 w-3.5" /> افزودن ورودی</button>}</div>
            <div className="space-y-2">
              {inputs.map((inp, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                  <input className="input !h-9 w-32 !py-0" disabled={!canEdit} placeholder="کلید (key)" value={inp.key} onChange={e => setInput(idx, { key: e.target.value.replace(/\s+/g, '_') })} />
                  <input className="input !h-9 w-40 !py-0" disabled={!canEdit} placeholder="نام نمایشی" value={inp.name} onChange={e => setInput(idx, { name: e.target.value })} />
                  <select className="input !h-9 w-28 !py-0" disabled={!canEdit} value={inp.input_type} onChange={e => setInput(idx, { input_type: e.target.value as any })}><option value="number">عدد</option><option value="text">متن</option></select>
                  <input className="input !h-9 w-24 !py-0" disabled={!canEdit} placeholder="واحد" value={inp.unit} onChange={e => setInput(idx, { unit: e.target.value })} />
                  <label className="flex items-center gap-1 text-xs text-slate-500"><input type="checkbox" disabled={!canEdit} checked={inp.required} onChange={e => setInput(idx, { required: e.target.checked })} /> الزامی</label>
                  <input type="number" className="input !h-9 w-16 !py-0" disabled={!canEdit} value={inp.order} onChange={e => setInput(idx, { order: Number(e.target.value) })} />
                  {canEdit && <button className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setInputs(p => p.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></button>}
                </div>
              ))}
            </div>
            <div className="flex justify-end"><button className="btn-primary" onClick={() => setStep(2)} disabled={!canEdit}>مرحله بعد: خروجی‌ها</button></div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-600 dark:text-slate-300">خروجی‌های محاسبه‌شده (با فرمول)</span>{canEdit && <button className="btn-ghost !h-8 !px-2 text-xs" onClick={() => setOutputs(p => [...p, emptyOutput(p.length)])}><Plus className="h-3.5 w-3.5" /> افزودن خروجی</button>}</div>
            <div className="space-y-2">
              {outputs.map((out, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <input className="input !h-9 w-32 !py-0" disabled={!canEdit} placeholder="کلید (key)" value={out.key} onChange={e => setOutput(idx, { key: e.target.value.replace(/\s+/g, '_') })} />
                    <input className="input !h-9 w-40 !py-0" disabled={!canEdit} placeholder="نام نمایشی" value={out.name} onChange={e => setOutput(idx, { name: e.target.value })} />
                    <input className="input !h-9 w-24 !py-0" disabled={!canEdit} placeholder="واحد" value={out.unit} onChange={e => setOutput(idx, { unit: e.target.value })} />
                    <input type="number" className="input !h-9 w-16 !py-0" disabled={!canEdit} value={out.order} onChange={e => setOutput(idx, { order: Number(e.target.value) })} />
                    {canEdit && <button className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => { setOutputs(p => p.filter((_, i) => i !== idx)); setChecks(p => { const n = { ...p }; delete n[idx]; return n }) }}><Trash2 className="h-4 w-4" /></button>}
                  </div>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <textarea ref={el => { refs.current[idx] = el }} className="input min-h-[80px] flex-1 font-mono text-xs" dir="ltr" rows={3} disabled={!canEdit} value={out.formula} onFocus={() => setFocusIdx(idx)} onChange={e => setOutput(idx, { formula: e.target.value })} placeholder="مثال: tonnage * (grade - tail) ..." />
                    {canEdit && <div className="w-full shrink-0 sm:w-56"><button className="btn-ghost !h-8 w-full !px-2 text-xs" onClick={() => validateFormula(idx)} disabled={checking[idx]}>{checking[idx] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'اعتبارسنجی فرمول'}</button><div className="mt-1.5 flex flex-wrap gap-1">{variables.map(v => <button key={v.var} type="button" className="chip" onClick={() => insertVar(v.var)}>{v.label}</button>)}</div></div>}
                  </div>
                  {checks[idx] && <div className={`mt-1.5 rounded-lg px-3 py-1.5 text-xs ${checks[idx].ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}>{checks[idx].ok ? 'فرمول معتبر است' : checks[idx].errors.join(' · ')}</div>}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2"><button className="btn-ghost" onClick={() => setStep(1)} disabled={saving}>مرحله قبل</button><button className="btn-primary" onClick={save} disabled={saving || !canEdit}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} ذخیره تعریف</button></div>
          </div>
        )}
      </div>
    </div>
  )
}

function TableSkeleton({ columns = 3 }: { columns?: number }) {
  return <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
}
