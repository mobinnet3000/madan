import { useEffect, useState } from 'react'
import { History, Trash2, Download, Search, X, Filter, Calendar, FileJson, FileSpreadsheet, FileText, Globe } from 'lucide-react'
import { getReportHistory, removeReportHistoryEntry, clearReportHistory, REPORT_HISTORY_EVENT, type ReportHistoryEntry } from '../../features/reportHistory'
import { formatNumber } from '../../utils'

const FORMAT_ICON: Record<string, any> = {
  pdf: FileText,
  xlsx: FileSpreadsheet,
  csv: FileJson,
  docx: FileText,
  html: Globe,
  json: FileJson,
}
const FORMAT_COLOR: Record<string, string> = {
  pdf: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-300',
  xlsx: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
  csv: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
  docx: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
  html: 'text-sky-600 bg-sky-50 dark:bg-sky-950/30',
  json: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30',
}

export default function ReportHistoryPanel() {
  const [entries, setEntries] = useState<ReportHistoryEntry[]>(() => getReportHistory())
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<string>('')

  useEffect(() => {
    const on = () => setEntries(getReportHistory())
    window.addEventListener(REPORT_HISTORY_EVENT, on)
    window.addEventListener('storage', on)
    return () => { window.removeEventListener(REPORT_HISTORY_EVENT, on); window.removeEventListener('storage', on) }
  }, [])

  const filtered = entries.filter(e => {
    if (kind && e.kind !== kind) return false
    if (!q.trim()) return true
    const t = q.trim().toLowerCase()
    return [e.title, e.fileName, e.factoryName, e.kindLabel, e.format, e.chips.map(c => c.value).join(' ')].join(' ').toLowerCase().includes(t)
  })

  const kinds = Array.from(new Set(entries.map(e => e.kind)))

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900"><History className="h-4 w-4" /></div>
            <div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">سابقه گزارش‌ها</div>
              <div className="text-xs text-slate-500">هر خروجی که با هر پسوند و هر بازه‌ای گرفتی اینجا می‌ماند — تا گم نشود.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold text-white dark:bg-white dark:text-slate-900">{formatNumber(entries.length)} مورد</span>
            {entries.length > 0 && <button className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300" onClick={() => { if (confirm('همه سابقه پاک شود؟')) clearReportHistory() }}><Trash2 className="h-3.5 w-3.5" /> پاک کردن همه</button>}
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-[180px] flex-1 max-w-[420px]">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input !h-9 !rounded-xl !py-0 pr-9 text-sm" placeholder="جستجو عنوان، فایل، کارخانه..." value={q} onChange={e => setQ(e.target.value)} />
            {q && <button onClick={() => setQ('')} className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <select className="input !h-9 !w-[180px] !rounded-xl !py-0 text-sm" value={kind} onChange={e => setKind(e.target.value)}>
            <option value="">همه انواع</option>
            {kinds.map(k => {
              const label = entries.find(x => x.kind === k)?.kindLabel || k
              return <option key={k} value={k}>{label}</option>
            })}
          </select>
          {(q || kind) && <button className="btn-ghost !h-9 !px-3 text-xs" onClick={() => { setQ(''); setKind('') }}><X className="h-3.5 w-3.5" /> پاک کردن</button>}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <History className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <div className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">سابقه‌ای ثبت نشده</div>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">هنوز گزارشی نگرفتی یا با فیلتر فعلی چیزی نیست. هر خروجی (PDF/Excel/CSV/...) با هر بازه‌ای که بگیری، خودکار اینجا ذخیره می‌شود.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-right text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                    <th className="whitespace-nowrap px-4 py-3">زمان</th>
                    <th className="px-4 py-3">نوع گزارش</th>
                    <th className="px-4 py-3">کارخانه</th>
                    <th className="px-4 py-3">فایل</th>
                    <th className="whitespace-nowrap px-4 py-3">فرمت</th>
                    <th className="whitespace-nowrap px-4 py-3">تعداد</th>
                    <th className="px-4 py-3">فیلترها</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map(e => {
                    const Icon = FORMAT_ICON[e.format] || FileText
                    return (
                      <tr key={e.id} className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="text-xs font-medium text-slate-800 dark:text-slate-200">{e.createdAtJalali}</div>
                          <div className="text-[11px] text-slate-400" dir="ltr">{new Date(e.createdAt).toLocaleString('en-CA').slice(0, 19).replace(',', '')}</div>
                        </td>
                        <td className="px-4 py-3"><span className="badge bg-slate-900 text-white dark:bg-white dark:text-slate-900">{e.kindLabel}</span><div className="mt-1 max-w-[220px] truncate text-[11px] text-slate-500" title={e.title}>{e.title}</div></td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-300">{e.factoryName}</td>
                        <td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400" title={e.fileName} dir="ltr">{e.fileName}</td>
                        <td className="whitespace-nowrap px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${FORMAT_COLOR[e.format] || 'bg-slate-100 text-slate-600'}`}><Icon className="h-3 w-3" />{e.format.toUpperCase()}</span></td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">{formatNumber(e.recordCount)}</td>
                        <td className="px-4 py-3">
                          <div className="flex max-w-[260px] flex-wrap gap-1">
                            {e.chips.length ? e.chips.map((c, i) => <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{c.label}: {c.value}</span>) : <span className="text-xs text-slate-400">—</span>}
                            {(e.dateFrom || e.dateTo) && <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-900"><Calendar className="h-3 w-3" />{e.dateFrom || '—'} تا {e.dateTo || '—'}</span>}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center"><button className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => removeReportHistoryEntry(e.id)} title="حذف از سابقه"><Trash2 className="h-4 w-4" /></button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="text-xs text-slate-400">نمایش {formatNumber(filtered.length)} از {formatNumber(entries.length)} — سابقه فقط در همین مرورگر (localStorage) نگه‌داری می‌شود.</div>
        </div>
      )}
    </div>
  )
}
