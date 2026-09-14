import { useEffect, useState } from 'react'
import { getAnalysisSchema } from '../api/actual'

export function useOutputLabelMap(lineId: number | null): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!lineId) { setMap({}); return }
    getAnalysisSchema(lineId).then(s => {
      const m: Record<string, string> = {}
      s.outputs.forEach(o => { m[o.key] = o.name })
      setMap(m)
    }).catch(() => setMap({}))
  }, [lineId])
  return map
}
export function labelFor(map: Record<string, string>, key: string): string { return map[key] || key }
