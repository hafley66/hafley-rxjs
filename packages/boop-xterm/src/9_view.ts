import { Signal, toSignal } from "@hafley66/signals";
import type { Terminal } from "@xterm/xterm";
import { combineLatest, filter, map, merge, takeUntil, tap, type Observable } from "rxjs";
import { marksOf, type TurnMark } from "./2_agentSquaresMarks.js";
import { defaultTerminalDiagramLayout } from "./1_terminalDiagrams.js";
import type { BoopXtermPane, BoopXtermPorts, PaneIdentity } from "./3_ports.js";
import { createBoopXtermPane } from "./7_pane.js";
import { contextQueueStream, type ContextQueueModel } from "./8a_contextQueue.js";
import { contextGutterStream, type ContextGutterModel } from "./8b_contextGutter.js";
import { contextSyncStream, type ContextSyncModel } from "./8c_contextSync.js";
import { hoverCheckStream, type HoverCheckModel } from "./8d_hoverCheck.js";
import { turnMarksStream, type TurnMarksModel } from "./8e_turnMarks.js";
import { forkRenderStream, type ForkRenderModel } from "./8f_forkRender.js";
import { diagramOverlayStream, type DiagramInputs, type DiagramOverlayModel } from "./8g_diagramOverlay.js";
import { turnPanelStream, type TurnPanelModel } from "./8i_turnPanel.js";
import { agentSquaresStream, type AgentSquaresModel, type AgentSquaresInput } from "./8j_agentSquares.js";
import { structuredOverlayStream, type StructuredOverlayModel } from "./8k_structuredOverlay.js";
import { turnDebugOverlayStream, type TurnDebugModel } from "./8l_turnDebugOverlay.js";

export type BoopXtermView = {
  pane: BoopXtermPane;
  diagram: DiagramOverlayModel;
  diagramInputs: DiagramInputs;
  contextQueue: ContextQueueModel;
  contextGutter: ContextGutterModel;
  contextSync: ContextSyncModel;
  hoverCheck: HoverCheckModel;
  turnMarks: TurnMarksModel;
  forkRender: ForkRenderModel;
  turnPanel: TurnPanelModel;
  agentSquares: AgentSquaresModel;
  structuredOverlay: StructuredOverlayModel;
  turnDebugOverlay: TurnDebugModel;
  effects: Observable<void>;
};

export function createBoopXtermView(
  term: Terminal, host: HTMLElement, identity: PaneIdentity, ports: BoopXtermPorts,
): BoopXtermView {
  const pane = createBoopXtermPane(term, host, identity, ports);
  const diagramInputs: DiagramInputs = {
    enabled: ports.inlineDiagrams,
    inference: ports.diagramInference,
    scrollGesture: Signal<void>(),
    activate: Signal<void>(),
    layout: defaultTerminalDiagramLayout,
  };
  const diagram = diagramOverlayStream(term, host, pane.visibility, diagramInputs);
  const contextQueue = contextQueueStream(term, host, pane.visibility, pane.anchors, identity, ports);
  const contextGutter = contextGutterStream(term, host, contextQueue, pane.visibility, pane.anchors);
  const contextSync = contextSyncStream(contextQueue, ports.tabName, ports.sessionIds,
    pane.visibility.state.visible, ports);
  const hoverCheck = hoverCheckStream(term, host, contextQueue, contextGutter, pane.anchors);
  const turnMarks = turnMarksStream(host, contextQueue, contextGutter, contextSync);
  const forkRender = forkRenderStream(term, host, contextGutter, turnMarks, ports.forkLivePane, ports);
  const opened = Signal<import("./8i_turnPanel.js").TurnPanelTarget | undefined>(undefined);
  const marks = Signal<ReadonlyMap<string, TurnMark>>(new Map());
  const turnPanel = turnPanelStream(host, opened, marks);
  const squaresInput = Signal((): AgentSquaresInput | null => {
    const binding = pane.paneSession.data.$();
    if (!binding?.session) return null;
    return { pty: identity.id, session: binding.session, target: identity.target,
      ...(identity.socket ? { socket: identity.socket } : {}) };
  });
  const agentSquares = agentSquaresStream(term, host, squaresInput, turnPanel, ports);
  const structuredOverlay = structuredOverlayStream(term, host, pane.visibility, ports.structuredOverlayEnabled);
  const turnDebugOverlay = turnDebugOverlayStream(term, host, pane.visibility, turnPanel, ports.turnDebugEnabled);
  const favorites = toSignal(ports.favoriteSources);
  const hostTags = toSignal(ports.turnTags);
  const marks$ = combineLatest([agentSquares.state.frame.$, pane.visibility.state.visible.$, favorites.$, hostTags.$]).pipe(tap(([frame, visible, sources, tagged]) => {
    const next = new Map<string, TurnMark>();
    if (frame) {
      const byTurn = marksOf(frame, sources);
      for (const turn of [...frame.turns, ...frame.pinned]) {
        const mark = byTurn.get(turn.id);
        if (mark) next.set(`turn:${turn.session}:${turn.turn}`, mark);
      }
    }
    for (const turn of visible) {
      const source = `turn:${turn.session}:${turn.turn}`;
      if (!next.has(source)) next.set(source, { favorite: sources.has(source), tags: [] });
    }
    // Host tag edits win over the strip frame's tags, which lag until the next frame.
    for (const [source, tags] of tagged) next.set(source, { favorite: sources.has(source), tags: [...tags] });
    marks.$(next);
  }), map(() => void 0));
  const closed$ = toSignal(ports.paneClosed).$.pipe(filter(Boolean));
  const other$ = merge(
    diagram.effects,
    contextQueue.effects, contextGutter.effects, contextSync.effects,
    hoverCheck.effects, turnMarks.effects, forkRender.effects,
    turnPanel.effects, structuredOverlay.effects, turnDebugOverlay.effects,
    pane.wheel.activity.$.pipe(tap(() => diagramInputs.scrollGesture.$(undefined)), map(() => void 0)),
    marks$,
  ).pipe(takeUntil(closed$));
  const effects = merge(pane.effects, other$, agentSquares.effects);
  return { pane, diagram, diagramInputs, contextQueue, contextGutter, contextSync, hoverCheck,
    turnMarks, forkRender, turnPanel, agentSquares, structuredOverlay, turnDebugOverlay, effects };
}
