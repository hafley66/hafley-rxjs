// Tree grid built on @hafley66/grid's getSubRows tree. Hover tiers (README's "Hover tiers"):
// `ancestor` outlines a hovered row's parent chain, `hovered` adds a brighter background too.
import type { CSSProperties, FC, ReactElement } from 'react'
import { SignalReact } from '@hafley66/signals/react'
import type { Signal as SignalType } from '@hafley66/signals'
import type { Grid } from '@hafley66/grid'
import { useGrid } from '@hafley66/grid/react'
import { Truncated } from './Truncated'
import { formatDuration } from '../lib/time'
import type { NavRow } from '../types'

function ancestorIdsOf(rowId: string, rowsById: Record<string, { id: string; parentId?: string }>): Set<string> {
  const ids = new Set<string>()
  let current = rowsById[rowId]?.parentId
  while (current) {
    ids.add(current)
    current = rowsById[current]?.parentId
  }
  return ids
}

function dataAttrs(attrs?: Record<string, string>): Record<string, string> {
  if (!attrs) return {}
  return Object.fromEntries(Object.entries(attrs).map(([key, value]) => [`data-${key}`, value]))
}

function columnClass(columnId: string): string {
  if (columnId === 'label') return 'name'
  if (columnId === 'status') return 'status'
  if (columnId === 'durationMs') return 'ms'
  return 'count'
}

// @deprecated: vitest-telemetry moved onto @hafley66/grid's TreeTable directly; kept working for boop-adapters.
export type NavGridProps<T extends NavRow> = {
  grid: Grid<T>
  hoveredId: SignalType<string | null>
  onSelect: (row: T) => void
  onPivot: (row: T) => void
  /** @deprecated accepted for compatibility; no longer changes any row's color */
  sameScope?: (hovered: T, row: T) => boolean
  rowClassName?: (row: T) => string
  rowDataAttrs?: (row: T) => Record<string, string>
  emptyLabel?: string
}

function NavGridView<T extends NavRow>({ grid, hoveredId, onSelect, onPivot, rowClassName, rowDataAttrs, emptyLabel = 'no rows' }: NavGridProps<T>) {
  const table = useGrid<T>(grid)
  const rows = table.getRowModel().rows
  const hovered = hoveredId.$()
  const rowsById = table.getRowModel().rowsById as unknown as Record<string, { id: string; parentId?: string }>
  const ancestorIds = hovered ? ancestorIdsOf(hovered, rowsById) : null

  return (
    <div className="nav-grid" role="tree">
      <div className="nav-row nav-header" role="row">
        <span className="disclosure" />
        {table.getAllLeafColumns().map((column) => (
          <span key={column.id} className={columnClass(column.id)}>
            {String(column.columnDef.header ?? '')}
          </span>
        ))}
      </div>
      {rows.map((row) => {
        const node = row.original
        const isSelected = Boolean(node.selected)
        const isHovered = node.id === hovered
        const isAncestor = ancestorIds?.has(row.id) ?? false
        const classes = [
          'nav-row',
          rowClassName?.(node) ?? '',
          `status-${node.status}`,
          isSelected ? 'selected' : '',
          isHovered ? 'hovered' : '',
          isAncestor ? 'ancestor' : '',
        ].filter(Boolean).join(' ')
        return (
          <div
            key={row.id}
            className={classes}
            style={{ '--depth': row.depth } as CSSProperties}
            {...dataAttrs(rowDataAttrs?.(node))}
            onMouseEnter={() => hoveredId.$(node.id)}
            onMouseLeave={() => hoveredId.$(null)}
            onClick={(event) => {
              if (event.altKey) {
                onPivot(node)
                return
              }
              if (row.getCanExpand()) row.getToggleExpandedHandler()()
              onSelect(node)
            }}
          >
            {row.getCanExpand() ? <span className="disclosure">{row.getIsExpanded() ? '▾' : '▸'}</span> : <span className="disclosure" />}
            <Truncated className="name" text={node.label} />
            <span className={`status dot ${node.status}`} title="alt-click to pivot on status" />
            <span className="ms">{node.durationMs ? formatDuration(node.durationMs) : ''}</span>
            <span className="count">{node.events || ''}</span>
          </div>
        )
      })}
      {!rows.length && <div className="nav-row leaf">{emptyLabel}</div>}
    </div>
  )
}

const WrappedNavGrid = SignalReact(NavGridView as FC<NavGridProps<NavRow>>)

export function NavGrid<T extends NavRow>(props: NavGridProps<T>): ReactElement {
  return <WrappedNavGrid {...(props as unknown as NavGridProps<NavRow>)} />
}
