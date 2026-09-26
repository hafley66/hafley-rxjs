import { Signal, toSignal } from "@hafley66/signals";
import type { Terminal } from "@xterm/xterm";
import { filter, map, merge, share, takeUntil } from "rxjs";
import type { BoopXtermPane, BoopXtermPorts, PaneIdentity, PaneRuntimeState } from "./3_ports.js";
import { viewportStream } from "./4_viewport.js";
import { paneSessionStream } from "./4_paneSession.js";
import { lineAnchorsStream } from "./5_lineAnchors.js";
import { wheelStream } from "./5_wheel.js";
import { pinnedSelectionStream } from "./5_pinnedSelection.js";
import { turnVisibilityStream } from "./6_turnVisibility.js";

export function createBoopXtermPane(
  term: Terminal, host: HTMLElement, identity: PaneIdentity, ports: BoopXtermPorts,
): BoopXtermPane {
  const inputs: BoopXtermPorts = {
    ...ports,
    paneVisible: toSignal(ports.paneVisible),
    paneClosed: toSignal(ports.paneClosed),
    harness: toSignal(ports.harness),
    clipboardEnabled: toSignal(ports.clipboardEnabled),
    tabSessionIds: toSignal(ports.tabSessionIds),
  };
  const runtime = Signal<PaneRuntimeState>({
    viewportRevision: 0,
    selection: { selection: null, captured: [], anchor: null, dragging: false },
  });
  const paneSession = paneSessionStream(identity, inputs);
  const viewport = viewportStream(term, runtime, inputs);
  const anchors = lineAnchorsStream(term, viewport, runtime, inputs);
  const wheel = wheelStream(term, identity, runtime, inputs);
  const pinned = pinnedSelectionStream(term, host, runtime, inputs);
  const visibility = turnVisibilityStream(term, identity, viewport, paneSession, runtime, inputs);
  const effects = merge(
    viewport.effects, anchors.effects, wheel.effects, pinned.effects, visibility.effects,
    paneSession.$.pipe(map(() => void 0)),
    viewport.snapshot.$.pipe(map(() => void 0)),
    anchors.state.$.pipe(map(() => void 0)),
    visibility.state.$.pipe(map(() => void 0)),
    wheel.state.$.pipe(map(() => void 0)),
    pinned.text.$.pipe(map(() => void 0)),
  ).pipe(takeUntil(toSignal(inputs.paneClosed).$.pipe(filter(Boolean))), share());
  return { runtime, paneSession, viewport, anchors, visibility, wheel, pinned, effects };
}
