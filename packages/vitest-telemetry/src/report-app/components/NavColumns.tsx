// Column defs + cell renderers for Nav's TreeTable: name, status, duration, events. Widths are
// exported so NavStatusLegend can overlay the status header precisely.
import type { ReactNode } from 'react'
import { pivotOnAltClick, type TreeColumn } from '@hafley66/grid/react'
import { formatDuration } from '@hafley66/report-shell'
import type { NavNode } from '../model'

export const STATUS_COLUMN_WIDTH = 96
export const DURATION_COLUMN_WIDTH = 88
export const EVENTS_COLUMN_WIDTH = 60

const STATUS_TITLE: Record<string, string> = {
  pass: 'pass, green dot: the test passed',
  fail: 'fail, red dot: the test failed',
  skip: 'skip, amber dot: the test was skipped',
  none: 'none, gray dot: no verdict recorded yet',
}

// process: pid + span count. file: its vitest project. test: nothing (the name is enough).
function secondaryOf(node: NavNode): string {
  if (node.kind === 'process') return node.pid != null ? `pid ${node.pid} · ${node.events} spans` : ''
  if (node.kind === 'file') return node.project ?? ''
  return ''
}

function NameCell({ node }: { node: NavNode }): ReactNode {
  const secondary = secondaryOf(node)
  return (
    <span className="nav-name-cell">
      <span className="nav-name-primary">{node.label}</span>
      {secondary ? <span className="nav-name-secondary">{secondary}</span> : null}
    </span>
  )
}

function StatusCell({ node }: { node: NavNode }): ReactNode {
  return <span data-testid="status-cell" className={`status dot ${node.status}`} title={STATUS_TITLE[node.status] ?? STATUS_TITLE.none} />
}

// Sort order for the status column: failures first.
const STATUS_RANK: Record<string, number> = { fail: 0, skip: 1, none: 2, pass: 3 }

export const NAV_COLUMNS: TreeColumn<NavNode>[] = [
    { id: 'name', header: 'name', tree: true, cell: (node) => <NameCell node={node} /> },
    {
      id: 'status',
      header: 'status',
      size: STATUS_COLUMN_WIDTH,
      value: (node) => node.status ?? 'none',
      sortValue: (node) => STATUS_RANK[node.status] ?? STATUS_RANK.none,
      cell: (node) => <StatusCell node={node} />,
      epic: pivotOnAltClick(),
    },
    {
      id: 'duration',
      header: 'duration',
      size: DURATION_COLUMN_WIDTH,
      value: (node) => node.durationMs,
      cell: (node) => (node.durationMs ? formatDuration(node.durationMs) : ''),
    },
    {
      id: 'events',
      header: 'events',
      size: EVENTS_COLUMN_WIDTH,
      value: (node) => node.events,
      cell: (node) => node.events || '',
    },
]
