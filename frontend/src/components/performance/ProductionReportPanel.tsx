import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'
import { TrendingUp, BarChart3, Table2, Layers, Calendar, Users, Activity } from 'lucide-react'
import type { ProductionReport } from '../../types'
import { formatDate, formatNumber } from '../../utils'

function isoWeekKey(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00Z')
  if (isNaN(d.getTime())) return iso
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNr = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - dayNr + 3)
  const jan4 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  const diff = (t.getTime() - jan4.getTime()) / 86400000
  const week = 1 + Math.round(diff / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
function monthKey(iso: string): string { return iso ? iso.slice(0, 7) : '—' }
function formatMonthLabel(mk: string): string {
  if (!mk || mk === '—' || !/^\d{4}-\d{2}$/.test(mk)) return mk
  return formatDate(mk + '-01').slice(0, 7)
}

const PALETTE = ['#0f2040', '#ea580c', '#059669', '#7c3aed', '#0284c7', '#dc2626', '#0891b2', '#65a30d']
const PIE_COLORS = ['#0f2040', '#ea580c', '#059669', '#7c3aed', '#0284c7', '#dc2626', '#0891b2', '#65a30d', '#e11d48', '#a16207']

function uniqOutputs(records: ProductionReport[]): string[] {
  return Array.from(new Set(records.flatMap(r => Object.keys(r.outputs || {})))).sort((a, b) => a.localeCompare(b, 'fa'))
}

export default function ProductionReportPanel({ records }: { records: ProductionReport[] }) {
  const [metric, setMetric] = useState('')
  const [mode, setMode] = useState<'sum' | 'avg'>('sum')

  const computed = useMemo(() => {
    const outputKeys = uniqOutputs(records)
    const sums: Record<string, number> = {}
    const avgs: Record<string, number> = {}
    const mins: Record<string, number> = {}
    const maxs: Record<string, number> = {}
    const cnts: Record<string, number> = {}
    outputKeys.forEach(k => {
      const vals = records.map(r => r.outputs?.[k]).filter(v => typeof v === 'number') as number[]
      const s = vals.reduce((a, b) => a + b, 0)
      sums[k] = s
      cnts[k] = vals.length
      avgs[k] = vals.length ? s / vals.length : 0
      mins[k] = vals.length ? Math.min(...vals) : 0
      maxs[k] = vals.length ? Math.max(...vals) : 0
    })
    const topKeys = [...outputKeys].sort((a, b) => (sums[b] ?? 0) - (sums[a] ?? 0)).slice(0, 4)

    const byLine = new Map<string, { count: number; sums: Record<string, number> }>()
    const byDate = new Map<string, { count: number; sums: Record<string, number> }>()
    const byWeek = new Map<string, { count: number; sums: Record<string, number> }>()
    const byMonth = new Map<string, { count: number; sums: Record<string, number> }>()
    const byContractor = new Map<string, { count: number; sums: Record<string, number> }>()
    for (const r of records) {
      const ln = r.line?.name || '—'
      const le = byLine.get(ln) ?? { count: 0, sums: {} }
      le.count += 1
      for (const k of outputKeys) {
        const v = r.outputs?.[k]
        if (typeof v === 'number') le.sums[k] = (le.sums[k] ?? 0) + v
      }
      byLine.set(ln, le)

      const d = r.date_from || r.date_to || ''
      const de = byDate.get(d) ?? { count: 0, sums: {} }
      de.count += 1
      for (const k of outputKeys) {
        const v = r.outputs?.[k]
        if (typeof v === 'number') de.sums[k] = (de.sums[k] ?? 0) + v
      }
      byDate.set(d, de)

      const wk = isoWeekKey(d)
      const we = byWeek.get(wk) ?? { count: 0, sums: {} }
      we.count += 1
      for (const k of outputKeys) {
        const v = r.outputs?.[k]
        if (typeof v === 'number') we.sums[k] = (we.sums[k] ?? 0) + v
      }
      byWeek.set(wk, we)

      const mk = monthKey(d)
      const me = byMonth.get(mk) ?? { count: 0, sums: {} }
      me.count += 1
      for (const k of outputKeys) {
        const v = r.outputs?.[k]
        if (typeof v === 'number') me.sums[k] = (me.sums[k] ?? 0) + v
      }
      byMonth.set(mk, me)

      const ck = r.contractor?.name || 'بدون پیمانکار'
      const ce = byContractor.get(ck) ?? { count: 0, sums: {} }
      ce.count += 1
      for (const k of outputKeys) {
        const v = r.outputs?.[k]
        if (typeof v === 'number') ce.sums[k] = (ce.sums[k] ?? 0) + v
      }
      byContractor.set(ck, ce)
    }

    return { outputKeys, sums, avgs, mins, maxs, cnts, topKeys, byLine, byDate, byWeek, byMonth, byContractor }
  }, [records])

  const metricKey = metric || computed.topKeys[0] || computed.outputKeys[0] || ''

  const barData = useMemo(() => {
    return [...computed.byLine.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fa')).map(([name, v]) => ({
      name: name.length > 14 ? name.slice(0, 14) + '…' : name,
      fullName: name,
      value: mode === 'sum' ? (v.sums[metricKey] ?? 0) : v.count ? (v.sums[metricKey] ?? 0) / v.count : 0,
    }))
  }, [computed.byLine, metricKey, mode])

  const lineData = useMemo(() => {
    const sorted = [...computed.byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    const use = sorted.length > 28 ? (() => {
      const step = Math.ceil(sorted.length / 28)
      const p: typeof sorted = []
      for (let i = 0; i < sorted.length; i += step) p.push(sorted[i])
      return p
    })() : sorted
    return use.map(([d, v]) => ({
      date: formatDate(d).slice(5),
      fullDate: formatDate(d),
      value: v.sums[metricKey] ?? 0,
      count: v.count,
    }))
  }, [computed.byDate, metricKey])

  const weekData = useMemo(() => {
    return [...computed.byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({
      name: k,
      value: v.sums[metricKey] ?? 0,
      count: v.count,
    }))
  }, [computed.byWeek, metricKey])

  const monthData = useMemo(() => {
    return [...computed.byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({
      name: formatMonthLabel(k),
      fullKey: k,
      value: v.sums[metricKey] ?? 0,
      count: v.count,
    }))
  }, [computed.byMonth, metricKey])

  const contractorPie = useMemo(() => {
    return [...computed.byContractor.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([name, v]) => ({ name: name.length > 16 ? name.slice(0, 16) + '…' : name, fullName: name, value: v.count }))
  }, [computed.byContractor])

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
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 font-bold text-white dark:bg-white dark:text-slate-900"><Activity className="h-3.5 w-3.5" />{formatNumber(records.length)} رکورد</span>
        <span className="text-slate-400">{computed.outputKeys.length} ستون خروجی · {computed.byLine.size} خط · {computed.byContractor.size} پیمانکار</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div className="card p-4">
          <div className="text-xs text-ink-500 dark:text-slate-400">تعداد رکورد</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">{formatNumber(records.length)}</div>
          <div className="text-[11px] text-ink-400">{computed.byLine.size} خط · {computed.byDate.size} روز</div>
        </div>
        {computed.topKeys.slice(0, 3).map(k => (
          <div key={k} className="card p-4">
            <div className="text-xs text-ink-500 dark:text-slate-400">مجموع {k}</div>
            <div className="mt-1 text-xl font-extrabold text-ink-900 dark:text-white">{formatNumber(Math.round(computed.sums[k] * 10) / 10)}</div>
            <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-ink-400">
              <span>میانگین {formatNumber(Math.round(computed.avgs[k] * 10) / 10)}</span>
              <span className="hidden sm:inline">· کمینه {formatNumber(Math.round(computed.mins[k] * 10) / 10)}</span>
              <span>بیشینه {formatNumber(Math.round(computed.maxs[k] * 10) / 10)}</span>
            </div>
          </div>
        ))}
        {computed.topKeys.length === 0 && (
          <div className="card p-4">
            <div className="text-xs text-ink-500">خروجی</div>
            <div className="mt-1 text-xl font-extrabold">—</div>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 text-sm font-bold text-ink-700 dark:border-slate-700 dark:text-slate-200">
          <Table2 className="h-4 w-4 text-brand-600" /> آمار کلی هر پارامتر
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                <th className="px-4 py-3 font-semibold text-right">پارامتر</th>
                <th className="px-4 py-3 font-semibold">تعداد مقدار</th>
                <th className="px-4 py-3 font-semibold">جمع کل</th>
                <th className="px-4 py-3 font-semibold">میانگین</th>
                <th className="px-4 py-3 font-semibold">کمینه</th>
                <th className="px-4 py-3 font-semibold">بیشینه</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
              {computed.outputKeys.map(k => (
                <tr key={k} className="transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">{k}</td>
                  <td className="px-4 py-3 text-ink-600 dark:text-slate-400">{formatNumber(computed.cnts[k] ?? 0)}</td>
                  <td className="px-4 py-3 font-semibold text-ink-800 dark:text-slate-100">{formatNumber(Math.round(computed.sums[k] * 10) / 10)}</td>
                  <td className="px-4 py-3 text-emerald-700 dark:text-emerald-400">{formatNumber(Math.round(computed.avgs[k] * 10) / 10)}</td>
                  <td className="px-4 py-3 text-ink-500">{formatNumber(Math.round(computed.mins[k] * 10) / 10)}</td>
                  <td className="px-4 py-3 text-ink-500">{formatNumber(Math.round(computed.maxs[k] * 10) / 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[160px] flex-1">
          <label className="label">سنجه نمودارها</label>
          <select className="input" value={metricKey} onChange={e => setMetric(e.target.value)}>
            {computed.outputKeys.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-1">
          <button className={mode === 'sum' ? 'btn-primary !h-10 !px-4' : 'btn-ghost !h-10 !px-4'} onClick={() => setMode('sum')}><BarChart3 className="h-4 w-4" /> جمع</button>
          <button className={mode === 'avg' ? 'btn-primary !h-10 !px-4' : 'btn-ghost !h-10 !px-4'} onClick={() => setMode('avg')}><TrendingUp className="h-4 w-4" /> میانگین</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-700 dark:text-slate-200"><BarChart3 className="h-4 w-4 text-brand-600" />{mode === 'sum' ? 'مجموع' : 'میانگین'} «{metricKey}» به تفکیک خط</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.25} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={barData.length > 6 ? -22 : 0} height={barData.length > 6 ? 44 : 24} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ direction: 'rtl', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: number) => [formatNumber(Math.round(v * 10) / 10), metricKey]} labelFormatter={(_: unknown, p: any) => p?.[0]?.payload?.fullName ?? ''} />
              <Bar dataKey="value" name={metricKey} fill={mode === 'sum' ? '#0f2040' : '#059669'} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-700 dark:text-slate-200"><TrendingUp className="h-4 w-4 text-brand-600" />روند {mode === 'sum' ? 'مجموع' : ''} «{metricKey}» — روزانه</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={lineData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.25} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ direction: 'rtl', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} labelFormatter={(_: unknown, p: any) => p?.[0]?.payload?.fullDate ?? ''} />
              <Line type="monotone" dataKey="value" name={metricKey} stroke="#ea580c" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {weekData.length > 1 && (
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-700 dark:text-slate-200"><Calendar className="h-4 w-4 text-brand-600" />روند هفتگی «{metricKey}» — جمع هر هفته</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.25} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ direction: 'rtl', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="value" name={`${metricKey} جمع هفتگی`} fill="#7c3aed" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {monthData.length > 1 && (
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-700 dark:text-slate-200"><Calendar className="h-4 w-4 text-brand-600" />روند ماهانه «{metricKey}» — جمع هر ماه</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.25} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ direction: 'rtl', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="value" name={`${metricKey} جمع ماهانه`} fill="#0284c7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {contractorPie.length > 1 && (
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-700 dark:text-slate-200"><Users className="h-4 w-4 text-brand-600" />سهم پیمانکاران</div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={contractorPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={88} paddingAngle={2}>
                  {contractorPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ direction: 'rtl', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="overflow-hidden rounded-xl border border-ink-100 dark:border-slate-700">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60">
                      <th className="px-3 py-2 font-semibold">پیمانکار</th>
                      <th className="px-3 py-2 font-semibold">تعداد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                    {contractorPie.map(c => (
                      <tr key={c.fullName} className="hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                        <td className="px-3 py-2 text-ink-700 dark:text-slate-200">{c.fullName}</td>
                        <td className="px-3 py-2 dark:text-slate-300">{formatNumber(c.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 text-sm font-bold text-ink-700 dark:border-slate-700 dark:text-slate-200">
          <Table2 className="h-4 w-4 text-brand-600" /> خلاصه به تفکیک خط — جمع و میانگین هر پارامتر
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                <th className="px-4 py-3 font-semibold">خط تولید</th>
                <th className="px-4 py-3 font-semibold">تعداد</th>
                {computed.outputKeys.map(k => (
                  <th key={k} className="whitespace-nowrap px-4 py-3 font-semibold">{k} (جمع / میانگین)</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
              {[...computed.byLine.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fa')).map(([name, v]) => (
                <tr key={name} className="transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">{name}</td>
                  <td className="px-4 py-3 dark:text-slate-300">{formatNumber(v.count)}</td>
                  {computed.outputKeys.map(k => (
                    <td key={k} className="px-4 py-3 text-ink-600 dark:text-slate-400">
                      {formatNumber(Math.round((v.sums[k] ?? 0) * 10) / 10)} / <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatNumber(Math.round(avgOf(v.sums[k], v.count) * 10) / 10)}</span>
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-ink-50/80 font-bold dark:bg-slate-800/80">
                <td className="px-4 py-3 text-ink-800 dark:text-slate-100">جمع کل</td>
                <td className="px-4 py-3 dark:text-slate-200">{formatNumber(records.length)}</td>
                {computed.outputKeys.map(k => (
                  <td key={k} className="px-4 py-3 dark:text-slate-300">
                    {formatNumber(Math.round(computed.sums[k] * 10) / 10)} / <span className="text-emerald-700 dark:text-emerald-400">{formatNumber(Math.round(computed.avgs[k] * 10) / 10)}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 text-sm font-bold text-ink-700 dark:border-slate-700 dark:text-slate-200">
            <Calendar className="h-4 w-4 text-brand-600" /> روزانه — جمع و میانگین
          </div>
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-ink-50/90 backdrop-blur dark:bg-slate-800/90">
                <tr className="border-b border-ink-100 text-right text-xs text-ink-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="px-3 py-2 font-semibold">تاریخ</th>
                  <th className="px-3 py-2 font-semibold">تعداد</th>
                  {computed.outputKeys.slice(0, 4).map(k => <th key={k} className="whitespace-nowrap px-3 py-2 font-semibold">{k} جمع/میانگین</th>)}
                  {computed.outputKeys.length > 4 && <th className="px-3 py-2 font-semibold">…</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                {[...computed.byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, v]) => (
                  <tr key={d} className="hover:bg-ink-50/40 dark:hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-ink-700 dark:text-slate-200">{formatDate(d)}</td>
                    <td className="px-3 py-2 dark:text-slate-300">{formatNumber(v.count)}</td>
                    {computed.outputKeys.slice(0, 4).map(k => (
                      <td key={k} className="whitespace-nowrap px-3 py-2 text-xs text-ink-600 dark:text-slate-400">
                        {formatNumber(Math.round((v.sums[k] ?? 0) * 10) / 10)} / {formatNumber(Math.round(avgOf(v.sums[k], v.count) * 10) / 10)}
                      </td>
                    ))}
                    {computed.outputKeys.length > 4 && <td className="px-3 py-2 text-xs text-ink-400">+{computed.outputKeys.length - 4}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 text-sm font-bold text-ink-700 dark:border-slate-700 dark:text-slate-200">
            <Layers className="h-4 w-4 text-brand-600" /> هفتگی / ماهانه — جمع و میانگین
          </div>
          <div className="grid grid-cols-1 gap-3 p-3">
            <div className="overflow-hidden rounded-xl border border-ink-100 dark:border-slate-700">
              <div className="bg-ink-50/60 px-3 py-2 text-xs font-bold text-ink-600 dark:bg-slate-800/60 dark:text-slate-300">هفتگی</div>
              <div className="max-h-[160px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900">
                    <tr className="border-b border-ink-100 text-right text-ink-500 dark:border-slate-700">
                      <th className="px-2 py-1.5 font-semibold">هفته</th>
                      <th className="px-2 py-1.5 font-semibold">تعداد</th>
                      {computed.outputKeys.slice(0, 2).map(k => <th key={k} className="px-2 py-1.5 font-semibold">{k}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                    {[...computed.byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 12).map(([wk, v]) => (
                      <tr key={wk} className="hover:bg-ink-50/40">
                        <td className="px-2 py-1.5 font-medium dark:text-slate-200">{wk}</td>
                        <td className="px-2 py-1.5 dark:text-slate-300">{formatNumber(v.count)}</td>
                        {computed.outputKeys.slice(0, 2).map(k => (
                          <td key={k} className="px-2 py-1.5 dark:text-slate-400">{formatNumber(Math.round((v.sums[k] ?? 0) * 10) / 10)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-ink-100 dark:border-slate-700">
              <div className="bg-ink-50/60 px-3 py-2 text-xs font-bold text-ink-600 dark:bg-slate-800/60 dark:text-slate-300">ماهانه</div>
              <div className="max-h-[160px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900">
                    <tr className="border-b border-ink-100 text-right text-ink-500 dark:border-slate-700">
                      <th className="px-2 py-1.5 font-semibold">ماه</th>
                      <th className="px-2 py-1.5 font-semibold">تعداد</th>
                      {computed.outputKeys.slice(0, 2).map(k => <th key={k} className="px-2 py-1.5 font-semibold">{k}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                    {[...computed.byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mk, v]) => (
                      <tr key={mk} className="hover:bg-ink-50/40">
                        <td className="px-2 py-1.5 font-medium dark:text-slate-200">{formatMonthLabel(mk)}</td>
                        <td className="px-2 py-1.5 dark:text-slate-300">{formatNumber(v.count)}</td>
                        {computed.outputKeys.slice(0, 2).map(k => (
                          <td key={k} className="px-2 py-1.5 dark:text-slate-400">{formatNumber(Math.round((v.sums[k] ?? 0) * 10) / 10)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 text-sm font-bold text-ink-700 dark:border-slate-700 dark:text-slate-200">
          <Users className="h-4 w-4 text-brand-600" /> به تفکیک پیمانکار — جمع و میانگین
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                <th className="px-4 py-3 font-semibold">پیمانکار</th>
                <th className="px-4 py-3 font-semibold">تعداد</th>
                {computed.outputKeys.map(k => <th key={k} className="whitespace-nowrap px-4 py-3 font-semibold">{k} (جمع / میانگین)</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
              {[...computed.byContractor.entries()].sort((a, b) => b[1].count - a[1].count).map(([name, v]) => (
                <tr key={name} className="hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">{name}</td>
                  <td className="px-4 py-3 dark:text-slate-300">{formatNumber(v.count)}</td>
                  {computed.outputKeys.map(k => (
                    <td key={k} className="px-4 py-3 text-ink-600 dark:text-slate-400">
                      {formatNumber(Math.round((v.sums[k] ?? 0) * 10) / 10)} / <span className="font-semibold text-emerald-600">{formatNumber(Math.round(avgOf(v.sums[k], v.count) * 10) / 10)}</span>
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
