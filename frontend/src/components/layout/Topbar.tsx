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
    <header className="sticky top-0 z-20 border-b px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-3.5" style={{ background: 'rgba(255,255,255,0.7)', borderColor: 'rgba(249,115,22,0.08)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onMenuClick} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100/50 lg:hidden dark:hover:bg-white/5" aria-label="منو"><Menu className="h-5 w-5" /></button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-ink-400/80">کارخانه فعال</div>
            <div className="text-sm font-bold text-ink-800 dark:text-slate-100">{selectedFactory?.name ?? 'در حال بارگذاری...'}</div>
          </div>
          {user?.role !== 'admin' && selectedFactory && <span className="badge bg-ink-100/80 text-ink-500 hidden sm:inline-flex">دسترسی محدود</span>}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <button onClick={reload} className="btn-ghost h-9 w-9 !px-0 rounded-xl" title="بارگذاری مجدد">
            <RefreshCw className={classNames('h-4 w-4', loading && 'animate-spin')} />
          </button>

          {user?.role === 'admin' && (
            <div className="relative hidden sm:block">
              <select value={selectedFactory?.id ?? ''} onChange={(e) => setSelectedFactoryId(Number(e.target.value))}
                className="appearance-none rounded-xl border px-3.5 py-2 pl-9 pr-3.5 text-sm font-medium outline-none transition text-ink-700 dark:text-slate-200"
                style={{ background: 'rgba(241,245,249,0.6)', borderColor: 'rgba(148,163,184,0.3)' }}>
                {factories.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            </div>
          )}

          <div className="relative">
            <button onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl border px-3 py-1.5 transition" style={{ background: 'rgba(241,245,249,0.5)', borderColor: 'rgba(148,163,184,0.2)' }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg shadow-sm" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                <UserIcon className="h-4 w-4 text-white" />
              </span>
              <span className="hidden text-sm font-medium text-ink-700 dark:text-slate-200 sm:inline">{user?.first_name || user?.username}</span>
              <ChevronDown className="h-4 w-4 text-ink-400" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute left-0 z-40 mt-2 w-60 overflow-hidden rounded-2xl border p-2 shadow-xl backdrop-blur-xl"
                    style={{ background: 'rgba(255,255,255,0.9)', borderColor: 'rgba(249,115,22,0.1)' }}>
                    <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(241,245,249,0.6)' }}>
                      <div className="text-sm font-bold text-ink-800 dark:text-slate-100">{user?.first_name} {user?.last_name}</div>
                      <div className="text-[11px] text-ink-500">@{user?.username}</div>
                      <span className={classNames('badge mt-1.5', ROLE_BADGE[user!.role])}>{ROLE_LABELS[user!.role]}</span>
                      {user?.factory_name && <div className="mt-1 text-[11px] text-ink-500">کارخانه: {user.factory_name}</div>}
                    </div>
                    <button onClick={() => { setMenuOpen(false); logout() }}
                      className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50/80"><LogOut className="h-4 w-4" /> خروج از سامانه</button>
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
