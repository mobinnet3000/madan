import {
  LayoutGrid, Truck, Gauge, FlaskConical, Activity, ChartColumn, TrendingUp,
  Box, ClipboardList, Database, Filter, Layers3, ChartPie, ChartLine,
  Package, Factory, Scale, Clock, MapPin, Cpu, Wrench, Zap, Droplet,
  Thermometer, Settings2, Target, Grid3x3,
} from 'lucide-react'
import type { FactoryTabColor, FactoryTabIcon } from '../types'

export const TAB_ICONS: Record<FactoryTabIcon, any> = {
  layers: LayoutGrid,
  truck: Truck,
  gauge: Gauge,
  flask: FlaskConical,
  activity: Activity,
  'bar-chart': ChartColumn,
  'trending-up': TrendingUp,
  box: Box,
  'clipboard-list': ClipboardList,
  database: Database,
  filter: Filter,
  'layers-3': Layers3,
  'pie-chart': ChartPie,
  'line-chart': ChartLine,
  package: Package,
  factory: Factory,
  scale: Scale,
  clock: Clock,
  'map-pin': MapPin,
  cpu: Cpu,
  wrench: Wrench,
  zap: Zap,
  droplet: Droplet,
  thermometer: Thermometer,
  settings: Settings2,
  target: Target,
  grid: Grid3x3,
}

export const TAB_COLOR_BG: Record<FactoryTabColor, string> = {
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
  lime: 'bg-lime-100 text-lime-700 dark:bg-lime-950/60 dark:text-lime-300',
  cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300',
  fuchsia: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-300',
}

export function tabIcon(icon?: string): any {
  return TAB_ICONS[(icon ?? 'layers') as FactoryTabIcon] ?? LayoutGrid
}

export function tabColorBg(color?: string): string {
  return TAB_COLOR_BG[(color ?? 'slate') as FactoryTabColor] ?? TAB_COLOR_BG.slate
}
