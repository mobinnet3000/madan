export interface FailureReason {
  id: number
  title: string
}

export interface Shift {
  id: number
  line: number
  name: string
  start_time: string
  end_time: string
  is_active: boolean
}

export interface AttributeDef {
  name: string
  unit: string
}

export interface Device {
  id: number
  name: string
  code: string
  order: number
  template_name: string
  attributes_values: Record<string, number>
  attribute_defs: AttributeDef[]
  image: string | null
}

export type LineType = 'crushing' | 'processing' | 'conveying' | 'other'

export interface ProductionLine {
  id: number
  name: string
  description: string
  line_type: LineType
  template_name: string
  attributes_values: Record<string, number>
  attribute_defs: AttributeDef[]
  devices: Device[]
  shifts?: Shift[]
}

export interface Factory {
  id: number
  name: string
  address: string
  shifts: Shift[]
  lines: ProductionLine[]
  failure_reasons: FailureReason[]
  contractors: Contractor[]
  report_tabs?: FactoryTabBrief[]
}

export interface DeviceLog {
  id: number
  line: { id: number; name: string; factory: { id: number; name: string } }
  shift: Shift
  date: string
  date_jalali?: string
  day_of_week?: string
  device: Device | null
  failure_cause: FailureReason | null
  runtime_hours: number
  downtime_hours: number
  failure_description: string | null
  repair_description: string | null
  feed_tonnage: number
  product_tonnage: number
  tailing_tonnage: number
  efficiency: number | null
  created_at: string
}

export interface DeviceLogPayload {
  line: number
  shift: number
  date: string
  device?: number | null
  failure_cause?: number | null
  runtime_hours: number
  downtime_hours: number
  failure_description?: string
  repair_description?: string
  feed_tonnage?: number
  product_tonnage?: number
  tailing_tonnage?: number
}

export interface LogFilters {
  line?: number
  lines?: string
  shift?: number
  device?: number
  failure_cause?: number
  date?: string
  date_from?: string
  date_to?: string
}

export type Role = 'admin' | 'manager' | 'operator' | 'viewer'

export interface UserProfile {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string
  role: Role
  factory: number | null
  factory_name: string | null
  phone: string
  is_superuser: boolean
  permissions: string[]
}

export interface ManagedUser {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string
  is_active: boolean
  is_superuser: boolean
  role: Role
  factory: number | null
  factory_name: string | null
  phone: string
  permissions: { granted: string[]; denied: string[] }
  permissions_resolved: string[]
}

export interface PermissionDef {
  code: string
  label: string
  group: string
}

export interface RoleMatrixData {
  roles: { value: Role; label: string }[]
  permissions: PermissionDef[]
  matrix: Record<Role, Record<string, boolean>>
}

export interface ActivityLogEntry {
  id: number
  username: string
  role: string
  action: 'login' | 'logout' | 'create' | 'update' | 'delete'
  model_name: string
  object_repr: string
  description: string
  factory_name: string | null
  ip: string | null
  timestamp: string
  timestamp_jalali?: string
}

// ── عملکرد بخش تولید (Actual Analysis داینامیک) ──
export interface ContractorOpt {  id: number
  name: string
  contact_name?: string
  phone?: string
}

export interface Contractor extends ContractorOpt {
  factory?: number
  factory_name?: string
  is_active?: boolean
}

// ── تناژ تحویلی خطوط تولید ──
// ── تب‌های کارخانه (داینامیک) ──
// پاسخ API برای ورودی/خروجی تب هم‌شکل FactoryTabInput/FactoryTabOutput است.
// فرم ثبت رکورد از «schema» استفاده می‌کند که «type» به‌جای «input_type» دارد.
export interface FactoryTabInputDef {
  id: number
  key: string
  name: string
  input_type: 'number' | 'text' | 'select'
  options?: string[]
  unit: string
  required: boolean
  order: number
}

export interface FactoryTabOutputDef {
  id: number
  key: string
  name: string
  unit: string
  formula: string
  order: number
}

export interface FactoryTabInputSchema {
  id: number
  key: string
  name: string
  type: 'number' | 'text' | 'select'
  options: string[]
  required: boolean
  unit: string
}

export interface FactoryTabOutputSchema {
  id: number
  key: string
  name: string
  unit: string
}

export type FactoryTabRecordType = 'range' | 'daily'

export type FactoryTabIcon =
  | 'layers' | 'truck' | 'gauge' | 'flask' | 'activity' | 'bar-chart' | 'trending-up'
  | 'box' | 'clipboard-list' | 'database' | 'filter' | 'layers-3' | 'pie-chart'
  | 'line-chart' | 'package' | 'factory' | 'scale' | 'clock' | 'map-pin' | 'cpu'
  | 'wrench' | 'zap' | 'droplet' | 'thermometer' | 'settings' | 'target' | 'grid'

export type FactoryTabColor =
  | 'slate' | 'orange' | 'emerald' | 'violet' | 'sky' | 'rose' | 'teal' | 'amber'
  | 'indigo' | 'lime' | 'cyan' | 'fuchsia'

export const FACTORY_TAB_ICONS: FactoryTabIcon[] = [
  'layers', 'truck', 'gauge', 'flask', 'activity', 'bar-chart', 'trending-up',
  'box', 'clipboard-list', 'database', 'filter', 'layers-3', 'pie-chart',
  'line-chart', 'package', 'factory', 'scale', 'clock', 'map-pin', 'cpu',
  'wrench', 'zap', 'droplet', 'thermometer', 'settings', 'target', 'grid',
]

export const FACTORY_TAB_COLORS: FactoryTabColor[] = [
  'slate', 'orange', 'emerald', 'violet', 'sky', 'rose', 'teal', 'amber',
  'indigo', 'lime', 'cyan', 'fuchsia',
]

export interface FactoryTabBrief {
  id: number
  key: string
  name: string
  description: string
  icon: FactoryTabIcon
  color: FactoryTabColor
  record_type: FactoryTabRecordType
  require_line: boolean
  contractor_required: boolean
  order: number
  is_active: boolean
  inputs: FactoryTabInputDef[]
  outputs: FactoryTabOutputDef[]
}

export interface FactoryTabFull extends FactoryTabBrief {
  factory: number
  created_at: string
  updated_at: string
}

export interface FactoryTabSchema {
  tab: {
    id: number
    key: string
    name: string
    record_type: FactoryTabRecordType
    require_line: boolean
  }
  contractor: { required: boolean; options: ContractorOpt[] }
  lines: { id: number; name: string }[]
  inputs: FactoryTabInputSchema[]
  outputs: FactoryTabOutputSchema[]
  defined: boolean
}

export interface FactoryTabRecord {
  id: number
  tab: FactoryTabBrief
  line: { id: number; name: string; factory: { id: number; name: string } } | null
  contractor: ContractorOpt | null
  date_from: string
  date_to: string
  date_from_jalali?: string
  date_to_jalali?: string
  hour: string | null
  inputs: Record<string, number | string>
  outputs: Record<string, number>
  note: string
  created_by: number | null
  created_at: string
}

export interface FactoryTabRecordPayload {
  tab: number
  line_id?: number | null
  contractor_id?: number | null
  date_from: string
  date_to: string
  hour?: string | null
  inputs: Record<string, number | string>
  note?: string
}

export interface FactoryTabRecordFilters {
  tab?: number
  line?: number
  lines?: string
  contractor?: number
  date_from?: string
  date_to?: string
}

// ── گزارش‌های تب کارخانه ──
export interface FactoryTabReportMetric {
  key: string
  label: string
  formula: string
  unit: string
}

export interface FactoryTabReport {
  id: number
  tab: number
  name: string
  description: string
  is_default: boolean
  order: number
  is_active: boolean
  filters: string[]
  metrics: FactoryTabReportMetric[]
  widgets?: FactoryTabWidget[]
  created_at: string
  updated_at: string
}

export type FactoryTabWidgetType = 'kpi' | 'stat_table' | 'group_table' | 'chart'

export interface FactoryTabWidget {
  id: number
  widget_type: FactoryTabWidgetType
  title: string
  order: number
  is_active: boolean
  config: Record<string, unknown>
}

export interface FactoryTabReportPayload {
  tab: number
  name: string
  description?: string
  is_default?: boolean
  order?: number
  is_active?: boolean
  filters?: string[]
  metrics?: FactoryTabReportMetric[]
}

export interface ReportKpiCard {
  label: string
  value: number | null
  sub: Record<string, number | null>
}

export interface ReportWidgetData {
  cards?: ReportKpiCard[]
  columns?: string[]
  rows?: Record<string, unknown>[]
  total?: Record<string, unknown> | null
  chart?: 'bar' | 'line' | 'pie'
  value_label?: string
  points?: { x: string; label: string; value: number | null }[]
}

export interface ReportWidgetResult {
  id: number
  type: FactoryTabWidgetType
  title: string
  data?: ReportWidgetData
  error?: string
}

export interface ReportMetricResult {
  key: string
  label: string
  unit: string
  value: number | null
  error?: string | null
}

export interface FactoryTabReportRun {
  report: { id: number; name: string; tab: { id: number; key: string; name: string } }
  filters_applied: Record<string, string>
  record_count: number
  metrics: ReportMetricResult[]
  widgets: ReportWidgetResult[]
  meta: { engine: string; generated_at: string; max_records: number; widget_types: string[] }
}

export interface FactoryTabReportTypes {
  widget_types: string[]
  widget_labels: Record<string, string>
  aggregations: string[]
  group_bys: string[]
  filters: string[]
}
