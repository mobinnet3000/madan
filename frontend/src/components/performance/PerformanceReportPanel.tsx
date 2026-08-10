import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts'
import { TrendingUp, BarChart3, Table2 } from 'lucide-react'
import type { ActualAnalysis } from '../../types'
import { formatDate, formatNumber } from '../../utils'

interface ReportData {
  outputKeys: string[]
  byLine: Map<number, { name: string; count: number; sums: Record<string, number> }>
  daily: Map<string, Record<string, number>>
}

function computeReport(records: ActualAnalysis[]): ReportData {
  const outputKeys = Array.from(
    new Set(records.flatMap((r) => Object.keys(r.outputs || {}))),
  ).sort()
  const byLine = new Map<number, { name: string; count: number; sums: Record<string, number> }>()
  const daily = new Map<string, Record<string, number>>()

  for (const r of records) {
    const entry = byLine.get(r.line.id) ?? { name: r.line.name, count: 0, sums: {} as Record<string, number> }
    entry.count += 1
    for (const [k, v] of Object.entries(r.outputs || {})) {
      if (typeof v === 'number') entry.sums[k] = (entry.sums[k] ?? 0) + v
    }
    byLine.set(r.line.id, entry)

    const day = daily.get(r.date_from) ?? {}
    for (const [k, v] of Object.entries(r.outputs || {})) {
      if (typeof v === 'number') day[k] = (day[k] ?? 0) + v
    }
    daily.set(r.date_from, day)
  }

  const sortDaily = new Map(
    [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  )
  return { outputKeys, byLine, daily: sortDaily }
}

const CHART_COLORS = ['#f97316', '#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6', '#64748b']

export default function PerformanceReportPanel({ records }: { records: ActualAnalysis[] }) {
  const [metric, setMetric] = useState('')
  const [mode, setMode] = useState<'sum' | 'avg'>('sum')

  const report = useMemo(() => computeReport(records), [records])
  const metricKey = metric || report.outputKeys[0] || ''

  const barData = useMemo(
    () =>
      [...report.byLine.values()].map((l) => ({
        name: l.name,
        value:
          mode === 'sum'
            ? l.sums[metricKey] ?? 0
            : l.count
              ? (l.sums[metricKey] ?? 0) / l.count
              : 0,
      })),
    [report, metricKey, mode],
  )

  const lineData = useMemo(
    () =>
      [...report.daily.entries()].map(([d, sums]) => ({
        date: formatDate(d),
        value: sums[metricKey] ?? 0,
      })),
    [report, metricKey],
  )

  if (records.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-ink-500 dark:text-slate-400">
        برای بازه/فیلتر جاری رکوردی موجود نیست.
      </div>
    )
  }

  const avgOf = (sum: number | undefined, count: number) => (count ? (sum ?? 0) / count : 0)

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div className="card p-4">
          <div className="text-xs text-ink-500 dark:text-slate-400">تعداد ثبت عملکرد</div>
          <div className="mt-1 text-2xl font-extrabold text-brand-600">{formatNumber(records.length)}</div>
        </div>
        {report.outputKeys.slice(0, 3).map((k) => {
          let sum = 0
          for (const l of report.byLine.values()) sum += l.sums[k] ?? 0
          const count = records.length
          return (
            <div key={k} className="card p-4">
              <div className="text-xs text-ink-500 dark:text-slate-400">مجموع {k}</div>
              <div className="mt-1 text-xl font-extrabold text-ink-800 dark:text-slate-100">{formatNumber(sum)}</div>
              <div className="mt-0.5 text-[11px] text-ink-400">میانگین: {formatNumber(avgOf(sum, count))}</div>
            </div>
          )
        })}
      </div>

      {/* Chart controls */}
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[160px] flex-1">
          <label className="label">سنجه (خروجی)</label>
          <select className="input" value={metricKey} onChange={(e) => setMetric(e.target.value)}>
            {report.outputKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-1">
          <button
            className={mode === 'sum' ? 'btn-primary !h-10 !px-4' : 'btn-ghost !h-10 !px-4'}
            onClick={() => setMode('sum')}
          >
            <BarChart3 className="h-4 w-4" /> جمع
          </button>
          <button
            className={mode === 'avg' ? 'btn-primary !h-10 !px-4' : 'btn-ghost !h-10 !px-4'}
            onClick={() => setMode('avg')}
          >
            <TrendingUp className="h-4 w-4" /> میانگین
          </button>
        </div>
      </div>

      {barData.length > 0 && (
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-700 dark:text-slate-200">
            <BarChart3 className="h-4 w-4 text-brand-600" />
            {mode === 'sum' ? 'مجموع' : 'میانگین'} «{metricKey}» به تفکیک خط تولید
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.25} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  direction: 'rtl',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                }}
              />
              <Legend />
              <Bar dataKey="value" name={metricKey} fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {lineData.length > 0 && (
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-700 dark:text-slate-200">
            <TrendingUp className="h-4 w-4 text-brand-600" />
            روند روزانه «{metricKey}» (مجموع)
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={lineData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.25} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  direction: 'rtl',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="value" name={metricKey} stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-line summary table */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 text-sm font-bold text-ink-700 dark:border-slate-700 dark:text-slate-200">
          <Table2 className="h-4 w-4 text-brand-600" /> خلاصه به تفکیک خط
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                <th className="px-4 py-3 font-semibold">خط تولید</th>
                <th className="px-4 py-3 font-semibold">تعداد</th>
                {report.outputKeys.map((k) => (
                  <th key={k} className="px-4 py-3 font-semibold">
                    {k} (مجموع / میانگین)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
              {[...report.byLine.values()].map((l) => (
                <tr key={l.name} className="transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">{l.name}</td>
                  <td className="px-4 py-3 dark:text-slate-300">{formatNumber(l.count)}</td>
                  {report.outputKeys.map((k) => (
                    <td key={k} className="px-4 py-3 text-ink-600 dark:text-slate-400">
                      {formatNumber(l.sums[k] ?? 0)} / {formatNumber(avgOf(l.sums[k], l.count))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}