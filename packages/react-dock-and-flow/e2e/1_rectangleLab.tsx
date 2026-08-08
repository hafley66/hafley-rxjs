import { createRoot } from "react-dom/client"
import { SignalReact } from "@hafley66/signals/react"
import "@xyflow/react/dist/style.css"
import { RectangleCanvas, createRectangleModel, type Rectangle } from "../src/index.js"
import "./1_rectangleLab.css"

const initial: Rectangle[] = [
  {
    id: "session",
    title: "Claude session and files",
    position: { x: 30, y: 70 },
    size: { width: 310, height: 210 },
    z: 1,
    content: { kind: "session", lines: ["> inspect reload planner", "src/3_engine.ts", "plans/reload.d2", "✓ 4 tests"] },
  },
  {
    id: "graph",
    title: "DL query graph, Cytoscape canvas",
    position: { x: 410, y: 35 },
    size: { width: 440, height: 300 },
    z: 2,
    content: { kind: "graph", nodes: ["source", "resolve", "compile", "swap", "run"], edges: [["source", "resolve"], ["resolve", "compile"], ["compile", "swap"], ["swap", "run"]] },
  },
]

const model = createRectangleModel(initial)

const Lab = SignalReact(function Lab() {
  return <main className="rectangle-lab">
    <nav>
      <button onClick={() => model.events.$({ type: "undo" })}>Undo</button>
      <button onClick={() => model.events.$({ type: "redo" })}>Redo</button>
      <output>{model.journal.$().cursor}/{model.journal.$().events.length} events</output>
    </nav>
    <RectangleCanvas model={model} />
  </main>
})

declare global { interface Window { __rectangleLab: typeof model } }
window.__rectangleLab = model
createRoot(document.getElementById("root")!).render(<Lab />)
