import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useFactory } from '../../store/FactoryContext'
import JalaliDateInput from '../ui/JalaliDateInput'
import { getFactoryTabSchema, getFactoryTabRecords } from '../../api/factoryTabs'
import { formatDate } from '../../utils'
import type { FactoryTabInputSchema, FactoryTabRecord, FactoryTabSchema } from '../../types'

export type TabFormState = {
  tab: string
  line: string
  contractor: string
  date_from: string
  date_to: string
  hour: string
  note: string
  values: Record<string, string>
  linked_records: Record<string, number | ''>
}

export function TabRecordForm({ form, setForm, editing, fixedTab }: {
  form: TabFormState
  setForm: React.Dispatch<React.SetStateAction<TabFormState>>
  editing: FactoryTabRecord | null
  fixedTab?: { id: number; name: string } | null
}) {
  const { selectedFactory } = useFactory()
  const [schema, setSchema] = useState<FactoryTabSchema | null>(null)
  const [loadingSchema, setLoadingSchema] = useState(false)

  const [linkedOptions, setLinkedOptions] = useState<Record<string, FactoryTabRecord[]>>({})
  const set = (k: keyof TabFormState, v: string) => setForm((prev) => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!form.tab) {
      setSchema(null)
      return
    }
    setLoadingSchema(true)
    getFactoryTabSchema(Number(form.tab))
      .then((s) => {
        setSchema(s)
        if (editing) {
          const seed: Record<string, string> = {}
          s.inputs.forEach((inp) => {
            const v = editing.inputs?.[inp.key]
            if (v !== undefined && v !== null && v !== '') seed[inp.key] = String(v)
          })
          const lr = (editing as unknown as { linked_records?: Record<string, number> }).linked_records ?? {}
          setForm((prev) => ({ ...prev, values: seed, linked_records: { ...(prev.linked_records ?? {}), ...lr } }))
        } else {
          setForm((prev) => ({ ...prev, values: {} }))
        }
        const tabs = (s as unknown as { cross_tabs?: { id: number; norm_key: string }[] }).cross_tabs ?? []
        tabs.forEach((t) => {
          getFactoryTabRecords({ tab: t.id } as never, 1, 20)
            .then((r) => setLinkedOptions((p) => ({ ...p, [t.norm_key]: r.results })))
            .catch(() => {})
        })
      })
      .catch(() => setSchema(null))
      .finally(() => setLoadingSchema(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tab])

  const rangeInvalid = form.date_from && form.date_to && form.date_to < form.date_from
  const isDaily = schema?.tab.record_type === 'daily'
  const allTabs = (selectedFactory?.report_tabs ?? []).filter((t) => t.is_active)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fixedTab ? (
          <div>
            <label className="label">تب</label>
            <input className="input" value={fixedTab.name} disabled />
          </div>
        ) : (
        <div>
          <label className="label">تب *</label>
          <select className="input" value={form.tab} onChange={(e) => set('tab', e.target.value)}>
            <option value="">انتخاب تب</option>
            {allTabs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        )}
        <div>
          <label className="label">خط تولید {schema?.tab.require_line ? '*' : ''}</label>
          <select className="input" value={form.line} onChange={(e) => set('line', e.target.value)}>
            <option value="">بدون خط</option>
            {(schema ? schema.lines : selectedFactory?.lines ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">پیمانکار</label>
          <select className="input" value={form.contractor} onChange={(e) => set('contractor', e.target.value)}>
            <option value="">بدون پیمانکار</option>
            {(schema ? schema.contractor.options : selectedFactory?.contractors ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{isDaily ? 'تاریخ تحویل *' : 'از تاریخ (بازه) *'}</label>
          <JalaliDateInput value={form.date_from} onChange={(iso) => set('date_from', iso)} />
        </div>
        {!isDaily && (
          <div>
            <label className="label">تا تاریخ (بازه) *</label>
            <JalaliDateInput value={form.date_to} onChange={(iso) => set('date_to', iso)} />
          </div>
        )}
        {isDaily && (
          <div>
            <label className="label">ساعت ثبت *</label>
            <input type="time" className="input" value={form.hour} onChange={(e) => set('hour', e.target.value)} />
          </div>
        )}
      </div>
      {rangeInvalid && (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
          تاریخ پایان نمی‌تواند قبل از شروع باشد.
        </div>
      )}

      {loadingSchema && (
        <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> در حال بارگذاری تعریف تب...
        </div>
      )}

      {schema && schema.inputs.length === 0 && (
        <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-500 dark:bg-slate-800/60 dark:text-slate-400">
          ورودی‌ای برای این تب تعریف نشده است.
        </div>
      )}

      {schema && schema.inputs.length > 0 && (
        <fieldset className="rounded-xl border border-ink-100 p-3 dark:border-slate-700">
          <legend className="rounded-lg bg-ink-50 px-2 py-0.5 text-xs font-bold text-ink-700 dark:bg-slate-800 dark:text-slate-200">
            ورودی‌های تب
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {schema.inputs.map((inp) => (
              <InputField key={inp.id} inp={inp} value={form.values[inp.key] ?? ''} setForm={setForm} />
            ))}
          </div>
        </fieldset>
      )}

      {schema && (schema as unknown as { cross_tabs?: { id:number; key:string; norm_key:string; name:string }[] }).cross_tabs?.length ? (
        <fieldset className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900/30 dark:bg-amber-950/20">
          <legend className="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">رکوردهای مرجع بین‌تبی (اختیاری)</legend>
          <p className="mb-2 text-[11px] text-amber-700 dark:text-amber-300/80">اگر فرمول خروجی این تب به تب دیگری ارجاع می‌دهد، می‌توانید «رکورد خاص» آن تب را انتخاب کنید. خالی = میانگین هم‌بازه/هم‌خط (رفتار قبلی).</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {((schema as unknown as { cross_tabs: { id:number; key:string; norm_key:string; name:string }[] }).cross_tabs ?? []).map((t) => (
              <div key={t.norm_key}>
                <label className="label">{t.name} <span className="font-mono text-[10px] text-ink-400">({t.key} → {t.norm_key})</span></label>
                <select className="input" value={String(form.linked_records?.[t.norm_key] ?? '')} onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : ''
                  setForm((prev) => ({ ...prev, linked_records: { ...(prev.linked_records ?? {}), [t.norm_key]: v as number | '' } as Record<string, number | ''> }))
                }}>
                  <option value="">میانگین هم‌بازه (خودکار)</option>
                  {(linkedOptions[t.norm_key] ?? []).map((r) => (
                    <option key={r.id} value={r.id}>{formatDate(r.date_from)}{r.date_to !== r.date_from ? ` تا ${formatDate(r.date_to)}` : ''}{r.hour ? ` ${String(r.hour).slice(0,5)}` : ''} · {r.line?.name ?? 'بدون خط'}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </fieldset>
      ) : null}

      {schema && schema.outputs.length > 0 && (
        <div className="rounded-lg border border-dashed border-brand-200 bg-brand-50/40 p-3 dark:border-brand-900/50 dark:bg-brand-950/20">
          <div className="mb-1.5 text-xs font-bold text-brand-700 dark:text-brand-300">خروجی‌های خودکار (پس از ثبت محاسبه می‌شوند)</div>
          <div className="flex flex-wrap gap-1.5">
            {schema.outputs.map((o) => (
              <span key={o.id} className="chip">{o.name} {o.unit && <span className="text-[10px] text-ink-400">{o.unit}</span>}</span>
            ))}
          </div>
        </div>
      )}

      {!schema && form.tab === '' && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ابتدا یک تب را انتخاب کنید تا ورودی‌های آن نمایش داده شود.
        </div>
      )}

      <div>
        <label className="label">توضیحات / ملاحظات</label>
        <textarea className="input min-h-[70px]" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="اختیاری" />
      </div>
    </div>
  )
}

function InputField({ inp, value, setForm }: {
  inp: FactoryTabInputSchema
  value: string
  setForm: React.Dispatch<React.SetStateAction<TabFormState>>
}) {
  const onChange = (v: string) => setForm((prev) => ({ ...prev, values: { ...prev.values, [inp.key]: v } }))
  return (
    <div>
      <label className="label">
        {inp.name} {inp.required && <span className="text-rose-500">*</span>}
        {inp.unit && <span className="mr-1 badge bg-ink-100 text-ink-500 dark:bg-slate-700 dark:text-slate-300">{inp.unit}</span>}
      </label>
      {inp.type === 'select' ? (
        <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">انتخاب...</option>
          {(inp.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={inp.type === 'number' ? 'number' : 'text'}
          step={inp.type === 'number' ? 'any' : undefined}
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={inp.type === 'number' ? 'عدد...' : 'متن...'}
        />
      )}
    </div>
  )
}
