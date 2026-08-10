import { find } from "lodash"
import { useState } from "react"
import { ___rxjs_hmr_key___ } from "~/0_runtime_hmr/4_module-scope"
import { use$ } from "~/lib/1_use"
import { main } from "../0_runtime/0_store"
import { getAllSends, getRootObservables, getTopLevelSubscriptions } from "../0_runtime/06_queries"
import { MarbleDiagram } from "./1_MarbleDiagram"

export function DebuggerGrid() {
  use$(main.state$, main.state$.initialValue)
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null)

  if (selectedSubId) {
    return <MarbleDiagram subId={selectedSubId} onBack={() => setSelectedSubId(null)} />
  }

  const store = main.state$.value.store
  const roots = getRootObservables(store)
  const subs = getTopLevelSubscriptions(store)
  console.log({ store, subs })
  const subIds = subs.map(s => s.id)

  // Get all sends sorted chronologically
  const allSends = getAllSends(store)

  const colCount = 1 + subs.length // structure + subs

  return (
    <pre>
      <code>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            display: "grid",
            gridTemplateColumns: `auto repeat(${subs.length}, minmax(100px, 1fr))`,
            gap: 0,
          }}
        >
          {/* Header row */}
          <div style={{ padding: 4, borderBottom: "1px solid #ccc", fontWeight: "bold" }}>Structure</div>
          {subs.map(s => (
            <button
              key={s.id}
              type="button"
              style={{
                padding: 4,
                fontWeight: "bold",
                textAlign: "center",
                cursor: "pointer",
                background: "none",
                border: "none",
                borderBottom: "1px solid #ccc",
                font: "inherit",
              }}
              onClick={() => setSelectedSubId(s.id)}
              title="Click to view marble diagram"
            >
              Sub #{s.id}
            </button>
          ))}

          {/* Structure rows */}
          {roots.map(obs => (
            <RootRows key={obs.id} obsId={obs.id} subIds={subIds} />
          ))}

          {/* Sends section divider - spans all columns */}
          <div
            style={{
              gridColumn: `1 / ${colCount + 1}`,
              borderTop: "2px solid #666",
              paddingTop: 8,
              marginTop: 8,
              fontWeight: "bold",
            }}
          >
            Sends
          </div>

          {/* Sends rows - one row per send event, chronological */}
          {allSends.map(send => (
            <SendRow key={send.id} send={send} subIds={subIds} />
          ))}
        </div>
      </code>
    </pre>
  )
}

function SendRow({ send, subIds }: { send: ReturnType<typeof getAllSends>[number]; subIds: string[] }) {
  return (
    <>
      {/* Empty first column (aligns with structure) */}
      <div style={{ padding: 4 }} />
      {/* One cell per subscription column - only the matching one has content */}
      {subIds.map(subId => {
        if (send.subscription_id !== subId) return <div key={subId} style={{ padding: 4 }} />
        return (
          <div key={subId} style={{ padding: 4, textAlign: "center" }}>
            <span style={{ color: send.type === "error" ? "red" : send.type === "complete" ? "blue" : "green" }}>
              {send.type}
            </span>
            {send.type === "next" && <span style={{ color: "#666" }}>: {JSON.stringify(send.value)}</span>}
          </div>
        )
      })}
    </>
  )
}

function RootRows({ obsId, subIds }: { obsId: string; subIds: string[] }) {
  const store = main.state$.value.store
  const obs = store.observable[obsId]
  if (!obs) return null

  // Find pipes for this observable
  const pipes = Object.values(store.pipe).filter(p => p.parent_observable_id === obsId)
  const pipeIds = pipes.map(it => it.observable_id)
  const track = find(store.hmr_track, it => pipeIds.includes(it.mutable_observable_id))
  const it = track?.key?.split(":")[0]
  return (
    <>
      {/* Observable row */}
      <div style={{ padding: 4 }}>
        {it ? `const ${it} =` : ""} {String((obs as Record<PropertyKey, unknown>)[___rxjs_hmr_key___] ?? obs.name ?? "Observable")} #{obs.id}
      </div>
      {subIds.map(subId => (
        <SubCell key={subId} obsId={obsId} subId={subId} />
      ))}

      {/* Pipe rows */}
      {pipes.map(pipe => (
        <PipeRows key={pipe.id} pipeId={pipe.id} subIds={subIds} depth={1} />
      ))}
    </>
  )
}

function PipeRows({ pipeId, subIds, depth }: { pipeId: string; subIds: string[]; depth: number }) {
  const store = main.state$.value.store
  const pipe = store.pipe[pipeId]
  if (!pipe) return null

  const operators = Object.values(store.operator)
    .filter(op => op.pipe_id === pipeId)
    .sort((a, b) => a.index - b.index)

  const indent = "  ".repeat(depth)

  return (
    <>
      {/* .pipe( opening */}
      <div style={{ padding: 4, color: "#666" }}>{indent}.pipe(</div>
      {subIds.map(subId => (
        <div key={subId} />
      ))}

      {/* Operator rows */}
      {operators.map(op => (
        <OperatorRow key={op.id} opId={op.id} subIds={subIds} depth={depth + 1} />
      ))}

      {/* ) closing */}
      <div style={{ padding: 4, color: "#666" }}>
        {indent}) → #{pipe.observable_id}
      </div>
      {subIds.map(subId => (
        <div key={subId} />
      ))}
    </>
  )
}

function OperatorRow({ opId, subIds, depth }: { opId: string; subIds: string[]; depth: number }) {
  const store = main.state$.value.store
  const op = store.operator[opId]
  if (!op) return null

  const opFun = store.operator_fun[op.operator_fun_id]
  const indent = "  ".repeat(depth)

  return (
    <>
      <div style={{ padding: 4 }}>
        {indent}
        {opFun?.name ?? "op"}() → #{op.target_observable_id}
      </div>
      {subIds.map(subId => (
        <SubCell key={subId} obsId={op.target_observable_id} subId={subId} />
      ))}
    </>
  )
}

function SubCell({ obsId, subId }: { obsId: string; subId: string }) {
  const store = main.state$.value.store

  // Check if this subscription is for this observable or a descendant
  const sub = store.subscription[subId]
  if (!sub) return <div />

  // Walk up from sub to see if it touches this observable
  const touchesObs =
    sub.observable_id === obsId ||
    Object.values(store.subscription).some(s => s.parent_subscription_id === subId && s.observable_id === obsId)

  // Count sends for this obs+sub combo
  const sendCount = Object.values(store.send).filter(
    s => s.observable_id === obsId && s.subscription_id === subId,
  ).length

  return (
    <div style={{ padding: 4, textAlign: "center" }}>
      {touchesObs && <span style={{ color: "green" }}>●</span>}
      {sendCount > 0 && <span style={{ marginLeft: 4, color: "#999" }}>{sendCount}</span>}
    </div>
  )
}
