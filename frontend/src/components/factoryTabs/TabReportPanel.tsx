import { useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'
import { AlertTriangle } from 'lucide-react'
import { formatNumber } from '../../utils'
import type {
  FactoryTabBrief,
  FactoryTabReportRun,
  ReportWidgetData,
  ReportWidgetResult,
} from '../../types'
import { tabInputLabel } from '../../utils/outputLabels'

const PALETTE = ['#0f2040', '#ea580c', '#059669', '#7c3aed', '#0284c7', '#dc2626', '#0891b2', '#65a30d']
const PIE_COLORS = ['#0f2040', '#ea580c', '#059669', '#7c3aed', '#0284c7', '#dc2626', '#0891b2', '#65a30d', '#e11d48', '#a16207']

const cellVal = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return formatNumber(v)
  return String(v)
}

export default function TabReportPanel({ run, tab }: { run: FactoryTabReportRun; tab: FactoryTabBrief | null }) {
  const metrics = useMemo(() => run.metrics, [run])
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500 dark:text-slate-400">
        <span className="rounded-full bg-slate-900 px-2.5 py-1 font-bold text-white dark:bg-white dark:text-slate-900">{formatNumber(run.record_count)} رکورد</span>
        {metrics.map((m) => (
          <span key={m.key} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {m.label}: <span className="font-bold text-brand-600">{m.value == null ? '—' : formatNumber(m.value)}{m.unit ? ` ${m.unit}` : ''}</span>
          </span>
        ))}
      </div>
      {run.widgets.length === 0 && (
        <div className="card p-6 text-center text-sm text-ink-500 dark:text-slate-400">
          برای این گزارش ویجتی تعریف نشده است. از بخش «تعریف تب و گزارش» ویجت اضافه کنید.
        </div>
      )}
      {run.widgets.map((w) => (
        <WidgetBlock key={w.id} widget={w} tab={tab} />
      ))}
    </div>
  )
}

function WidgetBlock({ widget, tab }: { widget: ReportWidgetResult; tab: FactoryTabBrief | null }) {
  if (widget.error) {
    return (
      <div className="card p-4">
        <div className="mb-2 text-sm font-bold text-ink-700 dark:text-slate-200">{widget.title}</div>
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {widget.error}
        </div>
      </div>
    )
  }
  const data = widget.data
  if (!data) return null
  if (widget.type === 'kpi') return <KpiWidget title={widget.title} data={data} />
  if (widget.type === 'stat_table') return <StatTableWidget title={widget.title} data={data} tab={tab} />
  if (widget.type === 'group_table') return <GroupTableWidget title={widget.title} data={data} tab={tab} />
  if (widget.type === 'chart') return <ChartWidget title={widget.title} data={data} />
  return null
}

function KpiWidget({ title, data }: { title: string; data: ReportWidgetData }) {
  const cards = data.cards ?? []
  return (
    <div className="card p-4">
      <div className="mb-3 text-sm font-bold text-ink-700 dark:text-slate-200">{title}</div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="text-xs text-ink-500 dark:text-slate-400">{c.label}</div>
            <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">{c.value == null ? '—' : formatNumber(c.value)}</div>
            {!!Object.keys(c.sub ?? {}).length && (
              <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-ink-400 dark:text-slate-500">
                {Object.entries(c.sub).map(([k, v]) => (
                  <span key={k}>{k}: <span className="font-semibold text-ink-600 dark:text-slate-300">{v == null ? '—' : formatNumber(v)}</span></span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatTableWidget({ title, data, tab }: { title: string; data: ReportWidgetData; tab: FactoryTabBrief | null }) {
  const cols = data.columns ?? []
  const rows = data.rows ?? []
  return (
    <div className="card overflow-hidden">
      <div className="px-4 pt-4 text-sm font-bold text-ink-700 dark:text-slate-200">{title}</div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
              <th className="px-4 py-2.5 font-semibold">پارامتر</th>
              {cols.filter((c) => c !== 'field' && c !== 'label').map((c) => (
                <th key={c} className="px-4 py-2.5 font-semibold">{statLabel(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
            {rows.map((r, i) => (
              <tr key={i} className="transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-2.5 font-medium text-ink-700 dark:text-slate-200">{fieldLabel(String(r.field ?? ''), String(r.label ?? ''), tab)}</td>
                {cols.filter((c) => c !== 'field' && c !== 'label').map((c) => (
                  <td key={c} className="px-4 py-2.5 dark:text-slate-300">{cellVal(r[c])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GroupTableWidget({ title, data, tab }: { title: string; data: ReportWidgetData; tab: FactoryTabBrief | null }) {
  const cols = data.columns ?? []
  const rows = data.rows ?? []
  const total = data.total
  return (
    <div className="card overflow-hidden">
      <div className="px-4 pt-4 text-sm font-bold text-ink-700 dark:text-slate-200">{title}</div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
              <th className="px-4 py-2.5 font-semibold">گروه</th>
              <th className="px-4 py-2.5 font-semibold">تعداد</th>
              {cols.filter((c) => c !== 'label' && c !== 'count').map((c) => (
                <th key={c} className="px-4 py-2.5 font-semibold">{aggColLabel(c, tab)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
            {rows.map((r, i) => (
              <tr key={i} className="transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-2.5 font-medium text-ink-700 dark:text-slate-200">{String(r.label ?? '—')}</td>
                <td className="px-4 py-2.5 dark:text-slate-300">{cellVal(r.count)}</td>
                {cols.filter((c) => c !== 'label' && c !== 'count').map((c) => (
                  <td key={c} className="px-4 py-2.5 dark:text-slate-300">{cellVal(r[c])}</td>
                ))}
              </tr>
            ))}
            {total && (
              <tr className="bg-ink-50/70 font-bold dark:bg-slate-800/70">
                <td className="px-4 py-2.5 text-ink-800 dark:text-slate-100">{String(total.label ?? 'جمع کل')}</td>
                <td className="px-4 py-2.5 dark:text-slate-200">{cellVal(total.count)}</td>
                {cols.filter((c) => c !== 'label' && c !== 'count').map((c) => (
                  <td key={c} className="px-4 py-2.5 dark:text-slate-200">{cellVal(total[c])}</td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ChartWidget({ title, data }: { title: string; data: ReportWidgetData }) {
  const points = (data.points ?? []).map((p) => ({
    name: truncate(String(p.label ?? p.x ?? ''), 14),
    fullName: String(p.label ?? p.x ?? ''),
    value: typeof p.value === 'number' ? p.value : 0,
  }))
  if (!points.length) {
    return (
      <div className="card p-4">
        <div className="mb-2 text-sm font-bold text-ink-700 dark:text-slate-200">{title}</div>
        <div className="text-sm text-ink-400">داده‌ای برای نمودار نیست.</div>
      </div>
    )
  }
  return (
    <div className="card p-4">
      <div className="mb-1 text-sm font-bold text-ink-700 dark:text-slate-200">{title}</div>
      <div className="mb-2 text-xs text-ink-400">{data.value_label ?? ''}</div>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          {data.chart === 'pie' ? (
            <PieChart>
              <Pie data={points} dataKey="value" nameKey="fullName" innerRadius={48} outerRadius={88}>
                {points.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: unknown) => formatNumber(Number(v))} />
              <Legend />
            </PieChart>
          ) : data.chart === 'line' ? (
            <LineChart data={points}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} width={48} />
              <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.fullName ?? ''} formatter={(v: unknown) => formatNumber(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#ea580c" strokeWidth={2} dot={false} name={data.value_label ?? 'مقدار'} />
            </LineChart>
          ) : (
            <BarChart data={points}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} width={48} />
              <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.fullName ?? ''} formatter={(v: unknown) => formatNumber(Number(v))} />
              <Legend />
              <Bar dataKey="value" fill={PALETTE[0]} name={data.value_label ?? 'مقدار'}>
                {points.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function statLabel(s: string): string {
  return { sum: 'جمع کل', avg: 'میانگین', min: 'کمینه', max: 'بیشینه', count: 'تعداد مقدار' }[s] ?? s
}

function fieldLabel(ref: string, label: string, tab: FactoryTabBrief | null): string {
  if (label && label !== ref) return label
  const [src, key] = ref.split('.')
  if (src === 'in') return tabInputLabel(tab, key ?? ref)
  const found = tab?.outputs.find((o) => o.key === (key ?? ref))?.name
  return found || ref
}

function aggColLabel(col: string, tab: FactoryTabBrief | null): string {
  const idx = col.lastIndexOf('__')
  if (idx < 0) return col
  const ref = col.slice(0, idx)
  const stat = col.slice(idx + 2)
  return `${fieldLabel(ref, ref, tab)} (${statLabel(stat)})`
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}
