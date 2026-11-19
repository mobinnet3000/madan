import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mountain, LogIn, User, Lock, AlertCircle, ArrowLeft, PhoneCall } from 'lucide-react'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../ui/Toast'

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
      setError(err.message || 'نام کاربری یا کلمه عبور نادرست است')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden"
      style={{
        backgroundColor: '#f7f3ee', // پس‌زمینه سازمانی گرم
        backgroundImage: 'radial-gradient(circle at 15% 15%, rgba(239, 167, 63, 0.12) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(201, 33, 39, 0.08) 0%, transparent 45%)',
      }}
    >
      {/* مش‌گرید خطوط صنعتی با رنگ گرم */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: 'linear-gradient(rgba(228, 221, 210, 0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(228, 221, 210, 0.6) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        <div
          className="overflow-hidden rounded-3xl border bg-white/95 p-8 backdrop-blur-xl shadow-modal dark:bg-slate-900/95 dark:border-slate-800"
          style={{
            borderColor: 'rgba(228, 221, 210, 0.95)',
          }}
        >
          {/* لوگو و نام سازمانی */}
          <div className="mb-8 flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 14 }}
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-brand-glow"
              style={{
                background: 'linear-gradient(135deg, #f5b452, #efa73f)',
              }}
            >
              <Mountain className="h-8 w-8 text-[#0f1821]" />
            </motion.div>
            <h1 className="text-xl font-black tracking-tight text-[#0f1821] dark:text-white">
              سامانه جامع خطوط فرآوری معدن
            </h1>
            <p className="mt-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              سامانه یکپارچه مانیتورینگ تولید، توقفات و گزارش‌های صنعتی
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 flex items-center gap-2 rounded-xl border border-accent-500/20 bg-accent-50 px-3.5 py-2.5 text-xs font-semibold text-accent-700 dark:bg-accent-950/40 dark:text-accent-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-accent-500" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-ink-800 dark:text-slate-300">
                نام کاربری
              </label>
              <div className="relative">
                <User className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="input !pr-10 !h-11 text-sm font-medium focus:ring-2 focus:ring-brand-500/20"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: admin"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-ink-800 dark:text-slate-300">
                رمز عبور
              </label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  className="input !pr-10 !h-11 text-sm font-medium focus:ring-2 focus:ring-brand-500/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="رمز عبور شما"
                />
              </div>
            </div>

            {/* ترکیب دکمه‌ها دقیقاً منطبق بر عکس کاربر */}
            <div className="pt-2 flex flex-col gap-3">
              <button
                type="submit"
                className="btn-primary w-full !h-11 !text-sm font-bold tracking-wide"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0f1821] border-t-transparent" />
                    <span>در حال اعتبارسنجی...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <LogIn className="h-4 w-4 text-[#0f1821]" />
                    <span>ورود به سامانه</span>
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => notify('جهت دریافت دسترسی یا پشتیبانی با واحد IT تماس بگیرید.', 'info')}
                className="btn-secondary w-full !h-11 !text-sm font-bold tracking-wide group"
              >
                <span className="flex items-center justify-center gap-2">
                  <span>ارتباط با ما</span>
                  <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                </span>
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4 text-center dark:border-slate-800">
            <span className="text-[11px] text-slate-400">
              طراحی اختصاصی مدیریت کارخانجات و فرآوری معدنی
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
