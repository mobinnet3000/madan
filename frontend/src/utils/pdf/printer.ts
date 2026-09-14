export interface PrintOptions {
  fileName?: string
  title?: string
  onBeforePrint?: () => void
  onAfterPrint?: () => void
  cleanupDelay?: number
  printDelay?: number
  copies?: number
  duplex?: boolean
  color?: boolean
  paperSize?: string
  orientation?: 'portrait' | 'landscape'
  margins?: { top?: string; right?: string; bottom?: string; left?: string }
}
export interface IframePrintConfig {
  html: string
  title: string
  printDelay: number
  cleanupDelay: number
  onBeforePrint?: () => void
  onAfterPrint?: () => void
}
function createHiddenIframe(title: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'absolute'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.visibility = 'hidden'
  iframe.setAttribute('title', title)
  iframe.setAttribute('aria-hidden', 'true')
  document.body.appendChild(iframe)
  return iframe
}
function writeIframeContent(iframe: HTMLIFrameElement, html: string): Document | null {
  const doc = iframe.contentWindow?.document ?? null
  if (!doc) return null
  doc.open()
  doc.write(html)
  doc.close()
  return doc
}
function triggerPrint(iframe: HTMLIFrameElement, cleanupDelay: number, onAfterPrint?: () => void): void {
  try {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
  } catch {}
  setTimeout(() => {
    try { document.body.removeChild(iframe) } catch {}
    onAfterPrint?.()
  }, cleanupDelay)
}

function fallbackWindowPrint(html: string, title: string, printDelay: number, onAfterPrint?: () => void): void {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.document.title = title
  win.focus()
  setTimeout(() => { try { win.print() } catch {} onAfterPrint?.() }, printDelay)
}

export function htmlToPdf(html: string, fileName: string, opts: PrintOptions = {}): void {
  const cleanupDelay = opts.cleanupDelay ?? 1000
  const printDelay = opts.printDelay ?? 500
  const title = opts.title ?? fileName
  opts.onBeforePrint?.()
  const iframe = createHiddenIframe(title)
  const doc = writeIframeContent(iframe, html)
  if (!doc) {
    document.body.removeChild(iframe)
    fallbackWindowPrint(html, title, printDelay, opts.onAfterPrint)
    return
  }
  setTimeout(() => triggerPrint(iframe, cleanupDelay, opts.onAfterPrint), printDelay)
}

export function openHtmlPreview(html: string, title = 'Preview'): Window | null {
  const win = window.open('', '_blank')
  if (!win) return null
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.document.title = title
  return win
}

export function downloadHtml(html: string, fileName: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.html') ? fileName : `${fileName}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function isPrintSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.print === 'function'
}

export function getPrintMediaQuery(): MediaQueryList | null {
  try { return window.matchMedia('print') } catch { return null }
}

export function onAfterPrintOnce(cb: () => void): () => void {
  const handler = () => { cb(); window.removeEventListener('afterprint', handler) }
  window.addEventListener('afterprint', handler)
  return () => window.removeEventListener('afterprint', handler)
}

export async function ensureFontsReady(timeoutMs = 3000): Promise<void> {
  const fontsReady = (async () => {
    try {
      const docWithFonts = document as unknown as { fonts?: { ready: Promise<void>; status?: string } }
      if (docWithFonts.fonts?.ready) await docWithFonts.fonts.ready
    } catch {}
  })()
  const timer = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
  await Promise.race([fontsReady, timer])
}

export function waitForImages(container: Document | HTMLElement, timeoutMs = 4000): Promise<void> {
  const imgs = Array.from((container instanceof Document ? container : container.ownerDocument ?? document).images ?? [] as unknown as HTMLImageElement[])
  if (!imgs.length) return Promise.resolve()
  return new Promise((resolve) => {
    let remaining = imgs.length
    const done = () => { remaining -= 1; if (remaining <= 0) resolve() }
    const timer = setTimeout(resolve, timeoutMs)
    imgs.forEach((img) => {
      if (img.complete) done()
      else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }) }
    })
    void timer
  })
}

export function buildIframePrintConfig(html: string, opts: PrintOptions): IframePrintConfig {
  return {
    html,
    title: opts.title ?? opts.fileName ?? 'document',
    printDelay: opts.printDelay ?? 500,
    cleanupDelay: opts.cleanupDelay ?? 1000,
    onBeforePrint: opts.onBeforePrint,
    onAfterPrint: opts.onAfterPrint,
  }
}

export function printHtml(html: string, opts: PrintOptions = {}): void {
  htmlToPdf(html, opts.fileName ?? 'document', opts)
}

export function previewHtml(html: string, title = 'Preview'): void {
  openHtmlPreview(html, title)
}

export const PRINTER_DEFAULTS: Required<Pick<PrintOptions, 'printDelay' | 'cleanupDelay'>> = {
  printDelay: 500,
  cleanupDelay: 1000,
}

export type PrintTarget = 'iframe' | 'window' | 'blob'

export interface PrintJob {
  id: string
  html: string
  fileName: string
  target: PrintTarget
  opts: PrintOptions
}

export function createPrintJob(html: string, fileName: string, opts: PrintOptions = {}): PrintJob {
  return { id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, html, fileName, target: 'iframe', opts }
}

export function queuePrintJob(job: PrintJob): void {
  htmlToPdf(job.html, job.fileName, job.opts)
}
