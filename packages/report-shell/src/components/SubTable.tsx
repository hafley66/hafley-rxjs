// Reusable master/detail sub-grid: any columns|rows pair renders through this one component and
// its `.subtable` CSS class. Long values go through Truncated instead of forcing the grid wider.
import type { CSSProperties, ReactNode } from 'react'
import { Truncated } from './Truncated'

const TRUNCATE_AT = 48

function cell(value: string | ReactNode, key: string) {
  if (typeof value !== 'string') return <div key={key} className="cell">{value}</div>
  const needsPopover = value.length > TRUNCATE_AT || value.includes('\n')
  return <div key={key} className="cell">{needsPopover ? <Truncated text={value} /> : value}</div>
}

export function SubTable({ columns, rows, depth = 0 }: { columns: string[]; rows: (string | ReactNode)[][]; depth?: number }) {
  const style = { '--depth': depth, '--subtable-cols': `repeat(${columns.length}, minmax(0, 1fr))` } as CSSProperties
  return (
    <div className="subtable" style={style}>
      {columns.map((column) => <div key={column} className="cell hdr">{column}</div>)}
      {rows.map((row, rowIndex) => row.map((value, columnIndex) => cell(value, `${rowIndex}-${columnIndex}`)))}
    </div>
  )
}
