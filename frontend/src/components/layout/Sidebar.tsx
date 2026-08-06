import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Workflow, ClipboardList, FlaskConical,
  FileBarChart, History, Mountain, X, Factory, Users,
} from 'lucide-react'
import { classNames } from '../../utils'
import { useAuth } from '../../store/AuthContext'
import { ROLE_BADGE, ROLE_LABELS, hasPerm } from '../../constants'

const navItems: { to: string; label: string; icon: any; end: boolean; perm?: string }[] = [
  { to: '/', label: 'داشبورد', icon: LayoutDashboard, end: true, perm: 'dashboard.view' },
  { to: '/lines', label: 'مدل‌سازی خط فرآوری', icon: Workflow, end: false, perm: 'lines.view' },
  { to: '/logs', label: 'گزارش عملکرد', icon: ClipboardList, end: false, perm: 'logs.view' },
  { to: '/production', label: 'گزارش‌های تولید', icon: Factory, end: false, perm: 'production.view' },
  { to: '/analysis', label: 'آنالیز آنلاین', icon: FlaskConical, end: false, perm: 'analysis.view' },
  { to: '/reports', label: 'گزارش‌ها و خروجی', icon: FileBarChart, end: false, perm: 'reports.view' },
  { to: '/users', label: 'مدیریت کاربران و دسترسی‌ها', icon: Users, end: false, perm: 'users.view' },
  { to: '/activity', label: 'لاگ فعالیت‌ها', icon: History, end: false, perm: 'activity.view' },
]

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const perms = user?.permissions
  const items = navItems.filter((it) => !it.perm || hasPerm(perms, it.perm))

  const content = (
    <aside className="flex h-full w-64 flex-col border-l border-white/5" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}>
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 8px 20px rgba(249,115,22,0.3)' }}>
            <Mountain className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">خط فرآوری معدن</div>
            <div className="text-[11px] text-slate-400">سیستم مدل‌سازی و پایش</div>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:text-white lg:hidden"><X className="h-5 w-5" /></button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={onClose}
              className={({ isActive }) => classNames(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200',
                isActive ? 'text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white',
              )}>
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span layoutId="sidebar-active"
                      className="absolute inset-0 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(234,88,12,0.15))', boxShadow: 'inset 0 1px 0 rgba(249,115,22,0.2)' }}
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }} />
                  )}
                  <Icon className="relative z-10 h-[18px] w-[18px]" />
                  <span className="relative z-10">{item.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-white/5 px-5 py-4">
        {user && <span className={classNames('badge', ROLE_BADGE[user.role])}>{ROLE_LABELS[user.role]}</span>}
        <div className="mt-1 text-[11px] leading-relaxed text-slate-500">نسخه ۲.۰ · متصل به بک‌اند Django REST</div>
      </div>
    </aside>
  )

  return (
    <>
      <div className="hidden lg:flex">{content}</div>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute right-0 top-0 h-full">{content}</motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
