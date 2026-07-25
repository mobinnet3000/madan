import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mountain, LogIn, User, Lock, AlertCircle, Sparkles } from 'lucide-react'
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
    setError(null); setLoading(true)
    try {
      const u = await login(username.trim(), password)
      notify(`خوش‌آمدید ${u.first_name || u.username}`)
    } catch (err: any) { setError(err.message || 'خطا در ورود') }
    finally { setLoading(false) }
  }

  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #020617 100%)' }}>
      {/* Animated gradient mesh */}
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{
        backgroundImage: 'radial-gradient(circle at 25% 0%, rgba(249,115,22,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 100%, rgba(16,185,129,0.2) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(139,92,246,0.15) 0%, transparent 50%)',
      }} />
      <motion.div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-brand-500/10 blur-[100px]"
        animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }} transition={{ duration: 8, repeat: Infinity }} />
      <motion.div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-stock-500/10 blur-[100px]"
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.2, 0.1, 0.2] }} transition={{ duration: 10, repeat: Infinity }} />

      {/* Grid overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{
        backgroundImage: 'linear-gradient(rgba(249,115,22,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.1) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }} className="relative z-10 w-full max-w-md">
        <div className="overflow-hidden rounded-3xl border border-white/10 backdrop-blur-xl" style={{ background: 'linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95))', boxShadow: '0 25px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(249,115,22,0.1)' }}>
          <div className="p-8">
            <div className="mb-6 flex flex-col items-center text-center">
              <motion.div initial={{ rotate: -10, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 8px 30px rgba(249,115,22,0.3)' }}>
                <Mountain className="h-8 w-8 text-white" />
              </motion.div>
              <h1 className="text-xl font-extrabold text-white">مدیریت خط فرآوری معدن</h1>
              <p className="mt-1 text-sm text-slate-400">برای ورود نام کاربری و رمز عبور خود را وارد کنید</p>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 px-3 py-2.5 text-sm text-rose-300" style={{ background: 'rgba(244,63,94,0.1)' }}>
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </motion.div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-400">نام کاربری</label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input className="w-full rounded-xl border border-slate-700/50 px-3.5 py-2.5 pr-10 text-sm text-white outline-none transition placeholder:text-slate-500" style={{ background: 'rgba(30,41,59,0.6)' }}
                    value={username} onChange={(e) => setUsername(e.target.value)} placeholder="مثال: admin" autoFocus />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-400">رمز عبور</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input type="password" className="w-full rounded-xl border border-slate-700/50 px-3.5 py-2.5 pr-10 text-sm text-white outline-none transition placeholder:text-slate-500" style={{ background: 'rgba(30,41,59,0.6)' }}
                    value={password} onChange={(e) => setPassword(e.target.value)} placeholder="رمز عبور" />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full !py-3" disabled={loading}>
                {loading ? 'در حال ورود...' : <><LogIn className="h-4 w-4" /> ورود به سامانه</>}
              </button>
            </form>

            <div className="mt-6 rounded-xl px-3 py-3" style={{ background: 'rgba(30,41,59,0.5)' }}>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                <Sparkles className="h-3 w-3 text-brand-400" /> حساب‌های نمونه
              </div>
              <div className="flex flex-wrap gap-1.5">
                {demoUsers.map((u) => (
                  <button key={u.username} type="button" title={u.role}
                    onClick={() => { setUsername(u.username); setPassword('Madan@1404') }}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-slate-300 transition" style={{ background: 'rgba(51,65,85,0.6)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(51,65,85,0.6)'}>
                    {u.username}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 text-[10px] text-slate-500">رمز همه: Madan@1404</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
