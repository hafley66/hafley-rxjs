import { SignalReact } from "@hafley66/signals/react"
import { Dom } from "@hafley/rxjs-ext"
import { createRoot } from "react-dom/client"
import { filter, map, merge } from "rxjs"
import "dockview/dist/styles/dockview.css"
import "@xyflow/react/dist/style.css"
import { DockAndFlow, createDockAndFlowModel, type DockFlowEvent, type DockFlowNode } from "../src/index.js"
import "./0_perfLab.css"

const countButton = Dom("/perf/node-count/:count")
const panelInput = Dom("/perf/panel/:id/input")
const domEvents = merge(
  countButton.$.click.pipe(map(({ params }) => ({ type: "node-count-selected", count: Number(params.count) }) as DockFlowEvent)),
  panelInput.$.input.pipe(
    filter(({ delegateElement }) => delegateElement instanceof HTMLInputElement),
    map(({ params, delegateElement }) => ({
      type: "panel-value-changed",
      panelId: params.id,
      value: (delegateElement as HTMLInputElement).value,
    }) as DockFlowEvent),
  ),
)

const model = createDockAndFlowModel(100, [domEvents])

const PerfNode = SignalReact(function PerfNode({ id, data }: { id: string; data: DockFlowNode["data"] }) {
  const value = model.state.$().values[id] ?? `state-${id}`
  return <article className="perf-node" data-testid="live-panel"><header>{data.title}</header>
    <input id={panelInput.id({ id })} aria-label={`${data.title} input`} defaultValue={value} />
  </article>
})

function Details() {
  return <section className="perf-details" data-testid="details-panel">Package-owned Dockview and React Flow performance harness</section>
}

function PerfLab() {
  return <main className="perf-lab">
    <nav className="perf-toolbar">{[20, 100, 500].map((count) =>
      <button id={countButton.id({ count })} key={count}>{count} nodes</button>)}</nav>
    <DockAndFlow model={model} node={PerfNode} details={Details} />
  </main>
}

declare global { interface Window { __dockFlowPerf: typeof model } }
window.__dockFlowPerf = model
window.addEventListener("pagehide", model.dispose, { once: true })
createRoot(document.getElementById("root")!).render(<PerfLab />)

