import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Loader2, AlertTriangle, Save } from 'lucide-react'
import { useFactory } from '../../store/FactoryContext'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../ui/Toast'
import { hasPerm } from '../../constants'
import { api } from '../../api/client'

interface AnalysisInput { id?: number; key: string; name: string; input_type: 'number' | 'text'; unit: string; required: boolean; order: number }
interface AnalysisPos { id?: number; key: string; name: string; definition: number | null; order: number }
interface AnalysisOutput { id?: number; key: string; name: string; unit: string; formula: string; order: number }
interface LineDef { id: number; line: number; contractor_required: boolean; notes: string; positions?: AnalysisPos[]; additional_inputs?: AnalysisInput[]; outputs: AnalysisOutput[] }
interface TypeDef { id: number; name: string }

const emptyPos = (order: number): AnalysisPos => ({ key: '', name: '', definition: null, order })
const emptyIn = (order: number): AnalysisInput => ({ key: '', name: '', input_type: 'number', unit: '', required: true, order })
const emptyOut = (order: number): AnalysisOutput => ({ key: '', name: '', unit: '', formula: '', order })

export default function TonnageAnalysisDefinitionPanel({ lineMode = false }: { lineMode?: boolean }) {
  const { selectedFactory } = useFactory()
  const { user } = useAuth()
  const { notify } = useToast()
  const canEdit = hasPerm(user?.permissions, 'analysis.manage')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [lineId, setLineId] = useState<string>(() => String(selectedFactory?.lines[0]?.id ?? ''))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contractorRequired, setContractorRequired] = useState(true)
  const [notes, setNotes] = useState('')
  const [positions, setPositions] = useState<AnalysisPos[]>([])
  const [additional, setAdditional] = useState<AnalysisInput[]>([])
  const [outputs, setOutputs] = useState<AnalysisOutput[]>([])
  const [typeDefs, setTypeDefs] = useState<TypeDef[]>([])
  const [defined, setDefined] = useState(false)
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  const refs = useRef<Record<number, HTMLTextAreaElement | null>>({})
  const [checks, setChecks] = useState<Record<number, { ok: boolean; errors: string[] }>>({})
  const [checking, setChecking] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (!selectedFactory?.lines.length) return
    if (!lineId) setLineId(String(selectedFactory.lines[0].id))
  }, [selectedFactory, lineId])

  const load = useCallback(async () => {
    if (!lineId) { setLoading(false); return }
    setLoading(true); setChecks({})
    try {
      const [defRes, typesRes] = await Promise.all([
        api.get(`/production-lines/${lineId}/line-analysis-definition/`).catch((e: any) => e.response?.status === 404 ? { data: null } : Promise.reject(e)),
        api.get('/analysis-type-definitions/').catch(() => ({ data: [] as any })),
      ])
      const def = (defRes as any).data as LineDef | null
      const typesRaw = (typesRes as any).data
      const types: TypeDef[] = Array.isArray(typesRaw) ? typesRaw.map((t: any) => ({ id: t.id, name: t.name })) : (typesRaw?.results ?? []).map((t: any) => ({ id: t.id, name: t.name }))
      setTypeDefs(types)
      if (def) {
        setContractorRequired(!!def.contractor_required)
        setNotes(def.notes || '')
        setPositions(def.positions?.length ? def.positions.map(p => ({ ...p })) : [emptyPos(0)])
        setAdditional(def.additional_inputs?.length ? def.additional_inputs.map(a => ({ ...a })) : [])
        setOutputs(def.outputs?.length ? def.outputs.map(o => ({ ...o })) : [emptyOut(0)])
        setDefined(true)
      } else {
        setContractorRequired(true); setNotes('')
        setPositions([emptyPos(0)]); setAdditional([]); setOutputs([emptyOut(0)]); setDefined(false)
      }
    } catch (e: any) { notify(e.message || 'خطا در دریافت تعریف', 'error') }
    finally { setLoading(false) }
  }, [lineId, notify])

  useEffect(() => { load() }, [load])

  const variables = useMemo(() => {
    const vars: { var: string; label: string }[] = []
    additional.forEach(a => { if (a.key.trim()) vars.push({ var: a.key.trim(), label: a.name || a.key }) })
    positions.forEach(p => { if (p.key.trim()) vars.push({ var: p.key.trim(), label: p.name || p.key }) })
    outputs.forEach(o => { if (o.key.trim()) vars.push({ var: o.key.trim(), label: o.name || o.key }) })
    return vars
  }, [additional, positions, outputs])

  const insertVar = (v: string) => {
    if (focusIdx == null) return
    const ta = refs.current[focusIdx]
    if (!ta) return
    const s = ta.selectionStart ?? ta.value.length
    const e = ta.selectionEnd ?? ta.value.length
    const next = ta.value.slice(0, s) + v + ta.value.slice(e)
    setOutputs(p => p.map((r, i) => i === focusIdx ? { ...r, formula: next } : r))
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + v.length, s + v.length) })
  }

  const validateFormula = async (idx: number) => {
    if (!lineId) return
    const o = outputs[idx]
    if (!o.formula.trim()) { notify('فرمول خالی است', 'error'); return }
    setChecking(p => ({ ...p, [idx]: true }))
    try {
      const { data } = await api.post('/formula/validate/', { line_id: Number(lineId), expression: o.formula })
      setChecks(p => ({ ...p, [idx]: data }))
    } catch (e: any) { notify(e.message || 'خطا در اعتبارسنجی', 'error') }
    finally { setChecking(p => ({ ...p, [idx]: false })) }
  }

  const save = async () => {
    if (!lineId) return
    const cleanPos = positions.filter(p => p.key.trim() || p.name.trim())
    const cleanAdd = additional.filter(a => a.key.trim() || a.name.trim())
    const cleanOut = outputs.filter(o => o.key.trim() || o.name.trim())
    for (const p of cleanPos) if (!p.key.trim()) { notify('کلید موقعیت خالی است', 'error'); return }
    for (const a of cleanAdd) if (!a.key.trim()) { notify('کلید ورودی اضافه خالی است', 'error'); return }
    for (const o of cleanOut) { if (!o.key.trim()) { notify('کلید خروجی خالی است', 'error'); return } if (!o.formula.trim()) { notify(`فرمول «${o.key}» خالی است`, 'error'); return } }
    setSaving(true)
    try {
      const payload: any = { line: Number(lineId), contractor_required: contractorRequired, notes, additional_inputs: cleanAdd, outputs: cleanOut }
      await api.put(`/production-lines/${lineId}/line-analysis-definition/upsert/`, payload)
      for (const p of cleanPos) {
        if (p.id) await api.patch(`/production-lines/${lineId}/analysis-positions/${p.id}/`, { name: p.name, key: p.key, definition: p.definition, order: p.order })
        else await api.post(`/production-lines/${lineId}/analysis-positions/`, { name: p.name, key: p.key, definition: p.definition, order: p.order })
      }
      notify('تعریف آنالیز خط ذخیره شد'); setDefined(true); load()
    } catch (e: any) { notify(e.message || 'خطا در ذخیره', 'error') }
    finally { setSaving(false) }
  }

  const remove = async () => {
    if (!lineId || !confirm('تعریف آنالیز این خط حذف شود؟ (موقعیت‌ها و ورودی‌ها هم حذف می‌شوند)')) return
    setSaving(true)
    try {
      await api.delete(`/production-lines/${lineId}/line-analysis-definition/`)
      notify('تعریف حذف شد'); load()
    } catch (e: any) { notify(e.message || 'خطا در حذف', 'error') }
    finally { setSaving(false) }
  }

  if (!lineId && !selectedFactory?.lines.length) {
    return <div className="card p-6 text-center text-sm text-slate-500">خطی برای تعریف آنالیز وجود ندارد.</div>
  }

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
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={contractorRequired} disabled={!canEdit} onChange={e => setContractorRequired(e.target.checked)} /> پیمانکار الزامی</label>
        </div>
        {!canEdit && <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><AlertTriangle className="h-4 w-4 shrink-0" /> دسترسی مدیریت تعریف ندارید — فقط مشاهده.</div>}
        <div className="mt-3 flex gap-1.5">
          {([1, 2, 3] as const).map(s => (
            <button key={s} onClick={() => setStep(s)} className={`flex flex-1 items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold transition ${step === s ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-950/40 dark:text-brand-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800/60'}`}>
              {s === 1 ? '۱. موقعیت‌ها' : s === 2 ? '۲. ورودی‌های اضافه' : '۳. خروجی‌ها'}
            </button>
          ))}
        </div>
        {defined && <div className="mt-3 flex justify-between text-xs text-emerald-600"><span>تعریف ثبت شده</span>{canEdit && <button className="btn-ghost !h-7 !px-2" onClick={remove} disabled={saving}><Trash2 className="h-3 w-3" /> حذف تعریف</button>}</div>}
        {loading ? <div className="py-8 text-center text-sm text-slate-400">در حال بارگذاری...</div> : step === 1 ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between"><span className="text-xs font-bold">موقعیت‌های آنالیز (هر موقعیت = یک نوع آنالیز)</span>{canEdit && <button className="btn-ghost !h-7 !px-2 text-xs" onClick={() => setPositions(p => [...p, emptyPos(p.length)])}><Plus className="h-3 w-3" /> افزودن موقعیت</button>}</div>
            {positions.map((pos, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                <input className="input !h-9 w-28 !py-0" disabled={!canEdit} placeholder="کلید" value={pos.key} onChange={e => setPositions(p => p.map((r, i) => i === idx ? { ...r, key: e.target.value.replace(/\s+/g, '_') } : r))} />
                <input className="input !h-9 w-36 !py-0" disabled={!canEdit} placeholder="نام" value={pos.name} onChange={e => setPositions(p => p.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))} />
                <select className="input !h-9 w-44 !py-0" disabled={!canEdit} value={pos.definition ?? ''} onChange={e => setPositions(p => p.map((r, i) => i === idx ? { ...r, definition: e.target.value ? Number(e.target.value) : null } : r))}>
                  <option value="">— بدون نوع —</option>
                  {typeDefs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input type="number" className="input !h-9 w-16 !py-0" disabled={!canEdit} value={pos.order} onChange={e => setPositions(p => p.map((r, i) => i === idx ? { ...r, order: Number(e.target.value) } : r))} />
                {canEdit && <button className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setPositions(p => p.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></button>}
              </div>
            ))}
            <div className="flex justify-between"><span className="text-[11px] text-slate-400">هر موقعیت یک TypeDefinition را ارجاع می‌دهد — ورودی‌هایش در فرم ثبت عملکرد نمایش داده می‌شود.</span><button className="btn-primary !h-8" onClick={() => setStep(2)}>بعدی</button></div>
          </div>
        ) : step === 2 ? (
          <div className="mt-4 space-y-3">
            <div><label className="label">یادداشت تعریف</label><textarea className="input min-h-[50px]" disabled={!canEdit} value={notes} onChange={e => setNotes(e.target.value)} placeholder="اختیاری" /></div>
            <div className="flex items-center justify-between"><span className="text-xs font-bold">ورودی‌های اضافه (بدون موقعیت)</span>{canEdit && <button className="btn-ghost !h-7 !px-2 text-xs" onClick={() => setAdditional(p => [...p, emptyIn(p.length)])}><Plus className="h-3 w-3" /> افزودن</button>}</div>
            {additional.map((a, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                <input className="input !h-9 w-28 !py-0" disabled={!canEdit} placeholder="کلید" value={a.key} onChange={e => setAdditional(p => p.map((r, i) => i === idx ? { ...r, key: e.target.value.replace(/\s+/g, '_') } : r))} />
                <input className="input !h-9 w-36 !py-0" disabled={!canEdit} placeholder="نام" value={a.name} onChange={e => setAdditional(p => p.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))} />
                <select className="input !h-9 w-24 !py-0" disabled={!canEdit} value={a.input_type} onChange={e => setAdditional(p => p.map((r, i) => i === idx ? { ...r, input_type: e.target.value as any } : r))}><option value="number">عدد</option><option value="text">متن</option></select>
                <input className="input !h-9 w-20 !py-0" disabled={!canEdit} placeholder="واحد" value={a.unit} onChange={e => setAdditional(p => p.map((r, i) => i === idx ? { ...r, unit: e.target.value } : r))} />
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" disabled={!canEdit} checked={a.required} onChange={e => setAdditional(p => p.map((r, i) => i === idx ? { ...r, required: e.target.checked } : r))} /> الزامی</label>
                <input type="number" className="input !h-9 w-14 !py-0" disabled={!canEdit} value={a.order} onChange={e => setAdditional(p => p.map((r, i) => i === idx ? { ...r, order: Number(e.target.value) } : r))} />
                {canEdit && <button className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setAdditional(p => p.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></button>}
              </div>
            ))}
            {!additional.length && <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400 dark:bg-slate-800/50">ورودی اضافه‌ای نیست.</div>}
            <div className="flex justify-between"><button className="btn-ghost" onClick={() => setStep(1)}>قبلی</button><button className="btn-primary !h-8" onClick={() => setStep(3)}>بعدی: خروجی‌ها</button></div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between"><span className="text-xs font-bold">خروجی‌ها (با فرمول)</span>{canEdit && <button className="btn-ghost !h-7 !px-2 text-xs" onClick={() => setOutputs(p => [...p, emptyOut(p.length)])}><Plus className="h-3 w-3" /> افزودن</button>}</div>
            {outputs.map((out, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <input className="input !h-9 w-28 !py-0" disabled={!canEdit} placeholder="کلید" value={out.key} onChange={e => setOutputs(p => p.map((r, i) => i === idx ? { ...r, key: e.target.value.replace(/\s+/g, '_') } : r))} />
                  <input className="input !h-9 w-36 !py-0" disabled={!canEdit} placeholder="نام" value={out.name} onChange={e => setOutputs(p => p.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))} />
                  <input className="input !h-9 w-20 !py-0" disabled={!canEdit} placeholder="واحد" value={out.unit} onChange={e => setOutputs(p => p.map((r, i) => i === idx ? { ...r, unit: e.target.value } : r))} />
                  <input type="number" className="input !h-9 w-14 !py-0" disabled={!canEdit} value={out.order} onChange={e => setOutputs(p => p.map((r, i) => i === idx ? { ...r, order: Number(e.target.value) } : r))} />
                  {canEdit && <button className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setOutputs(p => p.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></button>}
                </div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <textarea ref={el => { refs.current[idx] = el }} className="input min-h-[80px] flex-1 font-mono text-xs" dir="ltr" rows={3} disabled={!canEdit} value={out.formula} onFocus={() => setFocusIdx(idx)} onChange={e => setOutputs(p => p.map((r, i) => i === idx ? { ...r, formula: e.target.value } : r))} placeholder="مثال: (a + b) / c * 100" />
                  {canEdit && <div className="w-full shrink-0 sm:w-64 space-y-2">
                    <div className="flex flex-wrap gap-1">{['+', '-', '*', '/', '(', ')', '%'].map(op => <button key={op} type="button" className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800" onClick={() => insertVar(op)}>{op}</button>)}<button type="button" className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800" onClick={() => insertVar('100')}>100</button></div>
                    <div className="flex flex-wrap gap-1">{variables.map(v => <button key={v.var} type="button" className="chip" onClick={() => insertVar(v.var)}>{v.label}</button>)}</div>
                    <button className="btn-ghost !h-7 w-full !px-2 text-xs" onClick={() => validateFormula(idx)} disabled={checking[idx]}>{checking[idx] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'اعتبارسنجی'}</button>
                    <div className="text-[10px] text-slate-400">عملگر/عدد/متغیر → درج در فرمول</div>
                  </div>}
                </div>
                {checks[idx] && <div className={`mt-1 rounded px-2 py-1 text-xs ${checks[idx].ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{checks[idx].ok ? 'معتبر' : checks[idx].errors.join(' · ')}</div>}
              </div>
            ))}
            <div className="flex justify-between"><button className="btn-ghost" onClick={() => setStep(2)}>قبلی</button><button className="btn-primary" onClick={save} disabled={saving || !canEdit}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} ذخیره تعریف</button></div>
          </div>
        )}
      </div>
    </div>
  )
}
