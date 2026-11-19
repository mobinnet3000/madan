import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell, AreaChart, Area, Line } from 'recharts'
import { Gauge, TrendingUp, ArrowLeft, ClipboardList, Layers, Clock, Cpu, AlertTriangle, Wrench, Users, Calendar, ShieldCheck, ArrowUpRight, ArrowDownRight, Sparkles, Factory, Mountain, Eye, LayoutGrid, Workflow, FileBarChart } from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { getLogsPage } from '../api/logs'
import { getFactoryTabRecords } from '../api/factoryTabs'
import type { DeviceLog, FactoryTabBrief } from '../types'
import { formatDate, formatNumber, formatPercent, rangeBounds, formatHours } from '../utils'
import { tabIcon, tabColorBg } from '../utils/tabIcons'
import { Loading, ErrorBanner, EmptyState } from '../components/ui/States'
import LineFlow from '../components/LineFlow'

interface TabStat {
  tab: FactoryTabBrief
  count: number
  lastDate: string | null
}

function Kpi({ icon, label, value, sub, accent, to, trend, trendUp }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: string; to?: string; trend?: string; trendUp?: boolean }) {
  const Card = (
    <div className={`group relative overflow-hidden rounded-2xl border border-[#e4ddd2] bg-white p-4 shadow-subtle transition-all duration-200 hover:shadow-card hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900 ${to ? 'cursor-pointer' : ''}`}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-br from-[#faf0df]/40 to-transparent dark:from-slate-800/40 pointer-events-none" />
      <div className="relative flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`}>{icon}</div>
        {trend && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${trendUp ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30'}`}>{trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{trend}</span>}
      </div>
      <div className="relative mt-3">
        <div className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">{label}</div>
        <div className="mt-1 text-xl font-black tracking-tight text-[#0f1821] dark:text-white">{value}</div>
        {sub && <div className="mt-1 text-[11px] leading-4 text-slate-500 line-clamp-1">{sub}</div>}
      </div>
    </div>
  )
  return to ? <Link to={to} className="block">{Card}</Link> : Card
}

const tip = { fontFamily: 'Vazirmatn, sans-serif', borderRadius: 12, border: '1px solid #e4ddd2', fontSize: 11, backgroundColor: '#ffffff', color: '#0f1821' } as any
const PIE = ['#0f1821', '#efa73f', '#c92127', '#10b981', '#8b5cf6', '#0ea5e9', '#d97706', '#ec4899']

export default function Dashboard() {
  const { selectedFactory, loading: fLoading } = useFactory()
  const [logs, setLogs] = useState<DeviceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tabStats, setTabStats] = useState<TabStat[]>([])

  const lineIds = useMemo(() => (selectedFactory?.lines ?? []).map(l => l.id), [selectedFactory])

  const load = useCallback(async () => {
    if (!selectedFactory) return
    setLoading(true)
    try {
      const { from } = rangeBounds('daily')
      const first = await getLogsPage({ date_from: from }, 1, 80)
      let merged = [...first.results]
      const pages = Math.max(1, Math.ceil(first.count / 80))
      for (let p = 2; p <= pages; p++) { const nxt = await getLogsPage({ date_from: from }, p, 80); merged = merged.concat(nxt.results) }
      setLogs(merged.filter(l => lineIds.includes(l.line.id)))
      const tabs = selectedFactory.report_tabs ?? []
      const stats = await Promise.all(tabs.map(async t => {
        try {
          const r = await getFactoryTabRecords({ tab: t.id }, 1, 1)
          const last = r.results[0]
          return { tab: t, count: r.count ?? 0, lastDate: last?.date_from ?? null }
        } catch { return { tab: t, count: 0, lastDate: null } }
      }))
      setTabStats(stats)
      setError(null)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [selectedFactory, lineIds])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => {
    const devices = (selectedFactory?.lines ?? []).flatMap(l => l.devices)
    const shifts = (selectedFactory?.shifts ?? []).length + (selectedFactory?.lines ?? []).reduce((s, l) => s + (l.shifts?.length ?? 0), 0)
    const contractors = selectedFactory?.contractors?.length ?? 0
    const totalFeed = logs.reduce((s, l) => s + (l.feed_tonnage || 0), 0)
    const totalProduct = logs.reduce((s, l) => s + (l.product_tonnage || 0), 0)
    const effs = logs.filter(l => l.efficiency != null).map(l => l.efficiency!)
    const avgEff = effs.length ? effs.reduce((a, b) => a + b, 0) / effs.length : null
    const downtime = logs.reduce((s, l) => s + (l.downtime_hours || 0), 0)
    const runtime = logs.reduce((s, l) => s + (l.runtime_hours || 0), 0)
    const avail = runtime + downtime ? (runtime / (runtime + downtime)) * 100 : null
    return { lines: selectedFactory?.lines.length ?? 0, devices: devices.length, shifts, contractors, totalFeed, totalProduct, avgEff, logCount: logs.length, downtime, runtime, avail }
  }, [logs, selectedFactory])

  const efficiencyTrend = useMemo(() => {
    const byDate = new Map<string, number[]>()
    logs.forEach(l => { if (l.efficiency == null) return; const a = byDate.get(l.date) ?? []; a.push(l.efficiency); byDate.set(l.date, a) })
    return [...byDate.entries()].map(([date, vals]) => ({ date, eff: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10, downtime: Math.round(logs.filter(x => x.date === date).reduce((s, x) => s + (x.downtime_hours || 0), 0) * 10) / 10 })).sort((a, b) => a.date.localeCompare(b.date)).slice(-12)
  }, [logs])

  const tonnageByLine = useMemo(() => {
    const map = new Map<number, { feed: number; product: number; tailing: number }>()
    logs.forEach(l => { const cur = map.get(l.line.id) ?? { feed: 0, product: 0, tailing: 0 }; cur.feed += l.feed_tonnage || 0; cur.product += l.product_tonnage || 0; cur.tailing += l.tailing_tonnage || 0; map.set(l.line.id, cur) })
    return [...map.entries()].map(([id, v]) => ({ name: selectedFactory?.lines.find(l => l.id === id)?.name ?? '—', ...v, eff: v.feed ? Math.round((v.product / v.feed) * 1000) / 10 : 0 }))
  }, [logs, selectedFactory])

  const downtimeByCause = useMemo(() => {
    const map = new Map<string, number>()
    logs.forEach(l => { if (!l.downtime_hours) return; const k = l.failure_cause?.title || 'نامشخص'; map.set(k, (map.get(k) ?? 0) + l.downtime_hours) })
    return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 })).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [logs])

  const downtimeByDevice = useMemo(() => {
    const map = new Map<string, number>()
    logs.forEach(l => { if (!l.downtime_hours) return; const k = l.device ? (l.device.code ? `${l.device.code} - ${l.device.name}` : l.device.name) : 'بدون دستگاه'; map.set(k, (map.get(k) ?? 0) + l.downtime_hours) })
    return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 })).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [logs])

  const recentLogs = useMemo(() => logs.slice(0, 5), [logs])
  const totalTabRecords = useMemo(() => tabStats.reduce((s, t) => s + t.count, 0), [tabStats])
  const emptyTabs = useMemo(() => tabStats.filter(t => t.count === 0), [tabStats])

  const health = useMemo(() => {
    if (!logs.length) return null
    let score = 100
    if (stats.avgEff != null && stats.avgEff < 70) score -= 25
    else if (stats.avgEff != null && stats.avgEff < 85) score -= 10
    if (stats.avail != null && stats.avail < 80) score -= 25
    else if (stats.avail != null && stats.avail < 90) score -= 10
    if (stats.downtime > stats.runtime * 0.3) score -= 20
    return Math.max(10, Math.min(100, Math.round(score)))
  }, [logs, stats])

  const alerts = useMemo(() => {
    const list: { label: string; to: string; tone: 'rose' | 'amber' | 'cyan' }[] = []
    if (emptyTabs.length > 0) list.push({ label: `${emptyTabs.length} تب بدون داده ثبت‌شده`, to: '/settings', tone: 'amber' })
    if (stats.avail != null && stats.avail < 85) list.push({ label: `دسترسی پایین (${Math.round(stats.avail)}٪)`, to: '/logs', tone: 'rose' })
    if (downtimeByCause.length > 0) list.push({ label: `علت اصلی: ${downtimeByCause[0].name}`, to: '/logs', tone: 'cyan' })
    return list
  }, [emptyTabs, stats.avail, downtimeByCause])

  if (fLoading || loading) return <Loading label="در حال بارگذاری داشبورد جامع معدن..." />
  if (!selectedFactory) return <EmptyState title="هیچ کارخانه‌ای یافت نشد" description="ابتدا از بخش مدیریت یک کارخانه ایجاد کنید." action={<Link to="/settings" className="btn-primary">ایجاد کارخانه</Link>} />

  return (
    <div className="space-y-6">
      {/* هدر بالایی با تم صنعتی و رنگ‌های سازمانی */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 text-white shadow-card"
        style={{
          background: 'linear-gradient(135deg, #0f1821 0%, #1e293b 60%, #0f1821 100%)',
          border: '1px solid rgba(239, 167, 63, 0.25)',
        }}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#efa73f]/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-[#c92127]/15 blur-3xl" />

        <div className="relative">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-brand-glow text-[#0f1821]"
                style={{ background: 'linear-gradient(135deg, #f5b452, #efa73f)' }}
              >
                <Mountain className="h-7 w-7" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-black text-white sm:text-2xl">{selectedFactory.name}</h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> مانیتورینگ زنده · ۳۰ روز اخیر
                  </span>
                  {health != null && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ring-1 ${health >= 80 ? 'bg-emerald-400 text-[#0f1821] ring-emerald-300' : health >= 60 ? 'bg-[#efa73f] text-[#0f1821] ring-amber-200' : 'bg-rose-500 text-white ring-rose-300'}`}>
                      سلامت {health}٪
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs font-medium text-slate-300">
                  {selectedFactory.address || 'سامانه یکپارچه پایش تولید و توقفات کارخانه فرآوری'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Link to="/lines" className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white ring-1 ring-white/15 backdrop-blur hover:bg-white/20 transition">
                <Layers className="h-4 w-4" /> مدل‌سازی خطوط
              </Link>
              <Link to="/logs" className="btn-primary !h-9 !px-4 !text-xs font-bold shadow-brand-glow">
                <ClipboardList className="h-4 w-4" /> توقفات خط تولید
              </Link>
              <Link to="/settings" className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white ring-1 ring-white/15 backdrop-blur hover:bg-white/20 transition">
                <Wrench className="h-4 w-4" /> تنظیمات
              </Link>
            </div>
          </div>

          {/* نوار وضعیت آماری داخل هدر */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-white/10 pt-4">
            <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
              <div className="text-[10px] font-bold text-slate-400 uppercase">خطوط فعال</div>
              <div className="mt-1 text-base font-black text-white">{formatNumber(stats.lines)} خط فرآوری</div>
              <div className="text-[10px] text-slate-400">{formatNumber(stats.devices)} دستگاه متصل</div>
            </div>
            <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
              <div className="text-[10px] font-bold text-slate-400 uppercase">میانگین راندمان</div>
              <div className="mt-1 text-base font-black text-[#efa73f]">{formatPercent(stats.avgEff)}</div>
              <div className="text-[10px] text-slate-400">{formatNumber(logs.length)} رکورد ثبت‌شده</div>
            </div>
            <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
              <div className="text-[10px] font-bold text-slate-400 uppercase">مجموع ساعات توقف</div>
              <div className="mt-1 text-base font-black text-rose-400">{formatHours(stats.downtime)}</div>
              <div className="text-[10px] text-slate-400">کارکرد مفید: {formatHours(stats.runtime)}</div>
            </div>
            <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
              <div className="text-[10px] font-bold text-slate-400 uppercase">وضعیت سامانه</div>
              <div className="mt-1 flex items-center gap-1.5 text-base font-black text-emerald-400">
                <ShieldCheck className="h-4 w-4" /> پایدار و عملیاتی
              </div>
              <div className="text-[10px] text-slate-400">دسترسی دیتابیس برقرار است</div>
            </div>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* شاخص‌های کلیدی (KPIs) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Layers className="h-5 w-5 text-[#0f1821]" />}
          label="خطوط فرآوری معدن"
          value={formatNumber(stats.lines)}
          sub={`${formatNumber(stats.devices)} تجهیز · ${formatNumber(stats.contractors)} پیمانکار`}
          accent="bg-[#faf0df] text-[#efa73f]"
          to="/lines"
          trend={`${stats.lines} خط`}
          trendUp
        />
        <Kpi
          icon={<ClipboardList className="h-5 w-5 text-white" />}
          label="توقفات خط تولید (۳۰ روز)"
          value={formatNumber(stats.logCount)}
          sub={`توقف: ${formatHours(stats.downtime)} · کارکرد: ${formatHours(stats.runtime)}`}
          accent="bg-gradient-to-br from-rose-500 to-rose-600 text-white"
          to="/logs"
          trend={stats.downtime > 0 ? formatHours(stats.downtime) : '—'}
          trendUp={false}
        />
        <Kpi
          icon={<Gauge className="h-5 w-5 text-white" />}
          label="راندمان و نرخ دسترسی"
          value={stats.avgEff != null ? `${Math.round(stats.avgEff * 100) / 100}٪` : '—'}
          sub={stats.avail != null ? `نرخ دسترسی: ${Math.round(stats.avail * 100) / 100}٪` : '—'}
          accent="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
          to="/reports"
          trend={health != null ? `${health}٪ سلامت` : undefined}
          trendUp={(health ?? 0) >= 70}
        />
        <Kpi
          icon={<TrendingUp className="h-5 w-5 text-white" />}
          label="تناژ ورودی ← محصول"
          value={`${formatNumber(Math.round(stats.totalFeed))} ← ${formatNumber(Math.round(stats.totalProduct))}`}
          sub={`باطله خروجی: ${formatNumber(Math.round(Math.max(0, stats.totalFeed - stats.totalProduct)))} تن`}
          accent="bg-gradient-to-br from-[#efa73f] to-[#d88f28] text-white"
          to="/logs"
        />
      </div>

      {/* بخش تب‌های کارخانه */}
      {tabStats.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-black text-[#0f1821] dark:text-slate-100">
              <LayoutGrid className="h-4 w-4 text-[#efa73f]" /> تب‌های ثبت اطلاعات و گزارش‌های کارخانه
            </h2>
            <Link to="/settings" className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[#0f1821] border border-[#e4ddd2] hover:border-[#efa73f] transition dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
              مدیریت تب‌ها <ArrowLeft className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tabStats.map(({ tab, count, lastDate }) => {
              const Icon = tabIcon(tab.icon)
              return (
                <Link
                  key={tab.id}
                  to={`/factory-tabs/${tab.id}`}
                  className="group relative overflow-hidden rounded-2xl border border-[#e4ddd2] bg-white p-4 shadow-subtle transition hover:-translate-y-0.5 hover:shadow-card dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tabColorBg(tab.color)}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="chip !text-[10px] font-bold">{tab.record_type === 'daily' ? 'روزانه' : 'بازه‌ای'}</span>
                  </div>
                  <div className="mt-3 truncate text-sm font-black text-[#0f1821] dark:text-white" title={tab.name}>
                    {tab.name}
                  </div>
                  <div className="mt-1 text-xl font-black tracking-tight text-[#0f1821] dark:text-white">
                    {formatNumber(count)}
                    <span className="mr-1 text-[11px] font-bold text-slate-400">رکورد</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {lastDate ? `آخرین ثبت: ${formatDate(lastDate)}` : 'بدون رکورد'}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* نمودارها و تحلیل‌ها */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* نمودار روند راندمان */}
        <div className="rounded-2xl border border-[#e4ddd2] bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0f1821] dark:text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#efa73f]" /> روند راندمان تولید
            </h3>
            <span className="text-xs text-slate-400 font-medium">۱۲ روز کاری اخیر</span>
          </div>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={efficiencyTrend}>
                <defs>
                  <linearGradient id="effGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#efa73f" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#efa73f" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1ede6" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} />
                <Tooltip contentStyle={tip} />
                <Area type="monotone" dataKey="eff" name="راندمان ٪" stroke="#efa73f" strokeWidth={2.5} fill="url(#effGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* نمودار علل خرابی و توقفات */}
        <div className="rounded-2xl border border-[#e4ddd2] bg-white p-5 shadow-subtle dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0f1821] dark:text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-accent-500" /> علل اصلی توقفات (ساعت)
            </h3>
            <Link to="/logs" className="text-xs font-bold text-accent-500 hover:underline">
              مشاهده گزارش کامل ←
            </Link>
          </div>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={downtimeByCause} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1ede6" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={tip} />
                <Bar dataKey="value" name="ساعت توقف" fill="#c92127" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
