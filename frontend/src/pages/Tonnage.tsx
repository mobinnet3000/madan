import { useEffect, useMemo, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Filter, Loader2, Truck, BarChart3, ListChecks, AlertTriangle } from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { useToast } from '../components/ui/Toast'
import {
  getDeliveredTonnages, fetchAllDeliveredTonnages, createDeliveredTonnage,
  updateDeliveredTonnage, deleteDeliveredTonnage, getTonnageSchema,
} from '../api/tonnage'
import type { DeliveredTonnage, DeliveredTonnagePayload, DeliveredTonnageFilters, TonnageSchema } from '../types'
import { Loading, EmptyState, ErrorBanner, TableSkeleton } from '../components/ui/States'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import JalaliDateInput from '../components/ui/JalaliDateInput'
import { formatDate, formatNumber, todayISO } from '../utils'

type FormState = {
  line: string
  contractor: string
  date: string
  hour: string
  note: string
  values: Record<string, string>
}

const emptyForm: FormState = { line: '', contractor: '', date: todayISO(), hour: '', note: '', values: {} }

function TonnageForm({ form, setForm, editing }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; editing: DeliveredTonnage | null }) {
  const { selectedFactory } = useFactory()
  const [schema, setSchema] = useState<TonnageSchema | null>(null)
  const [loadingSchema, setLoadingSchema] = useState(false)

  const set = (k: keyof FormState, v: string) => setForm((prev) => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!form.line) {
      setSchema(null)
      return
    }
    setLoadingSchema(true)
    getTonnageSchema(Number(form.line))
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
      .catch(() => setSchema(null))
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
          <label className="label">تاریخ تحویل (بازه مجاز: چند رکورد در روز) *</label>
          <JalaliDateInput value={form.date} onChange={(iso) => set('date', iso)} />
        </div>
        <div>
          <label className="label">ساعت تحویل *</label>
          <input type="time" className="input" value={form.hour} onChange={(e) => set('hour', e.target.value)} />
        </div>
      </div>

      {loadingSchema && (
        <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> در حال بارگذاری تعریف تناژ خط...
        </div>
      )}

      {schema && !schema.defined && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          برای این خط تولید تعریف تناژ تحویلی (ورودی\u200cها/خروجی\u200cها و فرمول\u200cها) ثبت نشده است.
        </div>
      )}

      {schema?.defined && schema.inputs.length === 0 && (
        <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-500 dark:bg-slate-800/60 dark:text-slate-400">
          ورودی\u200cای برای این خط تعریف نشده است.
        </div>
      )}

      {schema?.defined && schema.inputs.length > 0 && (
        <fieldset className="rounded-xl border border-ink-100 p-3 dark:border-slate-700">
          <legend className="rounded-lg bg-ink-50 px-2 py-0.5 text-xs font-bold text-ink-700 dark:bg-slate-800 dark:text-slate-200">
            ورودی\u200cهای تناژ تحویلی
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
          <div className="mb-1.5 text-xs font-bold text-brand-700 dark:text-brand-300">خروجی\u200cهای خودکار (پس از ثبت محاسبه می\u200cشوند)</div>
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

export default function Tonnage() {
  const { selectedFactory } = useFactory()
  const { notify } = useToast()

  const [tab, setTab] = useState<'records' | 'report'>('records')
  const [items, setItems] = useState<DeliveredTonnage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<DeliveredTonnageFilters>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DeliveredTonnage | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(30)
  const [totalCount, setTotalCount] = useState(0)

  const [reportRecords, setReportRecords] = useState<DeliveredTonnage[]>([])
  const [loadingReport, setLoadingReport] = useState(false)

  const lineIds = useMemo(() => (selectedFactory?.lines ?? []).map((l) => l.id), [selectedFactory])

  const load = useCallback(() => {
    setLoading(true)
    const merged = { ...filters } as any
    if (lineIds.length) merged.lines = lineIds.join(',')
    getDeliveredTonnages(merged, page, pageSize)
      .then((data) => { setItems(data.results); setTotalCount(data.count); setError(null) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filters, page, pageSize, lineIds])

  const loadReport = useCallback(() => {
    setLoadingReport(true)
    const merged: Record<string, unknown> = { ...filters }
    if (lineIds.length) merged.lines = lineIds.join(',')
    fetchAllDeliveredTonnages(merged as DeliveredTonnageFilters, 500)
      .then(setReportRecords)
      .catch((e) => notify(e.message || 'خطا در دریافت داده گزارش', 'error'))
      .finally(() => setLoadingReport(false))
  }, [filters, lineIds, notify])

  useEffect(() => { if (selectedFactory) load() }, [selectedFactory, load])
  useEffect(() => { if (tab === 'report' && selectedFactory) loadReport() }, [tab, selectedFactory, loadReport])

  const onSaved = () => {
    load()
    if (tab === 'report') loadReport()
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, line: String(selectedFactory?.lines[0]?.id ?? '') })
    setModalOpen(true)
  }

  const openEdit = (p: DeliveredTonnage) => {
    setEditing(p)
    setForm({
      line: String(p.line.id),
      contractor: p.contractor ? String(p.contractor.id) : '',
      date: p.date,
      hour: p.hour.slice(0, 5),
      note: p.note || '',
      values: {},
    })
    setModalOpen(true)
  }

  const submit = async () => {
    if (!form.line || !form.date) { notify('خط تولید و تاریخ الزامی هستند', 'error'); return }
    if (!form.hour) { notify('ساعت تحویل الزامی است', 'error'); return }
    const inputs: Record<string, number | string> = {}
    Object.entries(form.values).forEach(([k, raw]) => {
      const v = (raw ?? '').trim()
      if (v !== '') inputs[k] = isNaN(Number(v)) ? v : Number(v)
    })
    const payload: DeliveredTonnagePayload = {
      line_id: Number(form.line),
      contractor_id: form.contractor ? Number(form.contractor) : null,
      date: form.date,
      hour: form.hour,
      inputs,
      note: form.note,
    }
    setSaving(true)
    try {
      if (editing) { await updateDeliveredTonnage(editing.id, payload); notify('تناژ تحویلی ویرایش شد') }
      else { await createDeliveredTonnage(payload); notify('تناژ تحویلی ثبت شد') }
      setModalOpen(false); onSaved()
    } catch (e: any) { notify(e.message || 'خطا در ذخیره\u200cسازی', 'error') }
    finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (confirmId == null) return
    try { await deleteDeliveredTonnage(confirmId); notify('رکورد حذف شد'); setConfirmId(null); onSaved() }
    catch (e: any) { notify(e.message || 'خطا در حذف', 'error') }
  }

  const setFilter = (k: keyof DeliveredTonnageFilters, v: string) => { setPage(1); setFilters((prev) => ({ ...prev, [k]: v === '' ? undefined : (v as any) })) }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const sorted = [...items].sort((a, b) => (b.date + b.hour).localeCompare(a.date + a.hour))

  const { byLine, byDate, outputKeys } = useMemo(() => {
    const lineMap: Record<number, { name: string; count: number; sums: Record<string, number> }> = {}
    const dateMap: Record<string, { count: number; sums: Record<string, number> }> = {}
    const keys = new Set<string>()
    for (const r of reportRecords) {
      const line = lineMap[r.line.id] ?? { name: r.line.name, count: 0, sums: {} as Record<string, number> }
      line.count += 1
      const day = dateMap[r.date] ?? { count: 0, sums: {} as Record<string, number> }
      day.count += 1
      for (const [k, v] of Object.entries(r.outputs || {})) {
        keys.add(k)
        line.sums[k] = (line.sums[k] ?? 0) + (typeof v === 'number' ? v : Number(v) || 0)
        day.sums[k] = (day.sums[k] ?? 0) + (typeof v === 'number' ? v : Number(v) || 0)
      }
      lineMap[r.line.id] = line
      dateMap[r.date] = day
    }
    const byLine = Object.entries(lineMap).map(([, v]) => v).sort((a, b) => a.name.localeCompare(b.name))
    const byDate = Object.entries(dateMap).map(([date, v]) => ({ date, ...v })).sort((a, b) => b.date.localeCompare(a.date))
    return { byLine, byDate, outputKeys: [...keys] }
  }, [reportRecords])

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-ink-900 dark:text-slate-100">
            <Truck className="h-6 w-6 text-brand-600" /> تناژ تحویلی خطوط تولید
          </h1>
          <p className="text-sm text-ink-500">
            ثبت داینامیک تناژ تحویلی هر خط (پیمانکار + ساعت + ورودی\u200cهای مختص خط) — چند رکورد در روز
          </p>
        </div>
        {tab === 'records' && <button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> ثبت تناژ تحویلی</button>}
      </div>

      <div className="flex gap-1 rounded-xl bg-ink-100/60 p-1 dark:bg-slate-800">
        <button
          onClick={() => setTab('records')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'records' ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-brand-400' : 'text-ink-500 dark:text-slate-400'}`}
        >
          <ListChecks className="h-4 w-4" /> ثبت / مدیریت تناژ
        </button>
        <button
          onClick={() => setTab('report')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'report' ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-brand-400' : 'text-ink-500 dark:text-slate-400'}`}
        >
          <BarChart3 className="h-4 w-4" /> گزارش تناژ تحویلی
        </button>
      </div>

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

      {tab === 'records' && (
        <>
          {error && <ErrorBanner message={error} onRetry={load} />}
          {loading ? (
            <TableSkeleton columns={6} />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={<Truck className="h-10 w-10" />}
              title="رکوردی یافت نشد"
              description="برای این فیلترها تناژ تحویلی ثبت نشده است."
              action={<button className="btn-primary mt-2" onClick={openCreate}><Plus className="h-4 w-4" /> ثبت اولین تناژ</button>}
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                      <th className="px-4 py-3 font-semibold">تاریخ</th>
                      <th className="px-4 py-3 font-semibold">ساعت</th>
                      <th className="px-4 py-3 font-semibold">خط</th>
                      <th className="px-4 py-3 font-semibold">پیمانکار</th>
                      <th className="px-4 py-3 font-semibold">خروجی\u200cهای محاسبه\u200cشده</th>
                      <th className="px-4 py-3 font-semibold text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                    {sorted.map((p) => (
                      <tr key={p.id} className="transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">
                          {formatDate(p.date)}
                          {p.note && <div className="text-[11px] font-normal text-ink-400">{p.note}</div>}
                        </td>
                        <td className="px-4 py-3 dark:text-slate-300" dir="ltr">{p.hour.slice(0, 5)}</td>
                        <td className="px-4 py-3 dark:text-slate-300">{p.line.name}</td>
                        <td className="px-4 py-3 text-ink-600 dark:text-slate-400">{p.contractor?.name ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex max-w-[380px] flex-wrap gap-1">
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
        </>
      )}

      {tab === 'report' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-500 dark:text-slate-400">
              گزارش بر اساس فیلترهای بالا — نرخ: {formatDate(filters.date_from || reportRecords[0]?.date || todayISO())} تا {formatDate(filters.date_to || reportRecords[0]?.date || todayISO())}
            </span>
            <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">{reportRecords.length} رکورد</span>
          </div>
          {loadingReport ? (
            <TableSkeleton columns={4} />
          ) : reportRecords.length === 0 ? (
            <EmptyState icon={<BarChart3 className="h-10 w-10" />} title="داده‌ای برای گزارش نیست" description="در این بازه رکوردی ثبت نشده است." />
          ) : (
            <>
              <div className="card overflow-hidden">
                <div className="border-b border-ink-100 px-4 py-2.5 text-sm font-bold text-ink-700 dark:border-slate-700 dark:text-slate-200">خلاصه به تفکیک خط تولید</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                        <th className="px-4 py-3 font-semibold">خط تولید</th>
                        <th className="px-4 py-3 font-semibold">تعداد رکورد</th>
                        {outputKeys.map((k) => <th key={k} className="px-4 py-3 font-semibold">مجموع {k}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                      {byLine.map((r) => (
                        <tr key={r.name} className="transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">{r.name}</td>
                          <td className="px-4 py-3 dark:text-slate-300">{formatNumber(r.count)}</td>
                          {outputKeys.map((k) => <td key={k} className="px-4 py-3 font-semibold text-brand-600">{formatNumber(r.sums[k] ?? 0)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card overflow-hidden">
                <div className="border-b border-ink-100 px-4 py-2.5 text-sm font-bold text-ink-700 dark:border-slate-700 dark:text-slate-200">جزئیات روزانه</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                        <th className="px-4 py-3 font-semibold">تاریخ</th>
                        <th className="px-4 py-3 font-semibold">تعداد رکورد</th>
                        {outputKeys.map((k) => <th key={k} className="px-4 py-3 font-semibold">مجموع {k}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                      {byDate.map((r) => (
                        <tr key={r.date} className="transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">{formatDate(r.date)}</td>
                          <td className="px-4 py-3 dark:text-slate-300">{formatNumber(r.count)}</td>
                          {outputKeys.map((k) => <td key={k} className="px-4 py-3 font-semibold text-brand-600">{formatNumber(r.sums[k] ?? 0)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'ویرایش تناژ تحویلی' : 'ثبت تناژ تحویلی'} subtitle={selectedFactory?.name} size="lg"
        footer={<><button className="btn-ghost" onClick={() => setModalOpen(false)}>انصراف</button><button className="btn-primary" onClick={submit} disabled={saving}>{saving ? 'در حال ذخیره...' : editing ? 'ذخیره تغییرات' : 'ثبت تناژ'}</button></>}>
        <TonnageForm form={form} setForm={setForm} editing={editing} />
      </Modal>

      <Modal open={confirmId != null} onClose={() => setConfirmId(null)} title="حذف رکورد تناژ"
        footer={<><button className="btn-ghost" onClick={() => setConfirmId(null)}>انصراف</button><button className="btn-danger" onClick={confirmDelete}><Trash2 className="h-4 w-4" /> حذف قطعی</button></>}>
        <p className="text-sm text-ink-700 dark:text-slate-300">آیا از حذف این رکورد تناژ تحویلی اطمینان دارید؟</p>
      </Modal>
    </div>
  )
}