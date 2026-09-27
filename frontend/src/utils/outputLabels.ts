import type { FactoryTabBrief } from '../types'
export function factoryOutputLabel(): string { return '' }
export function lineTonnageOutputLabel(): string { return '' }
export function lineAnalysisOutputLabel(_factory: unknown, _lineId: number | null | undefined, key: string): string { return key }
export function tabOutputLabel(tab: FactoryTabBrief | null | undefined, key: string): string { return tab?.outputs.find(o => o.key === key)?.name || key }
export function tabInputLabel(tab: FactoryTabBrief | null | undefined, key: string): string { return tab?.inputs.find(i => i.key === key)?.name || key }
