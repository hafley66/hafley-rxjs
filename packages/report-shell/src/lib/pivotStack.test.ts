import { describe, expect, it } from 'vitest'
import { Signal } from '@hafley66/signals'
import type { PivotEntry } from '../types'
import { decodePivotStack, encodePivotStack, popPivotsTo, pushPivot } from './pivotStack'

const entry = (value: string): PivotEntry => ({ columnId: 'status', value, label: `status=${value}` })

describe('pivotStack', () => {
  it('round-trips through the history param and treats junk as empty', () => {
    const stack = [entry('fail'), entry('pass')]
    expect(decodePivotStack(encodePivotStack(stack))).toEqual(stack)
    expect(encodePivotStack([])).toBe('')
    expect(decodePivotStack('')).toEqual([])
    expect(decodePivotStack('{nope')).toEqual([])
  })

  it('push appends, popTo truncates', () => {
    const stack = Signal<PivotEntry[]>([])
    pushPivot(stack, entry('fail'))
    pushPivot(stack, entry('pass'))
    expect(stack.$().map((e) => e.value)).toEqual(['fail', 'pass'])
    popPivotsTo(stack, 1)
    expect(stack.$().map((e) => e.value)).toEqual(['fail'])
  })
})
