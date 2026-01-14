import { state$ } from "../00.types"
import { decycle } from "../01_helpers"
import { flattenSubTree, getArgCallForObs, getSubTree, getTimeRange, type FlatSubRow } from "../06_queries"

type Props = {
  subId: string
  onBack: () => void
}

export function MarbleDiagram({ subId, onBack }: Props) {
  state$.use$()

  const store = state$.value.store
  const tree = getSubTree(store, subId)
  if (!tree) return <div>Subscription not found</div>

  const rows = flattenSubTree(tree)
  const timeRange = getTimeRange(rows)
  const width = timeRange.max - timeRange.min || 1

  return (
    <pre>
      <code>
        <div style={{ fontFamily: "monospace", fontSize: 12 }}>
          <button onClick={onBack} style={{ marginBottom: 8, cursor: "pointer" }}>
            ← Back to Overview
          </button>

          <div style={{ marginBottom: 8, fontWeight: "bold" }}>Sub #{subId} Tree</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {rows.map(row => (
              <MarbleLane key={row.sub.id} row={row} timeRange={timeRange} width={width} />
            ))}
          </div>

          <TimeAxis timeRange={timeRange} />

          <Legend />
        </div>
      </code>
    </pre>
  )
}

function MarbleLane({
  row,
  timeRange,
  width,
}: {
  row: FlatSubRow
  timeRange: { min: number; max: number }
  width: number
}) {
  const store = state$.value.store
  const { sub, depth, sends } = row
  const obs = store.observable[sub.observable_id]

  // Check if this observable came from an arg_call (dynamic observable)
  const argCall = getArgCallForObs(store, sub.observable_id)
  const arg = argCall ? store.arg[argCall.arg_id] : null
  const isDynamic = !!argCall

  // Find what operator this belongs to (for better naming)
  const operator = Object.values(store.operator).find(op => op.target_observable_id === sub.observable_id)
  const operatorFun = operator ? store.operator_fun[operator.operator_fun_id] : null

  // Determine name: operator name > observable name > "obs"
  const name = operatorFun?.name ?? obs?.name ?? "obs"

  // Determine state: unsubscribed, completed, or active
  const isUnsubscribed = !!sub.unsubscribed_at
  const isCompleted = sends.some(s => s.type === "complete")
  const hasError = sends.some(s => s.type === "error")

  const startPct = ((sub.created_at - timeRange.min) / width) * 100
  const endTime = sub.unsubscribed_at ?? sub.created_at_end ?? timeRange.max
  const widthPct = ((endTime - sub.created_at) / width) * 100

  // Line color based on state
  const lineColor = hasError ? "#ff6b6b" : isUnsubscribed ? "#ffa94d" : isCompleted ? "#868e96" : "#339af0"
  const labelOpacity = isCompleted || isUnsubscribed ? 0.5 : 1

  // Dynamic observable indicator
  const dynamicIndicator = isDynamic ? (
    <span style={{ color: "#be4bdb", fontSize: 10, marginLeft: 4 }} title={`from ${arg?.path ?? "arg"}`}>
      $
    </span>
  ) : null

  return (
    <div style={{ display: "flex", alignItems: "center", height: 24 }}>
      {/* Tree indentation + label */}
      <div
        style={{
          paddingLeft: depth * 16,
          width: 180,
          flexShrink: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          opacity: labelOpacity,
        }}
      >
        {"└─".repeat(depth ? 1 : 0)}#{sub.id} ({name}){dynamicIndicator}
      </div>

      {/* Marble timeline */}
      <div style={{ position: "relative", flex: 1, height: 24 }}>
        {/* Subscription lifespan line */}
        <div
          style={{
            position: "absolute",
            left: `${startPct}%`,
            width: `${widthPct}%`,
            height: 2,
            background: lineColor,
            top: 11,
            opacity: isCompleted || isUnsubscribed ? 0.5 : 1,
          }}
        />

        {/* Unsubscribe marker (different from complete) */}
        {isUnsubscribed && (
          <div
            style={{
              position: "absolute",
              left: `${((sub.unsubscribed_at! - timeRange.min) / width) * 100}%`,
              transform: "translateX(-50%)",
              top: 4,
              color: "#ffa94d",
              fontWeight: "bold",
            }}
            title={`Unsubscribed at ${sub.unsubscribed_at}ms`}
          >
            ⊗
          </div>
        )}

        {/* Marble events */}
        {sends.map(send => {
          const leftPct = ((send.created_at - timeRange.min) / width) * 100
          return <Marble key={send.id} send={send} leftPct={leftPct} />
        })}
      </div>
    </div>
  )
}

function Marble({
  send,
  leftPct,
}: {
  send: { id: string; type: string; value?: any; created_at: number }
  leftPct: number
}) {
  const color = send.type === "error" ? "#ff6b6b" : send.type === "complete" ? "#868e96" : "#51cf66"
  const symbol = send.type === "complete" ? "|" : send.type === "error" ? "✗" : "●"
  const title = send.type === "next" ? JSON.stringify(decycle(send.value)) : send.type

  return (
    <div
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        transform: "translateX(-50%)",
        top: 4,
        cursor: "pointer",
      }}
      title={title}
    >
      <span style={{ color }}>{symbol}</span>
    </div>
  )
}

function Legend() {
  return (
    <div style={{ marginTop: 16, display: "flex", gap: 16, fontSize: 10, color: "#666" }}>
      <span>
        <span style={{ color: "#51cf66" }}>●</span> next
      </span>
      <span>
        <span style={{ color: "#868e96" }}>|</span> complete
      </span>
      <span>
        <span style={{ color: "#ff6b6b" }}>✗</span> error
      </span>
      <span>
        <span style={{ color: "#ffa94d" }}>⊗</span> unsubscribed
      </span>
      <span>
        <span style={{ color: "#be4bdb" }}>$</span> dynamic observable
      </span>
    </div>
  )
}

function TimeAxis({ timeRange }: { timeRange: { min: number; max: number } }) {
  const width = timeRange.max - timeRange.min
  if (width === 0) return null

  // Generate tick marks (roughly 5 ticks)
  const step = Math.ceil(width / 5 / 100) * 100 || 1
  const ticks: number[] = []
  for (let t = Math.ceil(timeRange.min / step) * step; t <= timeRange.max; t += step) {
    ticks.push(t)
  }

  return (
    <div style={{ display: "flex", marginTop: 8, marginLeft: 150, position: "relative", height: 20 }}>
      {ticks.map(t => {
        const leftPct = ((t - timeRange.min) / width) * 100
        return (
          <div
            key={t}
            style={{
              position: "absolute",
              left: `${leftPct}%`,
              transform: "translateX(-50%)",
              fontSize: 10,
              color: "#999",
            }}
          >
            {t}ms
          </div>
        )
      })}
    </div>
  )
}
