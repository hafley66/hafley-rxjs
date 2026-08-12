import { createTimeViewport, eventRange, reduceTimeViewport } from "./0a_TimeViewport"
import type { MarbleEvent, MarblePhase } from "./0_types"
import { createMarbler } from "./1_model"
import { MarblerPanel } from "./2_Marbler"
import { createRoot } from "react-dom/client"
import { useState } from "react"
import { GitMergeDemo, ObservableKindsDemo } from "./2a_DemoViz"
import "./2_marbler.css"

const PHASES: MarblePhase["kind"][] = ["queue", "send", "wait", "receive", "work"]

function makeEvent(index: number): MarbleEvent {
  const start = index * 23 + (index % 7) * 11
  const duration = 18 + (index * 37) % 680
  const sendEnd = start + Math.min(20, duration * 0.12)
  const workEnd = start + Math.max(12, duration - 16)
  const type = ["request", "tool", "result", "note"][index % 4]
  const method = ["GET", "POST", "TOOL", "NOTE"][index % 4]
  return {
    id: `demo-${index}`,
    name: `${type} event ${index}`,
    method,
    status: index % 11 === 0 ? 202 : 200,
    type,
    initiator: `lane-${index % 5}`,
    size: `${1 + index % 97}.${index % 10} kB`,
    start,
    duration,
    from: `lane-${index % 5}`,
    to: `lane-${(index + 1 + index % 3) % 5}`,
    preview: `Deterministic demo event ${index} at ${start} ms`,
    phases: [
      { kind: PHASES[index % PHASES.length], start, end: sendEnd },
      { kind: PHASES[(index + 2) % PHASES.length], start: sendEnd, end: workEnd },
      { kind: "receive", start: workEnd, end: start + duration },
    ],
  }
}

const INITIAL_COUNT = 40
const model = createMarbler(Array.from({ length: INITIAL_COUNT }, (_, index) => makeEvent(index)))

function replaceEvents(events: MarbleEvent[]) {
  model.source.$(events)
  model.viewport.$(createTimeViewport(eventRange(events)))
  model.selectedId.$(events[0]?.id ?? null)
  model.hoveredId.$(null)
}

function append(count: number) {
  const current = model.source.$()
  const appended = Array.from({ length: count }, (_, index) => makeEvent(current.length + index))
  const events = [...current, ...appended]
  model.source.$(events)
  model.viewport.$(reduceTimeViewport(model.viewport.$(), { type: "full", range: eventRange(events) }))
}

function Demo() {
  const [tab, setTab] = useState<"network" | "git" | "observables">("network")
  return <>
    <div className="demo-controls">
      <button className={tab === "network" ? "active" : ""} onClick={() => setTab("network")}>network</button>
      <button className={tab === "git" ? "active" : ""} onClick={() => setTab("git")}>git merges</button>
      <button className={tab === "observables" ? "active" : ""} onClick={() => setTab("observables")}>observables</button>
      {tab === "network" && <><button onClick={() => append(100)}>append 100</button><button onClick={() => append(1000)}>append 1,000</button><button onClick={() => model.viewport.$(reduceTimeViewport(model.viewport.$(), { type: "fit" }))}>fit</button><button onClick={() => replaceEvents(Array.from({ length: INITIAL_COUNT }, (_, index) => makeEvent(index)))}>reset</button></>}
      <span>wheel zoom · trackpad pan · drag pan · double-click fit · hover marks</span>
    </div>
    {tab === "network" && <MarblerPanel model={model} />}
    {tab === "git" && <GitMergeDemo />}
    {tab === "observables" && <ObservableKindsDemo />}
  </>
}

createRoot(document.getElementById("root")!).render(<Demo />)
