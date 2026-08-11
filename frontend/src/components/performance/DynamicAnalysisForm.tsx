import { useEffect, useMemo, useState } from 'react'
import { Save, X, Loader2, AlertTriangle } from 'lucide-react'
import { useFactory } from '../../store/FactoryContext'
import { useToast } from '../ui/Toast'
import Modal from '../ui/Modal'
import { getProductionLineDetail, createActualAnalysis, updateActualAnalysis } from '../../api/actual'
import type { ActualAnalysis, ActualAnalysisPayload, AnalysisSchema } from '../../types'
import { todayISO } from '../../utils'
import JalaliDateInput from '../ui/JalaliDateInput'

interface Props {
  open: boolean
  editing: ActualAnalysis | null
  onClose: () => void
  onSaved: () => void
}

export default function DynamicAnalysisForm({ open, editing, onClose, onSaved }: Props) {
  const { selectedFactory } = useFactory()
  const { notify } = useToast()

  const [lineId, setLineId] = useState('')
  const [schema, setSchema] = useState<AnalysisSchema | null>(null)
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [saving, setSaving] = useState(false)
  const [contractorId, setContractorId] = useState('')
  const [dateFrom, setDateFrom] = useState(todayISO())
  const [dateTo, setDateTo] = useState(todayISO())
  const [values, setValues] = useState<Record<string, string>>({})

  const keyOf = (prefix: 'p' | 'a', idOrKey: string | number, inputKey: string) =>
    `${prefix}_${idOrKey}_${inputKey}`

  useEffect(() => {
    if (!open) return
    const initial = editing ? String(editing.line.id) : String(selectedFactory?.lines[0]?.id ?? '')
    setLineId(initial)
    setContractorId(editing?.contractor ? String(editing.contractor.id) : '')
    setDateFrom(editing?.date_from || todayISO())
    setDateTo(editing?.date_to || todayISO())
    setValues({})
    setSchema(null)
  }, [open, editing, selectedFactory])

  useEffect(() => {
    if (!open || !lineId) {
      setSchema(null)
      return
    }
    setLoadingSchema(true)
    setSchema(null)
    getProductionLineDetail(Number(lineId))
      .then((data) => {
        setSchema(data)
        if (editing) {
          const seed: Record<string, string> = {}
          data.positions.forEach((p) => {
            p.inputs.forEach((inp) => {
              const v = editing.inputs?.positions?.[p.key]?.[inp.key]
              if (v !== undefined && v !== null && v !== '') seed[keyOf('p', p.id, inp.key)] = String(v)
            })
          })
          data.additional_inputs.forEach((a) => {
            const v = editing.inputs?.additional_inputs?.[a.key]
            if (v !== undefined && v !== null && v !== '') seed[keyOf('a', a.key, a.key)] = String(v)
          })
          setValues(seed)
        }
      })
      .catch((e) => notify(e.message || 'خطا در دریافت تعریف خط', 'error'))
      .finally(() => setLoadingSchema(false))
  }, [open, lineId]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedLine = useMemo(
    () => selectedFactory?.lines.find((l) => l.id === Number(lineId)),
    [selectedFactory, lineId],
  )

  const set = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }))

  const submit = async () => {
    if (!lineId) return notify('خط تولید را انتخاب کنید', 'error')
    if (!schema || !schema.defined) return notify('برای این خط تعریف آنالیز تنظیم نشده است', 'error')
    if (!dateFrom || !dateTo) return notify('بازه تاریخ را کامل کنید', 'error')
    if (dateTo < dateFrom) return notify('تاریخ پایان نمی‌تواند قبل از شروع باشد', 'error')
    if (schema.contractor.required && !contractorId)
      return notify('انتخاب پیمانکار اجباری است', 'error')

    const positions: ActualAnalysisPayload['positions'] = {}
    const additional: Record<string, number | string> = {}

    for (const pos of schema.positions) {
      const pvals: Record<string, number | string> = {}
      for (const inp of pos.inputs) {
        const raw = (values[keyOf('p', pos.id, inp.key)] ?? '').trim()
        if (inp.required && raw === '')
          return notify(`ورودی اجباری «${pos.name} / ${inp.name}» وارد نشده است`, 'error')
        if (raw !== '') pvals[inp.key] = inp.type === 'number' ? Number(raw) : raw
      }
      if (Object.keys(pvals).length) positions[String(pos.id)] = pvals
    }
    for (const a of schema.additional_inputs) {
      const raw = (values[keyOf('a', a.key, a.key)] ?? '').trim()
      if (a.required && raw === '') return notify(`ورودی اجباری «${a.name}» وارد نشده است`, 'error')
      if (raw !== '') additional[a.key] = a.type === 'number' ? Number(raw) : raw
    }

    const payload: ActualAnalysisPayload = {
      line_id: Number(lineId),
      contractor_id: contractorId ? Number(contractorId) : null,
      date_from: dateFrom,
      date_to: dateTo,
      positions,
      additional_inputs: additional,
    }

    setSaving(true)
    try {
      if (editing) {
        await updateActualAnalysis(editing.id, payload)
        notify('عملکرد با موفقیت ویرایش شد')
      } else {
        await createActualAnalysis(payload)
        notify('عملکرد جدید ثبت شد')
      }
      onSaved()
      onClose()
    } catch (e: any) {
      notify(e.message || 'خطا در ذخیره‌سازی', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'ویرایش عملکرد بخش تولید' : 'ثبت عملکرد جدید (بخش تولید)'}
      subtitle={selectedLine ? `خط: ${selectedLine.name}` : undefined}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4" /> انصراف
          </button>
          <button className="btn-primary" onClick={submit} disabled={saving || loadingSchema}>
            <Save className="h-4 w-4" /> {saving ? 'در حال ذخیره...' : editing ? 'ذخیره تغییرات' : 'ثبت عملکرد'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">خط تولید *</label>
            <select
              className="input"
              value={lineId}
              onChange={(e) => {
                setLineId(e.target.value)
                setValues({})
              }}
            >
              <option value="">انتخاب خط</option>
              {selectedFactory?.lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">
              پیمانکار {schema?.contractor.required ? '*' : '(اختیاری)'}
            </label>
            <select
              className="input"
              value={contractorId}
              onChange={(e) => setContractorId(e.target.value)}
              disabled={!schema}
            >
              <option value="">بدون پیمانکار</option>
              {(schema?.contractor.options ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">از تاریخ *</label>
            <JalaliDateInput value={dateFrom} onChange={(iso) => setDateFrom(iso)} />
          </div>
          <div>
            <label className="label">تا تاریخ *</label>
            <JalaliDateInput value={dateTo} onChange={(iso) => setDateTo(iso)} />
          </div>
        </div>

        {loadingSchema && (
          <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> در حال بارگذاری تعریف خط...
          </div>
        )}

        {schema && !schema.defined && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            برای این خط، تعریف آنالیز (ورودی‌ها/خروجی‌ها) هنوز تنظیم نشده است.
          </div>
        )}

        {schema?.defined && (
          <>
            {schema.positions.map((pos) => (
              <fieldset key={pos.id} className="rounded-xl border border-ink-100 p-3 dark:border-slate-700">
                <legend className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-2 py-0.5 text-xs font-bold text-ink-700 dark:bg-slate-800 dark:text-slate-200">
                  موقعیت: {pos.name}
                  {pos.definition && (
                    <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                      {pos.definition.name}
                    </span>
                  )}
                </legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {pos.inputs.map((inp) => (
                    <div key={inp.id}>
                      <label className="label">
                        {inp.name} {inp.required && <span className="text-rose-500">*</span>}
                        {inp.unit && <span className="mr-1 badge bg-ink-100 text-ink-500 dark:bg-slate-700 dark:text-slate-300">{inp.unit}</span>}
                      </label>
                      <input
                        type={inp.type === 'number' ? 'number' : 'text'}
                        step={inp.type === 'number' ? 'any' : undefined}
                        className="input"
                        value={values[keyOf('p', pos.id, inp.key)] ?? ''}
                        onChange={(e) => set(keyOf('p', pos.id, inp.key), e.target.value)}
                        placeholder={inp.type === 'number' ? 'عدد...' : 'متن...'}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}

            {schema.additional_inputs.length > 0 && (
              <fieldset className="rounded-xl border border-ink-100 p-3 dark:border-slate-700">
                <legend className="rounded-lg bg-ink-50 px-2 py-0.5 text-xs font-bold text-ink-700 dark:bg-slate-800 dark:text-slate-200">
                  ورودی‌های اضافه
                </legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {schema.additional_inputs.map((a) => (
                    <div key={a.id}>
                      <label className="label">
                        {a.name} {a.required && <span className="text-rose-500">*</span>}
                        {a.unit && <span className="mr-1 badge bg-ink-100 text-ink-500 dark:bg-slate-700 dark:text-slate-300">{a.unit}</span>}
                      </label>
                      <input
                        type={a.type === 'number' ? 'number' : 'text'}
                        step={a.type === 'number' ? 'any' : undefined}
                        className="input"
                        value={values[keyOf('a', a.key, a.key)] ?? ''}
                        onChange={(e) => set(keyOf('a', a.key, a.key), e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="rounded-lg border border-dashed border-brand-200 bg-brand-50/40 p-3 dark:border-brand-900/50 dark:bg-brand-950/20">
              <div className="mb-1.5 text-xs font-bold text-brand-700 dark:text-brand-300">
                خروجی‌های خودکار (پس از ثبت محاسبه می‌شوند)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {schema.outputs.map((o) => (
                  <span key={o.id} className="chip">
                    {o.name} {o.unit && <span className="text-[10px] text-ink-400">{o.unit}</span>}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}