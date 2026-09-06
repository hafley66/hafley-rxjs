import { useCallback } from 'react'
import type { RowData } from '@tanstack/react-table'
import type { Signal as SignalType } from '@hafley66/signals'
import type { Grid } from '@hafley66/grid'
import { useGridEffect } from '@hafley66/grid/react'
import type { PivotEntry } from '../types'
import { pushPivot } from '../lib/pivotStack'

// Binds a grid's pivot effect (alt-click on a column with pivotOnAltClick) to a pivot stack.
export function usePivotEffect<TData extends RowData>(grid: Grid<TData>, stack: SignalType<PivotEntry[]>): void {
  useGridEffect(
    grid,
    'pivot',
    useCallback(
      (effect: { column: string; value: unknown }) => {
        const value = String(effect.value)
        pushPivot(stack, { columnId: effect.column, value, label: `${effect.column}=${value}` })
      },
      [stack],
    ),
  )
}
