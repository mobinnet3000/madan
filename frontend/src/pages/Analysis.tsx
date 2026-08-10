import { useState, useEffect, useMemo, useCallback } from 'react'
import { Pencil, Trash2, X, Filter, FlaskConical } from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { useToast } from '../components/ui/Toast'
import { getAnalysesPage, createAnalysis, updateAnalysis, deleteAnalysis } from '../api/analysis'
import type { DeviceDailyAnalysis, AnalysisFilters, DeviceDailyAnalysisPayload } from '../types'
import type { SamplePoint } from '../types'
import { Loading, EmptyState, ErrorBanner, TableSkeleton } from '../components/ui/States'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import { formatDate, formatDateWithWeekday, formatNumber, todayISO } from '../utils'
import JalaliDateInput from '../components/ui/JalaliDateInput'
import { SAMPLE_POINT_LABELS, SAMPLE_POINT_STYLE } from '../constants'

type AnalysisFormState = { device: string; shift: string; sample_point: SamplePoint | ''; date: string; value_1: number | null; value_2: number | null; analysis_text: string }

function AnalysisForm({ form, setForm, editing }: { form: AnalysisFormState; setForm: (f: AnalysisFormState) => void; editing: DeviceDailyAnalysis | null }) {
  const { selectedFactory, analyzers } = useFactory()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className="label">آنالایزور *</label>
        <select className="input" value={form.device} onChange={(e) => setForm({ ...form, device: e.target.value, sample_point: '' })}>
          <option value="">انتخاب آنالایزور</option>
          {analyzers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">نقطه نمونه‌برداری</label>
        <select className="input" value={form.sample_point ?? ''} onChange={(e) => setForm({ ...form, sample_point: e.target.value as SamplePoint | '' })}>
          <option value="">انتخاب نقطه</option>
          <option value="feed">خوراک (Feed)</option>
          <option value="tailing">باطله (Tailing)</option>
          <option value="product">محصول نهایی</option>
        </select>
      </div>
      <div>
        <label className="label">تاریخ *</label>
        <JalaliDateInput value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} />
        {form.date && (
          <p className="mt-1 text-[11px] text-brand-600 dark:text-brand-400">{formatDateWithWeekday(form.date)}</p>
        )}
      </div>
      <div>
        <label className="label">شیفت</label>
        <select className="input" value={form.shift || ''} onChange={(e) => setForm({ ...form, shift: e.target.value || '' })}>
          <option value="">بدون شیفت</option>
          {selectedFactory?.shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label">پارامتر ۱</label>
        <input type="number" step="0.01" className="input" value={form.value_1 ?? ''} onChange={(e) => setForm({ ...form, value_1: e.target.value ? Number(e.target.value) : null })} placeholder="اختیاری" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">پارامتر ۲</label>
        <input type="number" step="0.01" className="input" value={form.value_2 ?? ''} onChange={(e) => setForm({ ...form, value_2: e.target.value ? Number(e.target.value) : null })} placeholder="اختیاری" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">شرح / نتیجه آنالیز</label>
        <textarea className="input min-h-[80px]" value={form.analysis_text || ''} onChange={(e) => setForm({ ...form, analysis_text: e.target.value })} />
      </div>
    </div>
  )
}

export default function Analysis() {
  const { selectedFactory, analyzers } = useFactory()
  const { notify } = useToast()

  const [items, setItems] = useState<DeviceDailyAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<AnalysisFilters>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DeviceDailyAnalysis | null>(null)
  const [form, setForm] = useState<AnalysisFormState>(() => ({ device: '', shift: '', sample_point: '', date: todayISO(), value_1: null, value_2: null, analysis_text: '' }))
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(30)
  const [totalCount, setTotalCount] = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    const deviceIds = analyzers.map((d) => d.id)
    const merged = { ...filters }
    if (deviceIds.length) merged.devices = deviceIds.join(',') as any
    getAnalysesPage(merged, page, pageSize)
      .then((data) => {
        setItems(data.results)
        setTotalCount(data.count)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filters, page, pageSize, analyzers])

  useEffect(() => { if (selectedFactory && analyzers.length) load() }, [selectedFactory, load])

  const openCreate = () => {
    if (analyzers.length === 0) { notify('هیچ آنالایزوری در این کارخانه وجود ندارد', 'error'); return }
    setEditing(null); setForm({ device: analyzers[0].id.toString(), shift: '', sample_point: 'product', date: todayISO(), value_1: null, value_2: null, analysis_text: '' }); setModalOpen(true)
  }

  const openEdit = (a: DeviceDailyAnalysis) => {
    setEditing(a); setForm({ device: String(a.device.id), shift: a.shift?.id?.toString() || '', sample_point: a.sample_point || '', date: a.date, value_1: a.value_1, value_2: a.value_2, analysis_text: a.analysis_text || '' }); setModalOpen(true)
  }

  const submit = async () => {
    if (!form.device || !form.date) { notify('دستگاه (آنالایزور) و تاریخ الزامی هستند', 'error'); return }
    const payload: DeviceDailyAnalysisPayload = { device: Number(form.device), shift: form.shift ? Number(form.shift) : null, sample_point: (form.sample_point || null) as any, date: form.date, value_1: form.value_1 === null ? null : Number(form.value_1), value_2: form.value_2 === null ? null : Number(form.value_2), analysis_text: form.analysis_text }
    setSaving(true)
    try {
      if (editing) { await updateAnalysis(editing.id, payload); notify('آنالیز ویرایش شد') }
      else { await createAnalysis(payload); notify('آنالیز جدید ثبت شد') }
      setModalOpen(false); load()
    } catch (e: any) { notify(e.message || 'خطا در ذخیره‌سازی', 'error') }
    finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (confirmId == null) return
    try { await deleteAnalysis(confirmId); notify('آنالیز حذف شد'); setConfirmId(null); load() }
    catch (e: any) { notify(e.message || 'خطا در حذف', 'error') }
  }

  const setFilter = (k: keyof AnalysisFilters, v: string) => { setPage(1); setFilters((prev) => ({ ...prev, [k]: v === '' ? undefined : (v as any) })) }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900 dark:text-slate-100">آنالیز آنلاین</h1>
          <p className="text-sm text-ink-500">ثبت و پایش نتایج آنالیز دستگاه‌های آنالایزور ({analyzers.length} آنالایزر)</p>
        </div>
        <button className="btn-primary" onClick={openCreate} disabled={analyzers.length === 0}>ثبت آنالیز</button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {analyzers.length === 0 && !loading && <ErrorBanner message="هیچ آنالیزوری در این کارخانه وجود ندارد." />}

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-600"><Filter className="h-4 w-4" /> فیلترها</div>
        <div className="min-w-[180px] flex-1">
          <label className="label">آنالایزور</label>
          <select className="input" value={filters.device ?? ''} onChange={(e) => setFilter('device', e.target.value)}>
            <option value="">همه</option>
            {analyzers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="min-w-[130px]"><label className="label">از تاریخ</label><JalaliDateInput value={filters.date_from ?? ''} onChange={(iso) => setFilter('date_from', iso)} /></div>
        <div className="min-w-[130px]"><label className="label">تا تاریخ</label><JalaliDateInput value={filters.date_to ?? ''} onChange={(iso) => setFilter('date_to', iso)} /></div>
        <button className="btn-ghost" onClick={() => { setFilters({}); setPage(1) }}><X className="h-4 w-4" /> پاک کردن</button>
      </div>

      {loading ? <TableSkeleton columns={8} /> : sorted.length === 0 ? (
        <EmptyState icon={<FlaskConical className="h-10 w-10" />} title="آنالیزی یافت نشد" description="هنوز برای آنالایزورها رکوردی ثبت نشده است." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">تاریخ</th><th className="px-4 py-3 font-semibold">آنالایزور</th><th className="px-4 py-3 font-semibold">شیفت</th>
                  <th className="px-4 py-3 font-semibold">نقطه نمونه</th><th className="px-4 py-3 font-semibold">پارامتر ۱</th><th className="px-4 py-3 font-semibold">پارامتر ۲</th>
                  <th className="px-4 py-3 font-semibold">شرح</th><th className="px-4 py-3 font-semibold text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                {sorted.map((a) => (
                  <tr key={a.id} className="transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">
                      <div>{formatDate(a.date)}</div>
                      <div className="text-[10px] text-ink-400">{a.day_of_week || formatDate(a.date)}</div>
                    </td>
                    <td className="px-4 py-3 dark:text-slate-300">{a.device?.name}</td>
                    <td className="px-4 py-3 text-ink-600 dark:text-slate-400">{a.shift?.name || <span className="text-ink-300 dark:text-slate-600">—</span>}</td>
                    <td className="px-4 py-3">{a.sample_point ? <span className={`badge ${SAMPLE_POINT_STYLE[a.sample_point]}`}>{SAMPLE_POINT_LABELS[a.sample_point]}</span> : <span className="text-ink-300 dark:text-slate-600">—</span>}</td>
                    <td className="px-4 py-3 dark:text-slate-300">{formatNumber(a.value_1)}</td>
                    <td className="px-4 py-3 dark:text-slate-300">{formatNumber(a.value_2)}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-ink-500 dark:text-slate-400" title={a.analysis_text ?? ''}>{a.analysis_text || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-slate-800" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></button>
                        <button className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50" onClick={() => setConfirmId(a.id)}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && totalCount > pageSize && (
            <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 dark:border-slate-700">
              <span className="text-xs text-ink-400">نمایش {Math.min((page - 1) * pageSize + 1, totalCount)} تا {Math.min(page * pageSize, totalCount)} از {totalCount} رکورد</span>
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => { setPage(p); load() }} />
            </div>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'ویرایش آنالیز' : 'ثبت آنالیز جدید'} subtitle={selectedFactory?.name}
        footer={<><button className="btn-ghost" onClick={() => setModalOpen(false)}>انصراف</button><button className="btn-primary" onClick={submit} disabled={saving}>{saving ? 'در حال ذخیره...' : editing ? 'ذخیره تغییرات' : 'ثبت آنالیز'}</button></>}>
        <AnalysisForm form={form} setForm={setForm} editing={editing} />
      </Modal>

      <Modal open={confirmId != null} onClose={() => setConfirmId(null)} title="حذف آنالیز"
        footer={<><button className="btn-ghost" onClick={() => setConfirmId(null)}>انصراف</button><button className="btn-danger" onClick={confirmDelete}><Trash2 className="h-4 w-4" /> حذف قطعی</button></>}>
        <p className="text-sm text-ink-600 dark:text-slate-300">آیا از حذف این رکورد آنالیز اطمینان دارید؟</p>
      </Modal>
    </div>
  )
}
