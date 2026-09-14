import type { PdfPreset } from './types'
import { DEFAULT_PAGE, DEFAULT_STYLE } from './styles'

export const PRESETS: PdfPreset[] = [
  {
    id: 'a4-portrait-standard',
    label: 'A4 عمودی — استاندارد',
    page: { ...DEFAULT_PAGE, size: 'A4', orientation: 'portrait', headerHeight: '26mm', footerHeight: '13mm' },
    header: 'branded',
    footer: 'standard',
    style: { ...DEFAULT_STYLE },
  },
  {
    id: 'a4-landscape-wide',
    label: 'A4 افقی — جدول عریض',
    page: { ...DEFAULT_PAGE, size: 'A4', orientation: 'landscape', headerHeight: '22mm', footerHeight: '12mm' },
    header: 'standard',
    footer: 'standard',
    style: { ...DEFAULT_STYLE },
  },
  {
    id: 'a4-minimal',
    label: 'A4 مینیمال',
    page: { ...DEFAULT_PAGE, size: 'A4', orientation: 'portrait', headerHeight: '18mm', footerHeight: '10mm', margins: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' } },
    header: 'minimal',
    footer: 'minimal',
    style: { ...DEFAULT_STYLE, headerBg: '#0f172a' },
  },
  {
    id: 'a3-landscape',
    label: 'A3 افقی — پرحجم',
    page: { ...DEFAULT_PAGE, size: 'A3', orientation: 'landscape', headerHeight: '28mm', footerHeight: '14mm', margins: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' } },
    header: 'detailed',
    footer: 'detailed',
    style: { ...DEFAULT_STYLE },
  },
]

export function getPreset(id: string): PdfPreset | undefined {
  return PRESETS.find((p) => p.id === id)
}

export function presetOptions(): { value: string; label: string }[] {
  return PRESETS.map((p) => ({ value: p.id, label: p.label }))
}

export const DEFAULT_PRESET_ID = 'a4-portrait-standard'
