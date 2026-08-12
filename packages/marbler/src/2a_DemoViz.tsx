import { useMemo, useState } from "react"
import { createTimeViewport, reduceTimeViewport, type TimelineMark, type TimeViewport } from "./0a_TimeViewport"
import { TimeNavigatorPixi } from "./1b_TimeNavigatorPixi"

type DemoEntry = {
  id: string
  label: string
  time: number
  value: string
  kind: "next" | "complete" | "error" | "commit" | "merge"
}

type DemoLane = {
  id: string
  label: string
  entries: DemoEntry[]
}

function EventTree({ lanes, hoveredId, onHover }: { lanes: DemoLane[]; hoveredId: string | null; onHover(id: string | null): void }) {
  return <div className="demo-event-tree">
    <div className="demo-tree-head"><span>lane / event</span><span>kind</span><span>time</span><span>value</span></div>
    {lanes.map((lane) => <details key={lane.id} open>
      <summary><span>{lane.label}</span><span>{lane.entries.length} events</span></summary>
      <div className="demo-inner-grid">
        {lane.entries.map((entry) => <div
          key={entry.id}
          className={hoveredId === entry.id ? "demo-entry hovered" : "demo-entry"}
          onMouseEnter={() => onHover(entry.id)}
          onMouseLeave={() => onHover(null)}
        ><span>{entry.label}</span><span>{entry.kind}</span><span>{entry.time} ms</span><code>{entry.value}</code></div>)}
      </div>
    </details>)}
  </div>
}

function TimelineTreeDemo({ marks, lanes, full }: { marks: TimelineMark[]; lanes: DemoLane[]; full: readonly [number, number] }) {
  const [viewport, setViewport] = useState<TimeViewport>(() => createTimeViewport(full))
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  return <div className="demo-viz-stack" data-testid="timeline-tree-demo">
    <TimeNavigatorPixi
      marks={marks}
      viewport={viewport}
      highlightedId={hoveredId}
      laneLabels={lanes.map((lane) => lane.label)}
      onMarkHover={setHoveredId}
      onGesture={(gesture) => setViewport((state) => reduceTimeViewport(state, gesture))}
    />
    <EventTree lanes={lanes} hoveredId={hoveredId} onHover={setHoveredId} />
  </div>
}

export function GitMergeDemo() {
  const lanes = useMemo<DemoLane[]>(() => [
    { id: "main", label: "main", entries: [
      { id: "g-a", label: "a81c setup", time: 60, value: "initial graph", kind: "commit" },
      { id: "g-b", label: "c35f grid", time: 180, value: "tree rows", kind: "commit" },
      { id: "g-e", label: "f10a merge grid", time: 560, value: "feature/grid → main", kind: "merge" },
      { id: "g-h", label: "9dc2 merge perf", time: 880, value: "perf/pixi → main", kind: "merge" },
    ] },
    { id: "grid", label: "feature/grid", entries: [
      { id: "g-c", label: "2b09 nested rows", time: 290, value: "inner grid", kind: "commit" },
      { id: "g-d", label: "73aa expansion", time: 430, value: "expanded state", kind: "commit" },
    ] },
    { id: "pixi", label: "perf/pixi", entries: [
      { id: "g-f", label: "0ee4 retained", time: 650, value: "retained graphics", kind: "commit" },
      { id: "g-g", label: "bb71 density", time: 760, value: "overview buckets", kind: "commit" },
    ] },
  ], [])
  const marks = useMemo<TimelineMark[]>(() => {
    const dots = lanes.flatMap((lane, laneIndex) => lane.entries.map((entry) => ({ id: entry.id, kind: "dot" as const, time: entry.time, lane: laneIndex })))
    return [
      ...dots,
      { id: "edge-a-b", kind: "link", from: { time: 60, lane: 0 }, to: { time: 180, lane: 0 } },
      { id: "edge-b-c", kind: "link", from: { time: 180, lane: 0 }, to: { time: 290, lane: 1 } },
      { id: "edge-c-d", kind: "link", from: { time: 290, lane: 1 }, to: { time: 430, lane: 1 } },
      { id: "edge-d-e", kind: "link", from: { time: 430, lane: 1 }, to: { time: 560, lane: 0 } },
      { id: "edge-e-f", kind: "link", from: { time: 560, lane: 0 }, to: { time: 650, lane: 2 } },
      { id: "edge-f-g", kind: "link", from: { time: 650, lane: 2 }, to: { time: 760, lane: 2 } },
      { id: "edge-g-h", kind: "link", from: { time: 760, lane: 2 }, to: { time: 880, lane: 0 } },
    ] satisfies TimelineMark[]
  }, [lanes])
  return <TimelineTreeDemo marks={marks} lanes={lanes} full={[0, 950]} />
}

export function ObservableKindsDemo() {
  const lanes = useMemo<DemoLane[]>(() => [
    { id: "of", label: "of(1, 2, 3)", entries: [...[1, 2, 3].map((value, index): DemoEntry => ({ id: `o-of-${value}`, label: `next ${value}`, time: 70 + index * 70, value: String(value), kind: "next" })), { id: "o-of-c", label: "complete", time: 300, value: "|", kind: "complete" }] },
    { id: "merge", label: "merge(a$, b$)", entries: [90, 150, 230, 310, 390].map((time, index) => ({ id: `o-m-${index}`, label: `next ${index}`, time, value: index % 2 ? "b" : "a", kind: "next" as const })) },
    { id: "switch", label: "switchMap(query → request)", entries: [120, 250, 470].map((time, index) => ({ id: `o-s-${index}`, label: index === 1 ? "cancel + next" : "next", time, value: `request-${index}`, kind: "next" as const })) },
    { id: "concat", label: "concat(first$, second$)", entries: [80, 190, 360, 450].map((time, index) => ({ id: `o-c-${index}`, label: `next ${index}`, time, value: index < 2 ? "first" : "second", kind: "next" as const })) },
    { id: "debounce", label: "debounceTime(100)", entries: [100, 130, 165, 330].map((time, index) => ({ id: `o-d-${index}`, label: index === 3 ? "emit" : "suppressed", time, value: `key-${index}`, kind: "next" as const })) },
    { id: "retry", label: "retry({ count: 2 })", entries: [...[140, 280].map((time, index): DemoEntry => ({ id: `o-r-e-${index}`, label: `error ${index + 1}`, time, value: "×", kind: "error" })), { id: "o-r-ok", label: "next", time: 430, value: "ok", kind: "next" }, { id: "o-r-c", label: "complete", time: 510, value: "|", kind: "complete" }] },
  ], [])
  const marks = useMemo<TimelineMark[]>(() => lanes.flatMap((lane, laneIndex) => lane.entries.map((entry) => ({
    id: entry.id,
    kind: "dot" as const,
    time: entry.time,
    lane: laneIndex,
    variant: entry.label === "suppressed" ? "suppressed" : entry.kind === "complete" || entry.kind === "error" ? entry.kind : "next",
    label: entry.value,
  }))), [lanes])
  return <TimelineTreeDemo marks={marks} lanes={lanes} full={[0, 600]} />
}
