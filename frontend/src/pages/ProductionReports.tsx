import { useEffect, useMemo, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Filter, FlaskConical } from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { useToast } from '../components/ui/Toast'
import {
  getProductionReports, createProductionReport, updateProductionReport, deleteProductionReport,
} from '../api/production'
import type { ProductionReport, ProductionReportFilters, ProductionReportPayload } from '../types'
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
  batala_avalieh: string
  darsad_batale: string
  darsad_dane_dorosht: string
  darsad_rotobat: string
  darsad_takhfif: string
  darsad_jerime: string
  note: string
}

const emptyForm: FormState = {
  line: '', contractor: '', date_from: todayISO(), date_to: todayISO(),
  batala_avalieh: '0', darsad_batale: '0', darsad_dane_dorosht: '0',
  darsad_rotobat: '0', darsad_takhfif: '0', darsad_jerime: '0', note: '',
}

const FIELDS: { key: keyof FormState; label: string }[] = [
  { key: 'batala_avalieh', label: 'باطله اولیه' },
  { key: 'darsad_batale', label: 'درصد باطله' },
  { key: 'darsad_dane_dorosht', label: 'درصد دانه درشت' },
  { key: 'darsad_rotobat', label: 'درصد رطوبت' },
  { key: 'darsad_takhfif', label: 'درصد تخفیف' },
  { key: 'darsad_jerime', label: 'درصد جریمه' },
]

function ProductionForm({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const { selectedFactory } = useFactory()
  const set = (k: keyof FormState, v: string) => setForm({ ...form, [k]: v })
  const rangeInvalid = form.date_from && form.date_to && form.date_to < form.date_from

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
      {rangeInvalid && (
        <div className="sm:col-span-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
          تاریخ پایان نمی‌تواند قبل از شروع باشد.
        </div>
      )}

      {FIELDS.map((f) => (
        <div key={f.key}>
          <label className="label">{f.label} {f.key === 'batala_avalieh' ? '' : '(٪)'}</label>
          <input
            type="number" step="0.1" min="0" className="input"
            value={form[f.key]}
            onChange={(e) => set(f.key, e.target.value)}
          />
        </div>
      ))}

      <div className="sm:col-span-2">
        <label className="label">توضیحات / ملاحظات</label>
        <textarea className="input min-h-[70px]" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="اختیاری" />
      </div>
    </div>
  )
}

export default function ProductionReports() {
  const { selectedFactory } = useFactory()
  const { notify } = useToast()

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
      batala_avalieh: String(p.batala_avalieh), darsad_batale: String(p.darsad_batale),
      darsad_dane_dorosht: String(p.darsad_dane_dorosht), darsad_rotobat: String(p.darsad_rotobat),
      darsad_takhfif: String(p.darsad_takhfif), darsad_jerime: String(p.darsad_jerime),
      note: p.note || '',
    })
    setModalOpen(true)
  }

  const submit = async () => {
    if (!form.line || !form.date_from || !form.date_to) {
      notify('خط و بازه تاریخ الزامی هستند', 'error'); return
    }
    if (form.date_to < form.date_from) { notify('تاریخ پایان معتبر نیست', 'error'); return }
    const num = (v: string) => Number(v) || 0
    const payload: ProductionReportPayload = {
      line: Number(form.line),
      contractor: form.contractor ? Number(form.contractor) : null,
      date_from: form.date_from, date_to: form.date_to,
      batala_avalieh: num(form.batala_avalieh), darsad_batale: num(form.darsad_batale),
      darsad_dane_dorosht: num(form.darsad_dane_dorosht), darsad_rotobat: num(form.darsad_rotobat),
      darsad_takhfif: num(form.darsad_takhfif), darsad_jerime: num(form.darsad_jerime),
      note: form.note,
    }
    setSaving(true)
    try {
      if (editing) { await updateProductionReport(editing.id, payload); notify('آنالیز خط ویرایش شد') }
      else { await createProductionReport(payload); notify('آنالیز خط ثبت شد') }
      setModalOpen(false); load()
    } catch (e: any) { notify(e.message || 'خطا در ذخیره‌سازی', 'error') }
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
            ثبت ریز عملکرد خطوط تولید (باطله، دانه‌بندی، رطوبت، تخفیف و جریمه) در بازه‌های زمانی
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> ثبت آنالیز جدید</button>
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
        <TableSkeleton columns={8} />
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
                  <th className="px-4 py-3 font-semibold">باطله اولیه</th>
                  <th className="px-4 py-3 font-semibold">باطله ٪</th>
                  <th className="px-4 py-3 font-semibold">دانه درشت ٪</th>
                  <th className="px-4 py-3 font-semibold">رطوبت ٪</th>
                  <th className="px-4 py-3 font-semibold">تخفیف ٪</th>
                  <th className="px-4 py-3 font-semibold">جریمه ٪</th>
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
                    <td className="px-4 py-3 dark:text-slate-300">{formatNumber(p.batala_avalieh)}</td>
                    <td className="px-4 py-3 dark:text-slate-300">{formatNumber(p.darsad_batale)}</td>
                    <td className="px-4 py-3 dark:text-slate-300">{formatNumber(p.darsad_dane_dorosht)}</td>
                    <td className="px-4 py-3 dark:text-slate-300">{formatNumber(p.darsad_rotobat)}</td>
                    <td className="px-4 py-3 dark:text-slate-300">{formatNumber(p.darsad_takhfif)}</td>
                    <td className="px-4 py-3 dark:text-slate-300">{formatNumber(p.darsad_jerime)}</td>
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
        <ProductionForm form={form} setForm={setForm} />
      </Modal>

      <Modal open={confirmId != null} onClose={() => setConfirmId(null)} title="حذف آنالیز"
        footer={<><button className="btn-ghost" onClick={() => setConfirmId(null)}>انصراف</button><button className="btn-danger" onClick={confirmDelete}><Trash2 className="h-4 w-4" /> حذف قطعی</button></>}>
        <p className="text-sm text-ink-700 dark:text-slate-300">آیا از حذف این آنالیز خط اطمینان دارید؟</p>
      </Modal>
    </div>
  )
}