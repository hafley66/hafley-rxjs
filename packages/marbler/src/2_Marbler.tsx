/// <reference path="./0_assetImports.d.ts" />

import { flexRender } from "@tanstack/react-table"
import { useGrid } from "@hafley66/grid/react"
import { SignalReact } from "@hafley66/signals/react"
import { useMemo, useRef } from "react"
import type { EventFilter, MarbleEvent } from "./0_types.js"
import { reduceTimeViewport, type TimelineMark } from "./0a_TimeViewport.js"
import { WaterfallPixi } from "./1a_WaterfallPixi.js"
import { TimeNavigatorPixi } from "./1b_TimeNavigatorPixi.js"
import type { Marbler } from "./1_model.js"
import "./2_marbler.css"

const FILTERS: EventFilter[] = ["all", "request", "result", "tool", "note"]
const WATERFALL_LEFT = 690
const TREE_GUTTER = 20
function MarblerView({ model, embedded = false, summary }: {
	model: Marbler
	// Host apps embed this panel inside their own chrome: drop the demo
	// metaphors (filter chips, phase legend, fake HTTP stats, drawer nav)
	// and fill the host box instead of the demo page geometry.
	embedded?: boolean
	summary?: string[]
}) {
  const table = useGrid<MarbleEvent>(model.grid)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const selected = model.rows.$().find((row) => row.id === model.selectedId.$()) ?? null
  const hovered = model.rows.$().find((row) => row.id === model.hoveredId.$()) ?? null
  const rows = table.getRowModel().rows
  const events = useMemo<MarbleEvent[]>(() => rows.map((row) => row.original), [rows])
  const hasTree = useMemo(() => rows.some((row) => row.getCanExpand()), [rows])
  const waterfallLeft = WATERFALL_LEFT + (hasTree ? TREE_GUTTER : 0)
  const timelineEvents = model.rows.$()
  const laneById = useMemo(() => new Map(timelineEvents.map((event, lane) => [event.id, lane])), [timelineEvents])
  const marks = useMemo<TimelineMark[]>(() => timelineEvents.flatMap((event, lane) => {
    const eventMarks: TimelineMark[] = event.start !== null && event.duration !== null
      ? [{ id: event.id, kind: "span", start: event.start, end: event.start + event.duration, lane }]
      : []
    for (const frame of event.frames ?? []) {
      eventMarks.push({
        id: frame.id,
        kind: "dot",
        time: frame.t,
        lane,
        variant: frame.kind === "error" ? "error" : frame.kind === "turn-finish" || frame.kind === "result" || frame.kind === "exit" ? "complete" : "next",
      })
      const peerLane = frame.peer === null ? undefined : laneById.get(frame.peer)
      if (peerLane !== undefined && peerLane !== lane) {
        eventMarks.push({ id: `${frame.id}:link`, kind: "link", from: { time: frame.t, lane }, to: { time: frame.t, lane: peerLane } })
      }
    }
    return eventMarks
  }), [laneById, timelineEvents])
  const viewport = model.viewport.$()
  const ticks = Array.from({ length: 6 }, (_, index) => viewport.visible[0] + (viewport.visible[1] - viewport.visible[0]) * index / 5)
  return <main className="app-shell" data-embedded={embedded ? "true" : undefined} data-testid="marbler">
    <section className="network-panel">
      <div className="subtoolbar">
        {!embedded && FILTERS.map((filter) => <button key={filter} className={model.filter.$() === filter ? "kind active" : "kind"} onClick={() => model.filter.$(filter)}>{filter}</button>)}
        <span className="toolbar-spacer" />{hovered && <span className="hovered-event" data-testid="hovered-event">{hovered.name} · {hovered.duration} ms</span>}<span className="summary">{rows.length} events</span>
        {!embedded && <span className="legend"><i className="phase-send" />send <i className="phase-wait" />wait <i className="phase-receive" />receive <i className="phase-work" />work</span>}
      </div>
      <TimeNavigatorPixi
        marks={marks}
        viewport={viewport}
        laneLabels={timelineEvents.map((event) => event.name)}
        highlightedId={model.hoveredId.$()}
        onMarkHover={(id) => model.hoveredId.$(id)}
        onGesture={(gesture) => model.viewport.$(reduceTimeViewport(model.viewport.$(), gesture))}
      />
      <div className="grid-scroller" ref={scrollerRef}>
        <div className="grid-sticky-head">
          <div className={hasTree ? "grid-header grid-row has-tree" : "grid-header grid-row"}>
            {table.getHeaderGroups()[0].headers.filter((header) => hasTree || header.column.id !== "__expand").map((header) => <div key={header.id} className={`cell col-${header.column.id}`} onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}</div>)}
          </div>
          <div className={hasTree ? "timeline grid-row has-tree" : "timeline grid-row"}><span className="timeline-gutter" />{ticks.map((tick, index) => <span key={index} style={{ left: `calc(${waterfallLeft}px + ${index * 20}%)` }}>{`${(tick / 1000).toFixed(2)} s`}</span>)}</div>
        </div>
        <div className="grid-body">
          <WaterfallPixi
            rows={events}
            scroller={scrollerRef}
            domain={viewport.visible}
            leftOffset={waterfallLeft}
            onEventHover={(event) => model.hoveredId.$(event?.id ?? null)}
            onEventSelect={(event) => model.selectedId.$(event.id)}
          />
          {rows.map((row) => <div
            key={row.id}
            data-event-id={row.id}
            data-depth={row.depth}
            className={`${model.selectedId.$() === row.id ? "grid-row selected" : "grid-row"}${model.hoveredId.$() === row.id ? " hovered" : ""}${hasTree ? " has-tree" : ""}`}
            onMouseEnter={() => model.hoveredId.$(row.id)}
            onMouseLeave={() => model.hoveredId.$(null)}
            onClick={() => model.selectedId.$(row.id)}
          >
            {hasTree && <div className="cell col-__expand">{row.getCanExpand() && <button type="button" className="expand-toggle" aria-label={row.getIsExpanded() ? "collapse" : "expand"} onClick={(event) => { event.stopPropagation(); row.getToggleExpandedHandler()() }}>{row.getIsExpanded() ? "▾" : "▸"}</button>}</div>}
            <div className="cell col-name" style={{ paddingLeft: 9 + row.depth * 18 }}><span className={`method method-${row.original.method.toLowerCase()}`}>{row.original.method}</span><span className="name-stack"><b>{row.original.name}</b><small>{row.original.preview}</small></span></div>
            <div className={`cell col-status status-${Math.floor(row.original.status / 100)}`}>{row.original.status}</div>
            <div className="cell col-type">{row.original.type}</div>
            <div className="cell col-initiator">{row.original.initiator}</div>
            <div className="cell col-size">{row.original.size}</div>
            <div className="cell col-duration">{row.original.duration} ms</div>
            <div className="cell col-waterfall" />
          </div>)}
        </div>
      </div>
      <footer className="statusbar"><span>{rows.length} / {model.source.$().length} events</span>{embedded
        ? summary?.map((item) => <span key={item}>{item}</span>)
        : <><span>2.8 kB transferred</span><span>Finish: 2.63 s</span><span className="dom">▯ DOMContentLoaded: 1.18 s</span><span className="load">▯ Load: 1.92 s</span></>}</footer>
    </section>
    {selected && <aside className="drawer" data-testid="event-details">
      <div className="drawer-title"><div><span className={`method method-${selected.method.toLowerCase()}`}>{selected.method}</span><b>{selected.name}</b></div><button onClick={() => model.selectedId.$(null)}>×</button></div>
      {!embedded && <nav><b>Headers</b><span>Payload</span><span>Preview</span><span>Response</span><span>Timing</span></nav>}
      <h3>General</h3><dl><dt>Request URL</dt><dd>boop://{selected.from}/{selected.to}/{selected.id}</dd><dt>Request Method</dt><dd>{selected.method}</dd><dt>Status Code</dt><dd><i className="ok-dot" /> {selected.status} {selected.status === 200 ? "Delivered" : "Accepted"}</dd><dt>Remote Address</dt><dd>{selected.to}</dd></dl>
      <h3>Message</h3><pre>{selected.preview}</pre>
      <h3>Timing</h3><div className="timing-bars">{selected.phases.map((phase, index) => phase.start !== null && phase.end !== null ? <div key={`${phase.kind}:${phase.start}:${phase.end}:${index}`}><label>{phase.kind}</label><span className={`phase-${phase.kind}`} style={{ width: `${Math.max(4, (phase.end - phase.start) / 8)}%` }} /><em>{phase.end - phase.start} ms</em></div> : null)}</div>
      {selected.frames && selected.frames.length > 0 && <><h3>Messages</h3><table className="messages-table" data-testid="messages-table"><thead><tr><th /><th>Kind</th><th>Time</th><th>Peer</th><th>Preview</th></tr></thead><tbody>{[...selected.frames].sort((earlierFrame, laterFrame) => earlierFrame.t - laterFrame.t).map((frame) => <tr key={frame.id} className={`frame-row frame-${frame.direction}${frame.kind === "error" ? " frame-error" : ""}`}><td className="frame-direction">{frame.direction === "out" ? "▲" : frame.direction === "in" ? "▼" : "●"}</td><td>{frame.kind}</td><td>{selected.start !== null ? frame.t - selected.start : frame.t} ms</td><td>{frame.peer ?? "none"}</td><td>{frame.preview}{frame.repeat > 1 && <span className="frame-repeat">×{frame.repeat}</span>}</td></tr>)}</tbody></table></>}
    </aside>}
  </main>
}

export const MarblerPanel = SignalReact(MarblerView)
