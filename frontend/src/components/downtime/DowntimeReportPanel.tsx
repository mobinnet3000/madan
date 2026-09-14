import { useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import { TrendingUp, BarChart3, Table2, Calendar, Activity, Clock, Gauge, Wrench, Layers } from 'lucide-react'
import type { DeviceLog } from '../../types'
import { formatDate, formatNumber, formatHours } from '../../utils'

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

const PIE_COLORS = ['#dc2626', '#0f2040', '#059669', '#7c3aed', '#0284c7', '#ea580c', '#0891b2', '#65a30d', '#e11d48', '#a16207']

export default function DowntimeReportPanel({ records }: { records: DeviceLog[] }) {
  const computed = useMemo(() => {
    const count = records.length
    const totalDown = records.reduce((s, r) => s + (r.downtime_hours || 0), 0)
    const totalRun = records.reduce((s, r) => s + (r.runtime_hours || 0), 0)
    const effs = records.filter(r => r.efficiency != null).map(r => r.efficiency as number)
    const avgEff = effs.length ? effs.reduce((a, b) => a + b, 0) / effs.length : null
    const minDown = count ? Math.min(...records.map(r => r.downtime_hours || 0)) : 0
    const maxDown = count ? Math.max(...records.map(r => r.downtime_hours || 0)) : 0
    const minRun = count ? Math.min(...records.map(r => r.runtime_hours || 0)) : 0
    const maxRun = count ? Math.max(...records.map(r => r.runtime_hours || 0)) : 0
    const minEff = effs.length ? Math.min(...effs) : 0
    const maxEff = effs.length ? Math.max(...effs) : 0

    const byLine = new Map<string, { count: number; sumDown: number; sumRun: number; effs: number[] }>()
    const byDate = new Map<string, { count: number; sumDown: number; sumRun: number }>()
    const byWeek = new Map<string, { count: number; sumDown: number }>()
    const byMonth = new Map<string, { count: number; sumDown: number }>()
    const byDevice = new Map<string, { count: number; sumDown: number }>()
    const byCause = new Map<string, { count: number; sumDown: number }>()
    const byShift = new Map<string, { count: number; sumDown: number; sumRun: number }>()

    for (const r of records) {
      const ln = r.line?.name || '—'
      const le = byLine.get(ln) ?? { count: 0, sumDown: 0, sumRun: 0, effs: [] as number[] }
      le.count += 1; le.sumDown += r.downtime_hours || 0; le.sumRun += r.runtime_hours || 0
      if (r.efficiency != null) le.effs.push(r.efficiency as number)
      byLine.set(ln, le)

      const d = r.date || ''
      const de = byDate.get(d) ?? { count: 0, sumDown: 0, sumRun: 0 }
      de.count += 1; de.sumDown += r.downtime_hours || 0; de.sumRun += r.runtime_hours || 0
      byDate.set(d, de)

      const wk = isoWeekKey(d)
      const we = byWeek.get(wk) ?? { count: 0, sumDown: 0 }
      we.count += 1; we.sumDown += r.downtime_hours || 0
      byWeek.set(wk, we)

      const mk = monthKey(d)
      const me = byMonth.get(mk) ?? { count: 0, sumDown: 0 }
      me.count += 1; me.sumDown += r.downtime_hours || 0
      byMonth.set(mk, me)

      const dev = (r.device?.name || '—').trim() || '—'
      const dve = byDevice.get(dev) ?? { count: 0, sumDown: 0 }
      dve.count += 1; dve.sumDown += r.downtime_hours || 0
      byDevice.set(dev, dve)

      const cs = (r.failure_cause?.title || 'نامشخص').trim() || 'نامشخص'
      const ce = byCause.get(cs) ?? { count: 0, sumDown: 0 }
      ce.count += 1; ce.sumDown += r.downtime_hours || 0
      byCause.set(cs, ce)

      const sh = r.shift?.name || '—'
      const she = byShift.get(sh) ?? { count: 0, sumDown: 0, sumRun: 0 }
      she.count += 1; she.sumDown += r.downtime_hours || 0; she.sumRun += r.runtime_hours || 0
      byShift.set(sh, she)
    }

    return {
      count, totalDown, totalRun, avgEff, minDown, maxDown, minRun, maxRun, minEff, maxEff,
      byLine, byDate, byWeek, byMonth, byDevice, byCause, byShift,
    }
  }, [records])

  if (records.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-ink-500 dark:text-slate-400">
        برای بازه/فیلتر جاری رکوردی موجود نیست.
      </div>
    )
  }

  const lineNames = [...computed.byLine.keys()].sort((a, b) => a.localeCompare(b, 'fa'))
  const dateKeys = [...computed.byDate.keys()].sort()
  const weekKeys = [...computed.byWeek.keys()].sort()
  const monthKeys = [...computed.byMonth.keys()].sort()

  const barDownByLine = lineNames.map(n => ({ name: n.length > 12 ? n.slice(0, 12) + '…' : n, fullName: n, value: Math.round(computed.byLine.get(n)!.sumDown * 10) / 10 }))
  const barAvgDownByLine = lineNames.map(n => {
    const e = computed.byLine.get(n)!
    return { name: n.length > 12 ? n.slice(0, 12) + '…' : n, fullName: n, value: Math.round((e.sumDown / (e.count || 1)) * 10) / 10 }
  })
  const barRunByLine = lineNames.map(n => ({ name: n.length > 12 ? n.slice(0, 12) + '…' : n, fullName: n, value: Math.round(computed.byLine.get(n)!.sumRun * 10) / 10 }))
  const barEffByLine = lineNames.map(n => {
    const e = computed.byLine.get(n)!
    const a = e.effs.length ? e.effs.reduce((x, y) => x + y, 0) / e.effs.length : 0
    return { name: n.length > 12 ? n.slice(0, 12) + '…' : n, fullName: n, value: Math.round(a * 10) / 10 }
  })

  const downDaily = (() => {
    const useKeys = dateKeys.length > 24 ? (() => { const step = Math.ceil(dateKeys.length / 24); const p: string[] = []; for (let i = 0; i < dateKeys.length; i += step) p.push(dateKeys[i]); return p })() : dateKeys
    return useKeys.map(d => ({ name: formatDate(d).slice(5), fullName: formatDate(d), value: Math.round((computed.byDate.get(d)!.sumDown) * 10) / 10 }))
  })()

  const causePie = [...computed.byCause.entries()].sort((a, b) => b[1].sumDown - a[1].sumDown).slice(0, 8).map(([name, v]) => ({ name: name.length > 16 ? name.slice(0, 16) + '…' : name, fullName: name, value: Math.round(v.sumDown * 10) / 10 }))
  const devicePie = [...computed.byDevice.entries()].sort((a, b) => b[1].sumDown - a[1].sumDown).slice(0, 8).map(([name, v]) => ({ name: name.length > 16 ? name.slice(0, 16) + '…' : name, fullName: name, value: Math.round(v.sumDown * 10) / 10 }))
  const shiftPie = [...computed.byShift.entries()].sort((a, b) => b[1].sumDown - a[1].sumDown).map(([name, v]) => ({ name, value: Math.round(v.sumDown * 10) / 10 }))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 font-bold text-white dark:bg-white dark:text-slate-900"><Activity className="h-3.5 w-3.5" />{formatNumber(computed.count)} رکورد</span>
        <span className="text-slate-400">{lineNames.length} خط · {dateKeys.length} روز · {computed.byDevice.size} دستگاه</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-slate-400"><Layers className="h-3.5 w-3.5" />تعداد</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">{formatNumber(computed.count)}</div>
          <div className="text-[11px] text-ink-400">{lineNames.length} خط</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-slate-400"><Clock className="h-3.5 w-3.5 text-rose-500" />مجموع توقف</div>
          <div className="mt-1 text-xl font-extrabold text-rose-600" dir="ltr">{formatHours(computed.totalDown)}</div>
          <div className="text-[11px] text-ink-400">میانگین {formatHours(computed.count ? computed.totalDown / computed.count : 0)} · کمینه {formatHours(computed.minDown)} · بیشینه {formatHours(computed.maxDown)}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-slate-400"><TrendingUp className="h-3.5 w-3.5 text-emerald-500" />مجموع کارکرد</div>
          <div className="mt-1 text-xl font-extrabold text-emerald-600" dir="ltr">{formatHours(computed.totalRun)}</div>
          <div className="text-[11px] text-ink-400">میانگین {formatHours(computed.count ? computed.totalRun / computed.count : 0)}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-slate-400"><Gauge className="h-3.5 w-3.5" />میانگین راندمان</div>
          <div className="mt-1 text-xl font-extrabold text-ink-900 dark:text-white">{computed.avgEff != null ? `${Math.round(computed.avgEff * 10) / 10}٪` : '—'}</div>
          <div className="text-[11px] text-ink-400">کمینه {computed.minEff ? `${Math.round(computed.minEff * 10) / 10}٪` : '—'} · بیشینه {computed.maxEff ? `${Math.round(computed.maxEff * 10) / 10}٪` : '—'}</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 text-sm font-bold text-ink-700 dark:border-slate-700 dark:text-slate-200">
          <Table2 className="h-4 w-4 text-brand-600" /> آمار کلی توقف/کارکرد/راندمان
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                <th className="px-4 py-3 font-semibold text-right">پارامتر</th>
                <th className="px-4 py-3 font-semibold">تعداد</th>
                <th className="px-4 py-3 font-semibold">جمع کل</th>
                <th className="px-4 py-3 font-semibold">میانگین</th>
                <th className="px-4 py-3 font-semibold">کمینه</th>
                <th className="px-4 py-3 font-semibold">بیشینه</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
              <tr className="hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3 font-medium">توقف (ساعت)</td>
                <td className="px-4 py-3">{formatNumber(computed.count)}</td>
                <td className="px-4 py-3 font-semibold" dir="ltr">{formatHours(computed.totalDown)}</td>
                <td className="px-4 py-3 text-rose-600" dir="ltr">{formatHours(computed.count ? computed.totalDown / computed.count : 0)}</td>
                <td className="px-4 py-3" dir="ltr">{formatHours(computed.minDown)}</td>
                <td className="px-4 py-3" dir="ltr">{formatHours(computed.maxDown)}</td>
              </tr>
              <tr className="hover:bg-ink-50/50">
                <td className="px-4 py-3 font-medium">کارکرد (ساعت)</td>
                <td className="px-4 py-3">{formatNumber(computed.count)}</td>
                <td className="px-4 py-3 font-semibold" dir="ltr">{formatHours(computed.totalRun)}</td>
                <td className="px-4 py-3 text-emerald-600" dir="ltr">{formatHours(computed.count ? computed.totalRun / computed.count : 0)}</td>
                <td className="px-4 py-3" dir="ltr">{formatHours(computed.minRun)}</td>
                <td className="px-4 py-3" dir="ltr">{formatHours(computed.maxRun)}</td>
              </tr>
              <tr className="hover:bg-ink-50/50">
                <td className="px-4 py-3 font-medium">راندمان (٪)</td>
                <td className="px-4 py-3">{formatNumber(computed.byLine.size ? [...computed.byLine.values()].reduce((a, v) => a + v.effs.length, 0) : 0)}</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3 font-semibold">{computed.avgEff != null ? `${Math.round(computed.avgEff * 10) / 10}٪` : '—'}</td>
                <td className="px-4 py-3">{computed.minEff ? `${Math.round(computed.minEff * 10) / 10}٪` : '—'}</td>
                <td className="px-4 py-3">{computed.maxEff ? `${Math.round(computed.maxEff * 10) / 10}٪` : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-700 dark:text-slate-200"><BarChart3 className="h-4 w-4 text-rose-600" />مجموع توقف به تفکیک خط (ساعت)</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barDownByLine} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.25} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={barDownByLine.length > 6 ? -22 : 0} height={barDownByLine.length > 6 ? 44 : 24} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ direction: 'rtl', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} labelFormatter={(_: unknown, p: any) => p?.[0]?.payload?.fullName ?? ''} />
              <Bar dataKey="value" name="توقف جمع" fill="#dc2626" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-700 dark:text-slate-200"><BarChart3 className="h-4 w-4 text-orange-500" />میانگین توقف به تفکیک خط</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barAvgDownByLine} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.25} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={barAvgDownByLine.length > 6 ? -22 : 0} height={barAvgDownByLine.length > 6 ? 44 : 24} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ direction: 'rtl', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} labelFormatter={(_: unknown, p: any) => p?.[0]?.payload?.fullName ?? ''} />
              <Bar dataKey="value" name="توقف میانگین" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-700 dark:text-slate-200"><BarChart3 className="h-4 w-4 text-emerald-600" />مجموع کارکرد به تفکیک خط</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barRunByLine} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.25} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ direction: 'rtl', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} labelFormatter={(_: unknown, p: any) => p?.[0]?.payload?.fullName ?? ''} />
              <Bar dataKey="value" name="کارکرد جمع" fill="#059669" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-700 dark:text-slate-200"><Gauge className="h-4 w-4 text-slate-800" />میانگین راندمان به تفکیک خط (٪)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barEffByLine} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.25} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ direction: 'rtl', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} labelFormatter={(_: unknown, p: any) => p?.[0]?.payload?.fullName ?? ''} />
              <Bar dataKey="value" name="راندمان" fill="#0f2040" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {dateKeys.length >= 2 && (
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-700 dark:text-slate-200"><TrendingUp className="h-4 w-4 text-rose-600" />روند روزانه توقف (مجموع — HH:MM)</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={downDaily} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.25} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ direction: 'rtl', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} labelFormatter={(_: unknown, p: any) => p?.[0]?.payload?.fullName ?? ''} />
              <Bar dataKey="value" name="توقف" fill="#dc2626" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {causePie.length > 0 && (
          <div className="card p-4">
            <div className="mb-2 text-sm font-bold text-ink-700 dark:text-slate-200"><Wrench className="inline h-4 w-4 text-brand-600" /> سهم علل توقف</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={causePie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={36} outerRadius={72} paddingAngle={2}>
                  {causePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ direction: 'rtl', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {devicePie.length > 1 && (
          <div className="card p-4">
            <div className="mb-2 text-sm font-bold text-ink-700 dark:text-slate-200">سهم دستگاه‌ها</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={devicePie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={36} outerRadius={72} paddingAngle={2}>
                  {devicePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ direction: 'rtl', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {shiftPie.length > 1 && (
          <div className="card p-4">
            <div className="mb-2 text-sm font-bold text-ink-700 dark:text-slate-200">سهم شیفت‌ها</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={shiftPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={36} outerRadius={72} paddingAngle={2}>
                  {shiftPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ direction: 'rtl', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 text-sm font-bold text-ink-700 dark:border-slate-700 dark:text-slate-200">
          <Table2 className="h-4 w-4 text-brand-600" /> خلاصه به تفکیک خط — جمع و میانگین
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                <th className="px-4 py-3 font-semibold">خط</th>
                <th className="px-4 py-3 font-semibold">تعداد</th>
                <th className="px-4 py-3 font-semibold">مجموع توقف</th>
                <th className="px-4 py-3 font-semibold">میانگین توقف</th>
                <th className="px-4 py-3 font-semibold">مجموع کارکرد</th>
                <th className="px-4 py-3 font-semibold">میانگین کارکرد</th>
                <th className="px-4 py-3 font-semibold">میانگین راندمان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
              {[...computed.byLine.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fa')).map(([name, v]) => (
                <tr key={name} className="hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-medium text-ink-700 dark:text-slate-200">{name}</td>
                  <td className="px-4 py-3 dark:text-slate-300">{formatNumber(v.count)}</td>
                  <td className="px-4 py-3 font-semibold text-rose-600" dir="ltr">{formatHours(v.sumDown)}</td>
                  <td className="px-4 py-3" dir="ltr">{formatHours(v.count ? v.sumDown / v.count : 0)}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-600" dir="ltr">{formatHours(v.sumRun)}</td>
                  <td className="px-4 py-3" dir="ltr">{formatHours(v.count ? v.sumRun / v.count : 0)}</td>
                  <td className="px-4 py-3 font-semibold">{v.effs.length ? `${Math.round(v.effs.reduce((a, b) => a + b, 0) / v.effs.length * 10) / 10}٪` : '—'}</td>
                </tr>
              ))}
              <tr className="bg-ink-50/80 font-bold dark:bg-slate-800/80">
                <td className="px-4 py-3 text-ink-800 dark:text-slate-100">جمع کل</td>
                <td className="px-4 py-3 dark:text-slate-200">{formatNumber(computed.count)}</td>
                <td className="px-4 py-3 text-rose-700" dir="ltr">{formatHours(computed.totalDown)}</td>
                <td className="px-4 py-3" dir="ltr">{formatHours(computed.count ? computed.totalDown / computed.count : 0)}</td>
                <td className="px-4 py-3 text-emerald-700" dir="ltr">{formatHours(computed.totalRun)}</td>
                <td className="px-4 py-3" dir="ltr">{formatHours(computed.count ? computed.totalRun / computed.count : 0)}</td>
                <td className="px-4 py-3">{computed.avgEff != null ? `${Math.round(computed.avgEff * 10) / 10}٪` : '—'}</td>
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
                  <th className="px-3 py-2 font-semibold">مجموع توقف</th>
                  <th className="px-3 py-2 font-semibold">میانگین توقف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                {[...computed.byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, v]) => (
                  <tr key={d} className="hover:bg-ink-50/40 dark:hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-ink-700 dark:text-slate-200">{formatDate(d)}</td>
                    <td className="px-3 py-2 dark:text-slate-300">{formatNumber(v.count)}</td>
                    <td className="px-3 py-2 font-semibold text-rose-600" dir="ltr">{formatHours(v.sumDown)}</td>
                    <td className="px-3 py-2" dir="ltr">{formatHours(v.count ? v.sumDown / v.count : 0)}</td>
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
                      <th className="px-2 py-1.5 font-semibold">مجموع توقف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                    {[...computed.byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 12).map(([wk, v]) => (
                      <tr key={wk} className="hover:bg-ink-50/40">
                        <td className="px-2 py-1.5 font-medium dark:text-slate-200">{wk}</td>
                        <td className="px-2 py-1.5 dark:text-slate-300">{formatNumber(v.count)}</td>
                        <td className="px-2 py-1.5 font-semibold text-rose-600" dir="ltr">{formatHours(v.sumDown)}</td>
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
                      <th className="px-2 py-1.5 font-semibold">مجموع توقف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                    {[...computed.byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mk, v]) => (
                      <tr key={mk} className="hover:bg-ink-50/40">
                        <td className="px-2 py-1.5 font-medium dark:text-slate-200">{formatMonthLabel(mk)}</td>
                        <td className="px-2 py-1.5 dark:text-slate-300">{formatNumber(v.count)}</td>
                        <td className="px-2 py-1.5 font-semibold text-rose-600" dir="ltr">{formatHours(v.sumDown)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 text-sm font-bold text-ink-700 dark:border-slate-700 dark:text-slate-200">
            <Wrench className="h-4 w-4 text-brand-600" /> به تفکیک دستگاه
          </div>
          <div className="max-h-[300px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-ink-50/90 backdrop-blur dark:bg-slate-800/90">
                <tr className="border-b border-ink-100 text-right text-xs text-ink-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="px-3 py-2 font-semibold">دستگاه</th>
                  <th className="px-3 py-2 font-semibold">تعداد</th>
                  <th className="px-3 py-2 font-semibold">مجموع توقف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                {[...computed.byDevice.entries()].sort((a, b) => b[1].sumDown - a[1].sumDown).map(([name, v]) => (
                  <tr key={name} className="hover:bg-ink-50/40">
                    <td className="px-3 py-2 text-ink-700 dark:text-slate-200">{name}</td>
                    <td className="px-3 py-2 dark:text-slate-300">{formatNumber(v.count)}</td>
                    <td className="px-3 py-2 font-semibold text-rose-600" dir="ltr">{formatHours(v.sumDown)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 text-sm font-bold text-ink-700 dark:border-slate-700 dark:text-slate-200">
            <Wrench className="h-4 w-4 text-brand-600" /> به تفکیک علت
          </div>
          <div className="max-h-[300px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-ink-50/90 backdrop-blur dark:bg-slate-800/90">
                <tr className="border-b border-ink-100 text-right text-xs text-ink-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="px-3 py-2 font-semibold">علت</th>
                  <th className="px-3 py-2 font-semibold">تعداد</th>
                  <th className="px-3 py-2 font-semibold">مجموع توقف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                {[...computed.byCause.entries()].sort((a, b) => b[1].sumDown - a[1].sumDown).map(([name, v]) => (
                  <tr key={name} className="hover:bg-ink-50/40">
                    <td className="px-3 py-2 text-ink-700 dark:text-slate-200">{name}</td>
                    <td className="px-3 py-2 dark:text-slate-300">{formatNumber(v.count)}</td>
                    <td className="px-3 py-2 font-semibold text-rose-600" dir="ltr">{formatHours(v.sumDown)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 text-sm font-bold text-ink-700 dark:border-slate-700 dark:text-slate-200">
            <Clock className="h-4 w-4 text-brand-600" /> به تفکیک شیفت
          </div>
          <div className="max-h-[300px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-ink-50/90 backdrop-blur dark:bg-slate-800/90">
                <tr className="border-b border-ink-100 text-right text-xs text-ink-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="px-3 py-2 font-semibold">شیفت</th>
                  <th className="px-3 py-2 font-semibold">تعداد</th>
                  <th className="px-3 py-2 font-semibold">مجموع توقف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                {[...computed.byShift.entries()].sort((a, b) => b[1].sumDown - a[1].sumDown).map(([name, v]) => (
                  <tr key={name} className="hover:bg-ink-50/40">
                    <td className="px-3 py-2 text-ink-700 dark:text-slate-200">{name}</td>
                    <td className="px-3 py-2 dark:text-slate-300">{formatNumber(v.count)}</td>
                    <td className="px-3 py-2 font-semibold text-rose-600" dir="ltr">{formatHours(v.sumDown)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
