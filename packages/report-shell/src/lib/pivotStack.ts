import { historyAdapter, storageSignal, type Signal } from '@hafley66/signals'
import type { PivotEntry } from '../types'

export function encodePivotStack(stack: PivotEntry[]): string {
  return stack.length ? JSON.stringify(stack) : ''
}

export function decodePivotStack(raw: string): PivotEntry[] {
  if (!raw) return []
  try {
    return JSON.parse(raw) as PivotEntry[]
  } catch {
    return []
  }
}

// History-backed (Back pops a pivot) under query param `key`.
export function pivotStackSignal(key = 'p'): Signal<PivotEntry[]> {
  return storageSignal(historyAdapter(key), [] as PivotEntry[], { serialize: encodePivotStack, parse: decodePivotStack })
}

export function pushPivot(stack: Signal<PivotEntry[]>, entry: PivotEntry): void {
  stack.$([...stack.$(), entry])
}

export function popPivotsTo(stack: Signal<PivotEntry[]>, count: number): void {
  stack.$(stack.$().slice(0, count))
}
