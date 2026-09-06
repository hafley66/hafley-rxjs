import { pivotOnAltClick, type TreeColumn } from "@hafley66/grid/react"
import { formatAge } from "../../lib/time.js"
import { formatTokens, lastPathSegment } from "../../lib/format.js"
import { statusDefinition } from "../../lib/status.js"
import { OLDER_FOLD_ID, type NetworkNavRow } from "../nav.js"

function NameCell({ row }: { row: NetworkNavRow }) {
  if (row.id === OLDER_FOLD_ID) return <span className="name-fold">{row.name}</span>
  return (
    <span className="name-cell">
      <span className="name-primary">{row.name}</span>
      <span className="name-secondary">
        {row.harness} · {lastPathSegment(row.cwd)}
      </span>
    </span>
  )
}

function StatusCell({ row }: { row: NetworkNavRow }) {
  if (row.id === OLDER_FOLD_ID) return null
  return (
    <span className="status-cell">
      <span className={`dot ${row.status}`} title={statusDefinition(row.status)} />
      {row.status}
    </span>
  )
}

export const SESSION_COLUMNS: TreeColumn<NetworkNavRow>[] = [
  { id: "name", header: "session", tree: true, toggleExpand: true, cell: (row) => <NameCell row={row} />, sortValue: (row) => row.name },
  {
    id: "status",
    header: "status",
    cell: (row) => <StatusCell row={row} />,
    sortValue: (row) => row.status,
    epic: pivotOnAltClick((row) => row.status),
  },
  {
    id: "age",
    header: "age",
    cell: (row) => (row.id === OLDER_FOLD_ID ? "" : formatAge(row.age, Date.now())),
    sortValue: (row) => row.age,
  },
  { id: "waitingOn", header: "waiting on", cell: (row) => row.waitingOn ?? "", sortValue: (row) => row.waitingOn ?? "" },
  { id: "turns", header: "turns", cell: (row) => (row.id === OLDER_FOLD_ID ? "" : String(row.turns)), sortValue: (row) => row.turns },
  {
    id: "tokens",
    header: "tokens",
    cell: (row) => (row.id === OLDER_FOLD_ID ? "" : formatTokens(row.tokens)),
    sortValue: (row) => row.tokens,
  },
]
