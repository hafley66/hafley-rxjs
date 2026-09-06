// Breadcrumb + a stack of pivoted grids, newest at the bottom. Pivoting is grid.pivot(columnId,
// value) from @hafley66/grid; the domain owns when a push/pop happens (onPop).
import { useMemo, type FC, type ReactElement } from 'react'
import { SignalReact } from '@hafley66/signals/react'
import type { Signal as SignalType } from '@hafley66/signals'
import type { Grid } from '@hafley66/grid'
import { useGrid } from '@hafley66/grid/react'
import { Truncated } from './Truncated'
import type { NavRow, PivotEntry } from '../types'

export type { PivotEntry }

function PivotGrid<T extends NavRow>({ grid }: { grid: Grid<T> }) {
  const table = useGrid<T>(grid)
  const rows = table.getRowModel().rows
  return (
    <div className="pivot-grid" role="table">
      <div className="pivot-row pivot-header">
        <span>name</span><span>status</span><span>ms</span>
      </div>
      {rows.map((row) => (
        <div className="pivot-row" key={row.id}>
          <Truncated text={row.original.label} />
          <span className={`dot ${row.original.status}`} />
          <span>{Math.round(row.original.durationMs)}ms</span>
        </div>
      ))}
      {!rows.length && <div className="pivot-row pivot-empty">no rows</div>}
    </div>
  )
}

export type PivotStackProps<T extends NavRow> = {
  pivotStack: SignalType<PivotEntry[]>
  baseGrid: Grid<T>
  onPop: (count: number) => void
}

function PivotStackView<T extends NavRow>({ pivotStack, baseGrid, onPop }: PivotStackProps<T>) {
  const stack = pivotStack.$()
  const grids = useMemo(() => {
    let grid = baseGrid
    const chain: Grid<T>[] = []
    for (const entry of stack) {
      grid = grid.pivot(entry.columnId, entry.value)
      chain.push(grid)
    }
    return chain
  }, [baseGrid, stack])

  if (!stack.length) return null
  return (
    <div className="pivot-stack" data-testid="pivot-stack">
      <nav className="breadcrumb">
        <button type="button" onClick={() => onPop(0)}>all</button>
        {stack.map((entry, index) => (
          <button key={index} type="button" onClick={() => onPop(index + 1)}>
            {entry.label}
          </button>
        ))}
      </nav>
      {grids.map((grid, index) => <PivotGrid key={index} grid={grid} />)}
    </div>
  )
}

const WrappedPivotStack = SignalReact(PivotStackView as FC<PivotStackProps<NavRow>>)

export function PivotStack<T extends NavRow>(props: PivotStackProps<T>): ReactElement {
  return <WrappedPivotStack {...(props as unknown as PivotStackProps<NavRow>)} />
}
