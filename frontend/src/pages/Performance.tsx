import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Filter, X, Gauge, BarChart3, ListChecks, RefreshCw } from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { useToast } from '../components/ui/Toast'
import { getActualAnalyses, fetchAllActualAnalyses, deleteActualAnalysis } from '../api/actual'
import type { ActualAnalysis, ActualAnalysisFilters } from '../types'
import { ErrorBanner, EmptyState, TableSkeleton } from '../components/ui/States'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import DynamicAnalysisForm from '../components/performance/DynamicAnalysisForm'
import PerformanceReportPanel from '../components/performance/PerformanceReportPanel'
import { formatDate, formatNumber, todayISO } from '../utils'
import JalaliDateInput from '../components/ui/JalaliDateInput'

export default function Performance() {
  const { selectedFactory } = useFactory()
  const { notify } = useToast()

  const [tab, setTab] = useState<'list' | 'report'>('list')
  const [filters, setFilters] = useState<ActualAnalysisFilters>({})
  const [records, setRecords] = useState<ActualAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(30)
  const [total, setTotal] = useState(0)

  const [reportRecords, setReportRecords] = useState<ActualAnalysis[]>([])
  const [loadingReport, setLoadingReport] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ActualAnalysis | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  const lineIds = useMemo(() => (selectedFactory?.lines ?? []).map((l) => l.id), [selectedFactory])

  const loadList = useCallback(() => {
    setLoading(true)
    const merged: Record<string, unknown> = { ...filters }
    if (lineIds.length) merged.lines = lineIds.join(',')
    getActualAnalyses(merged as ActualAnalysisFilters, page, pageSize)
      .then((d) => {
        setRecords(d.results)
        setTotal(d.count)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filters, page, pageSize, lineIds])

  const loadReport = useCallback(() => {
    setLoadingReport(true)
    const merged: Record<string, unknown> = { ...filters }
    if (lineIds.length) merged.lines = lineIds.join(',')
    fetchAllActualAnalyses(merged as unknown as ActualAnalysisFilters, 500)
      .then(setReportRecords)
      .catch((e) => notify(e.message || 'خطا در دریافت داده گزارش', 'error'))
      .finally(() => setLoadingReport(false))
  }, [filters, lineIds, notify])

  useEffect(() => {
    if (selectedFactory) loadList()
  }, [selectedFactory, loadList])

  useEffect(() => {
    if (tab === 'report' && selectedFactory) loadReport()
  }, [tab, selectedFactory, loadReport])

  const onSaved = () => {
    loadList()
    if (tab === 'report') loadReport()
  }

  const setFilter = (k: keyof ActualAnalysisFilters, v: string) => {
    setPage(1)
    setFilters((prev) => ({ ...prev, [k]: v === '' ? undefined : (v as any) }))
  }

  const confirmDelete = async () => {
    if (confirmId == null) return
    try {
      await deleteActualAnalysis(confirmId)
      notify('عملکرد حذف شد')
      setConfirmId(null)
      loadList()
    } catch (e: any) {
      notify(e.message || 'خطا در حذف', 'error')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-ink-900 dark:text-slate-100">
            <Gauge className="h-6 w-6 text-brand-600" /> عملکرد بخش تولید
          </h1>
          <p className="text-sm text-ink-500">
            ثبت عملکرد آنالیزهای خطوط تولید، مشاهده و گزارش‌گیری (جمع/میانگین/نمودار)
          </p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setModalOpen(true) }}>
          <Plus className="h-4 w-4" /> ثبت عملکرد جدید
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadList} />}

      {/* فیلترها */}
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-600 dark:text-slate-300">
          <Filter className="h-4 w-4" /> فیلترها
        </div>
        <div className="min-w-[150px] flex-1">
          <label className="label">خط تولید</label>
          <select className="input" value={filters.line ?? ''} onChange={(e) => setFilter('line', e.target.value)}>
            <option value="">همه خطوط</option>
            {selectedFactory?.lines.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="label">پیمانکار</label>
          <select className="input" value={filters.contractor ?? ''} onChange={(e) => setFilter('contractor', e.target.value)}>
            <option value="">همه پیمانکاران</option>
            {selectedFactory?.contractors.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[130px]">
          <label className="label">از تاریخ</label>
          <JalaliDateInput value={filters.date_from ?? ''} onChange={(iso) => setFilter('date_from', iso)} />
        </div>
        <div className="min-w-[130px]">
          <label className="label">تا تاریخ</label>
          <JalaliDateInput value={filters.date_to ?? ''} onChange={(iso) => setFilter('date_to', iso)} />
        </div>
        <button className="btn-ghost" onClick={() => { setFilters({}); setPage(1) }}>
          <X className="h-4 w-4" /> پاک کردن
        </button>
      </div>

      {/* تب‌ها */}
      <div className="flex gap-1 rounded-xl bg-ink-100/60 p-1 dark:bg-slate-800">
        <button
          onClick={() => setTab('list')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'list' ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-brand-400' : 'text-ink-500 dark:text-slate-400'}`}
        >
          <ListChecks className="h-4 w-4" /> عملکردهای ثبت‌شده
        </button>
        <button
          onClick={() => setTab('report')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === 'report' ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-brand-400' : 'text-ink-500 dark:text-slate-400'}`}
        >
          <BarChart3 className="h-4 w-4" /> گزارش و نمودار
        </button>
      </div>

      {tab === 'list' && (
        <>
          <div className="flex items-center justify-end">
            <span className="text-xs text-ink-400">تعداد رکوردها: {formatNumber(total)}</span>
          </div>
          {loading ? (
            <TableSkeleton columns={7} />
          ) : records.length === 0 ? (
            <EmptyState
              icon={<Gauge className="h-10 w-10" />}
              title="عملکردی یافت نشد"
              description="با فیلترهای فعلی رکوردی وجود ندارد یا هنوز عملکردی ثبت نشده است."
              action={<button className="btn-primary mt-2" onClick={() => { setEditing(null); setModalOpen(true) }}><Plus className="h-4 w-4" /> ثبت اولین عملکرد</button>}
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
                      <th className="px-4 py-3 font-semibold">خروجی‌ها</th>
                      <th className="px-4 py-3 font-semibold text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                    {records.map((r) => (
                      <tr key={r.id} className="transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">
                          <div>{formatDate(r.date_from)} تا {formatDate(r.date_to)}</div>
                          {r.date_from === r.date_to && (
                            <div className="text-[11px] text-ink-400">{formatDate(r.date_to)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 dark:text-slate-300">{r.line.name}</td>
                        <td className="px-4 py-3 text-ink-600 dark:text-slate-400">{r.contractor?.name ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex max-w-[360px] flex-wrap gap-1">
                            {Object.entries(r.outputs || {}).map(([k, v]) => (
                              <span key={k} className="chip">
                                {k}: <span className="font-semibold text-brand-600">{formatNumber(v)}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-slate-800"
                              title="ویرایش"
                              onClick={() => { setEditing(r); setModalOpen(true) }}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                              title="حذف"
                              onClick={() => setConfirmId(r.id)}
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
              <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 dark:border-slate-700">
                <span className="text-xs text-ink-400">
                  نمایش {Math.min((page - 1) * pageSize + 1, total)} تا {Math.min(page * pageSize, total)} از {total} رکورد
                </span>
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => { setPage(p); loadList() }} />
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'report' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-500 dark:text-slate-400">
              گزارش بر اساس فیلترهای بالا — نرخ: {formatDate(filters.date_from || todayISO())} تا {formatDate(filters.date_to || todayISO())}
            </span>
            <button className="btn-ghost !h-9 !px-3" onClick={loadReport} title="بارگذاری مجدد">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          {loadingReport ? (
            <TableSkeleton columns={4} />
          ) : (
            <PerformanceReportPanel records={reportRecords} />
          )}
        </div>
      )}

      <DynamicAnalysisForm
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
      />

      <Modal open={confirmId != null} onClose={() => setConfirmId(null)} title="حذف عملکرد"
        footer={<>
          <button className="btn-ghost" onClick={() => setConfirmId(null)}>انصراف</button>
          <button className="btn-danger" onClick={confirmDelete}><Trash2 className="h-4 w-4" /> حذف قطعی</button>
        </>}>
        <p className="text-sm text-ink-700 dark:text-slate-300">آیا از حذف این رکورد عملکرد اطمینان دارید؟ این عمل قابل بازگشت نیست.</p>
      </Modal>
    </div>
  )
}