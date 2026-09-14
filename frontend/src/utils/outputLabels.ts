import type { Factory } from '../types'

export function factoryOutputLabel(factory: Factory | null | undefined, key: string): string {
  const def = factory?.factory_analysis_definition
  const found = def?.outputs.find(o => o.key === key)
  return found?.name || key
}
export function lineTonnageOutputLabel(factory: Factory | null | undefined, lineId: number | null | undefined, key: string): string {
  const line = factory?.lines.find(l => l.id === lineId)
  const found = line?.tonnage_definition?.outputs.find(o => o.key === key)
  return found?.name || key
}
export function lineAnalysisOutputLabel(_factory: Factory | null | undefined, _lineId: number | null | undefined, key: string): string {
  return key
}
