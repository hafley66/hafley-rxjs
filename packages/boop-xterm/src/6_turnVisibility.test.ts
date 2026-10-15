import { Signal } from "@hafley66/signals"
import type { Terminal } from "@xterm/xterm"
import { EMPTY, merge, of } from "rxjs"
import { expect, it } from "vitest"
import type { PaneRuntimeState, ViewportModel, ViewportSnapshot } from "./3_ports.js"
import { paneSessionStream } from "./4_paneSession.js"
import { turnVisibilityStream } from "./6_turnVisibility.js"
import { testPorts } from "./test/0_endpointTransport.js"

it("ingests an idle pane when its exact chat binds while the sidebar is disabled", async () => {
  const syncs: unknown[] = []
  const ports = testPorts((request) => {
    if (request.url === "boop_mux_session") return of({ status: 200, body: { session: "clicked-chat", harness: "omp" } })
    if (request.url === "boop_sync_session") {
      syncs.push(request.body)
      return of({ status: 200, body: { written: 0, dropped: 0 } })
    }
    return of({ status: 200, body: request.url === "boop_mux_capture" ? "" : [] })
  })
  const viewport: ViewportModel = {
    snapshot: Signal<ViewportSnapshot>({ change: { kind: "resize", cols: 80, rows: 20, viewportY: 0, bufferLength: 20 },
      lines: [], visible: true, geometry: { top: 0, cellHeight: 20, viewportY: 0, rows: 20 } }),
    changes: Signal(), effects: EMPTY,
  }
  const identity = { id: "p", target: "%470", socket: null }
  const session = paneSessionStream(identity, ports)
  const runtime = Signal<PaneRuntimeState>({ viewportRevision: 0,
    selection: { selection: null, captured: [], anchor: null, dragging: false } })
  const visibility = turnVisibilityStream(null as unknown as Terminal, identity, viewport, session, runtime, ports)
  const subscription = merge(session.$, visibility.effects).subscribe()
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  subscription.unsubscribe()
  expect(syncs).toEqual([{ session: "clicked-chat", harness: "omp" }])
})
