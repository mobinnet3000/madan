import { DEFAULT_PAGE, DEFAULT_STYLE } from '../../../utils/pdf/styles'
import type { PdfRenderOptions } from '../../../utils/pdf/types'

export function brandedLayout(title: string, factoryName: string, factoryAddress?: string): Partial<PdfRenderOptions> {
  return {
    title,
    branding: { factoryName, factoryAddress, primaryColor: '#1e3a5f' },
    page: { ...DEFAULT_PAGE, headerHeight: '26mm', footerHeight: '13mm' },
    style: { ...DEFAULT_STYLE, headerBg: '#1e3a5f' },
    header: { variant: 'branded', height: '26mm', branding: { factoryName, factoryAddress, primaryColor: '#1e3a5f' }, title, subtitle: factoryAddress, showLogo: true, showDate: true },
    footer: { variant: 'standard', height: '13mm', branding: { factoryName, factoryAddress }, showPageNumbers: true, showPrintDate: true, footnote: factoryName },
  }
}
