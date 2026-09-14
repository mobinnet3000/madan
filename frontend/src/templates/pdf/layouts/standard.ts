import { DEFAULT_PAGE } from '../../../utils/pdf/styles'
import type { PdfRenderOptions } from '../../../utils/pdf/types'

export function standardLayout(title: string, factoryName: string): Partial<PdfRenderOptions> {
  return {
    title,
    branding: { factoryName },
    page: { ...DEFAULT_PAGE, headerHeight: '26mm', footerHeight: '13mm' },
    header: { variant: 'standard', height: '26mm', branding: { factoryName }, title, showLogo: true, showDate: true },
    footer: { variant: 'standard', height: '13mm', branding: { factoryName }, showPageNumbers: true, showPrintDate: true },
  }
}
