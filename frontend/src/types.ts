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

export interface Device {
  id: number
  name: string
  order: number
  template_name: string
  attributes_values: Record<string, number>
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
  devices: Device[]
}

export interface Factory {
  id: number
  name: string
  address: string
  shifts: Shift[]
  lines: ProductionLine[]
  failure_reasons: FailureReason[]
}

export interface DeviceLog {
  id: number
  line: { id: number; name: string; factory: { id: number; name: string } }
  shift: Shift
  date: string
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
  feed_tonnage: number
  product_tonnage: number
  tailing_tonnage: number
}

export type SamplePoint = 'feed' | 'tailing' | 'product'

export interface DeviceDailyAnalysis {
  id: number
  device: Device
  shift: Shift | null
  date: string
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

export type Role = 'admin' | 'manager' | 'operator'

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
}
