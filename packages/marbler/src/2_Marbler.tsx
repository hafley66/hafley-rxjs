/// <reference path="./0_assetImports.d.ts" />

import { flexRender } from "@tanstack/react-table"
import { useGrid } from "@hafley66/grid/react"
import { SignalReact } from "@hafley66/signals/react"
import { useLayoutEffect, useMemo, useRef, useState } from "react"
import type { MarbleEvent } from "./0_types.js"
import type { AggregateExtent } from "./1c_aggregate.js"
import { reduceTimeViewport, type TimelineMark } from "./0a_TimeViewport.js"
import { formatDuration } from "./0b_time.js"
import { aggregateExtents, displayDuration, flameNodes } from "./1c_aggregate.js"
import { FlameChart } from "./1d_FlameChart.js"
import { WaterfallPixi } from "./1a_WaterfallPixi.js"
import { TimeNavigatorPixi } from "./1b_TimeNavigatorPixi.js"
import type { Marbler } from "./1_model.js"
import "./2_marbler.css"

const WATERFALL_LEFT = 690
const TREE_GUTTER = 20
// One tick per this many measured waterfall pixels: below it the labels collide.
const TICK_PITCH = 90
const MIN_TICKS = 2

// Embedded mode drops the demo metaphors (fake HTTP stats, drawer nav) by default; a host can
// opt back into the filter chip row (still useful once real events carry more than one type).
type EmbeddedOption = boolean | { chips?: boolean }

function showChips(embedded: EmbeddedOption): boolean {
  return embedded === false || (typeof embedded === "object" && embedded.chips === true)
}

// Selection can land on a row the table has collapsed, so the drawer resolves ids against the tree.
function findEvent(rows: readonly MarbleEvent[], id: string | null): MarbleEvent | null {
  if (id === null) return null
  for (const row of rows) {
    if (row.id === id) return row
    const found = row.children ? findEvent(row.children, id) : null
    if (found) return found
  }
  return null
}

function durationLabel(event: MarbleEvent, extent?: AggregateExtent): string {
  const shown = displayDuration(event, extent)
  return shown === null ? "—" : formatDuration(shown)
}

function durationCell(event: MarbleEvent, extent?: AggregateExtent) {
  const shown = displayDuration(event, extent)
  return <>{durationLabel(event, extent)}{event.duration !== null && event.duration !== shown && <small>{formatDuration(event.duration)}</small>}</>
}

function MarblerView({ model, embedded = false, summary, navigatorHeight }: {
	model: Marbler
	embedded?: EmbeddedOption
	summary?: string[]
	navigatorHeight?: number
}) {
  const table = useGrid<MarbleEvent>(model.grid)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const tree = model.treeRows.$()
  const selected = findEvent(tree, model.selectedId.$())
  const hovered = findEvent(tree, model.hoveredId.$())
  const rows = table.getRowModel().rows
  const events = useMemo<MarbleEvent[]>(() => rows.map((row) => row.original), [rows])
  const hasTree = useMemo(() => rows.some((row) => row.getCanExpand()), [rows])
  // The waterfall canvas sits on the DOM waterfall column wherever host
  // column widths put it; the demo constant is the pre-measure fallback.
  const [measuredLeft, setMeasuredLeft] = useState<number | null>(null)
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    const cell = scroller?.querySelector<HTMLElement>(".grid-header .cell.col-waterfall")
    if (!scroller || !cell) return
    const measure = () => {
      const bounds = cell.getBoundingClientRect()
      const left = bounds.left - scroller.getBoundingClientRect().left + scroller.scrollLeft
      setMeasuredLeft((prior) => (Math.abs((prior ?? -1) - left) < 0.5 ? prior : left))
      setMeasuredWidth((prior) => (Math.abs((prior ?? -1) - bounds.width) < 0.5 ? prior : bounds.width))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(cell)
    observer.observe(scroller)
    return () => observer.disconnect()
  })
  const waterfallLeft = measuredLeft ?? WATERFALL_LEFT + (hasTree ? TREE_GUTTER : 0)
  const extents = useMemo(() => aggregateExtents(tree), [tree])
  const flame = useMemo(() => flameNodes(tree, extents), [tree, extents])
  const timelineEvents = model.rows.$()
  const laneById = useMemo(() => new Map(timelineEvents.map((event, lane) => [event.id, lane])), [timelineEvents])
  const marks = useMemo<TimelineMark[]>(() => timelineEvents.flatMap((event, lane) => {
    const extent = extents.get(event.id)
    const eventMarks: TimelineMark[] = extent?.start != null && extent.end != null
      ? [{ id: event.id, kind: "span", start: extent.start, end: extent.end, lane }]
      : []
    for (const frame of event.frames ?? []) {
      eventMarks.push({
        id: frame.id,
        kind: "dot",
        time: frame.t,
        lane,
        variant: frame.severity === "error" ? "error" : frame.severity === "done" ? "complete" : "next",
      })
      const peerLane = frame.peer === null ? undefined : laneById.get(frame.peer)
      if (peerLane !== undefined && peerLane !== lane) {
        eventMarks.push({ id: `${frame.id}:link`, kind: "link", from: { time: frame.t, lane }, to: { time: frame.t, lane: peerLane } })
      }
    }
    return eventMarks
  }), [extents, laneById, timelineEvents])
  const viewport = model.viewport.$()
  // Ticks are read off the measured waterfall column, not a fixed count, and are labelled relative
  // to the start of the full range: absolute epoch seconds are both meaningless and too wide here.
  const tickCount = Math.max(MIN_TICKS, Math.round((measuredWidth ?? 520) / TICK_PITCH))
  const ticks = Array.from({ length: tickCount }, (_, index) => viewport.visible[0] + (viewport.visible[1] - viewport.visible[0]) * index / (tickCount - 1))
  const filterChips = ["all", ...model.filters.$()]
  const legendEntries = Object.entries(model.phaseStyles)
  return <main className="app-shell" data-embedded={embedded ? "true" : undefined} data-testid="marbler">
    <section className="network-panel">
      <div className="subtoolbar">
        {showChips(embedded) && filterChips.map((chip) => <button key={chip} className={model.filter.$() === chip ? "kind active" : "kind"} onClick={() => model.filter.$(chip)}>{chip}</button>)}
        <span className="view-toggle">{(["table", "flame"] as const).map((mode) => <button key={mode} type="button" className={model.view.$() === mode ? "kind active" : "kind"} data-testid={`view-${mode}`} onClick={() => model.view.$(mode)}>{mode}</button>)}</span>
        <span className="toolbar-spacer" />{hovered && <span className="hovered-event" data-testid="hovered-event">{hovered.name} · {durationLabel(hovered, extents.get(hovered.id))}</span>}<span className="summary">{rows.length} events</span>
        {!embedded && <span className="legend">{legendEntries.map(([kind, style]) => <span key={kind}><i style={{ background: style.color }} />{style.label} </span>)}</span>}
      </div>
      <TimeNavigatorPixi
        marks={marks}
        viewport={viewport}
        laneLabels={timelineEvents.map((event) => event.name)}
        highlightedId={model.hoveredId.$()}
        onMarkHover={(id) => model.hoveredId.$(id)}
        onGesture={(gesture) => model.viewport.$(reduceTimeViewport(model.viewport.$(), gesture))}
        height={navigatorHeight}
      />
      {model.view.$() === "flame" ? <div className="flame-scroller" data-testid="flame-scroller">
        <FlameChart
          nodes={flame}
          domain={viewport.visible}
          phaseStyles={model.phaseStyles}
          hoveredId={model.hoveredId.$()}
          selectedId={model.selectedId.$()}
          onNodeHover={(id) => model.hoveredId.$(id)}
          onNodeSelect={(id) => model.selectedId.$(id)}
        />
      </div> : <div className="grid-scroller" ref={scrollerRef}>
        <div className="grid-sticky-head">
          <div className={hasTree ? "grid-header grid-row has-tree" : "grid-header grid-row"}>
            {table.getHeaderGroups()[0].headers.filter((header) => hasTree || header.column.id !== "__expand").map((header) => <div key={header.id} className={`cell col-${header.column.id}`} onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}</div>)}
          </div>
          <div className={hasTree ? "timeline grid-row has-tree" : "timeline grid-row"}><span className="timeline-gutter" />{ticks.map((tick, index) => <span key={index} style={{ left: `calc(${waterfallLeft}px + (100% - ${waterfallLeft}px) * ${index / (ticks.length - 1)})`, transform: index === 0 ? undefined : index === ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)" }}>{`+${formatDuration(tick - viewport.full[0])}`}</span>)}</div>
        </div>
        <div className="grid-body">
          <WaterfallPixi
            rows={events}
            scroller={scrollerRef}
            domain={viewport.visible}
            leftOffset={waterfallLeft}
            extents={extents}
            phaseStyles={model.phaseStyles}
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
            <div className="cell col-duration">{durationCell(row.original, extents.get(row.id))}</div>
            <div className="cell col-waterfall" />
          </div>)}
        </div>
      </div>}
      <footer className="statusbar"><span>{rows.length} / {model.source.$().length} events</span>{embedded
        ? summary?.map((item) => <span key={item}>{item}</span>)
        : <><span>2.8 kB transferred</span><span>Finish: 2.63 s</span><span className="dom">▯ DOMContentLoaded: 1.18 s</span><span className="load">▯ Load: 1.92 s</span></>}</footer>
    </section>
    {selected && <aside className="drawer" data-testid="event-details">
      <div className="drawer-title"><div><span className={`method method-${selected.method.toLowerCase()}`}>{selected.method}</span><b>{selected.name}</b></div><button onClick={() => model.selectedId.$(null)}>×</button></div>
      {!embedded && <nav><b>Headers</b><span>Payload</span><span>Preview</span><span>Response</span><span>Timing</span></nav>}
      <h3>General</h3><dl><dt>Request URL</dt><dd>boop://{selected.from}/{selected.to}/{selected.id}</dd><dt>Request Method</dt><dd>{selected.method}</dd><dt>Status Code</dt><dd><i className="ok-dot" /> {selected.status} {selected.status === 200 ? "Delivered" : "Accepted"}</dd><dt>Remote Address</dt><dd>{selected.to}</dd></dl>
      <h3>Message</h3><pre>{selected.preview}</pre>
      <h3>Timing</h3><div className="timing-bars">{selected.phases.map((phase, index) => phase.start !== null && phase.end !== null ? <div key={`${phase.kind}:${phase.start}:${phase.end}:${index}`}><label>{phase.kind}</label><span style={{ width: `${Math.max(4, (phase.end - phase.start) / 8)}%`, background: (model.phaseStyles[phase.kind] ?? { color: "#70839b" }).color }} /><em>{formatDuration(phase.end - phase.start)}</em></div> : null)}</div>
      {selected.frames && selected.frames.length > 0 && <><h3>Messages</h3><table className="messages-table" data-testid="messages-table"><thead><tr><th /><th>Kind</th><th>Time</th><th>Peer</th><th>Preview</th></tr></thead><tbody>{[...selected.frames].sort((earlierFrame, laterFrame) => earlierFrame.t - laterFrame.t).map((frame) => <tr key={frame.id} className={`frame-row frame-${frame.direction}${frame.severity === "error" ? " frame-error" : ""}`}><td className="frame-direction">{frame.direction === "out" ? "▲" : frame.direction === "in" ? "▼" : "●"}</td><td>{frame.kind}</td><td>{formatDuration(selected.start !== null ? frame.t - selected.start : frame.t)}</td><td>{frame.peer ?? "none"}</td><td>{frame.preview}{frame.repeat > 1 && <span className="frame-repeat">×{frame.repeat}</span>}</td></tr>)}</tbody></table></>}
    </aside>}
  </main>
}

export const MarblerPanel = SignalReact(MarblerView)
