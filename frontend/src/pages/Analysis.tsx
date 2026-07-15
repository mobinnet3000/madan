import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, Trash2, X, Filter } from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { useAuth } from '../store/AuthContext'
import { useToast } from '../components/ui/Toast'
import { fetchAllAnalyses, createAnalysis, updateAnalysis, deleteAnalysis } from '../api/analysis'
import type { DeviceDailyAnalysis, AnalysisFilters, DeviceDailyAnalysisPayload } from '../types'
import type { SamplePoint } from '../types'
import { Loading, EmptyState, ErrorBanner } from '../components/ui/States'
import Modal from '../components/ui/Modal'
import { formatDate, formatNumber, todayISO } from '../utils'
import { SAMPLE_POINT_LABELS, SAMPLE_POINT_STYLE } from '../constants'

type AnalysisFormState = {
  device: string
  shift: string
  sample_point: SamplePoint | ''
  date: string
  value_1: number | null
  value_2: number | null
  analysis_text: string
}

function AnalysisForm({
  form,
  setForm,
  onSubmit,
  editing,
  onCancel,
}: {
  form: AnalysisFormState
  setForm: (f: AnalysisFormState) => void
  onSubmit: () => Promise<void>
  editing: DeviceDailyAnalysis | null
  onCancel: () => void
}) {
  const { selectedFactory, analyzers, deviceName } = useFactory()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className="label">آنالایزور *</label>
        <select
          className="input"
          value={form.device}
          onChange={(e) => setForm({ ...form, device: e.target.value, sample_point: '' })}
        >
          <option value="">انتخاب آنالایزور</option>
          {analyzers.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">نقطه نمونه‌برداری</label>
          <select
            className="input"
            value={form.sample_point ?? ''}
            onChange={(e) => setForm({ ...form, sample_point: e.target.value as SamplePoint | '' })}
          >
          <option value="">انتخاب نقطه</option>
          <option value="feed">خوراک (Feed)</option>
          <option value="tailing">باطله (Tailing)</option>
          <option value="product">محصول نهایی</option>
        </select>
      </div>

      <div>
        <label className="label">تاریخ *</label>
        <input
          type="date"
          className="input"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
      </div>

      <div>
        <label className="label">شیفت</label>
        <select
          className="input"
          value={form.shift || ''}
          onChange={(e) => setForm({ ...form, shift: e.target.value || '' })}
        >
          <option value="">بدون شیفت</option>
          {selectedFactory?.shifts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2">
        <label className="label">پارامتر ۱</label>
        <input
          type="number"
          step="0.01"
          className="input"
          value={form.value_1 || ''}
          onChange={(e) => setForm({ ...form, value_1: e.target.value ? Number(e.target.value) : null })}
          placeholder="اختیاری"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="label">پارامتر ۲</label>
        <input
          type="number"
          step="0.01"
          className="input"
          value={form.value_2 || ''}
          onChange={(e) => setForm({ ...form, value_2: e.target.value ? Number(e.target.value) : null })}
          placeholder="اختیاری"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="label">شرح / نتیجه آنالیز</label>
        <textarea
          className="input min-h-[80px]"
          value={form.analysis_text || ''}
          onChange={(e) => setForm({ ...form, analysis_text: e.target.value })}
        />
      </div>

      {editing && (
        <div className="sm:col-span-2 rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
          <div><strong>دستگاه:</strong> {editing.device?.name}</div>
          <div><strong>خط:</strong> {selectedFactory?.lines.find((l) => l.devices.some((d) => d.id === editing.device?.id))?.name}</div>
          <div><strong>کارخانه:</strong> {selectedFactory?.name}</div>
        </div>
      )}
    </div>
  )
}

export default function Analysis() {
  const { selectedFactory, analyzers } = useFactory()
  const { user } = useAuth()
  const { notify } = useToast()

  const [items, setItems] = useState<DeviceDailyAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<AnalysisFilters>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DeviceDailyAnalysis | null>(null)
  const [form, setForm] = useState<AnalysisFormState>(() => ({
    device: '',
    shift: '',
    sample_point: '',
    date: todayISO(),
    value_1: null,
    value_2: null,
    analysis_text: '',
  }))
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  const analyzerIds = useMemo(() => analyzers.map((d) => d.id), [analyzers])

  const load = async () => {
    setLoading(true)
    let loaded = 0
    try {
      const data = await fetchAllAnalyses(filters, 120, (chunk, current, total) => {
        loaded = current
        setItems((prev) => {
          const merged = current === chunk.length ? chunk : [...prev, ...chunk]
          return merged.filter((a, idx, arr) => idx === arr.findIndex((x) => x.id === a.id))
        })
        setError(null)
      })
      const filtered = data.filter((a) => analyzerIds.includes(a.device.id))
      setItems(filtered)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedFactory && analyzers.length) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFactory, filters, analyzerIds])

  const openCreate = () => {
    if (analyzers.length === 0) {
      notify('هیچ آنالایزروری در این کارخانه وجود ندارد. از پنل ادمین یک دستگاه با is_analyzer=True بسازید.', 'error')
      return
    }
    setEditing(null)
    setForm({
      device: analyzers[0].id.toString(),
      shift: '',
      sample_point: 'product',
      date: todayISO(),
      value_1: null,
      value_2: null,
      analysis_text: '',
    })
    setModalOpen(true)
  }

  const openEdit = (a: DeviceDailyAnalysis) => {
    setEditing(a)
    setForm({
      device: String(a.device.id),
      shift: a.shift?.id?.toString() || '',
      sample_point: a.sample_point || '',
      date: a.date,
      value_1: a.value_1,
      value_2: a.value_2,
      analysis_text: a.analysis_text || '',
    })
    setModalOpen(true)
  }

  const submit = async () => {
    if (!form.device || !form.date) {
      notify('دستگاه (آنالایزور) و تاریخ الزامی هستند', 'error')
      return
    }
    const payload: DeviceDailyAnalysisPayload = {
      device: Number(form.device),
      shift: form.shift ? Number(form.shift) : null,
      sample_point: (form.sample_point || null) as any,
      date: form.date,
      value_1: form.value_1 === null ? null : Number(form.value_1),
      value_2: form.value_2 === null ? null : Number(form.value_2),
      analysis_text: form.analysis_text,
    }
    setSaving(true)
    try {
      if (editing) {
        await updateAnalysis(editing.id, payload)
        notify('آنالیز ویرایش شد')
      } else {
        await createAnalysis(payload)
        notify('آنالیز جدید ثبت شد')
      }
      setModalOpen(false)
      load()
    } catch (e: any) {
      notify(e.message || 'خطا در ذخیره‌سازی', 'error')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (confirmId == null) return
    try {
      await deleteAnalysis(confirmId)
      notify('آنالیز حذف شد')
      setConfirmId(null)
      load()
    } catch (e: any) {
      notify(e.message || 'خطا در حذف', 'error')
    }
  }

  const setFilter = (k: keyof AnalysisFilters, v: string) =>
    setFilters((prev) => ({ ...prev, [k]: v === '' ? undefined : (v as any) }))

  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900">آنالیز آنلاین</h1>
          <p className="text-sm text-ink-500">
            ثبت و پایش نتایج آنالیز دستگاه‌های آنالایزور برای خوراک، باطله و محصول نهایی ({analyzers.length} آنالایزر)
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate} disabled={analyzers.length === 0}>
          ثبت آنالیز
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {analyzers.length === 0 && !loading && (
        <ErrorBanner message="هیچ آنالیزوری در این کارخانه وجود ندارد. از پنل ادمین دستگاهی با is_analyzer=True بسازید." />
      )}

      {/* فیلتر */}
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-600">
          <Filter className="h-4 w-4" /> فیلترها
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="label">آنالایزور</label>
          <select
            className="input"
            value={filters.device ?? ''}
            onChange={(e) => setFilter('device', e.target.value)}
          >
            <option value="">همه آنالایزورها</option>
            {analyzers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[130px]">
          <label className="label">از تاریخ</label>
          <input
            type="date"
            className="input"
            value={filters.date_from ?? ''}
            onChange={(e) => setFilter('date_from', e.target.value)}
          />
        </div>
        <div className="min-w-[130px]">
          <label className="label">تا تاریخ</label>
          <input
            type="date"
            className="input"
            value={filters.date_to ?? ''}
            onChange={(e) => setFilter('date_to', e.target.value)}
          />
        </div>
        <button className="btn-ghost" onClick={() => setFilters({})}>
          <X className="h-4 w-4" /> پاک کردن
        </button>
      </div>

      {/* جدول */}
      {loading ? (
        <Loading />
      ) : sorted.length === 0 ? (
        <EmptyState title="آنالیزی یافت نشد" description="هنوز برای آنالایزورها رکوردی ثبت نشده است." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500">
                  <th className="px-4 py-3 font-semibold">تاریخ</th>
                  <th className="px-4 py-3 font-semibold">آنالایزور</th>
                  <th className="px-4 py-3 font-semibold">شیفت</th>
                  <th className="px-4 py-3 font-semibold">نقطه نمونه</th>
                  <th className="px-4 py-3 font-semibold">پارامتر ۱</th>
                  <th className="px-4 py-3 font-semibold">پارامتر ۲</th>
                  <th className="px-4 py-3 font-semibold">شرح</th>
                  <th className="px-4 py-3 font-semibold text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {sorted.map((a) => (
                  <tr key={a.id} className="transition hover:bg-ink-50/50">
                    <td className="px-4 py-3 font-medium text-ink-700">{formatDate(a.date)}</td>
                    <td className="px-4 py-3">{a.device?.name}</td>
                    <td className="px-4 py-3 text-ink-600">
                      {a.shift?.name || <span className="text-ink-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {a.sample_point ? (
                        <span className={`badge ${SAMPLE_POINT_STYLE[a.sample_point]}`}>
                          {SAMPLE_POINT_LABELS[a.sample_point]}
                        </span>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{formatNumber(a.value_1)}</td>
                    <td className="px-4 py-3">{formatNumber(a.value_2)}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-ink-500" title={a.analysis_text ?? ''}>
                      {a.analysis_text || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600"
                          onClick={() => openEdit(a)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                          onClick={() => setConfirmId(a.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* مودال فرم */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'ویرایش آنالیز' : 'ثبت آنالیز جدید'}
        subtitle={selectedFactory?.name}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setModalOpen(false)}>
              انصراف
            </button>
            <button className="btn-primary" onClick={submit} disabled={saving || analyzers.length === 0}>
              {saving ? 'در حال ذخیره...' : editing ? 'ذخیره تغییرات' : 'ثبت آنالیز'}
            </button>
          </>
        }
      >
        <AnalysisForm form={form} setForm={setForm} onSubmit={submit} editing={editing} onCancel={() => setModalOpen(false)} />
      </Modal>

      <Modal
        open={confirmId != null}
        onClose={() => setConfirmId(null)}
        title="حذف آنالیز"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setConfirmId(null)}>
              انصراف
            </button>
            <button className="btn-danger" onClick={confirmDelete}>
              <Trash2 className="h-4 w-4" /> حذف قطعی
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          آیا از حذف این رکورد آنالیز اطمینان دارید؟
        </p>
      </Modal>
    </div>
  )
}
