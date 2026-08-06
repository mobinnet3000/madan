import type { LineType, Role, SamplePoint } from './types'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'مدیر سیستم',
  manager: 'مدیر کارخانه',
  operator: 'اپراتور',
  viewer: 'بیننده',
}

export const ROLE_BADGE: Record<Role, string> = {
  admin: 'bg-rose-100 text-rose-700',
  manager: 'bg-sky-100 text-sky-700',
  operator: 'bg-emerald-100 text-emerald-700',
  viewer: 'bg-slate-100 text-slate-600',
}

export function hasPerm(permissions: string[] | undefined, code: string): boolean {
  return Array.isArray(permissions) && permissions.includes(code)
}

export const LINE_TYPE_LABELS: Record<LineType, string> = {
  crushing: 'خردایش',
  processing: 'فرآوری',
  conveying: 'انتقال / نوار نقاله',
  other: 'سایر',
}

export const LINE_TYPE_STYLE: Record<
  LineType,
  { badge: string; gradient: string; ring: string; dot: string }
> = {
  crushing: {
    badge: 'bg-orange-100 text-orange-700',
    gradient: 'from-orange-500 to-amber-500',
    ring: 'ring-orange-200',
    dot: 'bg-orange-500',
  },
  processing: {
    badge: 'bg-violet-100 text-violet-700',
    gradient: 'from-violet-500 to-fuchsia-500',
    ring: 'ring-violet-200',
    dot: 'bg-violet-500',
  },
  conveying: {
    badge: 'bg-slate-100 text-slate-700',
    gradient: 'from-slate-500 to-slate-600',
    ring: 'ring-slate-200',
    dot: 'bg-slate-500',
  },
  other: {
    badge: 'bg-teal-100 text-teal-700',
    gradient: 'from-teal-500 to-cyan-500',
    ring: 'ring-teal-200',
    dot: 'bg-teal-500',
  },
}

export const SAMPLE_POINT_LABELS: Record<SamplePoint, string> = {
  feed: 'خوراک (Feed)',
  tailing: 'باطله (Tailing)',
  product: 'محصول نهایی',
}

export const SAMPLE_POINT_STYLE: Record<SamplePoint, string> = {
  feed: 'bg-amber-100 text-amber-700',
  tailing: 'bg-rose-100 text-rose-700',
  product: 'bg-emerald-100 text-emerald-700',
}
