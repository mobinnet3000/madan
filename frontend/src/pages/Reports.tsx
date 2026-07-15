import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileSpreadsheet,
  Download,
  BarChart2,
  Activity as ActivityIcon,
  X,
  Filter,
  TrendingUp,
  Calendar,
  PieChart as PieChartIcon,
  AreaChart as AreaChartIcon,
} from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { useAuth } from '../store/AuthContext'
import {
  fetchAllLogs,
  updateLog,
  deleteLog,
  createLog,
} from '../api/logs'
import { exportToExcel } from '../utils'
import type { DeviceLog } from '../types'
import type { LogFilters } from '../types'
import { Loading, EmptyState, ErrorBanner } from '../components/ui/States'
import Modal from '../components/ui/Modal'
import { formatDate, formatNumber, rangeBounds, ReportRange } from '../utils'
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'

function ReportFilters({ onChange, initial }: { onChange: (f: LogFilters) => void; initial: LogFilters }) {
  const { selectedFactory } = useFactory()
  const [local, setLocal] = useState<LogFilters>(initial)
  const [show, setShow] = useState(false)

  const apply = () => {
    onChange(local)
    setShow(false)
  }

  return (
    <div>
      <button
        onClick={() => setShow((s) => !s)}
        className="btn-outline flex items-center gap-2"
      >
        <Filter className="h-4 w-4" /> فیلترها
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative z-10 mt-3 rounded-2xl border border-ink-200 bg-white p-4 shadow-lg"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div>
                <label className="label">خط</label>
                <select
                  className="input"
                  value={local.line ?? ''}
                  onChange={(e) => setLocal({ ...local, line: e.target.value ? Number(e.target.value) : undefined })}
                >
                  <option value="">همه</option>
                  {selectedFactory?.lines.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">شیفت</label>
                <select
                  className="input"
                  value={local.shift ?? ''}
                  onChange={(e) => setLocal({ ...local, shift: e.target.value ? Number(e.target.value) : undefined })}
                >
                  <option value="">همه</option>
                  {selectedFactory?.shifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">از تاریخ</label>
                <input type="date" className="input" value={local.date_from || ''} onChange={(e) => setLocal({ ...local, date_from: e.target.value || undefined })} />
              </div>
              <div>
                <label className="label">تا تاریخ</label>
                <input type="date" className="input" value={local.date_to || ''} onChange={(e) => setLocal({ ...local, date_to: e.target.value || undefined })} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => { setLocal({}); onChange({}); setShow(false); }}>
                <X className="h-4 w-4" /> پاک کردن
              </button>
              <button className="btn-primary" onClick={apply}>
                اعمال فیلترها
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function generateReportsData(logs: DeviceLog[]): Record<string, any>[] {
  return logs.map((l) => {
    const factory = l.line?.factory?.name || '—'
    const line = l.line?.name || '—'
    const shift = l.shift?.name || '—'
    const device = l.device?.name || 'بدون دستگاه'
    const cause = l.failure_cause?.title || 'بدون علت'
    return {
      'کارخانه': factory,
      'خط': line,
      'شیفت': shift,
      'دستگاه': device,
      'علت خرابی': cause,
      'روز': l.date,
      'ساعات کارکرد': l.runtime_hours,
      'ساعات توقف': l.downtime_hours,
      'تناژ ورودی': l.feed_tonnage,
      'تناژ خروجی': l.product_tonnage,
      'تناژ باطله': l.tailing_tonnage,
      'راندمان': l.efficiency,
      'آیا آنالیزور؟': l.device?.is_analyzer ? 'بله' : 'خیر',
      'شرح خرابی': l.failure_description || '—',
      'شرح اقدامات': l.repair_description || '—',
    }
  })
}

function getLogRangeStats(logs: DeviceLog[]) {
  // راندمان به تفکیک خط
  const efficiencyByLine = logs.reduce((acc, l) => {
    if (!l.line?.name) return acc
    if (!acc[l.line.name]) acc[l.line.name] = { product: 0, feed: 0, count: 0 }
    if (l.efficiency != null) {
      acc[l.line.name].product += l.efficiency
      acc[l.line.name].feed += 1
    }
    return acc
  }, {} as Record<string, { product: number; feed: number; count: number }>)

  const lineEfficiency = Object.entries(efficiencyByLine).map(([name, v]) => ({
    name,
    راندمان: v.feed ? (v.product / v.feed) * 100 : 0,
  }))

  // تناژ به تفکیک علت خرابی
  const tonnageByFailure = logs.reduce((acc, l) => {
    const cause = l.failure_cause?.title || 'بدون علت'
    if (!acc[cause]) acc[cause] = { feed: 0, product: 0, downtime: 0 }
    acc[cause].feed += l.feed_tonnage
    acc[cause].product += l.product_tonnage
    acc[cause].downtime += l.downtime_hours
    return acc
  }, {} as Record<string, { feed: number; product: number; downtime: number }>)

  const failureTonnage = Object.entries(tonnageByFailure).map(([name, v]) => ({
    name,
    تناژ: v.feed,
    ساعات_توقف: v.downtime,
  }))

  // تناژ در طول زمان
  const dailyData = logs.reduce((acc, l) => {
    if (!acc[l.date]) acc[l.date] = { روز: l.date, ورودی: 0, خروجی: 0, باطله: 0 }
    acc[l.date].ورودی += l.feed_tonnage
    acc[l.date].خروجی += l.product_tonnage
    acc[l.date].باطله += l.tailing_tonnage
    return acc
  }, {} as Record<string, { روز: string; ورودی: number; خروجی: number; باطله: number }>)

  const dailyChartData = Object.values(dailyData).sort((a, b) => a.روز.localeCompare(b.روز))

  // توزیع شیفت
  const shiftCounts = logs.reduce((acc, l) => {
    const shift = l.shift?.name || 'بدون شیفت'
    acc[shift] = (acc[shift] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const shiftPieData = Object.entries(shiftCounts).map(([name, value]) => ({ name, value }))

  return {
    lineEfficiency,
    failureTonnage,
    dailyChartData,
    shiftPieData,
  }
}

export default function Reports() {
  const { selectedFactory } = useFactory()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.is_superuser

  const [tab, setTab] = useState<'charts' | 'logs'>('charts')
  const [logs, setLogs] = useState<DeviceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<LogFilters>({})
  const [exporting, setExporting] = useState(false)
  const [range, setRange] = useState<ReportRange>('daily')

  const load = async () => {
    setLoading(true)
    const bounds = rangeBounds(range)
    const query = tab === 'charts'
      ? { ...filters, date_from: bounds.from, date_to: bounds.to }
      : filters
    try {
      const data = await fetchAllLogs(query, tab === 'charts' ? 120 : 200, (chunk) => {
        setLogs((prev) => {
          const merged = [...prev, ...chunk]
          return merged.filter((l, idx, arr) => idx === arr.findIndex((x) => x.id === l.id))
        })
      })
      setLogs(data)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedFactory) load()
  }, [selectedFactory, filters, range, tab])

  const filteredLogs = useMemo(() => logs, [logs])
  const reportStats = useMemo(() => getLogRangeStats(filteredLogs), [filteredLogs])

  const handleExport = async () => {
    try {
      setExporting(true)
      await exportToExcel(generateReportsData(filteredLogs), 'گزارشات_کارخانه')
    } catch {
    } finally {
      setExporting(false)
    }
  }

  if (!isAdmin) {
    return (
      <EmptyState
        icon={<ActivityIcon className="h-10 w-10" />}
        title="دسترسی غیرمجاز"
        description="شما به این بخش دسترسی ندارید. فقط ادمین‌ها می‌توانند گزارش‌ها را مشاهده کنند."
      />
    )
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900">گزارش‌ها و تحلیل‌ها</h1>
          <p className="text-sm text-ink-500">
            خروجی‌های پویا، نمودارهای مجموع‌بندی‌شده و داده‌های خام Excel برای تمام کارخانه‌ها
          </p>
        </div>
        <div className="flex gap-2">
          {(['charts', 'logs'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`btn-outline ${tab === t ? 'bg-brand-50 border-brand-500 text-brand-700' : ''}`}
            >
              {t === 'charts' ? 'نمودارها' : 'گزارش عملکرد'}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <AnimatePresence mode="wait">
        {tab === 'charts' ? (
          <motion.div key="charts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="space-y-6">
              <div className="card p-5">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-ink-900">نمودارهای عملکرد</h2>
                    <p className="text-sm text-ink-500">روند تناژ و تولید بر اساس بازه زمانی انتخاب‌شده</p>
                  </div>
                  <div className="flex gap-2">
                    {(['daily', 'weekly', 'monthly'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setRange(r)}
                        className={`btn-outline ${range === r ? 'bg-brand-50 border-brand-500 text-brand-700' : ''}`}
                      >
                        {r === 'daily' ? 'روزانه' : r === 'weekly' ? 'هفتگی' : 'ماهانه'}
                      </button>
                    ))}
                  </div>
                </div>

                {(() => {
                  return (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="rounded-xl bg-ink-50 p-4">
                        <div className="text-xs text-ink-400">تناژ ورودی</div>
                        <div className="text-xl font-bold text-ink-800">{(reportStats.dailyChartData.reduce((s, v) => s + v.ورودی, 0) / 1000).toFixed(1)} تن</div>
                      </div>
                      <div className="rounded-xl bg-ink-50 p-4">
                        <div className="text-xs text-ink-400">تناژ خروجی</div>
                        <div className="text-xl font-bold text-emerald-600">{(reportStats.dailyChartData.reduce((s, v) => s + v.خروجی, 0) / 1000).toFixed(1)} تن</div>
                      </div>
                      <div className="rounded-xl bg-ink-50 p-4">
                        <div className="text-xs text-ink-400">تناژ باطله</div>
                        <div className="text-xl font-bold text-amber-600">{(reportStats.dailyChartData.reduce((s, v) => s + v.باطله, 0) / 1000).toFixed(1)} تن</div>
                      </div>
                    </div>
                  )
                })()}

                <div className="mt-6 h-72">
                  {loading ? <Loading /> : filteredLogs.length === 0 ? (
                    <EmptyState icon={<BarChart2 className="h-10 w-10" />} title="داده‌ای برای نمایش وجود ندارد" description={`داده‌ای برای بازه ${range} وجود ندارد.`} />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={(() => {
                        const grouped = filteredLogs.reduce((acc, l) => {
                          const key = range === 'daily' ? l.date : (range === 'weekly' ? l.date.substring(0, 7) : l.date.substring(0, 4) + '-' + l.date.substring(5, 7))
                          if (!acc[key]) acc[key] = { name: key, ورودی: 0, خروجی: 0, باطله: 0, downtime: 0 }
                          acc[key].ورودی += l.feed_tonnage
                          acc[key].خروجی += l.product_tonnage
                          acc[key].باطله += l.tailing_tonnage
                          acc[key].downtime += l.downtime_hours
                          return acc
                        }, {} as Record<string, any>)
                        return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name))
                      })()} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                        <Tooltip contentStyle={{ fontFamily: 'Vazirmatn, sans-serif', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                        <Bar dataKey="ورودی" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="خروجی" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="باطله" stackId="a" fill="#fb923c" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="card p-5">
                  <h3 className="mb-4 text-sm font-bold text-ink-700">راندمان به تفکیک خط</h3>
                  {loading ? <Loading /> : (() => {
                    return reportStats.lineEfficiency.length === 0 ? (
                      <EmptyState title="داده‌ای برای نمایش وجود ندارد" description="داده‌ای کافی برای نمایش راندمان خطوط وجود ندارد." />
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={reportStats.lineEfficiency} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                            <Tooltip contentStyle={{ fontFamily: 'Vazirmatn, sans-serif', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                            <Bar dataKey="راندمان" fill="#f97316" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )
                  })()}
                </div>

                <div className="card p-5">
                  <h3 className="mb-4 text-sm font-bold text-ink-700">توزیع شیفت</h3>
                  {loading ? <Loading /> : (() => {
                    return reportStats.shiftPieData.length === 0 ? (
                      <EmptyState title="داده‌ای برای نمایش وجود ندارد" description="داده‌ای کافی برای نمایش توزیع شیفت وجود ندارد." />
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={reportStats.shiftPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                              {reportStats.shiftPieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={['#0ea5e9', '#10b981', '#f97316', '#8b5cf6', '#ec4899'][index % 5]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ fontFamily: 'Vazirmatn, sans-serif', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="logs" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="space-y-4">
              <div className="card flex flex-wrap items-end justify-between gap-3 p-4">
                <ReportFilters onChange={(f) => { setFilters(f); load(); }} initial={filters} />
                <button onClick={handleExport} className="btn-outline flex items-center gap-2" disabled={exporting || filteredLogs.length === 0}>
                  <Download className="h-4 w-4" /> {exporting ? 'در حال خروجی‌سازی...' : 'خروجی Excel'}
                </button>
              </div>

              {loading ? <Loading /> : filteredLogs.length === 0 ? (
                <EmptyState icon={<FileSpreadsheet className="h-10 w-10" />} title="گزارشی یافت نشد" description="هیچ گزارشی با فیلترهای انتخاب‌شده موجود نیست." />
              ) : (
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500">
                          <th className="px-4 py-3 font-semibold">کارخانه</th>
                          <th className="px-4 py-3 font-semibold">خط</th>
                          <th className="px-4 py-3 font-semibold">شیفت</th>
                          <th className="px-4 py-3 font-semibold">دستگاه</th>
                          <th className="px-4 py-3 font-semibold">علت خرابی</th>
                          <th className="px-4 py-3 font-semibold">تاریخ</th>
                          <th className="px-4 py-3 font-semibold">ساعت کارکرد</th>
                          <th className="px-4 py-3 font-semibold">ساعت توقف</th>
                          <th className="px-4 py-3 font-semibold">راندمان</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {filteredLogs.map((l) => (
                          <tr key={l.id} className="hover:bg-ink-50/50">
                            <td className="px-4 py-3 font-medium text-ink-700">{l.line?.factory?.name}</td>
                            <td className="px-4 py-3">{l.line?.name}</td>
                            <td className="px-4 py-3">{l.shift?.name}</td>
                            <td className="px-4 py-3">{l.device?.name || <span className="text-ink-400">—</span>}</td>
                            <td className="px-4 py-3">{l.failure_cause?.title || <span className="text-ink-400">—</span>}</td>
                            <td className="px-4 py-3">{l.date}</td>
                            <td className="px-4 py-3">{l.runtime_hours}</td>
                            <td className="px-4 py-3">{l.downtime_hours}</td>
                            <td className="px-4 py-3 font-semibold text-emerald-600">{l.efficiency}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
