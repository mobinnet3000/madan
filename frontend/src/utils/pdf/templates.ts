import type { PdfRenderOptions, PdfTemplate, PdfTemplateContext } from './types'
import { DEFAULT_PAGE, DEFAULT_STYLE } from './styles'

export const downtimeTemplate: PdfTemplate = {
  meta: { id: 'downtime', name: 'گزارش توقفات', description: 'AppliedFilters + KPI + charts + tables', version: '1.0.0', category: 'operations' },
  build(ctx: PdfTemplateContext): PdfRenderOptions {
    const chips = ctx.filters ?? []
    const kpis = ctx.kpis ?? []
    const branding = { factoryName: ctx.factoryName, factoryAddress: ctx.factoryAddress, primaryColor: '#1e3a5f', ...(ctx.branding ?? {}) }
    return {
      title: ctx.title,
      fileName: `${ctx.title}_${ctx.dateFrom}_${ctx.dateTo}`,
      branding,
      page: { ...DEFAULT_PAGE },
      style: { ...DEFAULT_STYLE },
      header: { variant: 'branded', height: '26mm', branding, title: ctx.title, subtitle: `${ctx.factoryName} — ${ctx.dateFrom} تا ${ctx.dateTo}`, showLogo: true, showDate: true },
      footer: { variant: 'standard', height: '13mm', branding, showPageNumbers: true, showPrintDate: true, footnote: ctx.factoryName },
      cover: { title: ctx.title, subtitle: 'گزارش تحلیلی توقفات خط تولید', factoryName: ctx.factoryName, factoryAddress: ctx.factoryAddress, dateFrom: ctx.dateFrom, dateTo: ctx.dateTo, generatedAt: new Date().toLocaleDateString('fa-IR'), recordCount: ctx.rows.length },
      filters: { title: 'فیلترهای اعمال‌شده', chips, dateFrom: ctx.dateFrom, dateTo: ctx.dateTo, summary: chips.length ? `${chips.length} فیلتر فعال` : 'بدون فیلتر' },
      kpis: kpis.length ? { cards: kpis, columns: 4 } : undefined,
      charts: ctx.charts,
      tables: ctx.rows.length ? [{ columns: Object.keys(ctx.rows[0] ?? {}).map((k) => ({ key: k, header: k, align: 'center' as const })), rows: ctx.rows as unknown as Record<string, unknown>[], variant: 'striped', striped: true, bordered: false, headerBg: '#1e3a5f', headerColor: '#fff', emptyText: 'داده‌ای یافت نشد', showRowNumbers: true }] : [],
      summary: { title: 'خلاصه', items: [{ label: 'تعداد رکورد', value: ctx.rows.length }, { label: 'بازه', value: `${ctx.dateFrom} تا ${ctx.dateTo}` }], columns: 3 },
      rtl: true,
    }
  },
}

export const standardTemplate: PdfTemplate = {
  meta: { id: 'standard', name: 'گزارش استاندارد', description: 'جدول ساده با هدر/فوتر حرفه‌ای', version: '1.0.0', category: 'general' },
  build(ctx: PdfTemplateContext): PdfRenderOptions {
    const branding = { factoryName: ctx.factoryName, ...(ctx.branding ?? {}) }
    return {
      title: ctx.title, fileName: ctx.title, branding, page: { ...DEFAULT_PAGE }, style: { ...DEFAULT_STYLE },
      header: { variant: 'standard', height: '26mm', branding, title: ctx.title, showLogo: true, showDate: true },
      footer: { variant: 'standard', height: '13mm', branding, showPageNumbers: true, showPrintDate: true },
      tables: ctx.rows.length ? [{ columns: Object.keys(ctx.rows[0] ?? {}).map((k) => ({ key: k, header: k, align: 'center' as const })), rows: ctx.rows as unknown as Record<string, unknown>[], variant: 'striped', striped: true, bordered: false, headerBg: '#1e3a5f', headerColor: '#fff' }] : [],
      rtl: true,
    }
  },
}

export const tableOnlyTemplate: PdfTemplate = {
  meta: { id: 'table-only', name: 'جدول تنها', description: 'فقط جدول بدون کاور', version: '1.0.0', category: 'general' },
  build(ctx: PdfTemplateContext): PdfRenderOptions {
    const branding = { factoryName: ctx.factoryName, ...(ctx.branding ?? {}) }
    return {
      title: ctx.title, fileName: ctx.title, branding, page: { ...DEFAULT_PAGE }, style: { ...DEFAULT_STYLE },
      header: { variant: 'minimal', height: '18mm', branding, title: ctx.title, showLogo: false, showDate: true },
      footer: { variant: 'minimal', height: '10mm', branding, showPageNumbers: true, showPrintDate: true },
      tables: [{ columns: Object.keys(ctx.rows[0] ?? {}).map((k) => ({ key: k, header: k, align: 'center' as const })), rows: ctx.rows as unknown as Record<string, unknown>[], variant: 'compact', striped: true, bordered: true, headerBg: '#0f172a', headerColor: '#fff' }],
      rtl: true,
    }
  },
}

export const registry: Record<string, PdfTemplate> = {
  downtime: downtimeTemplate,
  standard: standardTemplate,
  'table-only': tableOnlyTemplate,
}

export function getTemplate(id: string): PdfTemplate | undefined { return registry[id] }
export function listTemplates(): PdfTemplate[] { return Object.values(registry) }
