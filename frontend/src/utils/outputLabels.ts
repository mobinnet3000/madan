import type { Factory, FactoryTabBrief } from '../types'

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
export function tabOutputLabel(tab: FactoryTabBrief | null | undefined, key: string): string {
  return tab?.outputs.find(o => o.key === key)?.name || key
}
export function tabInputLabel(tab: FactoryTabBrief | null | undefined, key: string): string {
  return tab?.inputs.find(i => i.key === key)?.name || key
}
