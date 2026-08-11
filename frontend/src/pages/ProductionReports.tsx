import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Plus, Pencil, Trash2, X, Filter, FlaskConical, Loader2, AlertTriangle, Save, Settings2, ListChecks } from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { useAuth } from '../store/AuthContext'
import { useToast } from '../components/ui/Toast'
import { hasPerm } from '../constants'
import {
  getProductionReports, createProductionReport, updateProductionReport, deleteProductionReport,
  getFactoryAnalysisSchema, getFactoryAnalysisDefinition, saveFactoryAnalysisDefinition,
  deleteFactoryAnalysisDefinition, validateFactoryFormula,
} from '../api/production'
import type {
  ProductionReport, ProductionReportFilters, ProductionReportPayload, FactoryAnalysisSchema,
  FactoryAnalysisInputDef, FactoryAnalysisOutputDef,
} from '../types'
import { Loading, EmptyState, ErrorBanner, TableSkeleton } from '../components/ui/States'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import JalaliDateInput from '../components/ui/JalaliDateInput'
import { formatDate, formatNumber, todayISO } from '../utils'

type FormState = {
  line: string
  contractor: string
  date_from: string
  date_to: string
  note: string
  values: Record<string, string>
}

const emptyForm: FormState = {
  line: '', contractor: '', date_from: todayISO(), date_to: todayISO(), note: '', values: {},
}

function FactoryForm({ form, setForm, editing }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; editing: ProductionReport | null }) {
  const { selectedFactory } = useFactory()
  const [schema, setSchema] = useState<FactoryAnalysisSchema | null>(null)
  const [loadingSchema, setLoadingSchema] = useState(false)

  const set = (k: keyof FormState, v: string) => setForm({ ...form, [k]: v })
  const rangeInvalid = form.date_from && form.date_to && form.date_to < form.date_from

  useEffect(() => {
    if (!form.line) {
      setSchema(null)
      return
    }
    setLoadingSchema(true)
    getFactoryAnalysisSchema(Number(form.line))
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
      .catch((e) => setLoadingSchema(false))
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
          <label className="label">از تاریخ (بازه) *</label>
          <JalaliDateInput value={form.date_from} onChange={(iso) => set('date_from', iso)} />
        </div>
        <div>
          <label className="label">تا تاریخ (بازه) *</label>
          <JalaliDateInput value={form.date_to} onChange={(iso) => set('date_to', iso)} />
        </div>
      </div>
      {rangeInvalid && (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
          تاریخ پایان نمی‌تواند قبل از شروع باشد.
        </div>
      )}

      {loadingSchema && (
        <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> در حال بارگذاری تعریف آنالیز کارخانه...
        </div>
      )}

      {schema && !schema.defined && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          برای این کارخانه تعریف آنالیز (ورودیها/خروجیها و فرمولها) ثبت نشده است.
        </div>
      )}

      {schema?.defined && schema.inputs.length === 0 && (
        <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-500 dark:bg-slate-800/60 dark:text-slate-400">
          ورودیای برای این کارخانه تعریف نشده است.
        </div>
      )}

      {schema?.defined && schema.inputs.length > 0 && (
        <fieldset className="rounded-xl border border-ink-100 p-3 dark:border-slate-700">
          <legend className="rounded-lg bg-ink-50 px-2 py-0.5 text-xs font-bold text-ink-700 dark:bg-slate-800 dark:text-slate-200">
            ورودیهای آنالیز کارخانه
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
          <div className="mb-1.5 text-xs font-bold text-brand-700 dark:text-brand-300">خروجیهای خودکار (پس از ثبت محاسبه میشوند)</div>
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

const emptyInput = (order: number): FactoryAnalysisInputDef => ({ key: '', name: '', input_type: 'number', unit: '', required: true, order })
const emptyOutput = (order: number): FactoryAnalysisOutputDef => ({ key: '', name: '', unit: '', formula: '', order })

function FactoryDefinitionPanel() {
  const { selectedFactory } = useFactory()
  const { user } = useAuth()
  const { notify } = useToast()
  const canEdit = hasPerm(user?.permissions, 'analysis.manage')

  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [description, setDescription] = useState('')
  const [inputs, setInputs] = useState<FactoryAnalysisInputDef[]>([])
  const [outputs, setOutputs] = useState<FactoryAnalysisOutputDef[]>([])
  const [defined, setDefined] = useState(false)
  const [checks, setChecks] = useState<Record<string, { ok: boolean; errors: string[] }>>({})
  const [checking, setChecking] = useState<Record<string, boolean>>({})
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  const formulaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({})

  const factoryId = selectedFactory?.id

  const load = useCallback(async () => {
    if (!factoryId) { setLoading(false); return }
    setLoading(true)
    setChecks({})
    try {
      const def = await getFactoryAnalysisDefinition(factoryId)
      if (def) {
        setDescription(def.description)
        setInputs(def.inputs.map((i) => ({ ...i })))
        setOutputs(def.outputs.map((o) => ({ ...o })))
        setDefined(true)
      } else {
        setDescription('')
        setInputs([emptyInput(0)])
        setOutputs([emptyOutput(0)])
        setDefined(false)
      }
    } catch (e: any) {
      notify(e.message || 'خطا در دریافت تعریف آنالیز کارخانه', 'error')
    } finally {
      setLoading(false)
    }
  }, [factoryId, notify])

  useEffect(() => { load() }, [load])

  const setInput = (idx: number, patch: Partial<FactoryAnalysisInputDef>) =>
    setInputs((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  const setOutput = (idx: number, patch: Partial<FactoryAnalysisOutputDef>) =>
    setOutputs((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))

  const variables = useMemo(() => {
    const vars: { var: string; label: string }[] = []
    inputs.forEach((i) => { if (i.key.trim()) vars.push({ var: i.key.trim(), label: i.name || i.key }) })
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
    if (!factoryId) return
    if (!o.formula.trim()) { notify('فرمول خالی است', 'error'); return }
    setChecking((p) => ({ ...p, [idx]: true }))
    try {
      const res = await validateFactoryFormula(factoryId, o.formula)
      setChecks((p) => ({ ...p, [idx]: res }))
    } catch (e: any) { notify(e.message || 'خطا در اعتبارسنجی', 'error') }
    finally { setChecking((p) => ({ ...p, [idx]: false })) }
  }

  const save = async () => {
    if (!factoryId) return
    const cleanInputs = inputs.filter((i) => i.key.trim() || i.name.trim())
    const cleanOutputs = outputs.filter((o) => o.key.trim() || o.name.trim())
    const seen = new Set<string>()
    for (const i of cleanInputs) {
      if (!i.key.trim()) { notify('همه ورودیها باید کلید (key) داشته باشند', 'error'); return }
      if (seen.has(i.key)) { notify(`کلید ورودی تکراری «${i.key}»`, 'error'); return }
      seen.add(i.key)
    }
    seen.clear()
    for (const o of cleanOutputs) {
      if (!o.key.trim()) { notify('همه خروجیها باید کلید (key) داشته باشند', 'error'); return }
      if (seen.has(o.key)) { notify(`کلید خروجی تکراری «${o.key}»`, 'error'); return }
      seen.add(o.key)
      if (!o.formula.trim()) { notify(`فرمول خروجی «${o.key}» خالی است`, 'error'); return }
    }
    setSaving(true)
    try {
      await saveFactoryAnalysisDefinition(factoryId, { description, inputs: cleanInputs, outputs: cleanOutputs })
      notify('تعریف آنالیز کارخانه ذخیره شد')
      setDefined(true)
    } catch (e: any) { notify(e.message || 'خطا در ذخیره تعریف', 'error') }
    finally { setSaving(false) }
  }

  const removeDefinition = async () => {
    if (!factoryId || !window.confirm('تعریف آنالیز کارخانه حذف شود؟')) return
    setSaving(true)
    try {
      await deleteFactoryAnalysisDefinition(factoryId)
      notify('تعریف حذف شد')
      setDescription('')
      setInputs([emptyInput(0)])
      setOutputs([emptyOutput(0)])
      setDefined(false)
      setStep(1)
    } catch (e: any) { notify(e.message || 'خطا در حذف', 'error') }
    finally { setSaving(false) }
  }

  if (!factoryId) {
    return (
      <div className="card p-6 text-center text-sm text-ink-500 dark:text-slate-400">
        ابتدا یک کارخانه را از نوار بالا انتخاب کنید تا ورودیها و خروجیهای آن را تعریف کنید.
      </div>
    )
  }

  return (
    <div className="card p-4">
      <div className="mb-1 text-sm font-bold text-ink-700 dark:text-slate-200">
        تعریف آنالیز کارخانه: {selectedFactory.name}
      </div>
      {!canEdit && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          شما دسترسی مدیریت تعریفها (analysis.manage) را ندارید — فقط مشاهده.
        </div>
      )}

      <div className="mt-3 flex gap-1.5">
        {([1, 2] as const).map((s) => (
          <button key={s} type="button" onClick={() => setStep(s)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${step === s ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-950/40 dark:text-brand-300 dark:ring-brand-900/50' : 'bg-ink-50 text-ink-500 dark:bg-slate-800/60 dark:text-slate-400'}`}>
            {s === 1 ? '۱. ورودیها' : '۲. خروجیها و فرمولها'}
          </button>
        ))}
      </div>

      {defined && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            تعریف ثبت شده است ({inputs.filter((i) => i.key).length} ورودی، {outputs.filter((o) => o.key).length} خروجی)
          </span>
          {canEdit && (
            <button className="btn-ghost !h-8 !px-2 text-xs" onClick={removeDefinition} disabled={saving}>
              <Trash2 className="h-3.5 w-3.5" /> حذف تعریف
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-8"><TableSkeleton columns={3} /></div>
      ) : step === 1 ? (
        <div className="mt-4 space-y-3">
          <div>
            <label className="label">توضیحات تعریف (اختیاری)</label>
            <textarea className="input min-h-[60px]" disabled={!canEdit} value={description}
              onChange={(e) => setDescription(e.target.value)} placeholder="مثلاً: آنالیز خطوط فرآوری کارخانه" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-600 dark:text-slate-300">ورودیهای کارخانه (متغیرهای فرمول)</span>
            {canEdit && (
              <button className="btn-ghost !h-8 !px-2 text-xs" onClick={() => setInputs((p) => [...p, emptyInput(p.length)])}>
                <Plus className="h-3.5 w-3.5" /> افزودن ورودی
              </button>
            )}
          </div>
          {inputs.length === 0 && (
            <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-400 dark:bg-slate-800/60 dark:text-slate-500">ورودیای تعریف نشده است.</div>
          )}
          <div className="space-y-2">
            {inputs.map((inp, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-100 p-2 dark:border-slate-700">
                <input className="input !h-9 w-32 !py-0" disabled={!canEdit} placeholder="کلید (key)" value={inp.key}
                  onChange={(e) => setInput(idx, { key: e.target.value.replace(/\s+/g, '_') })} />
                <input className="input !h-9 w-40 !py-0" disabled={!canEdit} placeholder="نام نمایشی" value={inp.name}
                  onChange={(e) => setInput(idx, { name: e.target.value })} />
                <select className="input !h-9 w-28 !py-0" disabled={!canEdit} value={inp.input_type}
                  onChange={(e) => setInput(idx, { input_type: e.target.value as 'number' | 'text' })}>
                  <option value="number">عدد</option>
                  <option value="text">متن</option>
                </select>
                <input className="input !h-9 w-24 !py-0" disabled={!canEdit} placeholder="واحد" value={inp.unit}
                  onChange={(e) => setInput(idx, { unit: e.target.value })} />
                <label className="flex items-center gap-1 text-xs text-ink-500 dark:text-slate-400">
                  <input type="checkbox" disabled={!canEdit} checked={inp.required} onChange={(e) => setInput(idx, { required: e.target.checked })} /> الزامی
                </label>
                <input type="number" className="input !h-9 w-16 !py-0" disabled={!canEdit} title="ترتیب" value={inp.order}
                  onChange={(e) => setInput(idx, { order: Number(e.target.value) })} />
                {canEdit && (
                  <button className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                    onClick={() => setInputs((p) => p.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => setStep(2)} disabled={!canEdit}>مرحله بعد: خروجیها و فرمولها</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-600 dark:text-slate-300">خروجیهای محاسبهشده (با فرمول)</span>
            {canEdit && (
              <button className="btn-ghost !h-8 !px-2 text-xs" onClick={() => { setOutputs((p) => [...p, emptyOutput(p.length)]) }}>
                <Plus className="h-3.5 w-3.5" /> افزودن خروجی
              </button>
            )}
          </div>
          {outputs.length === 0 && (
            <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-400 dark:bg-slate-800/60 dark:text-slate-500">خروجیای تعریف نشده است.</div>
          )}
          <div className="space-y-2">
            {outputs.map((out, idx) => (
              <div key={idx} className="rounded-xl border border-ink-100 p-2 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <input className="input !h-9 w-32 !py-0" disabled={!canEdit} placeholder="کلید (key)" value={out.key}
                    onChange={(e) => setOutput(idx, { key: e.target.value.replace(/\s+/g, '_') })} />
                  <input className="input !h-9 w-40 !py-0" disabled={!canEdit} placeholder="نام نمایشی" value={out.name}
                    onChange={(e) => setOutput(idx, { name: e.target.value })} />
                  <input className="input !h-9 w-24 !py-0" disabled={!canEdit} placeholder="واحد" value={out.unit}
                    onChange={(e) => setOutput(idx, { unit: e.target.value })} />
                  <input type="number" className="input !h-9 w-16 !py-0" disabled={!canEdit} title="ترتیب" value={out.order}
                    onChange={(e) => setOutput(idx, { order: Number(e.target.value) })} />
                  {canEdit && (
                    <button className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                      onClick={() => { setOutputs((p) => p.filter((_, i) => i !== idx)); setChecks((p) => { const n = { ...p }; delete n[idx]; return n }) }}>
                      <Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <textarea
                    ref={(el) => { formulaRefs.current[idx] = el }}
                    className="input min-h-[80px] flex-1 font-mono text-xs leading-relaxed"
                    dir="ltr" rows={3} disabled={!canEdit}
                    value={out.formula}
                    onFocus={() => setFocusIdx(idx)}
                    onChange={(e) => setOutput(idx, { formula: e.target.value })}
                    placeholder="مثال: (feed - tail) / (product - tail) * 100"
                  />
                  {canEdit && (
                    <div className="w-full shrink-0 sm:w-56">
                      <button className="btn-ghost !h-8 w-full !px-2 text-xs" onClick={() => checkFormula(idx)} disabled={checking[idx]}>
                        {checking[idx] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'اعتبارسنجی فرمول'}
                      </button>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {variables.map((v) => (
                          <button key={v.var} type="button" className="chip" onClick={() => insertVar(v.var)} title={`افزودن ${v.var}`}>
                            {v.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-1 text-[10px] text-ink-400 dark:text-slate-500">کلیک روی چیپ = افزودن متغیر به فرمول</div>
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
            <button className="btn-ghost" onClick={() => setStep(1)} disabled={saving}>مرحله قبل: ورودیها</button>
            <button className="btn-primary" onClick={save} disabled={saving || !canEdit}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} ذخیره تعریف
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProductionReports() {
  const { selectedFactory } = useFactory()
  const { notify } = useToast()

  const [tab, setTab] = useState<'records' | 'definition'>('records')
  const [items, setItems] = useState<ProductionReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<ProductionReportFilters>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ProductionReport | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [totalCount, setTotalCount] = useState(0)

  const lineIds = useMemo(() => (selectedFactory?.lines ?? []).map((l) => l.id), [selectedFactory])

  const load = useCallback(() => {
    setLoading(true)
    const merged = { ...filters } as any
    if (lineIds.length) merged.lines = lineIds.join(',')
    getProductionReports(merged, page, pageSize)
      .then((data) => { setItems(data.results); setTotalCount(data.count); setError(null) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filters, page, pageSize, lineIds])

  useEffect(() => { if (selectedFactory) load() }, [selectedFactory, load])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, line: String(selectedFactory?.lines[0]?.id ?? '') })
    setModalOpen(true)
  }

  const openEdit = (p: ProductionReport) => {
    setEditing(p)
    setForm({
      line: String(p.line.id),
      contractor: p.contractor ? String(p.contractor.id) : '',
      date_from: p.date_from, date_to: p.date_to,
      note: p.note || '',
      values: {},
    })
    setModalOpen(true)
  }

  const submit = async () => {
    if (!form.line || !form.date_from || !form.date_to) {
      notify('خط و بازه تاریخ الزامی هستند', 'error'); return
    }
    if (form.date_to < form.date_from) { notify('تاریخ پایان معتبر نیست', 'error'); return }
    const inputs: Record<string, number | string> = {}
    Object.entries(form.values).forEach(([k, raw]) => {
      const v = (raw ?? '').trim()
      if (v !== '') inputs[k] = isNaN(Number(v)) ? v : Number(v)
    })
    const payload: ProductionReportPayload = {
      line_id: Number(form.line),
      contractor_id: form.contractor ? Number(form.contractor) : null,
      date_from: form.date_from, date_to: form.date_to,
      inputs,
      note: form.note,
    }
    setSaving(true)
    try {
      if (editing) { await updateProductionReport(editing.id, payload); notify('آنالیز خط ویرایش شد') }
      else { await createProductionReport(payload); notify('آنالیز خط ثبت شد') }
      setModalOpen(false); load()
    } catch (e: any) { notify(e.message || 'خطا در ذخیرهسازی', 'error') }
    finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (confirmId == null) return
    try { await deleteProductionReport(confirmId); notify('آنالیز حذف شد'); setConfirmId(null); load() }
    catch (e: any) { notify(e.message || 'خطا در حذف', 'error') }
  }

  const setFilter = (k: keyof ProductionReportFilters, v: string) => { setPage(1); setFilters((prev) => ({ ...prev, [k]: v === '' ? undefined : (v as any) })) }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const sorted = [...items].sort((a, b) => b.date_from.localeCompare(a.date_from))

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-ink-900 dark:text-slate-100">
            <FlaskConical className="h-6 w-6 text-brand-600" /> آنالیز خطوط تولید
          </h1>
          <p className="text-sm text-ink-500">
            ثبت آنالیز داینامیک خطوط تولید بر اساس ورودی/خروجیهای تعریفشده برای کارخانه
          </p>
        </div>
        {tab === 'records' && <button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> ثبت آنالیز جدید</button>}
      </div>

      <div className="flex gap-1 rounded-xl bg-ink-100/60 p-1 dark:bg-slate-800">
        <button
          onClick={() => setTab('records')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'records' ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-brand-400' : 'text-ink-500 dark:text-slate-400'}`}
        >
          <ListChecks className="h-4 w-4" /> ثبت / مدیریت آنالیزها
        </button>
        <button
          onClick={() => setTab('definition')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'definition' ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-brand-400' : 'text-ink-500 dark:text-slate-400'}`}
        >
          <Settings2 className="h-4 w-4" /> تعریف ورودیها / خروجیها
        </button>
      </div>

      {tab === 'definition' ? (
        <FactoryDefinitionPanel />
      ) : (
        <>
      {error && <ErrorBanner message={error} onRetry={load} />}

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

      {loading ? (
        <TableSkeleton columns={6} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<FlaskConical className="h-10 w-10" />}
          title="آنالیزی یافت نشد"
          description="برای این بازه یا خط، رکوردی ثبت نشده است."
          action={<button className="btn-primary mt-2" onClick={openCreate}><Plus className="h-4 w-4" /> ثبت اولین آنالیز</button>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">بازه تاریخ</th>
                  <th className="px-4 py-3 font-semibold">خط</th>
                  <th className="px-4 py-3 font-semibold">پیمانکار</th>
                  <th className="px-4 py-3 font-semibold">خروجیهای محاسبهشده</th>
                  <th className="px-4 py-3 font-semibold text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                {sorted.map((p) => (
                  <tr key={p.id} className="transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <div>{formatDate(p.date_from)} تا {formatDate(p.date_to)}</div>
                      {p.note && <div className="text-[11px] text-ink-400">{p.note}</div>}
                    </td>
                    <td className="px-4 py-3 dark:text-slate-300">{p.line.name}</td>
                    <td className="px-4 py-3 text-ink-600 dark:text-slate-400">{p.contractor?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[420px] flex-wrap gap-1">
                        {Object.entries(p.outputs || {}).map(([k, v]) => (
                          <span key={k} className="chip">
                            {k}: <span className="font-semibold text-brand-600">{formatNumber(v)}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-slate-800" onClick={() => openEdit(p)} title="ویرایش"><Pencil className="h-4 w-4" /></button>
                        <button className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50" onClick={() => setConfirmId(p.id)} title="حذف"><Trash2 className="h-4 w-4" /></button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'ویرایش آنالیز خط' : 'ثبت آنالیز جدید خط تولید'} subtitle={selectedFactory?.name} size="lg"
        footer={<><button className="btn-ghost" onClick={() => setModalOpen(false)}>انصراف</button><button className="btn-primary" onClick={submit} disabled={saving}>{saving ? 'در حال ذخیره...' : editing ? 'ذخیره تغییرات' : 'ثبت آنالیز'}</button></>}>
        <FactoryForm form={form} setForm={setForm} editing={editing} />
      </Modal>

      <Modal open={confirmId != null} onClose={() => setConfirmId(null)} title="حذف آنالیز"
        footer={<><button className="btn-ghost" onClick={() => setConfirmId(null)}>انصراف</button><button className="btn-danger" onClick={confirmDelete}><Trash2 className="h-4 w-4" /> حذف قطعی</button></>}>
        <p className="text-sm text-ink-700 dark:text-slate-300">آیا از حذف این آنالیز خط اطمینان دارید؟</p>
      </Modal>
        </>
      )}
    </div>
  )
}