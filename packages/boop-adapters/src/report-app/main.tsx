// Parses the embedded export blob, creates the model + prefs, mounts the React root. No
// module-level `let` state: everything lives on `model` or `prefs`.
import "@hafley66/report-shell/style.css"
import "@hafley66/report-shell/marbler.css"
import "./style.css"
import { createRoot } from "react-dom/client"
import type { AgentNetworkExport } from "../0_types.js"
import { createModel, createPrefs } from "./model"
import { App } from "./components/App"

type ReportData = AgentNetworkExport & { generated: string }

function readData(): ReportData {
  const script = document.getElementById("data")
  return JSON.parse(script?.textContent ?? '{"generated":"","rows":[],"frames":[]}') as ReportData
}

function metaLine(data: ReportData): string {
  const open = data.rows.filter((row) => row.closedTs === null).length
  return `${data.generated.slice(0, 19).replace("T", " ")} · ${data.rows.length} sessions · ${open} open · ${data.frames.length} frames`
}

function main(): void {
  const data = readData()
  const prefs = createPrefs()
  const model = createModel({ rows: data.rows, frames: data.frames }, prefs)

  const root = document.getElementById("root")
  if (!root) throw new Error("missing #root")
  createRoot(root).render(<App model={model} prefs={prefs} meta={metaLine(data)} />)
}

main()
