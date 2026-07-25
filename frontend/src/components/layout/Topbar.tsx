import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFactory } from '../../store/FactoryContext'
import { useAuth } from '../../store/AuthContext'
import { classNames } from '../../utils'
import { Building2, ChevronDown, RefreshCw, LogOut, User as UserIcon, Menu } from 'lucide-react'
import { ROLE_BADGE, ROLE_LABELS } from '../../constants'
import { ThemeToggle } from '../ui/Theme'

export default function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { factories, selectedFactory, setSelectedFactoryId, reload, loading } = useFactory()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-20 border-b border-ink-200/60 bg-white/70 px-4 py-3 backdrop-blur-xl dark:border-slate-700/40 dark:bg-slate-950/70 sm:px-6 sm:py-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onMenuClick} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100/50 lg:hidden dark:hover:bg-slate-800/50" aria-label="منو">
            <Menu className="h-5 w-5" />
          </button>
          <Building2 className="hidden h-5 w-5 text-brand-500 sm:block" />
          <div>
            <div className="text-[11px] font-medium text-ink-400">کارخانه فعال</div>
            <div className="text-sm font-bold text-ink-800 dark:text-slate-100">
              {selectedFactory?.name ?? 'در حال بارگذاری...'}
            </div>
          </div>
          {user?.role !== 'admin' && selectedFactory && (
            <span className="badge bg-ink-100 text-ink-500 hidden sm:inline-flex">دسترسی محدود</span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <button onClick={reload} className="btn-ghost h-9 w-9 !px-0 rounded-xl" title="بارگذاری مجدد">
            <RefreshCw className={classNames('h-4 w-4', loading && 'animate-spin')} />
          </button>

          {user?.role === 'admin' && (
            <div className="relative hidden sm:block">
              <select value={selectedFactory?.id ?? ''} onChange={(e) => setSelectedFactoryId(Number(e.target.value))}
                className="appearance-none rounded-xl border border-ink-200 bg-white/80 py-2 pl-9 pr-3.5 text-sm font-medium text-ink-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
                {factories.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            </div>
          )}

          <div className="relative">
            <button onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white/80 py-1.5 pl-2 pr-3 transition hover:bg-ink-50/80 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:bg-slate-800/80">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-amber-500 text-white shadow-sm">
                <UserIcon className="h-4 w-4" />
              </span>
              <span className="hidden text-sm font-medium text-ink-700 dark:text-slate-200 sm:inline">
                {user?.first_name || user?.username}
              </span>
              <ChevronDown className="h-4 w-4 text-ink-400" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute left-0 z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-ink-200 bg-white/90 p-2 shadow-xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/90">
                    <div className="rounded-xl bg-ink-50/80 px-3 py-2.5 dark:bg-slate-800/80">
                      <div className="text-sm font-bold text-ink-800 dark:text-slate-100">{user?.first_name} {user?.last_name}</div>
                      <div className="text-[11px] text-ink-500 dark:text-slate-400">@{user?.username}</div>
                      <span className={classNames('badge mt-1.5', ROLE_BADGE[user!.role])}>{ROLE_LABELS[user!.role]}</span>
                      {user?.factory_name && <div className="mt-1 text-[11px] text-ink-500">کارخانه: {user.factory_name}</div>}
                    </div>
                    <button onClick={() => { setMenuOpen(false); logout() }}
                      className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50/80 dark:hover:bg-rose-950/40">
                      <LogOut className="h-4 w-4" /> خروج از سامانه
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  )
}
