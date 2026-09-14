import { DEFAULT_PAGE } from '../../../utils/pdf/styles'
import type { PdfRenderOptions } from '../../../utils/pdf/types'

export function minimalLayout(title: string, factoryName: string): Partial<PdfRenderOptions> {
  return {
    title,
    branding: { factoryName },
    page: { ...DEFAULT_PAGE, headerHeight: '18mm', footerHeight: '10mm' },
    header: { variant: 'minimal', height: '18mm', branding: { factoryName }, title, showLogo: false, showDate: true },
    footer: { variant: 'minimal', height: '10mm', branding: { factoryName }, showPageNumbers: true, showPrintDate: false },
  }
}
