// The `heavyCell` of `0_bench.ts` as JSX, element for element and class for class, so "heavy"
// means the same weight whether the writer is the grid, React, or MUI X.
import type { ReactElement } from "react"
import { SPARK, type BenchRow } from "./0_bench.js"

export interface HeavyProps {
  readonly row: BenchRow
  readonly col: string
}

export function Heavy({ row, col }: HeavyProps): ReactElement {
  if (col === "spark") {
    return (
      <span className="b-stack">
        <svg viewBox={`0 0 ${SPARK * 4} 16`} width={SPARK * 4} height={16}>
          {row.spark.map((value, i) => (
            <rect key={i} x={i * 4} y={16 - value * 16} width={3} height={value * 16} />
          ))}
        </svg>
      </span>
    )
  }
  if (col === "pct") {
    const pct = Math.round(row.pct * 100)
    return (
      <span className="b-stack">
        <span className="b-meter">
          <span className="b-fill" style={{ inlineSize: `${pct}%` }} />
        </span>
        <span className="b-num">{`${pct}%`}</span>
      </span>
    )
  }
  return (
    <span className="b-stack">
      <span className="b-dot" />
      <span className="b-label">{String(col === "name" ? row.name : row.size)}</span>
      <span className="b-badge">{row.at % 3 === 0 ? "new" : "ok"}</span>
    </span>
  )
}
