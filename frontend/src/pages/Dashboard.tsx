import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import {
  Boxes, Cpu, Gauge, TrendingUp, ArrowLeft, ClipboardList,
} from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { getLogsPage } from '../api/logs'
import type { DeviceLog } from '../types'
import { formatDate, formatNumber, formatPercent, rangeBounds } from '../utils'
import { Loading, ErrorBanner, EmptyState, CardSkeleton } from '../components/ui/States'
import LineFlow from '../components/LineFlow'

function Kpi({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent: string
}) {
  return (
    <div className="card flex items-center gap-4 p-4 transition hover:shadow-md">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-ink-400">{label}</div>
        <div className="truncate text-xl font-extrabold text-ink-800 dark:text-slate-100">{value}</div>
        {sub && <div className="text-[11px] text-ink-400">{sub}</div>}
      </div>
    </div>
  )
}

const tooltipStyle = { fontFamily: 'Vazirmatn, sans-serif', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }

export default function Dashboard() {
  const { selectedFactory, loading: fLoading } = useFactory()
  const [logs, setLogs] = useState<DeviceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const lineIds = useMemo(
    () => (selectedFactory?.lines ?? []).map((l) => l.id),
    [selectedFactory],
  )

  const loadDashboard = useCallback(async () => {
    if (!selectedFactory) return
    setLoading(true)
    try {
      const { from } = rangeBounds('daily')
      const first = await getLogsPage({ date_from: from }, 1, 80)
      let merged = [...first.results]
      const pages = Math.max(1, Math.ceil(first.count / 80))
      for (let page = 2; page <= pages; page++) {
        const next = await getLogsPage({ date_from: from }, page, 80)
        merged = merged.concat(next.results)
      }
      setLogs(merged.filter((l) => lineIds.includes(l.line.id)))
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [selectedFactory, lineIds])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  const stats = useMemo(() => {
    const devices = (selectedFactory?.lines ?? []).flatMap((l) => l.devices)
    const totalFeed = logs.reduce((s, l) => s + (l.feed_tonnage || 0), 0)
    const totalProduct = logs.reduce((s, l) => s + (l.product_tonnage || 0), 0)
    const effs = logs.filter((l) => l.efficiency != null).map((l) => l.efficiency!)
    const avgEff = effs.length ? effs.reduce((a, b) => a + b, 0) / effs.length : null
    return { lines: selectedFactory?.lines.length ?? 0, devices: devices.length, analyzers: devices.filter((d) => d.is_analyzer).length, totalFeed, totalProduct, avgEff, logCount: logs.length }
  }, [logs, selectedFactory])

  const efficiencyTrend = useMemo(() => {
    const byDate = new Map<string, number[]>()
    logs.forEach((l) => {
      if (l.efficiency == null) return
      const arr = byDate.get(l.date) ?? []; arr.push(l.efficiency); byDate.set(l.date, arr)
    })
    return [...byDate.entries()].map(([date, vals]) => ({ date, راندمان: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 })).sort((a, b) => a.date.localeCompare(b.date)).slice(-10)
  }, [logs])

  const tonnageByLine = useMemo(() => {
    const map = new Map<number, { feed: number; product: number; tailing: number }>()
    logs.forEach((l) => {
      const cur = map.get(l.line.id) ?? { feed: 0, product: 0, tailing: 0 }
      cur.feed += l.feed_tonnage || 0; cur.product += l.product_tonnage || 0; cur.tailing += l.tailing_tonnage || 0
      map.set(l.line.id, cur)
    })
    return [...map.entries()].map(([id, v]) => ({ name: selectedFactory?.lines.find((l) => l.id === id)?.name ?? '—', ...v }))
  }, [logs, selectedFactory])

  const recentLogs = useMemo(() => [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6), [logs])

  if (fLoading) return <Loading />
  if (!selectedFactory) return <EmptyState title="کارخانه‌ای یافت نشد" description="ابتدا از پنل ادمین کارخانه بسازید." />

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900 dark:text-slate-100">داشبورد کارخانه</h1>
          <p className="text-sm text-ink-500">نمای کلی از خطوط فرآوری، دستگاه‌ها و عملکرد {selectedFactory.name}</p>
        </div>
        <Link to="/logs" className="btn-outline"><ClipboardList className="h-4 w-4" /> مشاهده گزارش‌ها</Link>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadDashboard} />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={<Boxes className="h-6 w-6 text-brand-600" />} label="خطوط فرآوری" value={formatNumber(stats.lines)} sub={`${formatNumber(stats.devices)} دستگاه`} accent="bg-brand-50 dark:bg-brand-950/30" />
        <Kpi icon={<Gauge className="h-6 w-6 text-emerald-600" />} label="میانگین راندمان" value={formatPercent(stats.avgEff)} sub={`${formatNumber(stats.logCount)} گزارش ثبت‌شده`} accent="bg-emerald-50 dark:bg-emerald-950/30" />
        <Kpi icon={<TrendingUp className="h-6 w-6 text-sky-600" />} label="تناژ ورودی" value={`${formatNumber(Math.round(stats.totalFeed))} تن`} sub={`خروجی ${formatNumber(Math.round(stats.totalProduct))} تن`} accent="bg-sky-50 dark:bg-sky-950/30" />
        <Kpi icon={<Cpu className="h-6 w-6 text-violet-600" />} label="آنالایزرها" value={formatNumber(stats.analyzers)} sub="دستگاه آنالیزور فعال" accent="bg-violet-50 dark:bg-violet-950/30" />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-700 dark:text-slate-200">مدل‌سازی خطوط فرآوری</h2>
          <Link to="/lines" className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"><ArrowLeft className="h-3.5 w-3.5" /> همه خطوط</Link>
        </div>
        {loading ? (
          <CardSkeleton />
        ) : (
          (selectedFactory.lines ?? []).slice(0, 2).map((line) => <LineFlow key={line.id} line={line} />)
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-bold text-ink-700 dark:text-slate-200">روند راندمان در زمان</h3>
          {efficiencyTrend.length === 0 ? (
            <div className="py-10 text-center text-xs text-ink-400">داده‌ای برای نمایش وجود ندارد</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={efficiencyTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}٪`, 'راندمان']} labelFormatter={(l) => `تاریخ: ${l}`} />
                <Line type="monotone" dataKey="راندمان" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-4">
          <h3 className="mb-3 text-sm font-bold text-ink-700 dark:text-slate-200">تناژ به تفکیک خط (مجموع)</h3>
          {tonnageByLine.length === 0 ? (
            <div className="py-10 text-center text-xs text-ink-400">داده‌ای برای نمایش وجود ندارد</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={tonnageByLine} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n) => [`${formatNumber(v)} تن`, n]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="feed" name="ورودی" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="product" name="محصول" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="tailing" name="باطله" fill="#fb923c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-slate-700">
          <h3 className="text-sm font-bold text-ink-700 dark:text-slate-200">آخرین گزارش‌های عملکرد</h3>
          <Link to="/logs" className="text-xs font-medium text-brand-600">مشاهده همه</Link>
        </div>
        {recentLogs.length === 0 ? (
          <div className="py-10 text-center text-xs text-ink-400">هنوز گزارشی ثبت نشده است</div>
        ) : (
          <div className="divide-y divide-ink-100 dark:divide-slate-700">
            {recentLogs.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="chip">{l.line.name}</span>
                  <span className="text-sm text-ink-700 dark:text-slate-300">{formatDate(l.date)}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-ink-500">
                  <span>ورودی: {formatNumber(l.feed_tonnage)}</span>
                  <span>خروجی: {formatNumber(l.product_tonnage)}</span>
                  <span className="font-semibold text-emerald-600">{formatPercent(l.efficiency)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
