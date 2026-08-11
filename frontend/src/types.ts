export interface FailureReason {
  id: number
  title: string
}

export interface Shift {
  id: number
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
  is_analyzer: boolean
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
}

export interface Factory {
  id: number
  name: string
  address: string
  shifts: Shift[]
  lines: ProductionLine[]
  failure_reasons: FailureReason[]
  contractors: Contractor[]
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

export type SamplePoint = 'feed' | 'tailing' | 'product'

export interface DeviceDailyAnalysis {
  id: number
  device: Device
  shift: Shift | null
  date: string
  date_jalali?: string
  day_of_week?: string
  sample_point: SamplePoint | null
  analysis_text: string | null
  value_1: number | null
  value_2: number | null
  created_at: string
}

export interface DeviceDailyAnalysisPayload {
  device: number
  shift?: number | null
  date: string
  sample_point?: SamplePoint | null
  analysis_text?: string
  value_1?: number | null
  value_2?: number | null
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

export interface AnalysisFilters {
  device?: number
  devices?: string
  shift?: number
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

export interface ProductionReport {
  id: number
  line: { id: number; name: string; factory: { id: number; name: string } }
  contractor: ContractorOpt | null
  date_from: string
  date_to: string
  inputs: Record<string, number | string>
  outputs: Record<string, number>
  note: string
  created_by: number | null
  created_at: string
}

export interface ProductionReportPayload {
  line_id: number
  contractor_id?: number | null
  date_from: string
  date_to: string
  inputs: Record<string, number | string>
  note?: string
}

export interface ProductionReportFilters {
  line?: number
  contractor?: number
  date_from?: string
  date_to?: string
}

// تعریف آنالیز کارخانه (ورودی/خروجی داینامیک با فرمول)
export interface FactoryAnalysisSchema {
  factory: { id: number; name: string }
  inputs: InputSchema[]
  outputs: AnalysisOutputSchema[]
  defined: boolean
}

// ── عملکرد بخش تولید (Actual Analysis داینامیک) ──
export interface ContractorOpt {
  id: number
  name: string
  contact_name?: string
  phone?: string
}

export interface Contractor extends ContractorOpt {
  factory?: number
  factory_name?: string
  is_active?: boolean
}

export interface InputSchema {
  id: number
  key: string
  name: string
  type: 'number' | 'text'
  required: boolean
  unit: string
}

export interface PositionSchema {
  id: number
  key: string
  name: string
  definition: { id: number; name: string } | null
  inputs: InputSchema[]
}

export interface AnalysisOutputSchema {
  id: number
  key: string
  name: string
  unit: string
}

export interface AnalysisSchema {
  line: { id: number; name: string }
  contractor: { required: boolean; options: ContractorOpt[] }
  positions: PositionSchema[]
  additional_inputs: InputSchema[]
  outputs: AnalysisOutputSchema[]
  defined: boolean
}

export interface LineDeviceRef {
  id: number
  name: string
  code: string
  order: number
}

export interface ProductionLineDetail extends AnalysisSchema {
  devices: LineDeviceRef[]
}

export interface ActualAnalysis {
  id: number
  line: { id: number; name: string; factory: { id: number; name: string } }
  contractor: ContractorOpt | null
  date_from: string
  date_to: string
  date_from_jalali?: string
  date_to_jalali?: string
  shift: {
    id: number
    name: string
    start_time: string
    end_time: string
    is_active: boolean
  } | null
  inputs: {
    positions: Record<string, Record<string, number | string>>
    additional_inputs: Record<string, number | string>
  }
  outputs: Record<string, number>
  line_devices: LineDeviceRef[]
  created_by: number | null
  created_at: string
}

export interface ActualAnalysisPayload {
  line_id: number
  contractor_id?: number | null
  date_from: string
  date_to: string
  positions: Record<string, Record<string, number | string>>
  additional_inputs: Record<string, number | string>
}

export interface ActualAnalysisFilters {
  line?: number
  lines?: string
  contractor?: number
  date_from?: string
  date_to?: string
}
