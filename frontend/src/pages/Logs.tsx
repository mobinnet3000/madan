import { useEffect, useMemo, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Filter, X, ClipboardList, Layers } from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { getLogsPage, createLog, updateLog, deleteLog } from '../api/logs'
import type { DeviceLog, DeviceLogPayload, LogFilters } from '../types'
import { useToast } from '../components/ui/Toast'
import { Loading, ErrorBanner, EmptyState, TableSkeleton } from '../components/ui/States'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import JalaliDateInput from '../components/ui/JalaliDateInput'
import { formatDate, formatNumber, todayISO, shiftHours } from '../utils'

type RowState = {
  device: string
  failure_cause: string
  downtime_hours: string
  failure_description: string
  repair_description: string
}

type FormState = {
  line: string
  shift: string
  date: string
  rows: RowState[]
}

const emptyRow: RowState = {
  device: '', failure_cause: '', downtime_hours: '0',
  failure_description: '', repair_description: '',
}

const emptyForm: FormState = {
  line: '', shift: '', date: todayISO(), rows: [{ ...emptyRow }],
}

function LogForm({ form, setForm, editing }: { form: FormState; setForm: (f: FormState) => void; editing: DeviceLog | null }) {
  const { selectedFactory } = useFactory()

  const selectedLine = useMemo(
    () => selectedFactory?.lines.find((l) => l.id === Number(form.line)),
    [form.line, selectedFactory],
  )
  const shifts = useMemo(() => selectedFactory?.shifts ?? [], [selectedFactory])
  const lineDevices = useMemo(() => selectedLine?.devices ?? [], [selectedLine])

  const selectedShift = useMemo(() => shifts.find((s) => s.id === Number(form.shift)), [shifts, form.shift])
  const totalShiftHours = useMemo(
    () => shiftHours(selectedShift?.start_time, selectedShift?.end_time),
    [selectedShift],
  )
  const totalDowntime = useMemo(
    () => form.rows.reduce((sum, r) => sum + (Number(r.downtime_hours) || 0), 0),
    [form.rows],
  )
  const runtime = Math.max(0, totalShiftHours - totalDowntime)
  const downtimeWarning = totalDowntime > totalShiftHours

  const set = (k: keyof FormState, v: string) => setForm({ ...form, [k]: v })
  const onLineChange = (v: string) => setForm({ ...form, line: v, shift: '' })

  const setRow = (idx: number, k: keyof RowState, v: string) => {
    setForm({ ...form, rows: form.rows.map((r, i) => (i === idx ? { ...r, [k]: v } : r)) })
  }
  const addRow = () => setForm({ ...form, rows: [...form.rows, { ...emptyRow }] })
  const removeRow = (idx: number) => {
    if (form.rows.length <= 1) return
    setForm({ ...form, rows: form.rows.filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-4">
      {/* سربرگ ثابت: خط / شیفت / تاریخ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label">خط تولید *</label>
          <select className="input" value={form.line} onChange={(e) => onLineChange(e.target.value)}>
            <option value="">انتخاب خط</option>
            {selectedFactory?.lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">شیفت *</label>
          <select className="input" value={form.shift} onChange={(e) => set('shift', e.target.value)} disabled={!form.line}>
            <option value="">انتخاب شیفت</option>
            {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.start_time.slice(0, 5)}-{s.end_time.slice(0, 5)})</option>)}
          </select>
        </div>
        <div>
          <label className="label">تاریخ *</label>
          <JalaliDateInput value={form.date} onChange={(iso) => set('date', iso)} />
        </div>
      </div>

      {/* ردیف‌های توقف */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-sm font-bold text-ink-700 dark:text-slate-200">
            <Layers className="h-4 w-4 text-brand-600" /> توقف‌های این گزارش
            <span className="chip">برای این خط/شیفت/تاریخ</span>
          </div>
          {!editing && (
            <button type="button" className="btn-ghost !h-9 !px-3 text-xs" onClick={addRow}>
              <Plus className="h-4 w-4" /> افزودن ردیف توقف
            </button>
          )}
        </div>

        {form.rows.map((row, idx) => (
          <div key={idx} className="mb-3 rounded-xl border border-ink-100 p-3 dark:border-slate-700">
            <div className="mb-2 flex items-center justify-between">
              <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">توقف {idx + 1}</span>
              {!editing && form.rows.length > 1 && (
                <button type="button" className="rounded-lg p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => removeRow(idx)} title="حذف ردیف">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="label">دستگاه</label>
                <select className="input" value={row.device} onChange={(e) => setRow(idx, 'device', e.target.value)} disabled={!form.line}>
                  <option value="">بدون دستگاه</option>
                  {lineDevices.map((d) => <option key={d.id} value={d.id}>{d.code ? `${d.code} - ${d.name}` : d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">علت خرابی</label>
                <select className="input" value={row.failure_cause} onChange={(e) => setRow(idx, 'failure_cause', e.target.value)}>
                  <option value="">بدون علت</option>
                  {selectedFactory?.failure_reasons.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
                </select>
              </div>
              <div>
                <label className="label">ساعت توقف</label>
                <input type="number" step="0.1" min="0" className="input" value={row.downtime_hours} onChange={(e) => setRow(idx, 'downtime_hours', e.target.value)} />
              </div>
              <div className="sm:col-span-3">
                <label className="label">توضیحات خرابی</label>
                <textarea className="input min-h-[56px]" value={row.failure_description} onChange={(e) => setRow(idx, 'failure_description', e.target.value)} />
              </div>
              <div className="sm:col-span-3">
                <label className="label">شرح اقدامات / تعمیرات</label>
                <textarea className="input min-h-[56px]" value={row.repair_description} onChange={(e) => setRow(idx, 'repair_description', e.target.value)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* خلاصه کارکرد */}
      <div className="rounded-lg border border-ink-100 bg-ink-50/60 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/50">
        <div className="mb-1 flex flex-wrap items-center justify-between text-xs text-ink-500 dark:text-slate-400">
          <span>طول شیفت: {formatNumber(Math.round(totalShiftHours * 10) / 10)} ساعت</span>
          <span>مجموع توقف: {formatNumber(Math.round(totalDowntime * 10) / 10)} ساعت ({form.rows.length} ردیف)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-ink-700 dark:text-slate-200">ساعت کارکرد مفید</span>
          <span className="text-lg font-extrabold text-emerald-600">{formatNumber(Math.round(runtime * 10) / 10)} ساعت</span>
        </div>
        <p className="mt-1 text-[11px] text-ink-400 dark:text-slate-500">کارکرد مفید = طول شیفت − مجموع توقف‌ها</p>
        {downtimeWarning && (
          <div className="mt-2 rounded-md bg-rose-50 px-3 py-1.5 text-xs text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
            مجموع توقف‌ها از طول شیفت بیشتر است.
          </div>
        )}
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
    const merged = { ...filters } as any
    if (lineIds.length) merged.lines = lineIds.join(',')
    getLogsPage(merged, page, pageSize)
      .then((data) => {
        setLogs(data.results)
        setTotalCount(data.count); setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filters, page, pageSize, lineIds])

  useEffect(() => { if (selectedFactory) load() }, [selectedFactory, load])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, line: String(selectedFactory?.lines[0]?.id ?? ''), rows: [{ ...emptyRow }] })
    setModalOpen(true)
  }

  const openEdit = (log: DeviceLog) => {
    setEditing(log)
    setForm({
      line: String(log.line.id), shift: String(log.shift.id), date: log.date,
      rows: [{
        device: log.device ? String(log.device.id) : '',
        failure_cause: log.failure_cause ? String(log.failure_cause.id) : '',
        downtime_hours: String(log.downtime_hours),
        failure_description: log.failure_description ?? '',
        repair_description: log.repair_description ?? '',
      }],
    })
    setModalOpen(true)
  }

  // ساعت کارکرد مفید برای هر ردیف (مانند قبل: طول شیفت − توقف همان ردیف)
  const computeShift = (lineId: number, shiftId: number, down: number): number => {
    const shift = selectedFactory?.shifts.find((s) => s.id === shiftId)
    return Math.max(0, shiftHours(shift?.start_time, shift?.end_time) - down)
  }

  const submit = async () => {
    if (!form.line || !form.shift || !form.date) {
      notify('خط، شیفت و تاریخ الزامی هستند', 'error'); return
    }
    if (form.rows.length === 0) {
      notify('حداقل یک ردیف توقف وارد کنید', 'error'); return
    }
    const line = Number(form.line)
    const shift = Number(form.shift)

    const buildPayload = (row: RowState): DeviceLogPayload => ({
      line, shift, date: form.date,
      device: row.device ? Number(row.device) : null,
      failure_cause: row.failure_cause ? Number(row.failure_cause) : null,
      runtime_hours: computeShift(line, shift, Number(row.downtime_hours) || 0),
      downtime_hours: Number(row.downtime_hours) || 0,
      failure_description: row.failure_description,
      repair_description: row.repair_description,
    })

    setSaving(true)
    try {
      if (editing) {
        await updateLog(editing.id, buildPayload(form.rows[0]))
        notify('گزارش با موفقیت ویرایش شد')
      } else {
        for (const row of form.rows) {
          await createLog(buildPayload(row))
        }
        notify(`گزارش ثبت شد (${form.rows.length} ردیف توقف)`)
      }
      setModalOpen(false); load()
    } catch (e: any) {
      notify(e.message || 'خطا در ذخیره‌سازی', 'error')
    } finally {
      setSaving(false)
    }
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
          <p className="text-sm text-ink-500">ثبت و مدیریت گزارش‌های عملکرد، توقف و خرابی خطوط (چند توقف در یک گزارش)</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> ثبت گزارش جدید</button>
      </div>

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
          <label className="label">شیفت</label>
          <select className="input" value={filters.shift ?? ''} onChange={(e) => setFilter('shift', e.target.value)}>
            <option value="">همه شیفت‌ها</option>
            {selectedFactory?.shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">از تاریخ</label>
          <JalaliDateInput value={filters.date_from ?? ''} onChange={(iso) => setFilter('date_from', iso)} />
        </div>
        <div>
          <label className="label">تا تاریخ</label>
          <JalaliDateInput value={filters.date_to ?? ''} onChange={(iso) => setFilter('date_to', iso)} />
        </div>
        <button className="btn-ghost" onClick={() => { setFilters({}); setPage(1) }}><X className="h-4 w-4" /> پاک کردن</button>
      </div>

      {loading ? (
        <TableSkeleton columns={7} />
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
                  <th className="px-4 py-3 font-semibold">کارکرد مفید</th>
                  <th className="px-4 py-3 font-semibold">توقف</th>
                  <th className="px-4 py-3 font-semibold text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                {sorted.map((l) => (
                  <tr key={l.id} className="transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">
                      <div>{formatDate(l.date)}</div>
                      <div className="text-[10px] text-ink-400">{l.day_of_week || formatDate(l.date)}</div>
                    </td>
                    <td className="px-4 py-3 dark:text-slate-300">{l.line.name}</td>
                    <td className="px-4 py-3 dark:text-slate-300">{l.shift.name}</td>
                    <td className="px-4 py-3 text-ink-600 dark:text-slate-400">
                      {l.device ? <span>{l.device.code ? `${l.device.code} - ` : ''}{l.device.name}</span> : <span className="text-ink-300 dark:text-slate-600">—</span>}
                      {l.failure_cause && <span className="mr-2 badge bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">{l.failure_cause.title}</span>}
                    </td>
                    <td className="px-4 py-3"><span className="font-semibold text-emerald-600">{formatNumber(l.runtime_hours)}</span></td>
                    <td className="px-4 py-3 text-rose-600">{formatNumber(l.downtime_hours)}</td>
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
        size="lg"
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