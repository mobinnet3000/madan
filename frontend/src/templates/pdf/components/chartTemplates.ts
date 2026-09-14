import { esc } from '../../../utils/pdf/helpers'
import type { PdfChartConfig } from '../../../utils/pdf/types'

const PALETTE = ['#1e3a5f', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316']

export function chartBar(cfg: PdfChartConfig): string { return renderChart({ ...cfg, type: 'bar' }) }
export function chartLine(cfg: PdfChartConfig): string { return renderChart({ ...cfg, type: 'line' }) }
export function chartPie(cfg: PdfChartConfig): string { return renderChart({ ...cfg, type: 'pie' }) }
export function chartArea(cfg: PdfChartConfig): string { return renderChart({ ...cfg, type: 'area' }) }
export function chartDonut(cfg: PdfChartConfig): string { return renderChart({ ...cfg, type: 'donut' }) }

export function renderChart(cfg: PdfChartConfig): string {
  const max = Math.max(1, ...cfg.datasets.flatMap((d) => d.data))
  const legend = cfg.showLegend !== false ? `<div class="pdf-chart-legend">${cfg.datasets.map((d, i) => `<span><i style="background:${esc(d.color ?? PALETTE[i % PALETTE.length])}"></i> ${esc(d.label)}</span>`).join('')}</div>` : ''
  const title = cfg.title ? `<div class="pdf-chart-title">${esc(cfg.title)}</div>` : ''
  if (cfg.type === 'pie' || cfg.type === 'donut') {
    const total = cfg.datasets[0]?.data.reduce((a, b) => a + b, 0) || 1
    const inner = cfg.type === 'donut' ? 'border-radius:999px;' : ''
    const rows = cfg.labels.map((lb, idx) => {
      const v = cfg.datasets[0]?.data[idx] ?? 0
      const pct = Math.round((v / total) * 100)
      const col = cfg.datasets[0]?.color ?? PALETTE[idx % PALETTE.length]
      const bar = `<div style="flex:1;height:8px;border-radius:999px;background:#e2e8f0;overflow:hidden"><div style="width:${pct}%;height:100%;background:${esc(col)}"></div></div>`
      return `<div style="display:flex;align-items:center;gap:8px;margin:5px 0"><span style="width:10px;height:10px;${inner}background:${esc(col)};display:inline-block"></span><span style="font-size:8px;flex:1">${esc(lb)}</span>${bar}<span style="font-size:7px;font-weight:700;min-width:56px;text-align:left">${esc(String(v))} (${pct}٪)</span></div>`
    }).join('')
    return `<div class="pdf-chart-wrap">${title}${rows}${legend}</div>`
  }
  if (cfg.type === 'line' || cfg.type === 'area') {
    const height = 88
    const pad = 6
    const w = 420
    const step = cfg.labels.length > 1 ? (w - pad * 2) / (cfg.labels.length - 1) : w
    const lines = cfg.datasets.map((ds, di) => {
      const col = ds.color ?? PALETTE[di % PALETTE.length]
      const pts = ds.data.map((v, i) => `${pad + i * step},${height - pad - (v / max) * (height - pad * 2)}`).join(' ')
      const dots = ds.data.map((v, i) => `<circle cx="${pad + i * step}" cy="${height - pad - (v / max) * (height - pad * 2)}" r="2.5" fill="${esc(col)}" />`).join('')
      const fill = cfg.type === 'area' ? `<polygon points="${pts} ${pad + (ds.data.length - 1) * step},${height - pad} ${pad},${height - pad}" fill="${esc(col)}" opacity="0.12" />` : ''
      return `${fill}<polyline fill="none" stroke="${esc(col)}" stroke-width="2" points="${pts}" />${dots}`
    }).join('')
    const xlabels = cfg.labels.map((lb, i) => `<text x="${pad + i * step}" y="${height - 1}" text-anchor="middle" font-size="5.5" fill="#64748b">${esc(lb)}</text>`).join('')
    return `<div class="pdf-chart-wrap">${title}<svg viewBox="0 0 ${w} ${height}" width="100%" height="${height}" style="display:block">${lines}${xlabels}</svg>${legend}</div>`
  }
  const bars = cfg.labels.map((lb, idx) => {
    const vals = cfg.datasets.map((d, di) => ({ v: d.data[idx] ?? 0, c: d.color ?? PALETTE[di % PALETTE.length] }))
    const stack = (cfg.stacked ? vals : [vals[0]]).map((it) => `<div class="pdf-chart-bar" style="height:${Math.max(3, Math.round((it.v / max) * 100))}%;background:${esc(it.c)}">${it.v ? esc(String(it.v)) : ''}</div>`).join('')
    const label = `<div style="font-size:5.5px;color:#64748b;text-align:center;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(lb)}</div>`
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:stretch">${cfg.stacked ? `<div style="display:flex;flex-direction:column;gap:1px;height:96px;justify-content:end">${stack}</div>` : `<div style="display:flex;gap:2px;align-items:end;height:96px">${stack}</div>`}${label}</div>`
  }).join('')
  return `<div class="pdf-chart-wrap">${title}<div class="pdf-chart-bars" style="height:110px">${bars}</div>${legend}</div>`
}

export function emptyChartHtml(title: string): string {
  return `<div class="pdf-chart-wrap"><div class="pdf-chart-title">${esc(title)}</div><div style="padding:18px;text-align:center;font-size:8px;color:#94a3b8">داده‌ای برای نمایش وجود ندارد</div></div>`
}
