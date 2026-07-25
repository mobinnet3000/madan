/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Vazirmatn', 'system-ui', 'sans-serif'], mono: ['Fira Code', 'monospace'] },
      colors: {
        brand: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12' },
        ink: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617' },
        stock: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b' },
        vibrant: { orange: '#f97316', amber: '#f59e0b', emerald: '#10b981', teal: '#14b8a6', cyan: '#06b6d4', sky: '#0ea5e9', violet: '#8b5cf6', purple: '#a855f7', pink: '#ec4899', rose: '#f43f5e' },
      },
      boxShadow: { 'glass': '0 4px 30px rgba(0,0,0,0.08)', 'glass-lg': '0 8px 40px rgba(0,0,0,0.12)', 'glass-xl': '0 16px 60px rgba(0,0,0,0.16)', 'inner-glow': 'inset 0 0 0 1px rgba(255,255,255,0.06)' },
      backdropBlur: { xs: '2px' },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'slide-up': { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'pulse-glow': { '0%, 100%': { boxShadow: '0 0 0 0 rgba(249,115,22,0.4)' }, '50%': { boxShadow: '0 0 20px 10px rgba(249,115,22,0)' } },
        'pulse-glow-green': { '0%, 100%': { boxShadow: '0 0 0 0 rgba(16,185,129,0.4)' }, '50%': { boxShadow: '0 0 20px 10px rgba(16,185,129,0)' } },
        'shimmer': { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'blob': { '0%': { transform: 'translate(0, 0) scale(1)' }, '33%': { transform: 'translate(30px, -50px) scale(1.05)' }, '66%': { transform: 'translate(-20px, 30px) scale(0.95)' }, '100%': { transform: 'translate(0, 0) scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out',
        'scale-in': 'scale-in 0.25s ease-out',
        'slide-up': 'slide-up 0.4s ease-out',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'pulse-glow-green': 'pulse-glow-green 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'blob': 'blob 20s infinite',
      },
    },
  },
  plugins: [],
}
