import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { getFactories } from '../api/factory'
import { useFactoryLookup } from '../hooks/useFactoryLookup'
import type { Factory, Device, FailureReason } from '../types'

interface FactoryContextValue {
  factories: Factory[]
  loading: boolean
  error: string | null
  selectedFactoryId: number | null
  setSelectedFactoryId: (id: number) => void
  selectedFactory: Factory | null
  reload: () => void
  allDevices: Device[]
  analyzers: Device[]
  lineName: (id: number) => string
  shiftName: (id: number) => string
  deviceName: (id: number) => string
  failureReasonTitle: (id: number) => string
}

const FactoryContext = createContext<FactoryContextValue | null>(null)

export function FactoryProvider({ children }: { children: ReactNode }) {
  const [factories, setFactories] = useState<Factory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    getFactories()
      .then((data) => {
        setFactories(data)
        setError(null)
        setSelectedFactoryId((prev) => prev ?? data[0]?.id ?? null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { reload() }, [reload])

  const { selectedFactory, allDevices, analyzers, lineName, shiftName, deviceName, failureReasonTitle } =
    useFactoryLookup(factories, selectedFactoryId)

  const value: FactoryContextValue = {
    factories,
    loading,
    error,
    selectedFactoryId: selectedFactory?.id ?? null,
    setSelectedFactoryId,
    selectedFactory,
    reload,
    allDevices,
    analyzers,
    lineName,
    shiftName,
    deviceName,
    failureReasonTitle,
  }

  return <FactoryContext.Provider value={value}>{children}</FactoryContext.Provider>
}

export function useFactory() {
  const ctx = useContext(FactoryContext)
  if (!ctx) throw new Error('useFactory must be used within FactoryProvider')
  return ctx
}
