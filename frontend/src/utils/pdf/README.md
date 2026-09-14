# PDF System

Fixed header/footer via `@page` margins + `position:fixed`.

- `types.ts` — shared types (272L)
- `styles.ts` — `@page { margin: calc(headerH + top) ... }` + fixed header 26mm/footer 13mm
- `renderer.ts` — `buildPdfHtml` / `printPdf` / `previewPdf`
- `printer.ts` — iframe print + fallback
- `helpers.ts` — esc, fmt*, chip/kpi helpers
- `presets.ts` — A4/A3 presets
- `templates.ts` — downtime/standard/table-only

Usage:
```ts
import { printPdf } from '@/utils/pdf'
printPdf({ title, fileName, branding, tables: [{ columns, rows }] })
```
