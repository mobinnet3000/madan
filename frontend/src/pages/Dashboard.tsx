import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { Boxes, Gauge, TrendingUp, ArrowLeft, ClipboardList, Layers, Clock, Cpu, Truck, FlaskConical, AlertTriangle, Wrench, Activity, Users, Calendar, Zap, ShieldCheck, ArrowUpRight, ArrowDownRight, Sparkles, Factory, Mountain, Eye } from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { getLogsPage } from '../api/logs'
import { getProductionReports } from '../api/production'
import { getActualAnalyses } from '../api/actual'
import { getDeliveredTonnages } from '../api/tonnage'
import type { DeviceLog } from '../types'
import { formatDate, formatNumber, formatPercent, rangeBounds, formatHours } from '../utils'
import { Loading, ErrorBanner, EmptyState } from '../components/ui/States'
import LineFlow from '../components/LineFlow'

function Kpi({ icon, label, value, sub, accent, to, trend, trendUp }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: string; to?: string; trend?: string; trendUp?: boolean }) {
  const Card = (
    <div className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-900 ${to ? 'cursor-pointer' : ''}`}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-br from-slate-50 to-transparent dark:from-slate-800/50" />
      <div className="relative flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`}>{icon}</div>
        {trend && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${trendUp ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/30'}`}>{trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{trend}</span>}
      </div>
      <div className="relative mt-3">
        <div className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">{label}</div>
        <div className="mt-1 text-xl font-black tracking-tight text-slate-900 dark:text-white">{value}</div>
        {sub && <div className="mt-1 text-[11px] leading-4 text-slate-500 line-clamp-1">{sub}</div>}
      </div>
    </div>
  )
  return to ? <Link to={to} className="block">{Card}</Link> : Card
}
const tip = { fontFamily: 'Vazirmatn, sans-serif', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 11 } as any
const PIE = ['#0f172a', '#f97316', '#10b981', '#8b5cf6', '#06b6d4', '#ef4444', '#84cc16', '#e11d48']

export default function Dashboard() {
  const { selectedFactory, loading: fLoading } = useFactory()
  const [logs, setLogs] = useState<DeviceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [counts, setCounts] = useState({ reports: 0, analyses: 0, tonnages: 0 })

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
      const [rep, ana, ton] = await Promise.all([
        getProductionReports({} as any, 1, 1).catch(() => ({ count: 0 } as any)),
        getActualAnalyses({} as any, 1, 1).catch(() => ({ count: 0 } as any)),
        getDeliveredTonnages({} as any, 1, 1).catch(() => ({ count: 0 } as any)),
      ])
      setCounts({ reports: rep.count ?? 0, analyses: ana.count ?? 0, tonnages: ton.count ?? 0 })
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

  const downtimeByLine = useMemo(() => {
    const m = new Map<string, { downtime: number; count: number }>()
    logs.forEach(l => { const n = l.line.name; const c = m.get(n) ?? { downtime: 0, count: 0 }; c.downtime += l.downtime_hours || 0; c.count += 1; m.set(n, c) })
    return [...m.entries()].map(([name, v]) => ({ name, value: Math.round(v.downtime * 10) / 10, count: v.count })).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [logs])

  const downtimeByCause = useMemo(() => {
    const m = new Map<string, number>()
    logs.forEach(l => { const k = l.failure_cause?.title || 'نامشخص'; m.set(k, (m.get(k) ?? 0) + (l.downtime_hours || 0)) })
    return [...m.entries()].map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 })).filter(x => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 5)
  }, [logs])

  const shiftLoad = useMemo(() => {
    const m = new Map<string, number>()
    logs.forEach(l => { const k = l.shift?.name || '—'; m.set(k, (m.get(k) ?? 0) + 1) })
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [logs])

  const recentLogs = useMemo(() => [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7), [logs])

  const health = useMemo(() => {
    if (stats.avgEff == null || stats.avail == null) return null
    return Math.round((stats.avgEff * 0.6 + stats.avail * 0.4) * 10) / 10
  }, [stats.avgEff, stats.avail])

  const alerts = useMemo(() => {
    if (!selectedFactory) return []
    const a: { label: string; to: string; tone: string }[] = []
    if (!selectedFactory.factory_analysis_definition) a.push({ label: 'تعریف ریز عملکرد ثبت نشده', to: '/production', tone: 'amber' })
    const missingTonnage = (selectedFactory.lines ?? []).filter(l => !l.tonnage_definition).length
    if (missingTonnage) a.push({ label: `${missingTonnage} خط بدون تعریف تناژ`, to: '/tonnage', tone: 'cyan' })
    if (stats.downtime > stats.runtime * 0.2 && stats.logCount > 5) a.push({ label: 'توقف بالا — نیاز به بررسی', to: '/logs', tone: 'rose' })
    return a
  }, [selectedFactory, stats.downtime, stats.runtime, stats.logCount])

  if (fLoading) return <Loading />
  if (!selectedFactory) return <EmptyState title="کارخانه‌ای یافت نشد" description="ابتدا از تنظیمات کارخانه بسازید." />

  return (
    <div className="animate-fade-in space-y-6">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-900 dark:via-slate-900 dark:to-black" />
        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(600px 220px at 85% -10%, #f97316 0%, transparent 60%), radial-gradient(500px 300px at -10% 100%, #06b6d4 0%, transparent 55%)' }} />
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="relative p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-4">
              <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur sm:flex"><Mountain className="h-6 w-6 text-white" /></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[18px] font-black tracking-tight text-white sm:text-[20px]">{selectedFactory.name}</h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-400/20"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> LIVE · ۳۰ روز اخیر</span>
                  {health != null && <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${health >= 80 ? 'bg-emerald-400 text-slate-900 ring-emerald-300' : health >= 60 ? 'bg-amber-300 text-slate-900 ring-amber-200' : 'bg-rose-400 text-white ring-rose-300'}`}>سلامت {health}٪</span>}
                </div>
                <p className="mt-1 max-w-[640px] text-sm leading-5 text-slate-300">{selectedFactory.address || 'نمای یکپارچه معدن — همه بخش‌ها در یک نگاه. هر کارت و نمودار به بخش مربوطه لینک است.'}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-white ring-1 ring-white/15 backdrop-blur"><Layers className="h-3.5 w-3.5 opacity-80" />{formatNumber(stats.lines)} خط</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-white ring-1 ring-white/15 backdrop-blur"><Cpu className="h-3.5 w-3.5 opacity-80" />{formatNumber(stats.devices)} دستگاه</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-white ring-1 ring-white/15 backdrop-blur"><Clock className="h-3.5 w-3.5 opacity-80" />{formatNumber(stats.shifts)} شیفت</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-white ring-1 ring-white/15 backdrop-blur"><Users className="h-3.5 w-3.5 opacity-80" />{formatNumber(stats.contractors)} پیمانکار</span>
                  <span className="hidden items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-900 sm:inline-flex"><Factory className="h-3.5 w-3.5" />{formatNumber(selectedFactory.failure_reasons.length)} علت خرابی</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 self-start">
              <Link to="/lines" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-black text-slate-900 shadow hover:bg-slate-100"><Layers className="h-4 w-4" /> خطوط</Link>
              <Link to="/logs" className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-2 text-sm font-black text-white shadow hover:bg-orange-600"><ClipboardList className="h-4 w-4" /> توقفات</Link>
              <Link to="/settings" className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-sm font-bold text-white ring-1 ring-white/15 backdrop-blur hover:bg-white/15"><Wrench className="h-4 w-4" /> تنظیمات</Link>
            </div>
          </div>
          {alerts.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {alerts.map(a => (
                <Link key={a.label} to={a.to} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 backdrop-blur ${a.tone === 'amber' ? 'bg-amber-400/15 text-amber-200 ring-amber-400/25 hover:bg-amber-400/20' : a.tone === 'cyan' ? 'bg-cyan-400/15 text-cyan-200 ring-cyan-400/25 hover:bg-cyan-400/20' : 'bg-rose-400/15 text-rose-200 ring-rose-400/25 hover:bg-rose-400/20'}`}>
                  <AlertTriangle className="h-3.5 w-3.5" />{a.label} <ArrowLeft className="h-3 w-3 opacity-70" />
                </Link>
              ))}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10 backdrop-blur">
              <div className="text-[11px] font-bold uppercase tracking-wide text-white/70">دسترسی</div>
              <div className="mt-1 text-sm font-black text-white">۳۰ روز اخیر</div>
              <div className="text-[11px] text-white/60">فیلتر داشبورد</div>
            </div>
            <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10 backdrop-blur">
              <div className="text-[11px] font-bold uppercase tracking-wide text-white/70">به‌روزرسانی</div>
              <div className="mt-1 text-sm font-black text-white">{formatDate(new Date().toISOString().slice(0, 10))}</div>
              <div className="text-[11px] text-white/60">امروز</div>
            </div>
            <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10 backdrop-blur">
              <div className="text-[11px] font-bold uppercase tracking-wide text-white/70">میانگین راندمان</div>
              <div className="mt-1 text-sm font-black text-white">{formatPercent(stats.avgEff)}</div>
              <div className="text-[11px] text-white/60">{formatNumber(logs.length)} رکورد توقف</div>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-black/5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">وضعیت</div>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-black text-slate-900"><ShieldCheck className="h-4 w-4 text-emerald-600" /> عملیاتی</div>
              <div className="text-[11px] text-slate-500">دسترسی لحظه‌ای</div>
            </div>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Layers className="h-6 w-6 text-white" />} label="خطوط فرآوری" value={formatNumber(stats.lines)} sub={`${formatNumber(stats.devices)} دستگاه · ${formatNumber(stats.contractors)} پیمانکار`} accent="bg-slate-900 text-white dark:bg-white dark:text-slate-900" to="/lines" trend={`${stats.lines} خط`} trendUp />
        <Kpi icon={<ClipboardList className="h-6 w-6 text-white" />} label="توقفات ۳۰ روز" value={formatNumber(stats.logCount)} sub={`توقف ${formatHours(stats.downtime)} · کارکرد ${formatHours(stats.runtime)}`} accent="bg-rose-600 text-white" to="/logs" trend={stats.downtime > 0 ? formatHours(stats.downtime) : '—'} trendUp={false} />
        <Kpi icon={<Gauge className="h-6 w-6 text-white" />} label="راندمان · دسترسی" value={stats.avgEff != null ? `${Math.round(stats.avgEff * 10) / 10}٪` : '—'} sub={stats.avail != null ? `دسترسی ${Math.round(stats.avail * 10) / 10}٪` : '—'} accent="bg-emerald-600 text-white" to="/reports" trend={health != null ? `${health}٪ سلامت` : undefined} trendUp={(health ?? 0) >= 70} />
        <Kpi icon={<TrendingUp className="h-6 w-6 text-white" />} label="تناژ ورودی → محصول" value={`${formatNumber(Math.round(stats.totalFeed))} → ${formatNumber(Math.round(stats.totalProduct))}`} sub={`باطله ${formatNumber(Math.round(Math.max(0, stats.totalFeed - stats.totalProduct)))} تن`} accent="bg-sky-600 text-white" to="/tonnage" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<FlaskConical className="h-5 w-5 text-white" />} label="ریز عملکرد" value={formatNumber(counts.reports)} sub="ریز عملکرد خطوط تولید" accent="bg-violet-600 text-white" to="/production" />
        <Kpi icon={<Activity className="h-5 w-5 text-white" />} label="عملکرد بخش" value={formatNumber(counts.analyses)} sub="Actual Analysis" accent="bg-amber-500 text-white" to="/performance" />
        <Kpi icon={<Truck className="h-5 w-5 text-white" />} label="تناژ تحویلی" value={formatNumber(counts.tonnages)} sub="سوابق تناژ" accent="bg-cyan-600 text-white" to="/tonnage" />
        <Kpi icon={<Wrench className="h-5 w-5 text-white" />} label="تعریف‌ها" value={`${(selectedFactory.lines ?? []).filter(l => l.tonnage_definition).length}/${stats.lines}`} sub="خطوط با تعریف تناژ" accent="bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900" to="/settings" />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-black tracking-tight text-slate-900 dark:text-slate-100"><Sparkles className="h-4 w-4 text-orange-500" /> خطوط فرآوری — مسیر تولید</h2>
          <Link to="/lines" className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-black dark:bg-white dark:text-slate-900"><Eye className="h-3.5 w-3.5" /> همه خطوط <ArrowLeft className="h-3 w-3" /></Link>
        </div>
        {loading ? <div className="card p-6 text-center text-sm text-slate-400">در حال بارگذاری...</div> : (
          (selectedFactory.lines ?? []).slice(0, 2).map(line => <LineFlow key={line.id} line={line} />)
        )}
        {selectedFactory.lines.length === 0 && <div className="card p-6 text-center text-sm text-slate-400">خطی ثبت نشده — از مدل‌سازی خطوط بسازید.</div>}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100"><TrendingUp className="h-4 w-4 text-emerald-600" /> روند راندمان + توقف</h3>
          {efficiencyTrend.length === 0 ? <div className="py-10 text-center text-xs text-slate-400">داده‌ای نیست</div> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={efficiencyTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs><linearGradient id="eff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f97316" stopOpacity={0.28} /><stop offset="1" stopColor="#f97316" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip contentStyle={tip} />
                <Area type="monotone" dataKey="eff" name="راندمان ٪" stroke="#f97316" strokeWidth={2.2} fill="url(#eff)" dot={{ r: 2.5 }} />
                <Line type="monotone" dataKey="downtime" stroke="#ef4444" strokeWidth={1.6} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-black text-slate-900 dark:text-slate-100">تناژ به تفکیک خط</h3>
          {tonnageByLine.length === 0 ? <div className="py-10 text-center text-xs text-slate-400">داده‌ای نیست</div> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={tonnageByLine} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} angle={-14} height={36} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip contentStyle={tip} formatter={(v: number, n: string) => [`${formatNumber(v)}`, n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="feed" name="ورودی" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="product" name="محصول" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="tailing" name="باطله" fill="#fb923c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-black text-slate-900 dark:text-slate-100">توقف به تفکیک خط</h3>
          {downtimeByLine.length === 0 ? <div className="py-10 text-center text-xs text-slate-400">داده‌ای نیست</div> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={downtimeByLine} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}٪`}>
                  {downtimeByLine.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                </Pie>
                <Tooltip contentStyle={tip} formatter={(v: number) => [`${v} ساعت`, 'توقف']} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-black text-slate-900 dark:text-slate-100">علت‌های توقف</h3>
          {downtimeByCause.length === 0 ? <div className="py-10 text-center text-xs text-slate-400">داده‌ای نیست</div> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={downtimeByCause} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#334155' }} width={92} />
                <Tooltip contentStyle={tip} formatter={(v: number) => [`${v} ساعت`, 'توقف']} />
                <Bar dataKey="value" fill="#ef4444" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-black text-slate-900 dark:text-slate-100">بار شیفت‌ها + تناژ</h3>
          {shiftLoad.length === 0 ? <div className="py-10 text-center text-xs text-slate-400">داده‌ای نیست</div> : (
            <div className="space-y-3">
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={shiftLoad} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip contentStyle={tip} />
                  <Bar dataKey="value" fill="#0f172a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60"><div className="text-[11px] font-bold text-slate-500">تناژ روز</div><div className="text-sm font-black">{formatNumber(counts.tonnages)}</div></div>
                <div className="rounded-xl bg-violet-50 p-3 text-center dark:bg-violet-950/30"><div className="text-[11px] font-bold text-violet-600">ریز عملکرد</div><div className="text-sm font-black text-violet-700">{formatNumber(counts.reports)}</div></div>
                <div className="rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-950/30"><div className="text-[11px] font-bold text-amber-600">عملکرد</div><div className="text-sm font-black text-amber-700">{formatNumber(counts.analyses)}</div></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link to="/logs" className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition dark:border-slate-800 dark:bg-slate-900">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-50 to-transparent opacity-0 group-hover:opacity-100 transition dark:from-rose-950/20" />
          <div className="relative flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white"><ClipboardList className="h-5 w-5" /></div><div><div className="text-sm font-black text-slate-900 dark:text-white">توقفات خط تولید</div><div className="text-xs text-slate-500">ثبت و گزارش توقفات — شیفت خط‌محور</div></div><ArrowLeft className="mr-auto h-4 w-4 text-slate-400 group-hover:text-slate-900" /></div>
        </Link>
        <Link to="/production" className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition dark:border-slate-800 dark:bg-slate-900">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-50 to-transparent opacity-0 group-hover:opacity-100 transition dark:from-violet-950/20" />
          <div className="relative flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white"><FlaskConical className="h-5 w-5" /></div><div><div className="text-sm font-black text-slate-900 dark:text-white">ریز عملکرد</div><div className="text-xs text-slate-500">آنالیز کارخانه + فرمول</div></div><ArrowLeft className="mr-auto h-4 w-4 text-slate-400 group-hover:text-slate-900" /></div>
        </Link>
        <Link to="/performance" className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition dark:border-slate-800 dark:bg-slate-900">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-transparent opacity-0 group-hover:opacity-100 transition dark:from-amber-950/20" />
          <div className="relative flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white"><Activity className="h-5 w-5" /></div><div><div className="text-sm font-black text-slate-900 dark:text-white">عملکرد بخش تولید</div><div className="text-xs text-slate-500">Actual Analysis</div></div><ArrowLeft className="mr-auto h-4 w-4 text-slate-400 group-hover:text-slate-900" /></div>
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100"><Calendar className="h-4 w-4 text-orange-500" /> آخرین توقفات</h3>
          <Link to="/logs" className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white hover:bg-black dark:bg-white dark:text-slate-900">مشاهده همه <ArrowLeft className="h-3 w-3" /></Link>
        </div>
        {recentLogs.length === 0 ? <div className="py-10 text-center text-xs text-slate-400">هنوز توقفی ثبت نشده</div> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentLogs.map(l => (
              <motion.div key={l.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white dark:bg-white dark:text-slate-900">{l.line.name}</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatDate(l.date)}</span>
                  {l.shift && <span className="hidden text-xs text-slate-500 sm:inline">· {l.shift.name}</span>}
                  {l.device && <span className="hidden items-center gap-1 text-xs text-slate-500 sm:inline-flex"><Cpu className="h-3 w-3" />{l.device.name}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="hidden text-slate-500 sm:inline">ورودی {formatNumber(l.feed_tonnage)}</span>
                  <span className="hidden text-slate-500 sm:inline">خروجی {formatNumber(l.product_tonnage)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-black ${ (l.efficiency ?? 0) >= 80 ? 'bg-emerald-100 text-emerald-700' : (l.efficiency ?? 0) >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{formatPercent(l.efficiency)}</span>
                  <span className={`hidden sm:inline ${l.downtime_hours > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>{formatHours(l.downtime_hours)} توقف</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
