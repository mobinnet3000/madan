import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getFactories } from '../api/factory'
import type { Factory, ProductionLine, Shift, Device, FailureReason } from '../types'

interface FactoryContextValue {
  factories: Factory[]
  loading: boolean
  error: string | null
  selectedFactoryId: number | null
  setSelectedFactoryId: (id: number) => void
  selectedFactory: Factory | null
  reload: () => void
  // توابع کمکی برای تبدیل شناسه به نام
  lineName: (id: number) => string
  shiftName: (id: number) => string
  deviceName: (id: number) => string
  failureReasonTitle: (id: number) => string
  allDevices: Device[]
  analyzers: Device[]
}

const FactoryContext = createContext<FactoryContextValue | null>(null)

export function FactoryProvider({ children }: { children: ReactNode }) {
  const [factories, setFactories] = useState<Factory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(null)

  const reload = () => {
    setLoading(true)
    getFactories()
      .then((data) => {
        setFactories(data)
        setError(null)
        setSelectedFactoryId((prev) => prev ?? data[0]?.id ?? null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedFactory =
    factories.find((f) => f.id === selectedFactoryId) ?? factories[0] ?? null

  const allLines: ProductionLine[] = (selectedFactory?.lines ?? []).flatMap((l) => l)
  const allDevices: Device[] = allLines.flatMap((l) => l.devices)
  const analyzers: Device[] = allDevices.filter((d) => d.is_analyzer)

  const lineName = (id: number) =>
    allLines.find((l) => l.id === id)?.name ?? `خط ${id}`
  const deviceName = (id: number) => allDevices.find((d) => d.id === id)?.name ?? `دستگاه ${id}`
  const shiftName = (id: number) =>
    selectedFactory?.shifts.find((s) => s.id === id)?.name ?? `شیفت ${id}`
  const failureReasonTitle = (id: number) => {
    const fr: FailureReason | undefined = selectedFactory?.failure_reasons.find(
      (f) => f.id === id,
    )
    return fr?.title ?? `علت ${id}`
  }

  const value: FactoryContextValue = {
    factories,
    loading,
    error,
    selectedFactoryId: selectedFactory?.id ?? null,
    setSelectedFactoryId,
    selectedFactory,
    reload,
    lineName,
    shiftName,
    deviceName,
    failureReasonTitle,
    allDevices,
    analyzers,
  }

  return <FactoryContext.Provider value={value}>{children}</FactoryContext.Provider>
}

export function useFactory() {
  const ctx = useContext(FactoryContext)
  if (!ctx) throw new Error('useFactory must be used within FactoryProvider')
  return ctx
}
