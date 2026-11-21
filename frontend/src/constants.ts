import type { LineType, Role } from './types'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'مدیر سیستم',
  manager: 'مدیر کارخانه',
  operator: 'اپراتور',
  viewer: 'بیننده',
}

export const ROLE_BADGE: Record<Role, string> = {
  admin: 'bg-[#faf0df] text-[#935a1a]',
  manager: 'bg-sky-50 text-sky-800',
  operator: 'bg-emerald-50 text-emerald-800',
  viewer: 'bg-[#ede7de] text-[#0f1821]',
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
    badge: 'bg-[#faf0df] text-[#935a1a]',
    gradient: 'from-[#f5b452] to-[#efa73f]',
    ring: 'ring-[#f0cc8b]',
    dot: 'bg-[#efa73f]',
  },
  processing: {
    badge: 'bg-violet-50 text-violet-700',
    gradient: 'from-violet-500 to-fuchsia-500',
    ring: 'ring-violet-200',
    dot: 'bg-violet-500',
  },
  conveying: {
    badge: 'bg-[#ede7de] text-[#0f1821]',
    gradient: 'from-slate-600 to-slate-700',
    ring: 'ring-slate-300',
    dot: 'bg-slate-600',
  },
  other: {
    badge: 'bg-teal-50 text-teal-700',
    gradient: 'from-teal-500 to-cyan-500',
    ring: 'ring-teal-200',
    dot: 'bg-teal-500',
  },
}
