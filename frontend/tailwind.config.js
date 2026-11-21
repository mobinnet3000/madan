/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
      colors: {
        // پالت سازمانی زرین / اکر (Amber Ochre)
        brand: {
          50: '#fdfaf3',
          100: '#faf0df',
          200: '#f5dfb8',
          300: '#f0cc8b',
          400: '#ebb55e',
          500: '#efa73f', // رنگ اصلی سازمانی
          600: '#d88f28',
          700: '#b8741b',
          800: '#935a1a',
          900: '#774719',
          950: '#402409',
        },
        // پالت یاقوتی سازمانی (Crimson Accent)
        accent: {
          50: '#fdf2f2',
          100: '#fbe4e5',
          200: '#f7cbcd',
          300: '#f1a5a8',
          400: '#e77378',
          500: '#c92127', // رنگ سازمانی دکمه ارتباط با ما و هشدارهای مهم
          600: '#ab181d',
          700: '#8c1418',
          800: '#751317',
          900: '#641417',
          950: '#380608',
        },
        // سطوح سازمانی گرم (Warm Stone / Industrial Sand)
        surface: {
          base: '#f7f3ee', // پس‌زمینه گرم سازمانی
          card: '#ffffff',
          muted: '#ede7de',
          border: '#e4ddd2',
        },
        // رنگ‌های متن و تیرگی صنعتی
        ink: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f1821', // رنگ مشکی سازمانی پرکنتراست
          950: '#080d12',
        },
        stock: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
      },
      boxShadow: {
        'brand-glow': '0 4px 18px rgba(239, 167, 63, 0.32)',
        'accent-glow': '0 4px 18px rgba(201, 33, 39, 0.28)',
        'subtle': '0 1px 3px rgba(15, 24, 33, 0.05), 0 6px 16px rgba(15, 24, 33, 0.03)',
        'card': '0 2px 8px -2px rgba(15, 24, 33, 0.06), 0 10px 24px -4px rgba(15, 24, 33, 0.05)',
        'modal': '0 20px 48px -8px rgba(15, 24, 33, 0.22), 0 4px 12px rgba(15, 24, 33, 0.08)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
