import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Workflow, ClipboardList,
  FileBarChart, History, Mountain, X, Users, Settings,
} from 'lucide-react'
import { classNames } from '../../utils'
import { useAuth } from '../../store/AuthContext'
import { useFactory } from '../../store/FactoryContext'
import { ROLE_BADGE, ROLE_LABELS, hasPerm } from '../../constants'
import type { FactoryTabIcon } from '../../types'
import { tabIcon } from '../../utils/tabIcons'

const navItems: { to: string; label: string; icon: any; end: boolean; perm?: string }[] = [
  { to: '/', label: 'داشبورد', icon: LayoutDashboard, end: true, perm: 'dashboard.view' },
  { to: '/lines', label: 'مدل‌سازی خط فرآوری', icon: Workflow, end: false, perm: 'lines.view' },
  { to: '/logs', label: 'توقفات خط تولید', icon: ClipboardList, end: false, perm: 'logs.view' },
  { to: '/reports', label: 'گزارش‌ها و خروجی', icon: FileBarChart, end: false, perm: 'reports.view' },
  { to: '/settings', label: 'تنظیمات کارخانه و خط', icon: Settings, end: false, perm: 'settings.view' },
  { to: '/users', label: 'مدیریت کاربران و دسترسی‌ها', icon: Users, end: false, perm: 'users.view' },
  { to: '/activity', label: 'لاگ فعالیت‌ها', icon: History, end: false, perm: 'activity.view' },
]

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const { selectedFactory } = useFactory()
  const perms = user?.permissions
  const baseItems = navItems.filter((it) => !it.perm || hasPerm(perms, it.perm))
  const factoryTabs = (selectedFactory?.report_tabs ?? []).filter((t) => t.is_active)
  const canFactoryTabs = hasPerm(perms, 'factory-tabs.view')

  const items = (() => {
    if (!factoryTabs.length || !canFactoryTabs) return baseItems
    const reportsIdx = baseItems.findIndex((it) => it.to === '/reports')
    const insertAt = reportsIdx >= 0 ? reportsIdx : baseItems.length - 2
    const tabItems = factoryTabs.map((t) => ({
      to: `/factory-tabs/${t.id}`,
      label: t.name,
      icon: tabIcon(t.icon),
      end: true as const,
      perm: 'factory-tabs.view' as string,
    }))
    return [...baseItems.slice(0, insertAt), ...tabItems, ...baseItems.slice(insertAt)]
  })()

  const content = (
    <aside
      className="flex h-full w-64 flex-col border-l border-[#080d12]/50 shadow-2xl"
      style={{ background: 'linear-gradient(180deg, #0f1821 0%, #080d12 100%)' }}
    >
      {/* سرستون سایدبار با تم طلایی سازمانی */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl shadow-brand-glow text-[#0f1821]"
            style={{
              background: 'linear-gradient(135deg, #f5b452, #efa73f)',
            }}
          >
            <Mountain className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-black text-white tracking-tight">خط فرآوری معدن</div>
            <div className="text-[10px] font-medium text-[#efa73f]/90 mt-0.5">سیستم یکپارچه صنعتی</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:text-white lg:hidden"
          aria-label="بستن"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-3 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                classNames(
                  'group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all duration-150',
                  isActive
                    ? 'text-[#efa73f]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background: 'linear-gradient(90deg, rgba(239, 167, 63, 0.18), rgba(239, 167, 63, 0.05))',
                        borderRight: '3px solid #efa73f',
                      }}
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  <Icon
                    className={classNames(
                      'relative z-10 h-4 w-4 transition-transform group-hover:scale-105',
                      isActive ? 'text-[#efa73f]' : 'text-slate-400 group-hover:text-slate-200'
                    )}
                  />
                  <span className="relative z-10 tracking-tight">{item.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-white/5 px-5 py-4 bg-black/20">
        {user && (
          <span className={classNames('badge !px-2.5 !py-0.5 !text-[11px] font-bold', ROLE_BADGE[user.role])}>
            {ROLE_LABELS[user.role]}
          </span>
        )}
        <div className="mt-1.5 text-[10px] font-medium text-slate-500">
          سامانه مانیتورینگ کارخانجات صنعتی
        </div>
      </div>
    </aside>
  )

  return (
    <>
      <div className="hidden lg:flex">{content}</div>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={onClose}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="absolute right-0 top-0 h-full w-64 z-10"
            >
              {content}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
