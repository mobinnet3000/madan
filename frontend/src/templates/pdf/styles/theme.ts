import type { PdfStyleConfig } from '../../../utils/pdf/types'
import { DEFAULT_STYLE } from '../../../utils/pdf/styles'

export const THEMES: Record<string, PdfStyleConfig> = {
  default: { ...DEFAULT_STYLE },
  dark: { ...DEFAULT_STYLE, primaryColor: '#0f172a', headerBg: '#020617', textColor: '#0f172a' },
  brand: { ...DEFAULT_STYLE, primaryColor: '#1e3a5f', headerBg: '#1e3a5f', borderColor: '#cbd5e1' },
  minimal: { ...DEFAULT_STYLE, primaryColor: '#334155', headerBg: '#334155', borderColor: '#e2e8f0', kpiBg: '#ffffff' },
}

export function getTheme(id: string): PdfStyleConfig { return THEMES[id] ?? THEMES.default }
