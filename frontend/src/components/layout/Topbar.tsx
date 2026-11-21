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
    <header className="sticky top-0 z-20 border-b border-[#e4ddd2] bg-[#f7f3ee]/90 px-4 py-2.5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 sm:px-6 sm:py-3 transition-colors duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-200/60 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="منو"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#f5b452] to-[#efa73f] text-[#0f1821] shadow-xs">
            <Building2 className="h-5 w-5" />
          </div>

          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">
              کارخانه فعال
            </div>
            <div className="text-sm font-black text-[#0f1821] dark:text-slate-100">
              {selectedFactory?.name ?? 'در حال بارگذاری...'}
            </div>
          </div>

          {user?.role !== 'admin' && selectedFactory && (
            <span className="badge hidden bg-[#ede7de] text-[#0f1821] sm:inline-flex dark:bg-slate-800 dark:text-slate-300">
              دسترسی محدود
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <button
            onClick={reload}
            className="btn-ghost h-9 w-9 !px-0 rounded-xl"
            title="بارگذاری مجدد اطلاعات"
          >
            <RefreshCw className={classNames('h-4 w-4', loading && 'animate-spin')} />
          </button>

          {user?.role === 'admin' && (
            <div className="relative hidden sm:block">
              <select
                value={selectedFactory?.id ?? ''}
                onChange={(e) => setSelectedFactoryId(Number(e.target.value))}
                className="appearance-none rounded-xl border border-[#e4ddd2] bg-white px-3.5 py-2 pl-9 pr-3.5 text-xs font-bold text-[#0f1821] outline-none transition hover:border-[#efa73f] focus:border-[#efa73f] focus:ring-2 focus:ring-[#efa73f]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs"
              >
                {factories.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl border border-[#e4ddd2] bg-white px-3 py-1.5 transition hover:border-[#efa73f] dark:border-slate-700 dark:bg-slate-800 shadow-2xs cursor-pointer"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#faf0df] text-[#efa73f] dark:bg-slate-700 dark:text-brand-400">
                <UserIcon className="h-4 w-4" />
              </span>
              <span className="hidden text-xs font-bold text-[#0f1821] dark:text-slate-200 sm:inline">
                {user?.first_name || user?.username}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.12 }}
                    className="absolute left-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-[#e4ddd2] bg-white p-2 shadow-modal backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="rounded-xl bg-[#f7f3ee] p-3 dark:bg-slate-800">
                      <div className="text-sm font-bold text-[#0f1821] dark:text-slate-100">
                        {user?.first_name} {user?.last_name}
                      </div>
                      <div className="text-[11px] text-slate-500">@{user?.username}</div>
                      <span className={classNames('badge mt-1.5', ROLE_BADGE[user!.role])}>
                        {ROLE_LABELS[user!.role]}
                      </span>
                      {user?.factory_name && (
                        <div className="mt-1 text-[11px] text-slate-500">کارخانه: {user.factory_name}</div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        logout()
                      }}
                      className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-accent-500 transition hover:bg-accent-50 dark:hover:bg-accent-950/30 cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" /> خروج از حساب
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
