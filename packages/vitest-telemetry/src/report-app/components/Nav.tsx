// Left pane: @hafley66/grid's TreeTable over the process > file > test tree, replacing the
// hand-rolled NavGrid that @hafley66/report-shell used to ship (deleted in the ui kit unification).
import { useMemo } from 'react'
import { z } from 'zod'
import { createGrid, createDefaultGridState, compactSingleChildChains, type Grid, type GridState } from '@hafley66/grid'
import { TreeTable, treeColumnDefs } from '@hafley66/grid/react'
import { Signal, useSignal, type Signal as SignalType } from '@hafley66/signals/react'
import { usePivotEffect } from '@hafley66/report-shell'
import { selectNode, type Model, type NavNode } from '../model'
import type { Prefs } from '../prefs'
import { expandedPathTo } from '../lib/expandedForSelection'
import { NAV_COLUMNS } from './NavColumns'
import { NavStatusLegend } from './NavStatusLegend'

function combineChain(chain: NavNode[], children: NavNode[]): NavNode {
  return { ...chain[chain.length - 1]!, label: chain.map((node) => node.label).join(' › '), children }
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
    columnDefs: treeColumnDefs(NAV_COLUMNS),
    state: Signal<GridState>(createDefaultGridState({ expanded: initialExpanded(model) })),
  })
}

function rowClassName(node: NavNode): string {
  return [node.kind, `status-${node.status}`, node.selected ? 'selected' : ''].filter(Boolean).join(' ')
}

export function Nav({ model, prefs }: { model: Model; prefs: SignalType<Prefs> }) {
  const density = useSignal(prefs.$).density
  const grid = useMemo(() => createNavGrid(model, prefs), [model, prefs])
  usePivotEffect(grid, model.pivotStack)

  return (
    <div className="nav-tree-wrap">
      <NavStatusLegend grid={grid} />
      <TreeTable
        grid={grid}
        density={density}
        indentGuides
        rowClassName={rowClassName}
        onRowClick={(node) => selectNode(model, node)}
      />
    </div>
  )
}
