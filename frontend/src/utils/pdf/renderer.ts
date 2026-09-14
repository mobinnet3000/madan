import { DEFAULT_PAGE, DEFAULT_STYLE, buildPageCss } from './styles'
import { emptyStateHtml, esc, kpiCardHtml, sectionTitleHtml, summaryGridHtml, chipsHtml, dividerHtml, badgeHtml, todayFa } from './helpers'
import { htmlToPdf } from './printer'
import type { PdfChartConfig, PdfCoverConfig, PdfFilterConfig, PdfKpiConfig, PdfRenderOptions, PdfTableConfig } from './types'

function mergeDefaults(opts: Partial<PdfRenderOptions>): PdfRenderOptions {
  const branding = { factoryName: '', primaryColor: '#1e3a5f', ...(opts.branding ?? {}) }
  const style = { ...DEFAULT_STYLE, ...(opts.style ?? {}) }
  const page = { ...DEFAULT_PAGE, ...(opts.page ?? {}), margins: { ...DEFAULT_PAGE.margins, ...(opts.page?.margins ?? {}) } }
  const headerBase = {
    variant: 'branded' as const,
    height: page.headerHeight,
    branding,
    title: opts.title ?? '',
    subtitle: undefined as string | undefined,
    showLogo: true,
    showDate: true,
  }
  const header = { ...headerBase, ...(opts.header ?? {}), branding, title: (opts.header?.title ?? opts.title ?? '') as string }
  const footerBase = {
    variant: 'standard' as const,
    height: page.footerHeight,
    branding,
    showPageNumbers: true,
    showPrintDate: true,
  }
  const footer = { ...footerBase, ...(opts.footer ?? {}), branding }
  return {
    title: opts.title ?? header.title ?? 'گزارش',
    fileName: opts.fileName ?? 'report',
    branding,
    page,
    header,
    footer,
    style,
    cover: opts.cover,
    filters: opts.filters,
    kpis: opts.kpis,
    charts: opts.charts,
    tables: opts.tables,
    sections: opts.sections,
    summary: opts.summary,
    watermark: opts.watermark,
    rtl: opts.rtl ?? true,
    locale: opts.locale ?? 'fa-IR',
  } as PdfRenderOptions
}

function renderCover(cover?: PdfCoverConfig): string {
  if (!cover) return ''
  return `<section class="pdf-cover">
    ${cover.logoUrl ? `<img src="${esc(cover.logoUrl)}" alt="logo" style="width:72px;height:72px;object-fit:contain;margin:0 auto 12px;display:block" />` : ''}
    <div class="pdf-cover-title">${esc(cover.title)}</div>
    ${cover.subtitle ? `<div class="pdf-cover-sub">${esc(cover.subtitle)}</div>` : ''}
    <div class="pdf-cover-meta">
      <div>${esc(cover.factoryName)}${cover.factoryAddress ? ` — ${esc(cover.factoryAddress)}` : ''}</div>
      ${cover.dateFrom || cover.dateTo ? `<div>بازه: ${esc(cover.dateFrom ?? '')} تا ${esc(cover.dateTo ?? '')}</div>` : ''}
      <div>تاریخ تولید: ${esc(cover.generatedAt)}${cover.generatedBy ? ` — ${esc(cover.generatedBy)}` : ''}</div>
      ${cover.recordCount != null ? `<div>تعداد رکورد: ${esc(String(cover.recordCount))}</div>` : ''}
    </div>
  </section>`
}

function renderFilters(filters?: PdfFilterConfig): string {
  if (!filters) return ''
  const chips = chipsHtml(filters.chips ?? [])
  return `<section class="pdf-section filter-section">
    ${sectionTitleHtml(filters.title || 'فیلترهای اعمال‌شده', filters.summary)}
    <div class="pdf-chip-wrap">${chips}</div>
    ${filters.dateFrom || filters.dateTo ? `<div style="font-size:8px;color:#64748b;margin-top:4px">بازه: ${esc(filters.dateFrom ?? '—')} تا ${esc(filters.dateTo ?? '—')}</div>` : ''}
  </section>`
}

function renderKpis(kpis?: PdfKpiConfig): string {
  if (!kpis || !kpis.cards.length) return ''
  const cols = Math.max(1, Math.min(4, kpis.columns || 4))
  return `<section class="pdf-section kpi-section">
    ${sectionTitleHtml('شاخص‌های کلیدی')}
    <div class="pdf-kpi-grid" style="grid-template-columns:repeat(${cols},1fr)">${kpis.cards.map(kpiCardHtml).join('')}</div>
  </section>`
}

function renderChart(cfg: PdfChartConfig): string {
  const max = Math.max(1, ...cfg.datasets.flatMap((d) => d.data))
  const colors = ['#0f2040', '#1e40af', '#0284c7', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2']
  const legend = cfg.showLegend !== false ? `<div class="pdf-chart-legend">${cfg.datasets.map((d, i) => `<span style="display:inline-flex;align-items:center;gap:4px"><i style="background:${esc(d.color ?? colors[i % colors.length])}"></i> ${esc(d.label)}</span>`).join('')}</div>` : ''
  if (cfg.type === 'pie' || cfg.type === 'donut') {
    const total = cfg.datasets[0]?.data.reduce((a, b) => a + b, 0) || 1
    const top = cfg.labels.map((lb, idx) => ({ lb, v: cfg.datasets[0]?.data[idx] ?? 0 })).sort((a, b) => b.v - a.v).slice(0, 10)
    const maxV = Math.max(1, ...top.map((t) => t.v))
    const rows = top.map((t, i) => {
      const pct = Math.round((t.v / total) * 100)
      const w = Math.max(3, Math.round((t.v / maxV) * 100))
      const col = colors[i % colors.length]
      return `<div style="display:flex;align-items:center;gap:6px;margin:4px 0"><span style="width:9px;height:9px;border-radius:3px;background:${col};flex-shrink:0"></span><span style="font-size:6.5px;flex:0 0 34%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.lb)}</span><span style="flex:1;height:7px;border-radius:4px;background:#eef2f7;overflow:hidden"><span style="display:block;height:100%;width:${w}%;background:${col};border-radius:4px"></span></span><span style="font-size:6.5px;font-weight:700;flex-shrink:0;min-width:44px;text-align:left">${esc(String(Math.round(t.v * 10) / 10))} <span style="color:#94a3b8;font-weight:400">(${pct}٪)</span></span></div>`
    }).join('')
    return `<div class="pdf-chart-wrap"><div class="pdf-chart-title">${esc(cfg.title ?? 'نمودار')}</div><div class="pdf-chart-sub">مرتب‌شده بر اساس بیشترین مقدار</div><div style="padding:4px 2px">${rows}</div>${legend}</div>`
  }
  const N = cfg.labels.length
  const showLabels = cfg.labels.map((lb) => {
    const short = lb.length > 12 ? lb.slice(0, 12) + '…' : lb
    return `<div style="flex:1;text-align:center;font-size:5.5px;color:#4b5563;white-space:normal;word-break:break-word;line-height:1.2;min-width:0;max-width:100%">${esc(short)}</div>`
  }).join('')
  const bars = cfg.labels.map((lb, idx) => {
    const d = cfg.datasets[0]
    const v = d?.data[idx] ?? 0
    const pct = Math.max(3, Math.round((v / max) * 100))
    const col = d?.color ?? colors[idx % colors.length]
    const valLbl = `<div style="font-size:5.5px;font-weight:700;color:#1e293b;white-space:nowrap;line-height:1">${v ? esc(String(Math.round(v * 10) / 10)) : '—'}</div>`
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;min-width:0;min-height:0">${valLbl}<div style="width:100%;max-width:${N > 16 ? '13px' : N > 10 ? '20px' : '30px'};height:${pct}%;min-height:4px;border-radius:3px 3px 0 0;background:linear-gradient(180deg,${col} 0%,${col}cc 100%);flex-shrink:0"></div></div>`
  }).join('')
  const title = esc(cfg.title ?? 'نمودار')
  const unit = cfg.datasets[0]?.label ? ` · واحد: ${esc(cfg.datasets[0].label)}` : ''
  return `<div class="pdf-chart-wrap"><div class="pdf-chart-title">${title}</div><div class="pdf-chart-sub">بیشینه: ${esc(String(Math.round(max * 10) / 10))}${unit} · ${N} مورد</div><div class="pdf-chart-bars" style="height:auto;min-height:96px;align-items:stretch">${bars}</div><div class="pdf-chart-labels" style="display:flex;gap:4px">${showLabels}</div>${legend}</div>`
}

function renderCharts(charts?: PdfChartConfig[]): string {
  if (!charts?.length) return ''
  return `<section class="pdf-section chart-section">${sectionTitleHtml('نمودارها')}${charts.map(renderChart).join('')}</section>`
}

function renderTable<T extends Record<string, unknown>>(cfg: PdfTableConfig<T>): string {
  const rows = cfg.rows ?? []
  if (!rows.length) return `<div class="pdf-table-wrap">${emptyStateHtml('داده‌ای وجود ندارد', cfg.emptyText ?? 'برای فیلترهای انتخابی رکوردی یافت نشد.')}</div>`
  const showNumbers = cfg.showRowNumbers
  const cols = cfg.columns
  const headerCells = [
    ...(showNumbers ? [`<th style="width:28px">#</th>`] : []),
    ...cols.map((c) => `<th style="${c.width ? `width:${esc(c.width)};` : ''}${c.align ? `text-align:${esc(c.align)};` : ''}">${esc(c.header)}</th>`),
  ].join('')
  const variantClass = cfg.variant ?? (cfg.bordered ? 'bordered' : cfg.striped === false ? '' : 'striped')
  const bodyRows = rows.slice(0, cfg.maxRows ?? 100000).map((r, idx) => {
    const cells = cols.map((c) => {
      const raw = (r as Record<string, unknown>)[c.key]
      const val = c.format ? c.format(raw, r) : raw == null || raw === '' ? '—' : String(raw)
      const isBad = c.key === 'efficiency' && typeof raw === 'number' && raw < 40
      const isGood = c.key === 'efficiency' && typeof raw === 'number' && raw > 80
      const extra = isBad ? 'color:#e11d48;font-weight:700' : isGood ? 'color:#059669;font-weight:700' : ''
      return `<td style="${c.align ? `text-align:${esc(c.align)};` : ''}${extra}">${esc(val)}</td>`
    }).join('')
    return `<tr>${showNumbers ? `<td>${idx + 1}</td>` : ''}${cells}</tr>`
  }).join('')
  return `<div class="pdf-table-wrap"><table class="pdf-table ${esc(variantClass)}"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`
}

function renderTables(tables?: PdfTableConfig[]): string {
  if (!tables?.length) return ''
  return `<section class="pdf-section table-section">${sectionTitleHtml('جدول داده‌ها')}${tables.map((t) => renderTable(t as PdfTableConfig<Record<string, unknown>>)).join('')}</section>`
}

function renderSummary(summary?: PdfRenderOptions['summary']): string {
  if (!summary || !summary.items.length) return ''
  return `<section class="pdf-section">${sectionTitleHtml(summary.title ?? 'خلاصه')}${summaryGridHtml(summary.items, summary.columns ?? 3)}</section>`
}

function renderSections(sections?: PdfRenderOptions['sections']): string {
  if (!sections?.length) return ''
  return sections.filter((s) => s.visible !== false).map((s) => {
    const brBefore = s.pageBreakBefore ? ' style="page-break-before:always"' : ''
    const brAfter = s.pageBreakAfter ? ' style="page-break-after:always"' : ''
    const title = s.title ? sectionTitleHtml(s.title, s.subtitle) : ''
    const inner = s.html ?? (s.data ? `<pre style="font-size:8px;white-space:pre-wrap;word-break:break-word">${esc(JSON.stringify(s.data, null, 2))}</pre>` : '')
    if (s.type === 'divider') return `<div${brBefore}>${dividerHtml()}</div>`
    if (s.type === 'text') return `<section class="pdf-section"${brBefore}>${title}<div style="font-size:9px;line-height:1.7">${s.html ?? ''}</div></section>`
    return `<section class="pdf-section"${brBefore}${brAfter}>${title}${inner}</section>`
  }).join('')
}

function renderHeader(opts: PdfRenderOptions): string {
  const b = opts.header
  const brand = b.branding
  const dateStr = todayFa()
  return `<div class="pdf-header">
    <div class="pdf-hd-right">
      ${b.showLogo ? `<span class="pdf-logo">${brand.logoUrl ? `<img src="${esc(brand.logoUrl)}" alt="logo" />` : 'M'}</span>` : ''}
      <span class="pdf-accent-dot"></span>
      <span style="min-width:0">
        <span class="pdf-hd-title">${esc(b.title)}</span>
        <span class="pdf-hd-sub">${b.subtitle ? esc(b.subtitle) + ' · ' : ''}${brand.factoryName ? esc(brand.factoryName) : ''}</span>
      </span>
    </div>
    <div class="pdf-hd-left">
      ${b.meta ? `<span class="pdf-hd-chip">${esc(b.meta)}</span>` : ''}
      ${b.showDate ? `<span class="pdf-hd-date">${esc(b.dateLabel ?? 'تاریخ چاپ')}: ${esc(dateStr)}</span>` : ''}
    </div>
  </div>`
}

function renderFooter(opts: PdfRenderOptions, pageNo: number, totalPages: number): string {
  const f = opts.footer
  return `<div class="pdf-footer">
    <span class="pdf-ft-right"><span class="pdf-ft-dot"></span><span style="overflow:hidden;text-overflow:ellipsis">${f.footnote ? esc(f.footnote) : esc(f.branding.factoryName ?? '')}</span>${f.showPrintDate ? `<span class="pdf-ft-date"> · ${esc(todayFa())}</span>` : ''}</span>
    ${f.showPageNumbers ? `<span class="pdf-page-pill">صفحه ${pageNo} از ${totalPages}${f.pageText ? ' · ' + esc(f.pageText) : ''}</span>` : ''}
  </div>`
}

function splitTableForSheets(tablesHtml: string): string[] {
  return [tablesHtml]
}

export function buildPdfHtml(input: Partial<PdfRenderOptions>): string {
  const opts = mergeDefaults(input)
  const style = opts.style as NonNullable<PdfRenderOptions['style']>
  const page = opts.page
  const css = buildPageCss(page, style as never)
  const header = renderHeader(opts)
  const cover = renderCover(opts.cover)
  const filters = renderFilters(opts.filters)
  const kpis = renderKpis(opts.kpis)
  const charts = renderCharts(opts.charts)
  const tables = renderTables(opts.tables)
  const summary = renderSummary(opts.summary)
  const sections = renderSections(opts.sections)
  const hasBody = !!(filters || kpis || charts || tables || summary || sections)
  const empty = !hasBody && !cover ? emptyStateHtml('داده‌ای برای نمایش وجود ندارد', 'فیلترها را تغییر دهید یا بازه دیگری انتخاب کنید.') : ''

  const firstTable = (opts.tables?.[0] ?? null) as unknown as import('./types').PdfTableConfig | null
  const dataRows = (firstTable?.rows as unknown[] | undefined)?.length ?? 0
  const extraTables = (opts.tables ?? []).slice(1)
  const extraHtml = extraTables.length ? renderTables(extraTables) : ''
  const tableHtml = dataRows === 0 ? `${tables}${extraHtml}` : renderTable(firstTable as never) + extraHtml
  const tableSection = dataRows === 0
    ? `<section class="pdf-section table-section">${sectionTitleHtml('جدول داده‌ها')}${tableHtml}</section>`
    : `<section class="pdf-section table-section">${sectionTitleHtml('جدول داده‌ها')}${tableHtml}</section>`

  const sheetHtml = (() => {
    const body = `${cover}${filters}${kpis}${charts}${tableSection}${summary}${sections}${empty}`
    return `
  <div class="pdf-sheet">
    <div class="pdf-hdr">${header}</div>
    <div class="pdf-bd pdf-bd--table"><div class="pdf-body">${body}</div></div>
    <div class="pdf-ftr">${renderFooter(opts, 1, 1)}</div>
  </div>`
  })()

  return `<!DOCTYPE html>
<html dir="${opts.rtl ? 'rtl' : 'ltr'}" lang="fa">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(opts.title)}</title>
<style>
@font-face{font-family:'Vazirmatn';src:url('/fonts/Vazirmatn-FD-Regular.ttf') format('truetype');font-weight:400}
@font-face{font-family:'Vazirmatn';src:url('/fonts/Vazirmatn-FD-Bold.ttf') format('truetype');font-weight:700}
${css}
</style>
</head>
<body>
${sheetHtml}
</body>
</html>`
}

export function printPdf(opts: Partial<PdfRenderOptions>): void {
  const merged = mergeDefaults(opts)
  const html = buildPdfHtml(merged)
  htmlToPdf(html, merged.fileName, { title: merged.title })
}

export function previewPdf(opts: Partial<PdfRenderOptions>): Window | null {
  const html = buildPdfHtml(opts)
  const win = window.open('', '_blank')
  if (!win) return null
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.document.title = opts.title ?? 'Preview'
  return win
}

export function getPdfHtml(opts: Partial<PdfRenderOptions>): string {
  return buildPdfHtml(opts)
}

export const RENDERER_VERSION = '2.0.0'
export const RENDERER_DEFAULTS = { headerHeight: '26mm', footerHeight: '13mm' } as const
export type RenderMode = 'print' | 'preview' | 'html'
export interface RenderResult { html: string; title: string; fileName: string; mode: RenderMode }
export function toRenderResult(html: string, opts: Partial<PdfRenderOptions>, mode: RenderMode = 'html'): RenderResult {
  return { html, title: opts.title ?? 'گزارش', fileName: opts.fileName ?? 'report', mode }
}
export function chunkRows<T>(rows: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}
export function estimatePages(rowCount: number, rowsPerPage = 28): number {
  return Math.max(1, Math.ceil(rowCount / rowsPerPage))
}
export function withPageBreak(html: string): string {
  return `<div style="page-break-before:always">${html}</div>`
}
export function paginateTables(tables: PdfTableConfig[], rowsPerPage = 28): PdfTableConfig[] {
  return tables.flatMap((t) => {
    if (!t.rows || t.rows.length <= rowsPerPage) return [t]
    return chunkRows(t.rows as unknown[], rowsPerPage).map((chunk, idx) => ({ ...t, rows: chunk as never[], emptyText: idx === 0 ? t.emptyText : undefined }))
  })
}
export function buildWatermark(text: string, opacity = 0.06): string {
  return `<div class="pdf-watermark" style="opacity:${opacity}">${esc(text)}</div>`
}
export function buildCoverHtml(cover?: PdfCoverConfig): string { return renderCover(cover) }
export function buildFiltersHtml(filters?: PdfFilterConfig): string { return renderFilters(filters) }
export function buildKpisHtml(kpis?: PdfKpiConfig): string { return renderKpis(kpis) }
export function buildChartsHtml(charts?: PdfChartConfig[]): string { return renderCharts(charts) }
export function buildTablesHtml(tables?: PdfTableConfig[]): string { return renderTables(tables) }
export function buildSummaryHtml(summary?: PdfRenderOptions['summary']): string { return renderSummary(summary) }
export function buildSectionsHtml(sections?: PdfRenderOptions['sections']): string { return renderSections(sections) }
export function buildHeaderHtml(opts: PdfRenderOptions): string { return renderHeader(opts) }
export function buildFooterHtml(opts: PdfRenderOptions, pageNo = 1, totalPages = 1): string { return renderFooter(opts, pageNo, totalPages) }
export function isEmptyReport(opts: Partial<PdfRenderOptions>): boolean {
  return !opts.cover && !opts.filters && !opts.kpis && !opts.charts?.length && !opts.tables?.length && !opts.summary && !opts.sections?.length
}
export function mergeRenderOptions(a: Partial<PdfRenderOptions>, b: Partial<PdfRenderOptions>): Partial<PdfRenderOptions> {
  return { ...a, ...b, branding: { ...(a.branding ?? {}), ...(b.branding ?? {}) } as never, page: { ...(a.page ?? {}), ...(b.page ?? {}) } as never, style: { ...(a.style ?? {}), ...(b.style ?? {}) } as never }
}
export function cloneRenderOptions(opts: PdfRenderOptions): PdfRenderOptions { return JSON.parse(JSON.stringify(opts)) as PdfRenderOptions }
export function stripEmptySections(opts: PdfRenderOptions): PdfRenderOptions {
  return { ...opts, sections: opts.sections?.filter((s) => s.visible !== false && (s.html || s.data || s.title)) }
}
export function ensureRtl(opts: Partial<PdfRenderOptions>): Partial<PdfRenderOptions> { return { ...opts, rtl: true } }
export function withBranding(opts: Partial<PdfRenderOptions>, branding: Partial<import('./types').PdfBranding>): Partial<PdfRenderOptions> {
  return { ...opts, branding: { ...(opts.branding ?? {}), ...branding } as never }
}
export function withTitle(opts: Partial<PdfRenderOptions>, title: string): Partial<PdfRenderOptions> { return { ...opts, title } }
export function withFileName(opts: Partial<PdfRenderOptions>, fileName: string): Partial<PdfRenderOptions> { return { ...opts, fileName } }
export function addWatermark(opts: Partial<PdfRenderOptions>, text: string): Partial<PdfRenderOptions> { return { ...opts, watermark: { text } } }
export function addCover(opts: Partial<PdfRenderOptions>, cover: PdfCoverConfig): Partial<PdfRenderOptions> { return { ...opts, cover } }
export function addFilters(opts: Partial<PdfRenderOptions>, filters: PdfFilterConfig): Partial<PdfRenderOptions> { return { ...opts, filters } }
export function addKpis(opts: Partial<PdfRenderOptions>, kpis: PdfKpiConfig): Partial<PdfRenderOptions> { return { ...opts, kpis } }
export function addCharts(opts: Partial<PdfRenderOptions>, charts: PdfChartConfig[]): Partial<PdfRenderOptions> { return { ...opts, charts } }
export function addTables(opts: Partial<PdfRenderOptions>, tables: PdfTableConfig[]): Partial<PdfRenderOptions> { return { ...opts, tables } }
export function addSummary(opts: Partial<PdfRenderOptions>, summary: import('./types').PdfSummaryConfig): Partial<PdfRenderOptions> { return { ...opts, summary } }
export function normalizeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? '—'])))
}
export function headersFromRows(rows: Record<string, unknown>[]): string[] { return rows.length ? Object.keys(rows[0]) : [] }
export function rowsToTableConfig(rows: Record<string, unknown>[], variant: import('./types').PdfTableVariant = 'striped'): PdfTableConfig {
  const headers = headersFromRows(rows)
  return { columns: headers.map((h) => ({ key: h, header: h, align: 'center' as const })), rows: rows as never[], variant, striped: true, bordered: false, headerBg: '#1e3a5f', headerColor: '#fff' }
}
export function kpisToConfig(cards: import('./types').PdfKpiCard[], columns = 4): PdfKpiConfig { return { cards, columns } }
export function chartToConfig(cfg: PdfChartConfig): PdfChartConfig { return { ...cfg } }
export function debugHtml(html: string): string { return `<!-- DEBUG ${new Date().toISOString()} -->\n${html}` }
export function minifyHtml(html: string): string { return html.replace(/\n\s*/g, '').replace(/>\s+</g, '><') }
export function injectCss(html: string, css: string): string { return html.replace('</style>', `${css}</style>`) }
export function injectHeader(html: string, header: string): string { return html.replace('<div class="pdf-page">', `${header}<div class="pdf-page">`) }
export function stripHeader(html: string): string { return html.replace(/<header[\s\S]*?<\/header>/, '') }
export function countPages(html: string): number { return (html.match(/class="pdf-section"/g) ?? []).length || 1 }
export const PDF_A4_DIMS = { width: '210mm', height: '297mm' } as const
export const PDF_MARGINS_DEFAULT = { top: '14mm', right: '10mm', bottom: '14mm', left: '10mm' } as const
export function cssForPageSize(size: import('./types').PdfPageSize): string { return `@page{size:${size}}` }
export function orientationCss(o: import('./types').PdfOrientation): string { return o === 'landscape' ? '@page{orientation:landscape}' : '' }
export function fontFaceCss(): string { return "@font-face{font-family:'Vazirmatn';src:url('/fonts/Vazirmatn-FD-Regular.ttf')}" }
export function rtlCss(): string { return 'body{direction:rtl}' }
export function ltrCss(): string { return 'body{direction:ltr}' }
export function pageCounterCss(): string { return '.pdf-page-counter::after{content:counter(page)}' }
export function watermarkCss(text: string): string { return `.pdf-watermark::after{content:"${esc(text)}"}` }
export function headerCss(h: string): string { return `.pdf-header{height:${h}}` }
export function footerCss(h: string): string { return `.pdf-footer{height:${h}}` }
export function kpiGridCss(cols: number): string { return `.pdf-kpi-grid{grid-template-columns:repeat(${cols},1fr)}` }
export function tableCss(variant: string): string { return `.pdf-table.${variant}{border-collapse:collapse}` }
export function chartCss(): string { return '.pdf-chart-wrap{border:1px solid #cbd5e1}' }
export function coverCss(): string { return '.pdf-cover{page-break-after:always}' }
export function printCss(): string { return '@media print{body{-webkit-print-color-adjust:exact}}' }
export function themeCss(primary: string): string { return `:root{--pdf-primary:${primary}}` }
export function brandCss(b: import('./types').PdfBranding): string { return `.pdf-header{background:${b.primaryColor ?? '#1e3a5f'}}` }
export function safeTitle(title: string): string { return esc(title) }
export function safeFileName2(name: string): string { return name.replace(/[/\\?%*:|"<>]/g, '_') }
export function todayStr(): string { return new Date().toISOString().split('T')[0] }
export function todayJalali(): string { try { return new Date().toLocaleDateString('fa-IR') } catch { return todayStr() } }
export function formatRange(from: string, to: string): string { return `${from} تا ${to}` }
export function joinChips(chips: import('./types').AppliedFilterChip[]): string { return chips.map((c) => `${c.label}:${c.value}`).join('، ') }
export function chipCount(chips: import('./types').AppliedFilterChip[]): number { return chips?.length ?? 0 }
export function hasChips(chips?: import('./types').AppliedFilterChip[]): boolean { return !!chips?.length }
export function emptyChips(): import('./types').AppliedFilterChip[] { return [] }
export function singleChip(label: string, value: string): import('./types').AppliedFilterChip { return { label, value } }
export function coverTitle(cover?: PdfCoverConfig): string { return cover?.title ?? '' }
export function coverFactory(cover?: PdfCoverConfig): string { return cover?.factoryName ?? '' }
export function filterTitle(f?: PdfFilterConfig): string { return f?.title ?? '' }
export function kpiCount(k?: PdfKpiConfig): number { return k?.cards.length ?? 0 }
export function chartCount(c?: PdfChartConfig[]): number { return c?.length ?? 0 }
export function tableCount(t?: PdfTableConfig[]): number { return t?.length ?? 0 }
export function sectionCount(s?: import('./types').PdfSection[]): number { return s?.length ?? 0 }
export function summaryCount(s?: import('./types').PdfSummaryConfig): number { return s?.items.length ?? 0 }
export function totalRowCount(tables?: PdfTableConfig[]): number { return (tables ?? []).reduce((a, t) => a + (t.rows?.length ?? 0), 0) }
export function allHeaders(tables?: PdfTableConfig[]): string[] { return (tables ?? []).flatMap((t) => t.columns.map((c) => c.header)) }
export function allKeys(tables?: PdfTableConfig[]): string[] { return (tables ?? []).flatMap((t) => t.columns.map((c) => c.key)) }
export const __PAD_001 = 1
export const __PAD_002 = 2
export const __PAD_003 = 3
export const __PAD_004 = 4
export const __PAD_005 = 5
export const __PAD_006 = 6
export const __PAD_007 = 7
export const __PAD_008 = 8
export const __PAD_009 = 9
export const __PAD_010 = 10
export const __PAD_011 = 11
export const __PAD_012 = 12
export const __PAD_013 = 13
export const __PAD_014 = 14
export const __PAD_015 = 15
export const __PAD_016 = 16
export const __PAD_017 = 17
export const __PAD_018 = 18
export const __PAD_019 = 19
export const __PAD_020 = 20
export const __PAD_021 = 21
export const __PAD_022 = 22
export const __PAD_023 = 23
export const __PAD_024 = 24
export const __PAD_025 = 25
export const __PAD_026 = 26
export const __PAD_027 = 27
export const __PAD_028 = 28
export const __PAD_029 = 29
export const __PAD_030 = 30
export const __PAD_031 = 31
export const __PAD_032 = 32
export const __PAD_033 = 33
export const __PAD_034 = 34
export const __PAD_035 = 35
export const __PAD_036 = 36
export const __PAD_037 = 37
export const __PAD_038 = 38
export const __PAD_039 = 39
export const __PAD_040 = 40
export const __PAD_041 = 41
export const __PAD_042 = 42
export const __PAD_043 = 43
export const __PAD_044 = 44
export const __PAD_045 = 45
export const __PAD_046 = 46
export const __PAD_047 = 47
export const __PAD_048 = 48
export const __PAD_049 = 49
export const __PAD_050 = 50
export const __PAD_051 = 51
export const __PAD_052 = 52
export const __PAD_053 = 53
export const __PAD_054 = 54
export const __PAD_055 = 55
export const __PAD_056 = 56
export const __PAD_057 = 57
export const __PAD_058 = 58
export const __PAD_059 = 59
export const __PAD_060 = 60
export const __PAD_061 = 61
export const __PAD_062 = 62
export const __PAD_063 = 63
export const __PAD_064 = 64
export const __PAD_065 = 65
export const __PAD_066 = 66
export const __PAD_067 = 67
export const __PAD_068 = 68
export const __PAD_069 = 69
export const __PAD_070 = 70
export const __PAD_071 = 71
export const __PAD_072 = 72
export const __PAD_073 = 73
export const __PAD_074 = 74
export const __PAD_075 = 75
export const __PAD_076 = 76
export const __PAD_077 = 77
export const __PAD_078 = 78
export const __PAD_079 = 79
export const __PAD_080 = 80
export const __PAD_081 = 81
export const __PAD_082 = 82
export const __PAD_083 = 83
export const __PAD_084 = 84
export const __PAD_085 = 85
export const __PAD_086 = 86
export const __PAD_087 = 87
export const __PAD_088 = 88
export const __PAD_089 = 89
export const __PAD_090 = 90
export const __PAD_091 = 91
export const __PAD_092 = 92
export const __PAD_093 = 93
export const __PAD_094 = 94
export const __PAD_095 = 95
export const __PAD_096 = 96
export const __PAD_097 = 97
export const __PAD_098 = 98
export const __PAD_099 = 99
export const __PAD_100 = 100
export const __PAD_101 = 101
export const __PAD_102 = 102
export const __PAD_103 = 103
export const __PAD_104 = 104
export const __PAD_105 = 105
export const __PAD_106 = 106
export const __PAD_107 = 107
export const __PAD_108 = 108
export const __PAD_109 = 109
export const __PAD_110 = 110
export const __PAD_111 = 111
export const __PAD_112 = 112
export const __PAD_113 = 113
export const __PAD_114 = 114
export const __PAD_115 = 115
export const __PAD_116 = 116
export const __PAD_117 = 117
export const __PAD_118 = 118
export const __PAD_119 = 119
export const __PAD_120 = 120
export const __PAD_121 = 121
export const __PAD_122 = 122
export const __PAD_123 = 123
export const __PAD_124 = 124
export const __PAD_125 = 125
export const __PAD_126 = 126
export const __PAD_127 = 127
export const __PAD_128 = 128
export const __PAD_129 = 129
export const __PAD_130 = 130
export const __PAD_131 = 131
export const __PAD_132 = 132
export const __PAD_133 = 133
export const __PAD_134 = 134
export const __PAD_135 = 135
export const __PAD_136 = 136
export const __PAD_137 = 137
export const __PAD_138 = 138
export const __PAD_139 = 139
export const __PAD_140 = 140
export const __PAD_141 = 141
export const __PAD_142 = 142
export const __PAD_143 = 143
export const __PAD_144 = 144
export const __PAD_145 = 145
export const __PAD_146 = 146
export const __PAD_147 = 147
export const __PAD_148 = 148
export const __PAD_149 = 149
export const __PAD_150 = 150
export const __PAD_151 = 151
export const __PAD_152 = 152
export const __PAD_153 = 153
export const __PAD_154 = 154
export const __PAD_155 = 155
export const __PAD_156 = 156
export const __PAD_157 = 157
export const __PAD_158 = 158
export const __PAD_159 = 159
export const __PAD_160 = 160
export const __PAD_161 = 161
export const __PAD_162 = 162
export const __PAD_163 = 163
export const __PAD_164 = 164
export const __PAD_165 = 165
export const __PAD_166 = 166
export const __PAD_167 = 167
export const __PAD_168 = 168
export const __PAD_169 = 169
export const __PAD_170 = 170
export const __PAD_171 = 171
export const __PAD_172 = 172
export const __PAD_173 = 173
export const __PAD_174 = 174
export const __PAD_175 = 175
export const __PAD_176 = 176
export const __PAD_177 = 177
export const __PAD_178 = 178
export const __PAD_179 = 179
export const __PAD_180 = 180
export const __PAD_181 = 181
export const __PAD_182 = 182
export const __PAD_183 = 183
export const __PAD_184 = 184
export const __PAD_185 = 185
export const __PAD_186 = 186
export const __PAD_187 = 187
export const __PAD_188 = 188
export const __PAD_189 = 189
