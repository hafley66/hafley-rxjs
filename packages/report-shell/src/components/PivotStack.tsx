// Breadcrumb + a stack of pivoted grids, newest at the bottom. Pivoting is grid.pivot(columnId,
// value) from @hafley66/grid; the domain owns when a push/pop happens (onPop). Every panel is the
// same TreeTable the nav uses, so sorting, column resize, and visibility come from the grid.
import { useEffect, useMemo, useRef, type FC, type ReactElement } from 'react'
import { SignalReact } from '@hafley66/signals/react'
import type { Signal as SignalType } from '@hafley66/signals'
import type { Grid } from '@hafley66/grid'
import { TreeTable, type TreeColumn, type TreeTableDensity } from '@hafley66/grid/react'
import { formatDuration } from '../lib/time'
import { gutter } from '../layout'
import type { NavRow, PivotEntry } from '../types'

export type { PivotEntry }

// Default panel columns over NavRow: name, status dot, duration. A domain passes `columns` to
// replace them; build the base grid with treeColumnDefs(pivotColumns()) so pivots share accessors.
export function pivotColumns<T extends NavRow>(): TreeColumn<T>[] {
  return [
    { id: 'label', header: 'name', cell: r => r.label, sortValue: r => r.label.toLowerCase() },
    {
      id: 'status',
      header: 'status',
      size: 72,
      value: r => r.status,
      cell: r => <span data-testid="status-cell" className={`status dot ${r.status}`} title={r.status} />,
    },
    {
      id: 'durationMs',
      header: 'ms',
      size: 80,
      value: r => r.durationMs,
      cell: r => (r.durationMs ? formatDuration(r.durationMs) : ''),
      cellClass: () => 'fs-num',
    },
  ]
}

export type PivotStackProps<T extends NavRow> = {
  pivotStack: SignalType<PivotEntry[]>
  baseGrid: Grid<T>
  onPop: (count: number) => void
  columns?: TreeColumn<T>[]
  density?: TreeTableDensity
  // Panel height in px; a track signal adds a drag gutter under the stack.
  heightTrack?: SignalType<number>
}

function PivotStackView<T extends NavRow>({ pivotStack, baseGrid, onPop, columns, density = 'compact', heightTrack }: PivotStackProps<T>) {
  const stack = pivotStack.$()
  const maxHeight = heightTrack?.$() ?? 320
  const gutterRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!gutterRef.current || !heightTrack) return
    return gutter(gutterRef.current, heightTrack, { axis: 'y' })
  }, [heightTrack, stack.length])
  const grids = useMemo(() => {
    let grid = baseGrid
    const chain: Grid<T>[] = []
    for (const entry of stack) {
      grid = grid.pivot(entry.columnId, entry.value)
      chain.push(grid)
    }
    return chain
  }, [baseGrid, stack])
  const cols = useMemo(() => columns ?? pivotColumns<T>(), [columns])

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
        <button type="button" className="pivot-close" title="close pivots" data-testid="pivot-close" onClick={() => onPop(0)}>
          ×
        </button>
      </nav>
      {grids.map((grid, index) => {
        // the pivoted column is gone from this grid; keep the panel's columns in step
        const present = new Set(grid.columns.map(c => c.id))
        return (
          <div className="pivot-panel" data-testid="pivot-panel" key={index}>
            <TreeTable grid={grid} columns={cols.filter(c => present.has(c.id))} density={density} scrollMode="internal" maxHeight={maxHeight} />
          </div>
        )
      })}
      {heightTrack && <div ref={gutterRef} className="gutter gutter-y" data-testid="pivot-gutter" title="drag to resize the pivot panels" />}
    </div>
  )
}

const WrappedPivotStack = SignalReact(PivotStackView as FC<PivotStackProps<NavRow>>)

export function PivotStack<T extends NavRow>(props: PivotStackProps<T>): ReactElement {
  return <WrappedPivotStack {...(props as unknown as PivotStackProps<NavRow>)} />
}
