import { useEffect, useMemo, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Filter, X, ClipboardList } from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { getLogsPage, createLog, updateLog, deleteLog } from '../api/logs'
import type { DeviceLog, DeviceLogPayload, LogFilters } from '../types'
import { useToast } from '../components/ui/Toast'
import { Loading, ErrorBanner, EmptyState, TableSkeleton } from '../components/ui/States'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import { formatDate, formatNumber, formatPercent, todayISO } from '../utils'

type FormState = {
  line: string; shift: string; date: string; device: string; failure_cause: string
  runtime_hours: string; downtime_hours: string; feed_tonnage: string
  product_tonnage: string; tailing_tonnage: string; failure_description: string; repair_description: string
}

const emptyForm: FormState = {
  line: '', shift: '', date: todayISO(), device: '', failure_cause: '',
  runtime_hours: '0', downtime_hours: '0', feed_tonnage: '0', product_tonnage: '0',
  tailing_tonnage: '0', failure_description: '', repair_description: '',
}

function LogForm({ form, setForm, editing }: { form: FormState; setForm: (f: FormState) => void; editing: DeviceLog | null }) {
  const { selectedFactory } = useFactory()
  const lineDevices = useMemo(() => selectedFactory?.lines.find((l) => l.id === Number(form.line))?.devices ?? [], [form.line, selectedFactory])
  const hoursTotal = (Number(form.runtime_hours) || 0) + (Number(form.downtime_hours) || 0)
  const hoursWarning = hoursTotal > 24

  const set = (k: keyof FormState, v: string) => setForm({ ...form, [k]: v })

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className="label">خط تولید *</label>
        <select className="input" value={form.line} onChange={(e) => set('line', e.target.value)}>
          <option value="">انتخاب خط</option>
          {selectedFactory?.lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">شیفت *</label>
        <select className="input" value={form.shift} onChange={(e) => set('shift', e.target.value)}>
          <option value="">انتخاب شیفت</option>
          {selectedFactory?.shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.start_time.slice(0, 5)})</option>)}
        </select>
      </div>
      <div>
        <label className="label">تاریخ *</label>
        <input type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} />
      </div>
      <div>
        <label className="label">دستگاه (اختیاری)</label>
        <select className="input" value={form.device} onChange={(e) => set('device', e.target.value)} disabled={!form.line}>
          <option value="">بدون دستگاه</option>
          {lineDevices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">علت خرابی (اختیاری)</label>
        <select className="input" value={form.failure_cause} onChange={(e) => set('failure_cause', e.target.value)}>
          <option value="">بدون علت</option>
          {selectedFactory?.failure_reasons.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">ساعت کارکرد</label>
          <input type="number" step="0.1" min="0" className="input" value={form.runtime_hours} onChange={(e) => set('runtime_hours', e.target.value)} />
        </div>
        <div>
          <label className="label">ساعت توقف</label>
          <input type="number" step="0.1" min="0" className="input" value={form.downtime_hours} onChange={(e) => set('downtime_hours', e.target.value)} />
        </div>
      </div>
      {hoursWarning && (
        <div className="sm:col-span-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">مجموع ساعت‌ها از ۲۴ بیشتر است ({hoursTotal}h)</div>
      )}
      <div className="grid grid-cols-3 gap-3 sm:col-span-2">
        <div><label className="label">تناژ ورودی</label><input type="number" step="0.1" min="0" className="input" value={form.feed_tonnage} onChange={(e) => set('feed_tonnage', e.target.value)} /></div>
        <div><label className="label">محصول</label><input type="number" step="0.1" min="0" className="input" value={form.product_tonnage} onChange={(e) => set('product_tonnage', e.target.value)} /></div>
        <div><label className="label">باطله</label><input type="number" step="0.1" min="0" className="input" value={form.tailing_tonnage} onChange={(e) => set('tailing_tonnage', e.target.value)} /></div>
      </div>
      <div className="sm:col-span-2">
        <label className="label">توضیحات خرابی</label>
        <textarea className="input min-h-[70px]" value={form.failure_description} onChange={(e) => set('failure_description', e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">شرح اقدامات / تعمیرات</label>
        <textarea className="input min-h-[70px]" value={form.repair_description} onChange={(e) => set('repair_description', e.target.value)} />
      </div>
    </div>
  )
}

export default function Logs() {
  const { selectedFactory } = useFactory()
  const { notify } = useToast()

  const [logs, setLogs] = useState<DeviceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<LogFilters>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DeviceLog | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(30)
  const [totalCount, setTotalCount] = useState(0)

  const lineIds = useMemo(() => (selectedFactory?.lines ?? []).map((l) => l.id), [selectedFactory])

  const load = useCallback(() => {
    setLoading(true)
    getLogsPage(filters, page, pageSize)
      .then((data) => {
        setLogs(lineIds.length ? data.results.filter((l) => lineIds.includes(l.line.id)) : data.results)
        setTotalCount(data.count); setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filters, page, pageSize, lineIds])

  useEffect(() => { if (selectedFactory) load() }, [selectedFactory, load])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, line: String(selectedFactory?.lines[0]?.id ?? ''), shift: String(selectedFactory?.shifts[0]?.id ?? '') })
    setModalOpen(true)
  }

  const openEdit = (log: DeviceLog) => {
    setEditing(log)
    setForm({
      line: String(log.line.id), shift: String(log.shift.id), date: log.date,
      device: log.device ? String(log.device.id) : '', failure_cause: log.failure_cause ? String(log.failure_cause.id) : '',
      runtime_hours: String(log.runtime_hours), downtime_hours: String(log.downtime_hours),
      feed_tonnage: String(log.feed_tonnage), product_tonnage: String(log.product_tonnage),
      tailing_tonnage: String(log.tailing_tonnage), failure_description: log.failure_description ?? '',
      repair_description: log.repair_description ?? '',
    })
    setModalOpen(true)
  }

  const submit = async () => {
    if (!form.line || !form.shift || !form.date) {
      notify('خط، شیفت و تاریخ الزامی هستند', 'error'); return
    }
    const payload: DeviceLogPayload = {
      line: Number(form.line), shift: Number(form.shift), date: form.date,
      device: form.device ? Number(form.device) : null,
      failure_cause: form.failure_cause ? Number(form.failure_cause) : null,
      runtime_hours: Number(form.runtime_hours) || 0, downtime_hours: Number(form.downtime_hours) || 0,
      feed_tonnage: Number(form.feed_tonnage) || 0, product_tonnage: Number(form.product_tonnage) || 0,
      tailing_tonnage: Number(form.tailing_tonnage) || 0,
      failure_description: form.failure_description, repair_description: form.repair_description,
    }
    setSaving(true)
    try {
      if (editing) { await updateLog(editing.id, payload); notify('گزارش با موفقیت ویرایش شد') }
      else { await createLog(payload); notify('گزارش جدید ثبت شد') }
      setModalOpen(false); load()
    } catch (e: any) { notify(e.message || 'خطا در ذخیره‌سازی', 'error') }
    finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (confirmId == null) return
    try { await deleteLog(confirmId); notify('گزارش حذف شد'); setConfirmId(null); load() }
    catch (e: any) { notify(e.message || 'خطا در حذف', 'error') }
  }

  const setFilter = (k: keyof LogFilters, v: string) => { setPage(1); setFilters((prev) => ({ ...prev, [k]: v === '' ? undefined : (v as any) })) }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900 dark:text-slate-100">گزارش عملکرد روزانه</h1>
          <p className="text-sm text-ink-500">ثبت و مدیریت گزارش‌های عملکرد، توقف و تولید خطوط</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> ثبت گزارش جدید</button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-600"><Filter className="h-4 w-4" /> فیلترها</div>
        <div className="min-w-[150px] flex-1">
          <label className="label">خط</label>
          <select className="input" value={filters.line ?? ''} onChange={(e) => setFilter('line', e.target.value)}>
            <option value="">همه خطوط</option>
            {selectedFactory?.lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="label">شیفت</label>
          <select className="input" value={filters.shift ?? ''} onChange={(e) => setFilter('shift', e.target.value)}>
            <option value="">همه شیفت‌ها</option>
            {selectedFactory?.shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="min-w-[130px]">
          <label className="label">از تاریخ</label>
          <input type="date" className="input" value={filters.date_from ?? ''} onChange={(e) => setFilter('date_from', e.target.value)} />
        </div>
        <div className="min-w-[130px]">
          <label className="label">تا تاریخ</label>
          <input type="date" className="input" value={filters.date_to ?? ''} onChange={(e) => setFilter('date_to', e.target.value)} />
        </div>
        <button className="btn-ghost" onClick={() => { setFilters({}); setPage(1) }}><X className="h-4 w-4" /> پاک کردن</button>
      </div>

      {loading ? (
        <TableSkeleton columns={9} />
      ) : sorted.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-10 w-10" />} title="گزارشی یافت نشد"
          description="با فیلترهای فعلی رکوردی وجود ندارد یا هنوز گزارشی ثبت نشده است."
          action={<button className="btn-primary mt-2" onClick={openCreate}><Plus className="h-4 w-4" /> ثبت اولین گزارش</button>} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                  <th className="px-4 py-3 font-semibold">تاریخ</th>
                  <th className="px-4 py-3 font-semibold">خط</th>
                  <th className="px-4 py-3 font-semibold">شیفت</th>
                  <th className="px-4 py-3 font-semibold">دستگاه</th>
                  <th className="px-4 py-3 font-semibold">ورودی</th>
                  <th className="px-4 py-3 font-semibold">خروجی</th>
                  <th className="px-4 py-3 font-semibold">کارکرد/توقف</th>
                  <th className="px-4 py-3 font-semibold">راندمان</th>
                  <th className="px-4 py-3 font-semibold text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                {sorted.map((l) => (
                  <tr key={l.id} className="transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">{formatDate(l.date)}</td>
                    <td className="px-4 py-3 dark:text-slate-300">{l.line.name}</td>
                    <td className="px-4 py-3 dark:text-slate-300">{l.shift.name}</td>
                    <td className="px-4 py-3 text-ink-600 dark:text-slate-400">
                      {l.device?.name || <span className="text-ink-300 dark:text-slate-600">—</span>}
                      {l.failure_cause && <span className="mr-2 badge bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">{l.failure_cause.title}</span>}
                    </td>
                    <td className="px-4 py-3 dark:text-slate-300">{formatNumber(l.feed_tonnage)}</td>
                    <td className="px-4 py-3 dark:text-slate-300">{formatNumber(l.product_tonnage)}</td>
                    <td className="px-4 py-3 text-xs text-ink-500">{formatNumber(l.runtime_hours)} / {formatNumber(l.downtime_hours)}</td>
                    <td className="px-4 py-3"><span className="font-bold text-emerald-600">{formatPercent(l.efficiency)}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-slate-800" onClick={() => openEdit(l)} title="ویرایش"><Pencil className="h-4 w-4" /></button>
                        <button className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50" onClick={() => setConfirmId(l.id)} title="حذف"><Trash2 className="h-4 w-4" /></button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'ویرایش گزارش عملکرد' : 'ثبت گزارش عملکرد جدید'} subtitle={selectedFactory?.name}
        footer={<><button className="btn-ghost" onClick={() => setModalOpen(false)}>انصراف</button><button className="btn-primary" onClick={submit} disabled={saving}>{saving ? 'در حال ذخیره...' : editing ? 'ذخیره تغییرات' : 'ثبت گزارش'}</button></>}>
        <LogForm form={form} setForm={setForm} editing={editing} />
      </Modal>

      <Modal open={confirmId != null} onClose={() => setConfirmId(null)} title="حذف گزارش"
        footer={<><button className="btn-ghost" onClick={() => setConfirmId(null)}>انصراف</button><button className="btn-danger" onClick={confirmDelete}><Trash2 className="h-4 w-4" /> حذف قطعی</button></>}>
        <p className="text-sm text-ink-600 dark:text-slate-300">آیا از حذف این گزارش عملکرد اطمینان دارید؟ این عمل قابل بازگشت نیست.</p>
      </Modal>
    </div>
  )
}
