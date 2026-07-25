import { Component, lazy, Suspense, useState, type ErrorInfo, type ReactNode } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AuthProvider, useAuth } from './store/AuthContext'
import { FactoryProvider } from './store/FactoryContext'
import { ToastProvider } from './components/ui/Toast'
import { ThemeProvider } from './components/ui/Theme'
import { PageLoader } from './components/ui/States'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import Login from './components/layout/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Lines = lazy(() => import('./pages/Lines'))
const Logs = lazy(() => import('./pages/Logs'))
const Analysis = lazy(() => import('./pages/Analysis'))
const Reports = lazy(() => import('./pages/Reports'))
const ActivityLog = lazy(() => import('./pages/ActivityLog'))

function Page({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-grid p-4">
          <div className="card-glass max-w-md p-8 text-center dark:border-slate-700 dark:bg-slate-900/80">
            <h1 className="mb-3 text-xl font-bold text-rose-600">خطا در بارگذاری صفحه</h1>
            <p className="mb-6 text-sm text-ink-600 dark:text-slate-300">مشکلی غیرمنتظره رخ داده است.</p>
            <button className="btn-primary" onClick={() => this.setState({ error: null })}>تلاش مجدد</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function AppInner() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (loading) return <PageLoader />
  if (!user) return <Login />

  return (
    <FactoryProvider>
      <div className="flex h-screen overflow-hidden bg-grid">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
              <AnimatePresence mode="wait">
                <Suspense fallback={<PageLoader />}>
                  <Routes location={location} key={location.pathname}>
                    <Route path="/" element={<Page><Dashboard /></Page>} />
                    <Route path="/lines" element={<Page><Lines /></Page>} />
                    <Route path="/logs" element={<Page><Logs /></Page>} />
                    <Route path="/analysis" element={<Page><Analysis /></Page>} />
                    <Route path="/reports" element={<Page><Reports /></Page>} />
                    <Route path="/activity" element={<Page><ActivityLog /></Page>} />
                  </Routes>
                </Suspense>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    </FactoryProvider>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppInner />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
