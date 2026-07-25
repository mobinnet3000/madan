import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mountain, LogIn, User, Lock, AlertCircle } from 'lucide-react'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../ui/Toast'

const demoUsers = [
  { role: 'ادمین (دسترسی کامل)', username: 'admin' },
  { role: 'مدیر کارخانه ۱', username: 'manager1' },
  { role: 'اپراتور کارخانه ۱', username: 'operator1' },
  { role: 'مدیر کارخانه ۲', username: 'manager2' },
]

export default function Login() {
  const { login } = useAuth()
  const { notify } = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const u = await login(username.trim(), password)
      notify(`خوش‌آمدید ${u.first_name || u.username}`)
    } catch (err: any) {
      setError(err.message || 'خطا در ورود')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden bg-grid">
      {/* Ambient glow blobs */}
      <motion.div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 8, repeat: Infinity }} />
      <motion.div className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-stock-500/20 blur-3xl"
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.4, 0.2, 0.4] }} transition={{ duration: 10, repeat: Infinity }} />
      <motion.div className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl"
        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }} transition={{ duration: 12, repeat: Infinity }} />

      <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }} className="relative z-10 w-full max-w-md">
        <div className="card-glass overflow-hidden p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <motion.div initial={{ rotate: -10, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
              className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-amber-500 shadow-lg shadow-brand-500/20">
              <Mountain className="h-8 w-8 text-white" />
            </motion.div>
            <h1 className="text-xl font-extrabold text-ink-900 dark:text-white">مدیریت خط فرآوری معدن</h1>
            <p className="mt-1 text-sm text-ink-500">برای ورود نام کاربری و رمز عبور خود را وارد کنید</p>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2.5 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </motion.div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">نام کاربری</label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input className="input pr-10" value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: admin" autoFocus />
              </div>
            </div>
            <div>
              <label className="label">رمز عبور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input type="password" className="input pr-10" value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="رمز عبور" />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full !py-3" disabled={loading}>
              {loading ? 'در حال ورود...' : <><LogIn className="h-4 w-4" /> ورود به سامانه</>}
            </button>
          </form>

          <div className="mt-6 rounded-xl bg-ink-50/80 p-3 dark:bg-slate-800/80">
            <div className="mb-2 text-[11px] font-semibold text-ink-500 dark:text-slate-400">حساب‌های نمونه (رمز همه: Madan@1404)</div>
            <div className="flex flex-wrap gap-1.5">
              {demoUsers.map((u) => (
                <button key={u.username} type="button"
                  onClick={() => { setUsername(u.username); setPassword('Madan@1404') }}
                  className="rounded-lg bg-white/80 px-2 py-1 text-[11px] font-medium text-ink-600 shadow-sm ring-1 ring-ink-200 transition hover:bg-brand-50 hover:text-brand-700 dark:bg-slate-700/80 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-brand-950/30 dark:hover:text-brand-400">
                  {u.username}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
