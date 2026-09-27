export function useOutputLabelMap(_lineId: number | null): Record<string, string> { return {} }
export function labelFor(map: Record<string, string>, key: string): string { return map[key] || key }
