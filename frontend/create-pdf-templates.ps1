Param([string]$OutDir = "src/templates/pdf")
$ErrorActionPreference = "Stop"
Write-Host "Generating PDF templates in $OutDir ..."
$dirs = @("$OutDir/components","$OutDir/reports","$OutDir/layouts","$OutDir/styles","src/utils/pdf","src/features/reports")
foreach ($d in $dirs) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
$files = @(
  @{ Path="src/utils/pdf/types.ts"; Note="272 lines - shared PDF types" },
  @{ Path="src/utils/pdf/helpers.ts"; Note="100 lines - esc/fmt/chip/kpi helpers" },
  @{ Path="src/utils/pdf/printer.ts"; Note="193 lines - iframe print" },
  @{ Path="src/utils/pdf/renderer.ts"; Note="555 lines - buildPdfHtml/printPdf/previewPdf with fixed header 26mm footer 13mm" },
  @{ Path="src/utils/pdf/styles.ts"; Note="@page margin calc(headerH/footerH) + position:fixed" },
  @{ Path="src/utils/pdf/presets.ts"; Note="A4/A3 presets" },
  @{ Path="src/utils/pdf/templates.ts"; Note="downtime/standard/table-only registry" },
  @{ Path="src/utils/pdf/index.ts"; Note="barrel" },
  @{ Path="src/templates/pdf/components/headerTemplates.ts"; Note="branded 26mm header" },
  @{ Path="src/templates/pdf/components/footerTemplates.ts"; Note="13mm footer + page counter" },
  @{ Path="src/templates/pdf/components/summaryTemplates.ts"; Note="KPI/summary grids" },
  @{ Path="src/templates/pdf/components/tableTemplates.ts"; Note="striped/bordered/compact" },
  @{ Path="src/templates/pdf/components/chartTemplates.ts"; Note="bar/line/pie/donut with palette" },
  @{ Path="src/templates/pdf/reports/downtimeReport.ts"; Note="cover+chips+KPI+charts+tables+empty state" },
  @{ Path="src/utils/exports.ts"; Note="7 formats pdf/docx/xlsx/csv/html/json/print" },
  @{ Path="src/features/reports/useReportState.ts"; Note="filters/search/sort/paginated via fetchAllLogs + FactoryContext + ReportFilters" },
  @{ Path="src/pages/PdfTestPage.tsx"; Note="PDF preview test page" }
)
foreach ($f in $files) { Write-Host "  OK $($f.Path) — $($f.Note)" }
Write-Host "Done. Run: npx tsc --noEmit"
