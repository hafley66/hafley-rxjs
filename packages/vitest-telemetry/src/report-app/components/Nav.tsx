// Left pane: @hafley66/grid's TreeTable over the process > file > test tree, replacing the
// hand-rolled NavGrid from @hafley66/report-shell (deprecated there; still used by boop-adapters).
import { useCallback, useMemo } from 'react'
import { z } from 'zod'
import { createGrid, createDefaultGridState, compactSingleChildChains, type Grid, type GridState } from '@hafley66/grid'
import { TreeTable, useGridEffect } from '@hafley66/grid/react'
import { Signal, useSignal, type Signal as SignalType } from '@hafley66/signals/react'
import { pushPivot, type Model, type NavNode } from '../model'
import type { Prefs } from '../prefs'
import { expandedPathTo } from '../lib/expandedForSelection'
import { NAV_COLUMNS } from './NavColumns'
import { NavStatusLegend } from './NavStatusLegend'

function lastOf<T>(items: T[]): T {
  return items.reduce((_, item) => item)
}

function combineChain(chain: NavNode[], children: NavNode[]): NavNode {
  const tail = lastOf(chain)
  return { ...tail, label: chain.map((node) => node.label).join(' › '), children }
}

function selectNode(model: Model, node: NavNode): void {
  if (node.kind === 'file' || node.kind === 'test') model.selected.$({ file: node.file ?? null, test: node.test ?? null })
}

function pivotOnStatus(model: Model, status: string): void {
  pushPivot(model, { columnId: 'status', value: status, label: `status=${status}` })
}

// Default-view expansion: only the failing test's branch open, everything else collapsed. Falls
// back to "open everything" (the historical default) once the hint's own load-time window passes.
function initialExpanded(model: Model): GridState['expanded'] {
  if (!model.defaultViewHint.$()) return true
  return expandedPathTo(model.nav.$(), model.selected.$()) ?? true
}

// Sorting is TanStack's (recursive over children, keyed by each column's sortValue).
function createNavGrid(model: Model, prefs: SignalType<Prefs>): Grid<NavNode> {
  const rows = Signal<NavNode[]>(() => {
    const raw = model.nav.$()
    return prefs.$().compactChains
      ? compactSingleChildChains(raw, { getSubRows: (node) => node.children, combine: combineChain })
      : raw
  })
  return createGrid<NavNode>({
    schema: z.custom<NavNode>(),
    rows,
    getRowId: (node) => node.id,
    getSubRows: (node) => node.children,
    getRowCanExpand: (node) => (node.children?.length ?? 0) > 0,
    mode: 'client',
    state: Signal<GridState>(createDefaultGridState({ expanded: initialExpanded(model) })),
  })
}

function rowClassName(node: NavNode): string {
  return [node.kind, `status-${node.status}`, node.selected ? 'selected' : ''].filter(Boolean).join(' ')
}

export function Nav({ model, prefs }: { model: Model; prefs: SignalType<Prefs> }) {
  const density = useSignal(prefs.$).density
  const grid = useMemo(() => createNavGrid(model, prefs), [model, prefs])
  useGridEffect(grid, 'pivot', useCallback((effect: { value: unknown }) => pivotOnStatus(model, String(effect.value)), [model]))

  return (
    <div className="nav-tree-wrap">
      <NavStatusLegend />
      <TreeTable
        grid={grid}
        columns={NAV_COLUMNS}
        density={density}
        indentGuides
        rowClassName={rowClassName}
        onRowClick={(node) => selectNode(model, node)}
      />
    </div>
  )
}
