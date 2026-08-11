import { flexRender } from "@tanstack/react-table"
import { useGrid } from "@hafley66/grid/react"
import { SignalReact } from "@hafley66/signals/react"
import { useRef } from "react"
import type { EventFilter } from "./0_types"
import { WaterfallCanvas } from "./1a_WaterfallCanvas"
import type { Marbler } from "./1_model"
import "./2_marbler.css"

const FILTERS: EventFilter[] = ["all", "request", "result", "tool", "note"]
const TICKS = [0, 500, 1000, 1500, 2000, 2500]

function MarblerView({ model }: { model: Marbler }) {
  const table = useGrid(model.grid)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const selected = model.source.$().find((row) => row.id === model.selectedId.$()) ?? null
  const rows = table.getRowModel().rows
  return <main className="app-shell" data-testid="marbler">
    <section className="network-panel">
      <header className="toolbar">
        <button className="record" aria-label="record" />
        <button className="tool-icon">⊘</button><button className="tool-icon">⌁</button>
        <span className="divider" />
        <label className="filter-input"><span>⌕</span><input placeholder="Filter" /></label>
        <button className="chip active">All</button><button className="chip">Fetch/XHR</button><button className="chip">Doc</button><button className="chip">JS</button><button className="chip">CSS</button>
        <span className="toolbar-spacer" /><span className="summary">{rows.length} events</span>
      </header>
      <div className="subtoolbar">
        {FILTERS.map((filter) => <button key={filter} className={model.filter.$() === filter ? "kind active" : "kind"} onClick={() => model.filter.$(filter)}>{filter}</button>)}
        <span className="legend"><i className="phase-send" />send <i className="phase-wait" />wait <i className="phase-receive" />receive <i className="phase-work" />work</span>
      </div>
      <div className="grid-scroller" ref={scrollerRef}>
        <div className="grid-header grid-row">
          {table.getHeaderGroups()[0].headers.map((header) => <div key={header.id} className={`cell col-${header.column.id}`} onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}</div>)}
        </div>
        <div className="timeline grid-row"><span className="timeline-gutter" />{TICKS.map((tick) => <span key={tick} style={{ left: `calc(640px + ${tick / 30}%)` }}>{tick === 0 ? "0" : `${(tick / 1000).toFixed(1)} s`}</span>)}</div>
        <div className="grid-body">
          <WaterfallCanvas rows={rows.map((row) => row.original)} scroller={scrollerRef} />
          {rows.map((row) => <div key={row.id} className={model.selectedId.$() === row.id ? "grid-row selected" : "grid-row"} onClick={() => model.selectedId.$(row.id)}>
            <div className="cell col-name"><span className={`method method-${row.original.method.toLowerCase()}`}>{row.original.method}</span><span className="name-stack"><b>{row.original.name}</b><small>{row.original.preview}</small></span></div>
            <div className={`cell col-status status-${Math.floor(row.original.status / 100)}`}>{row.original.status}</div>
            <div className="cell col-type">{row.original.type}</div>
            <div className="cell col-initiator">{row.original.initiator}</div>
            <div className="cell col-size">{row.original.size}</div>
            <div className="cell col-duration">{row.original.duration} ms</div>
            <div className="cell col-waterfall" />
          </div>)}
        </div>
      </div>
      <footer className="statusbar"><span>{rows.length} / {model.source.$().length} events</span><span>2.8 kB transferred</span><span>Finish: 2.63 s</span><span className="dom">▯ DOMContentLoaded: 1.18 s</span><span className="load">▯ Load: 1.92 s</span></footer>
    </section>
    {selected && <aside className="drawer" data-testid="event-details">
      <div className="drawer-title"><div><span className={`method method-${selected.method.toLowerCase()}`}>{selected.method}</span><b>{selected.name}</b></div><button onClick={() => model.selectedId.$(null)}>×</button></div>
      <nav><b>Headers</b><span>Payload</span><span>Preview</span><span>Response</span><span>Timing</span></nav>
      <h3>General</h3><dl><dt>Request URL</dt><dd>boop://{selected.from}/{selected.to}/{selected.id}</dd><dt>Request Method</dt><dd>{selected.method}</dd><dt>Status Code</dt><dd><i className="ok-dot" /> {selected.status} {selected.status === 200 ? "Delivered" : "Accepted"}</dd><dt>Remote Address</dt><dd>{selected.to}</dd></dl>
      <h3>Message</h3><pre>{selected.preview}</pre>
      <h3>Timing</h3><div className="timing-bars">{selected.phases.map((phase) => <div key={phase.kind}><label>{phase.kind}</label><span className={`phase-${phase.kind}`} style={{ width: `${Math.max(4, (phase.end - phase.start) / 8)}%` }} /><em>{phase.end - phase.start} ms</em></div>)}</div>
    </aside>}
  </main>
}

export const MarblerPanel = SignalReact(MarblerView)
