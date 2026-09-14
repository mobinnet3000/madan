export type PdfOrientation = 'portrait' | 'landscape'
export type PdfPageSize = 'A4' | 'A3' | 'Letter' | 'Legal'
export type PdfAlign = 'left' | 'center' | 'right' | 'justify'
export type PdfFontWeight = 'normal' | 'bold' | '600' | '700' | '800'
export type PdfChartType = 'bar' | 'line' | 'pie' | 'area' | 'column' | 'donut'
export type PdfTableVariant = 'striped' | 'bordered' | 'compact' | 'grid'
export type PdfSectionType = 'cover' | 'filters' | 'kpi' | 'chart' | 'table' | 'summary' | 'text' | 'divider'
export type PdfHeaderVariant = 'standard' | 'minimal' | 'branded' | 'detailed'
export type PdfFooterVariant = 'standard' | 'minimal' | 'detailed' | 'none'
export interface PdfMargins {
  top: string
  right: string
  bottom: string
  left: string
}
export interface PdfBranding {
  factoryName: string
  factoryAddress?: string
  logoUrl?: string
  primaryColor?: string
  accentColor?: string
  watermark?: string
}
export interface PdfPageConfig {
  size: PdfPageSize
  orientation: PdfOrientation
  margins: PdfMargins
  headerHeight: string
  footerHeight: string
}
export interface PdfHeaderConfig {
  variant: PdfHeaderVariant
  height: string
  branding: PdfBranding
  title: string
  subtitle?: string
  meta?: string
  showLogo: boolean
  showDate: boolean
  dateLabel?: string
}

export interface PdfFooterConfig {
  variant: PdfFooterVariant
  height: string
  branding: PdfBranding
  showPageNumbers: boolean
  showPrintDate: boolean
  footnote?: string
  pageText?: string
}

export interface PdfColumnDef<T = Record<string, unknown>> {
  key: string
  header: string
  width?: string
  align?: PdfAlign
  format?: (value: unknown, row: T) => string
  headerStyle?: Record<string, string>
  cellStyle?: Record<string, string>
  sortable?: boolean
}

export interface PdfTableConfig<T = Record<string, unknown>> {
  columns: PdfColumnDef<T>[]
  rows: T[]
  variant: PdfTableVariant
  striped: boolean
  bordered: boolean
  headerBg: string
  headerColor: string
  rowHeight?: string
  emptyText?: string
  maxRows?: number
  showRowNumbers?: boolean
}

export interface PdfChartDataset {
  label: string
  data: number[]
  color?: string
  backgroundColor?: string
  borderColor?: string
}

export interface PdfChartConfig {
  type: PdfChartType
  title?: string
  labels: string[]
  datasets: PdfChartDataset[]
  height?: string
  showLegend?: boolean
  showGrid?: boolean
  stacked?: boolean
}

export interface PdfKpiCard {
  label: string
  value: string
  suffix?: string
  icon?: string
  color?: string
  bg?: string
  trend?: number
  trendLabel?: string
}

export interface PdfKpiConfig {
  cards: PdfKpiCard[]
  columns: number
  gap?: string
}

export interface AppliedFilterChip {
  label: string
  value: string
  removable?: boolean
}

export interface PdfFilterConfig {
  title: string
  chips: AppliedFilterChip[]
  dateFrom?: string
  dateTo?: string
  summary?: string
  showClearAll?: boolean
}

export interface PdfCoverConfig {
  title: string
  subtitle?: string
  factoryName: string
  factoryAddress?: string
  dateFrom?: string
  dateTo?: string
  generatedAt: string
  generatedBy?: string
  logoUrl?: string
  recordCount?: number
}

export interface PdfSummaryConfig {
  title?: string
  items: { label: string; value: string | number }[]
  columns?: number
}

export interface PdfSection {
  type: PdfSectionType
  title?: string
  subtitle?: string
  data?: unknown
  config?: Record<string, unknown>
  html?: string
  visible?: boolean
  pageBreakBefore?: boolean
  pageBreakAfter?: boolean
}

export interface PdfWatermarkConfig {
  text: string
  opacity?: number
  rotation?: number
  color?: string
}

export interface PdfStyleConfig {
  fontFamily: string
  fontSize: string
  lineHeight: string
  primaryColor: string
  textColor: string
  borderColor: string
  headerBg: string
  headerColor: string
  kpiBg?: string
  tableStripedBg?: string
}

export interface PdfRenderOptions {
  title: string
  fileName: string
  branding: PdfBranding
  page: PdfPageConfig
  header: PdfHeaderConfig
  footer: PdfFooterConfig
  cover?: PdfCoverConfig
  filters?: PdfFilterConfig
  kpis?: PdfKpiConfig
  charts?: PdfChartConfig[]
  tables?: PdfTableConfig[]
  sections?: PdfSection[]
  summary?: PdfSummaryConfig
  watermark?: PdfWatermarkConfig
  style?: Partial<PdfStyleConfig>
  locale?: string
  rtl?: boolean
  debug?: boolean
}

export interface PdfTemplateMeta {
  id: string
  name: string
  description: string
  version: string
  category: string
  tags?: string[]
}

export interface PdfTemplate {
  meta: PdfTemplateMeta
  build: (ctx: PdfTemplateContext) => PdfRenderOptions
}

export interface PdfTemplateContext {
  title: string
  factoryName: string
  factoryAddress?: string
  dateFrom: string
  dateTo: string
  rows: Record<string, string | number>[]
  rawRows: unknown[]
  filters?: AppliedFilterChip[]
  kpis?: PdfKpiCard[]
  charts?: PdfChartConfig[]
  branding?: Partial<PdfBranding>
}

export interface PdfPrintResult {
  success: boolean
  fileName: string
  html: string
  error?: string
}

export interface PdfPreset {
  id: string
  label: string
  page: PdfPageConfig
  header: PdfHeaderVariant
  footer: PdfFooterVariant
  style: PdfStyleConfig
}

export interface HtmlPdfOptions {
  fileName: string
  title: string
  html: string
  onBeforePrint?: () => void
  onAfterPrint?: () => void
}

export interface PdfExportRequest {
  rows: Record<string, string | number>[]
  fileName: string
  title: string
  template?: string
  branding?: PdfBranding
  filters?: AppliedFilterChip[]
  options?: Partial<PdfRenderOptions>
}

export type PdfBuilderStep = (html: string, ctx: PdfRenderOptions) => string

export interface PdfRendererHooks {
  beforeHeader?: PdfBuilderStep
  afterHeader?: PdfBuilderStep
  beforeFooter?: PdfBuilderStep
  afterFooter?: PdfBuilderStep
  beforeBody?: PdfBuilderStep
  afterBody?: PdfBuilderStep
}
