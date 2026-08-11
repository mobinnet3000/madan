import { useMemo } from 'react'
import type { Factory, Device, FailureReason, ProductionLine } from '../types'

export function useFactoryLookup(factories: Factory[], selectedFactoryId: number | null) {
  const selectedFactory = useMemo(
    () => factories.find((f) => f.id === selectedFactoryId) ?? factories[0] ?? null,
    [factories, selectedFactoryId],
  )

  const allLines = useMemo(
    () => (selectedFactory?.lines ?? []).flatMap((l) => l),
    [selectedFactory],
  )

  const allDevices = useMemo(
    () => allLines.flatMap((l) => l.devices),
    [allLines],
  )

  const lineName = (id: number) =>
    allLines.find((l) => l.id === id)?.name ?? `خط ${id}`

  const deviceName = (id: number) =>
    allDevices.find((d) => d.id === id)?.name ?? `دستگاه ${id}`

  const shiftName = (id: number) =>
    selectedFactory?.shifts.find((s) => s.id === id)?.name ?? `شیفت ${id}`

  const failureReasonTitle = (id: number) => {
    const fr: FailureReason | undefined = selectedFactory?.failure_reasons.find((f) => f.id === id)
    return fr?.title ?? `علت ${id}`
  }

  return { selectedFactory, allLines, allDevices, lineName, deviceName, shiftName, failureReasonTitle }
}
