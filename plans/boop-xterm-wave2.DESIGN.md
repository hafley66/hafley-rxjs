# boop-xterm wave 2 design r2

## 1. Type signatures

| Exported symbol group | Current signature | Proposed signature |
| --- | --- | --- |
| `LogicalLine`, `ViewportChange`, `BoopFavorite`, `BoopTurn`, `VisibleTurn`, `TurnSpan` | Current signature blocks below | Existing wire and model declarations remain unchanged in `0_types.ts` and wave 2 types. |
| `XtermViewport`, `XtermViewportAdapter` | Current signature block below | `viewportStream` and `ViewportModel` below. |
| `TmuxPane`, `NativeTmuxPane` | Current signature block below | `paneSessionStream` and `BoopXtermPorts.boop_mux_session` / `.boop_mux_capture` below. |
| `BoopConversation<TTurn>` | Current signature block below | Same type-only interface, with no wave 2 runtime constructor. |
| `VisibleTerminalLine`, `TerminalLineAnchorEvent`, `terminalLineId`, `TerminalLineAnchors` | Current signature block below | Pure declarations unchanged; `lineAnchorsStream` below. |
| `normalizeTurnLine`, `TurnVisibilityEvent`, `selectProjectionTurns`, `tmuxConfirms`, `dropTmuxStatusRow`, `TerminalInputRegion`, `terminalInputRegion`, `dropTerminalInputRows`, `locateVisibleTurns`, `extendTo`, `TURN_ACTIVITY_POLL_MS`, `TURN_ACTIVITY_LEASE_MS`, `attachTurnRegions`, `TurnLocator`, `TerminalTurnVisibilityV2` | Current signature block below | Pure declarations/constants unchanged; locator is an Endpoint; `turnVisibilityStream` below. |
| `TerminalMouseMode`, `TerminalWheelState`, `TerminalWheelEvent`, `initialTerminalWheelState`, `reduceTerminalWheel`, `TerminalWheelRouter` | Current signature block below | Pure declarations unchanged; `wheelStream` below. |
| `SelectionCell`, `PinnedSelection`, `PinnedRowSpan`, `orderedSelection`, `pinnedRowSpans`, `wordSpanAt`, `lineSpanAt`, `isEmptySelection`, `joinPinnedRows`, `PinnedSelectionOptions`, `TerminalPinnedSelection` | Current signature block below | Pure declarations unchanged; option callback becomes `copy` event; `pinnedSelectionStream` below. |
| `OmpTurnSources`, `projectionTurnSources` | Current signature block below | Same pure declarations and body in `1_turnMatching.ts`. |
| New `BoopXtermPorts` | No current signature | One endpoint and host-input record below. |

```ts
// Current signature: 00a_terminalIntersection.ts, public surface.
export type LogicalLine = { text: string; start: number; end: number };
export type ViewportChange = {
  kind: "write" | "scroll" | "resize";
  cols: number;
  rows: number;
  viewportY: number;
  bufferLength: number;
};
export interface XtermViewport {
  readonly changes: Observable<ViewportChange>;
  readVisibleLogicalLines(): LogicalLine[];
  bufferRowAtClientY(clientY: number): number | null;
  dispose(): void;
  visible?(): boolean;
}
export class XtermViewportAdapter implements XtermViewport {
  closed: Subject<void>;
  changes: Observable<ViewportChange>;
  constructor(readonly term: Terminal);
  visible(): boolean;
  readVisibleLogicalLines(): LogicalLine[];
  bufferRowAtClientY(clientY: number): number | null;
  dispose(): void;
}
export interface TmuxPane {
  readonly target: string;
  captureVisible(): Promise<string>;
}
export class NativeTmuxPane implements TmuxPane {
  session_id: string | null;
  session_read_at: number;
  session_binding: PaneSessionBinding | null;
  constructor(
    readonly target: string,
    readonly socket?: string,
    readonly onSessionBinding?: (binding: PaneSessionBinding | null) => void,
  );
  captureVisible(): Promise<string>;
  session(): Promise<string | null>;
}
export type BoopFavorite = {
  favorite_id: number;
  note: string;
  source: string;
  created_ts: number;
  bytes: number;
  body: string;
  tags?: string[];
};
export interface BoopConversation<TTurn> {
  readonly session: string;
  turns(): Promise<TTurn[]>;
  favorites(): Promise<BoopFavorite[]>;
  toggleFavorite(turn: TTurn): Promise<BoopFavorite[]>;
}
```

```ts
// Current signature: 00b_terminalLineAnchors.ts, public surface.
export type VisibleTerminalLine = {
  id: string; bufferStart: number; bufferEnd: number;
  viewportStart: number; viewportEnd: number; text: string;
};
export type TerminalLineAnchorEvent =
  | { kind: "entered"; line: VisibleTerminalLine }
  | { kind: "moved"; line: VisibleTerminalLine; previousViewportStart: number }
  | { kind: "changed"; line: VisibleTerminalLine; previousText: string }
  | { kind: "exited"; id: string }
  | { kind: "viewport-jump"; previousTop: number; top: number }
  | { kind: "top-line-changed"; previousId: string; id: string };
export function terminalLineId(text: string, duplicateIndex?: number): string;
export class TerminalLineAnchors {
  readonly events: SignalCreator<TerminalLineAnchorEvent[]>;
  readonly visible: Signal<VisibleTerminalLine[]>;
  readonly settled: Signal<boolean>;
  elementsByBufferRow: Map<number, HTMLElement>;
  frame: number;
  lifetime: Subscription;
  previousTop: number;
  constructor(readonly term: Terminal, readonly viewport: XtermViewport);
  schedule(): void;
  refresh(): void;
  elementForBufferRow(row: number): HTMLElement | null;
  dispose(): void;
}
```

```ts
// Current signature: 0_terminalTurnVisibility.ts, public surface.
export { normalizeTurnLine } from "./0a_terminalTurnMatching";
export type BoopTurn = {
  session: string; harness: string; turn: number; ts: number; role: string; said: string;
  session_scope?: "root" | "child" | "unknown"; parent_session?: string | null;
};
export type VisibleTurn = BoopTurn & {
  id: string; bufferStart: number; bufferEnd: number; anchorStart: number; anchorEnd: number;
  regions: ProjectedTurnRegion[]; confidence: "anchored" | "extended";
  source: "xterm+boop" | "xterm+tmux+boop";
  clippedAbove?: boolean; clippedBelow?: boolean;
};
export type TurnVisibilityEvent = {
  visible: VisibleTurn[]; entered: VisibleTurn[]; exited: VisibleTurn[];
};
export function selectProjectionTurns(direct: BoopTurn[], candidates: BoopTurn[]): BoopTurn[];
export function tmuxConfirms(lines: LogicalLine[], tmuxCapture: string): boolean;
export function dropTmuxStatusRow(lines: LogicalLine[], tmuxCapture: string): LogicalLine[];
export type TerminalInputRegion = { start: number; end: number };
export function terminalInputRegion(harness: string, lines: LogicalLine[]): TerminalInputRegion | null;
export function dropTerminalInputRows(lines: LogicalLine[], harness: string): LogicalLine[];
export function locateVisibleTurns(lines: LogicalLine[], turns: BoopTurn[], tmuxCapture?: string): VisibleTurn[];
export function extendTo(
  screen: { start: number; end: number; normalized: string }[],
  anchor: number, limit: number, step: 1 | -1,
): number;
export type TurnSpan = Omit<VisibleTurn, "regions" | "source">;
export type TurnLocator = (lines: LogicalLine[], turns: BoopTurn[]) => Promise<TurnSpan[]>;
export const TURN_ACTIVITY_POLL_MS: 1_000;
export const TURN_ACTIVITY_LEASE_MS: 5_000;
export function attachTurnRegions(spans: TurnSpan[], lines: LogicalLine[], tmuxBacked?: boolean): VisibleTurn[];
export class TerminalTurnVisibilityV2 {
  updates: Subject<TurnVisibilityEvent>;
  readonly changes: Observable<TurnVisibilityEvent>;
  settles: Subject<void>;
  readonly settled: Observable<void>;
  visible: VisibleTurn[];
  generation: number;
  viewportRevision: number;
  frame: number;
  disposed: boolean;
  scanning: boolean;
  rescanPending: boolean;
  activityAt: number;
  subscription: Subscription;
  constructor(
    readonly viewport: XtermViewport,
    readonly turns: () => Promise<BoopTurn[]>,
    readonly tmux?: TmuxPane,
    readonly locate?: TurnLocator,
    readonly ingest?: () => void,
  );
  ingestVisible(): void;
  schedule(): void;
  scan(supplied?: BoopTurn[]): Promise<void>;
  located(paneLines: LogicalLine[], turns: BoopTurn[], tmuxCapture: string, harness?: string): Promise<VisibleTurn[]>;
  bufferRowAtClientPoint(clientY: number): number | null;
  turnAtBufferRow(bufferRow: number): VisibleTurn | null;
  turnAtClientPoint(clientX: number, clientY: number): VisibleTurn | null;
  regionAtClientPoint(clientX: number, clientY: number): ProjectedTurnRegion | null;
  dispose(): void;
}
```

```ts
// Current signature: 0_terminalWheel.ts, 0_terminalPinnedSelection.ts, 0b_ompTurnBinding.ts.
export type TerminalMouseMode = Terminal["modes"]["mouseTrackingMode"];
export type TerminalWheelState = { mouseMode: TerminalMouseMode; native: boolean; wheels: number };
export type TerminalWheelEvent =
  | { type: "sync"; mouseMode: TerminalMouseMode }
  | { type: "wheel"; mouseMode: TerminalMouseMode; bypass?: boolean };
export const initialTerminalWheelState: TerminalWheelState;
export function reduceTerminalWheel(state: TerminalWheelState, event: TerminalWheelEvent): TerminalWheelState;
export class TerminalWheelRouter {
  events: Subject<TerminalWheelEvent>;
  state: BehaviorSubject<TerminalWheelState>;
  subscription: Subscription;
  parsed: { dispose(): void };
  wheelRows: number;
  wheelFrame: number;
  constructor(
    readonly term: Terminal,
    readonly scrollTmux: (up: boolean, lines: number) => void,
    readonly activity: () => void,
  );
  sync(): void;
  wheel(event: WheelEvent): boolean;
  dispose(): void;
}
export type SelectionCell = { row: number; col: number };
export type PinnedSelection = { anchor: SelectionCell; focus: SelectionCell };
export type PinnedRowSpan = { row: number; startCol: number; endCol: number };
export function orderedSelection(selection: PinnedSelection): PinnedSelection;
export function pinnedRowSpans(selection: PinnedSelection, cols: number): PinnedRowSpan[];
export function wordSpanAt(text: string, col: number): { startCol: number; endCol: number } | null;
export function lineSpanAt(text: string): { startCol: number; endCol: number } | null;
export function isEmptySelection(selection: PinnedSelection): boolean;
export function joinPinnedRows(rows: string[]): string;
export type PinnedSelectionOptions = { copy: (text: string) => void };
export class TerminalPinnedSelection {
  readonly root: HTMLElement;
  selection: PinnedSelection | null;
  captured: string[];
  anchor: SelectionCell | null;
  dragging: boolean;
  frame: number;
  render: IDisposable;
  resize: IDisposable;
  readonly onMouseDown: (event: MouseEvent) => void;
  readonly onMouseMove: (event: MouseEvent) => void;
  readonly onMouseUp: (event: MouseEvent) => void;
  constructor(readonly term: Terminal, readonly host: HTMLElement, readonly options: PinnedSelectionOptions);
  geometry(): { left: number; top: number; pageLeft: number; pageTop: number; cellWidth: number; cellHeight: number };
  cellAt(clientX: number, clientY: number): SelectionCell;
  rowText(span: PinnedRowSpan): string;
  text(): string;
  hasSelection(): boolean;
  appOwnsMouse(): boolean;
  mouseDown(event: MouseEvent): void;
  selectSpan(row: number, span: { startCol: number; endCol: number } | null): void;
  selectWordAt(cell: SelectionCell): void;
  selectLineAt(cell: SelectionCell): void;
  mouseMove(event: MouseEvent): void;
  mouseUp(event: MouseEvent): void;
  settle(): void;
  capture(): void;
  schedule(): void;
  syncToBuffer(): void;
  paint(): void;
  clear(): void;
  dispose(): void;
}
export type OmpTurnSources = { direct: BoopTurn[]; candidates: BoopTurn[] };
export function projectionTurnSources(
  harness: HarnessId | null, boundSession: string | null,
  paneTurns: BoopTurn[], tabTurns: BoopTurn[], candidates: BoopTurn[],
): OmpTurnSources;
```

```ts
// Proposed public signatures; existing pure signatures in the current column
// retain their parameters and bodies. Imports are from @hafley66/signals and rxjs.
export type PaneIdentity = {
  id: string;
  target: string;
  socket: string | null;
};
export type PaneSessionBinding = { session: string; harness: string | null };
export type BoopSyncStat = { written: number; dropped: number };
export type ViewportPoint = { clientX: number; clientY: number };
export type ViewportSnapshot = {
  change: ViewportChange;
  lines: LogicalLine[];
  visible: boolean;
};
export type SelectionState = {
  selection: PinnedSelection | null;
  captured: string[];
  anchor: SelectionCell | null;
  dragging: boolean;
};
export type PaneRuntimeState = {
  viewportRevision: number;
  scan: {
    generation: number;
    running: boolean;
    pending: boolean;
    activityAt: number;
  };
  anchors: { previousTop: number };
  turns: { recentSince: number };
  wheel: { accumulatedRows: number };
  selection: SelectionState;
};
export type TurnVisibilityState = {
  visible: VisibleTurn[];
};
export type LineAnchorState = {
  visible: VisibleTerminalLine[];
  settled: boolean;
  elementsByBufferRow: ReadonlyMap<number, HTMLElement>;
};
export type BoopXtermPorts = {
  boop_mux_session: Endpoint<{ target: string; socket: string | null }, PaneSessionBinding | null>;
  boop_mux_capture: Endpoint<{ target: string; socket: string | null }, string>;
  boop_turns: Endpoint<{ session: string }, BoopTurn[]>;
  boop_turns_recent: Endpoint<{ since: number; harness: string }, BoopTurn[]>;
  boop_sync_session: Endpoint<{ session: string; harness: string }, BoopSyncStat>;
  boop_locate_turns: Endpoint<{ lines: LogicalLine[]; turns: BoopTurn[] }, TurnSpan[]>;
  scroll_session: Endpoint<{ name: string; up: boolean; lines: number }, void>;
  paneVisible: SignalSource<boolean>;
  paneClosed: SignalSource<boolean>;
  harness: SignalSource<HarnessId | null>;
  clipboardEnabled: SignalSource<boolean>;
  tabSessionIds: SignalSource<string[]>;
  scanRequested: Signal<void | undefined>;
  pointQuery: Signal<ViewportPoint | undefined>;
  selectionClear: Signal<void | undefined>;
};
export type ViewportModel = {
  snapshot: Signal<ViewportSnapshot>;
  changes: Signal<ViewportChange | undefined>;
  bufferRowAtPoint: Observable<{ point: ViewportPoint; row: number | null }>;
  effects: Observable<void>;
};
export type LineAnchorModel = {
  state: Signal<LineAnchorState>;
  events: Signal<TerminalLineAnchorEvent[] | undefined>;
  effects: Observable<void>;
};
export type TurnVisibilityModel = {
  state: Signal<TurnVisibilityState>;
  scanning: Signal<boolean>;
  changes: Signal<TurnVisibilityEvent | undefined>;
  settled: Signal<void | undefined>;
  turnAtPoint: Observable<{ point: ViewportPoint; turn: VisibleTurn | null }>;
  regionAtPoint: Observable<{ point: ViewportPoint; region: ProjectedTurnRegion | null }>;
  effects: Observable<void>;
};
export type WheelModel = {
  state: Signal<TerminalWheelState>;
  activity: Signal<void | undefined>;
  effects: Observable<void>;
};
export type PinnedSelectionModel = {
  text: Signal<string>;
  copy: Signal<string | undefined>;
  effects: Observable<void>;
};
export type BoopXtermPane = {
  runtime: Signal<PaneRuntimeState>;
  paneSession: Query<{ target: string; socket: string | null }, PaneSessionBinding | null>;
  viewport: ViewportModel;
  anchors: LineAnchorModel;
  visibility: TurnVisibilityModel;
  wheel: WheelModel;
  pinned: PinnedSelectionModel;
  effects: Observable<void>;
};
export function viewportStream(
  term: Terminal, runtime: Signal<PaneRuntimeState>, ports: BoopXtermPorts,
): ViewportModel;
export function paneSessionStream(
  identity: PaneIdentity, ports: BoopXtermPorts,
): Query<{ target: string; socket: string | null }, PaneSessionBinding | null>;
export function lineAnchorsStream(
  term: Terminal, viewport: ViewportModel,
  runtime: Signal<PaneRuntimeState>, ports: BoopXtermPorts,
): LineAnchorModel;
export function turnVisibilityStream(
  term: Terminal, identity: PaneIdentity, viewport: ViewportModel,
  paneSession: Query<{ target: string; socket: string | null }, PaneSessionBinding | null>,
  runtime: Signal<PaneRuntimeState>, ports: BoopXtermPorts,
): TurnVisibilityModel;
export function wheelStream(
  term: Terminal, identity: PaneIdentity,
  runtime: Signal<PaneRuntimeState>, ports: BoopXtermPorts,
): WheelModel;
export function pinnedSelectionStream(
  term: Terminal, host: HTMLElement,
  runtime: Signal<PaneRuntimeState>, ports: BoopXtermPorts,
): PinnedSelectionModel;
export function createBoopXtermPane(
  term: Terminal, host: HTMLElement, identity: PaneIdentity, ports: BoopXtermPorts,
): BoopXtermPane;
```

| Port field | Rust command in `generated/native.ts` | Domain input `I` | Domain output `O` | Primitive |
| --- | --- | --- | --- | --- |
| `boop_mux_session` | `boop_mux_session` | `{ target: string; socket: string \| null }` | `PaneSessionBinding \| null` | `createQuery`, 1s unknown / 5s known polling |
| `boop_mux_capture` | `boop_mux_capture` | `{ target: string; socket: string \| null }` | `string` | `createQuery`, activity lease polling |
| `boop_turns` | `boop_turns` | `{ session: string }` | `BoopTurn[]` | `createQuery` |
| `boop_turns_recent` | `boop_turns_recent` | `{ since: number; harness: string }` | `BoopTurn[]` | `createQuery` |
| `boop_sync_session` | `boop_sync_session` | `{ session: string; harness: string }` | `BoopSyncStat` | `createMutation` |
| `boop_locate_turns` | `boop_locate_turns` | `{ lines: LogicalLine[]; turns: BoopTurn[] }` | `TurnSpan[]` | `createQuery` |
| `scroll_session` | `scroll_session` | `{ name: string; up: boolean; lines: number }` | `void` | `createMutation` |

| Other public function-typed parameter | Disposition | Source |
| --- | --- | --- |
| None | `Endpoint` config, `Signal(() => ...)`, `signalMap`, and `QueryOptions.refetchInterval` accept functions inside the signals API; wave 2 public function parameters contain no function type. | `packages/signals/src/3_Endpoint.ts:33-38`; `2_Signal.ts:45-50`; `7_signalMap.ts:7-9`; `4_Query.ts:44-58` |

## 2. Pseudo-code bodies

```ts
// createBoopXtermPane(term, host, identity, ports)
// Create one Signal(value) root for PaneRuntimeState, once per pane lifetime.
// Convert host SignalSource inputs with toSignal; preserve existing Signal identity.
// Build the six models and one paneSession Query from the same root and ports.
// Merge their effects with observations of paneSession.$, viewport.snapshot.$,
// anchors.state.$, visibility.state.$, wheel.state.$ and pinned.text.$;
// ignore state emissions after connecting the producers.
// takeUntil(paneClosed.$.pipe(filter(Boolean))) on that stream; share() once at root.
// Return grouped root, query, models, and effects. No runtime work at construction.

// viewportStream(term, runtime, ports)
// new Observable for onWriteParsed, onScroll, onResize; each native registration
// returns teardown that calls its own registration.dispose() at the direct site.
// merge events, map ViewportChange, share(); tap increments runtime.viewportRevision.
// signalMap over events reads paneVisible.$() and xterm buffer to build snapshot.
// Signal(snapshot$, initialSnapshot) owns the lazy, shared viewport state.
// Bare Signal<ViewportChange>() is the transient changes event; tap writes it.
// pointQuery.$ maps xterm geometry to buffer row; share(); close via takeUntil.

// paneSessionStream(identity, ports)
// createQuery(ports.boop_mux_session, {target, socket}, {
//   cacheTime: 0, staleTime: 0,
//   refetchInterval: state => state.isError || !state.data?.session ? 1000 : 5000,
//   pauseWhen: panePaused.$,
// });
// Query data is the binding source of truth; no copied session fields.
// Distinct session+harness projection drives host binding updates.

// lineAnchorsStream(term, viewport, runtime, ports)
// merge initial viewport snapshot and later semantic changes; share().
// auditTime(0, animationFrameScheduler) refresh branch, debounceTime(80) settled branch.
// scan previous visible/top into line IDs, entered/moved/changed/exited events.
// Signal(projected$, initialLineAnchorState) holds the observable-backed state.
// Bare Signal<TerminalLineAnchorEvent[]>() emits transient event batches.
// tap stamps xterm row data and anchor-name; finalize removes those stamps.
// runtime.anchors.previousTop is the scan's one retained top value.

// turnVisibilityStream(term, identity, viewport, paneSession, runtime, ports)
// Signal(() => paneSession.isError.$() ? null : paneSession.data.$() ?? null)
// names the reused binding value and preserves current error-to-null behavior.
// createQuery(ports.boop_turns, computed pane-session input, {staleTime:1000}).
// For tabSessionIds, switchMap to combineLatest of per-session boop_turns queries.
// createQuery(ports.boop_turns_recent, {since: now-6h,harness}, {staleTime:10000});
// if the recent result is empty, set a grouped fallback-since value to 0 and
// issue the unbounded query; create boop_turns queries for candidate sessions.
// A harness change resets runtime.turns.recentSince to the six-hour floor.
// projectionTurnSources and selectProjectionTurns remain pure selection stages.
// debounceTime(120) writes; immediate scroll/resize/manual scan triggers.
// createQuery(ports.boop_mux_capture, {target,socket}, {
//   cacheTime:0, refetchInterval: state => activeLease ? 1000 : false,
//   pauseWhen: paneHiddenOrLeaseExpired$,
// });
// pauseWhen uses paneVisible plus switchMap(timer(5000)) from write/scroll activity;
// no free-running scan clock. Trigger query.refetch() from tap for nonwrite changes.
// Query polling drops a tick during an active request; scan state coalesces one
// pending immediate trigger while capture/turn/locator work is in flight.
// After capture and turns settle, dropTmuxStatusRow once, then
// createQuery(ports.boop_locate_turns, {lines:paneLines,turns}, {cacheTime:0}).
// Native locator gets untrimmed composer rows; local fallback gets trimmed rows.
// On locator query error, use locateVisibleTurns; on success attachTurnRegions.
// filter stale viewportRevision/generation, scan previous visible to changes.
// Signal(projected$, initialTurnVisibilityState) owns retained projection.
// Bare Signal<TurnVisibilityEvent>() and Signal<void>() carry changes/settled.
// filter defined pointQuery events; signalMap reads state.visible.$() for
// point and region outputs.
// scanning aliases runtime.scan.running, rather than storing a second boolean.
// sync trigger uses write debounce and active lease, throttleTime(1000),
// filter paneSession.data and harness, exhaustMap per-trigger
// createMutation(ports.boop_sync_session, {session,harness}) until terminal state.
// tap on written+dropped > 0 invalidates turn queries and refetches capture.
// takeUntil(paneClosed true), finalize cancels the active scan graph.

// wheelStream(term, identity, runtime, ports)
// new Observable adapts onWriteParsed, with native dispose in its teardown.
// The custom wheel handler is owned by the Terminal lifetime if xterm has no remover.
// handler computes native/Shift return synchronously; emit event synchronously.
// merge initial sync, parsed sync, wheel; scan(reduceTerminalWheel).
// Signal(state$, initialTerminalWheelState) owns retained wheel state.
// Bare Signal<void>() emits activity on each wheel via tap.
// For app-owned wheels, normalize deltaMode, scan rows per animation frame,
// auditTime(0, animationFrameScheduler), clamp 1..50.
// concatMap each scroll to createMutation(ports.scroll_session, input).$
// until success/error; serializes frames because mutation input switchMap cancels.
// tap preventDefault before handler returns; takeUntil pane close; finalize teardown.

// pinnedSelectionStream(term, host, runtime, ports)
// defer overlay root creation; xdom event streams for mousedown/move/up;
// new Observable adapters for onRender/onResize, each with native teardown.
// merge click, drag, render, resize, selectionClear; scan transitions into
// runtime.selection nested paths, one grouped state root and no copies.
// Signal(() => joinPinnedRows(runtime.selection.captured.$())) names reused text.
// Bare Signal<string>() emits a finished nonempty copy, gated by clipboardEnabled.
// auditTime(0, animationFrameScheduler) for paint; tap paints or clears DOM.
// finalize removes overlay and document listeners; takeUntil pane close.
```

## 3. Instance timelines

| Current class | Current creation / storage / end | Proposed activation | Proposed completion |
| --- | --- | --- | --- |
| `XtermViewportAdapter` | `terminal.ts:771`; xterm registrations plus close event; `terminal.ts:630,1346` calls teardown | First observation of `viewport.snapshot` or pane `effects` connects cold adapters | `paneClosed` true or final observer leaving calls xterm registration teardowns |
| `NativeTmuxPane` | `terminal.ts:772`; session ID, timestamp, binding, callback; abandoned with tab | Observation of `paneSession.$` connects `boop_mux_session` query | `paneClosed` or final query observer leaving cancels transport and polling |
| `TerminalLineAnchors` | `terminal.ts:826`; signals, DOM row map, frame, lifetime; `terminal.ts:626,1342` tears down | Observation of `anchors.state` or pane `effects` connects viewport projection | Pane close or final observer leaving cancels frame and removes row stamps |
| `TerminalTurnVisibilityV2` | `terminal.ts:777`; visible turns, scan flags, lease, subscriptions; `terminal.ts:629,1345` tears down | Observation of visibility state or pane effects connects query chain | Pane close or final observer leaving cancels in-flight query observations and frames |
| `TerminalWheelRouter` | `terminal.ts:891`; event/state holders, xterm handlers, frame; `terminal.ts:632,1348` tears down | Observation of wheel state or pane effects connects handlers and mutation chain | Pane close releases parsed registration and frame; `term.dispose()` ends the custom wheel handler |
| `TerminalPinnedSelection` | `terminal.ts:901`; DOM root, selection, capture, listeners, frame; `terminal.ts:633,1349` tears down | Observation of pinned text/copy or pane effects creates overlay and listeners | Pane close or final observer leaving removes root/listeners and cancels frame |

```text
viewport source       --w---s-r--------|   w=write s=scroll r=resize
viewport snapshot     v-v---v-v--------|   Signal(source$, initial)
session query         q---q------q-----|   q=Endpoint execute; interval 1s/5s
session binding       n---b------------|   n=null b=known binding
anchors state         a--a---a---a-----|   a=projected visible lines
anchors settled       t--f---f---t-----|   80ms quiet branch restores true
capture query         q---q---q--------|   write/scroll/active lease
visibility state      v------v-----v---|   stale generation yields no change
visibility settled    -----s------s----|   completion or discard emits s
sync mutation         ----m------m-----|   m=boop_sync_session write
wheel state           n---w-w----------|   n=initial; w=wheel reduction
scroll mutation       -----m-m---------|   serialized frame requests
pinned state          n--d-m-u--c------|   drag then clear
pinned copy           -------t---------|   t=finished nonempty text
```

| Signal kind | Fields / outputs | Connection rule |
| --- | --- | --- |
| `Signal(value)` | One `PaneRuntimeState` root: scan control, viewport revision, anchor top, wheel accumulation, selection | Constructed once per pane; nested paths are direct projections. |
| `Signal(source$, initial)` | Viewport snapshot, line-anchor state, turn-visibility state, wheel state | Connect on first reader, ref-counted source; initial values support first JSX render. |
| `Signal(() => derived)` | Pane active, effective session binding, selected text, OMP turn source selection | Tracks signal reads; no copied holder for query or source state. |
| `signalMap` | Viewport event plus `paneVisible` and point query plus latest visible turns | Tracks the host signal read while retaining source emission semantics. |
| Bare `Signal<Event>()` | Viewport changes, anchor event batches, turn changes/settled, wheel activity, pinned copy | Transient, no replay to a late reader. |

## 4. Storage and sequence

| Current mutable field | Source | R2 owner / kind | Read then write order | Uniqueness condition |
| --- | --- | --- | --- | --- |
| `closed` | `00a_terminalIntersection.ts:27` | Host `paneClosed: SignalSource<boolean>` | Observe false then true; `takeUntil` ends each cold source | One pane close transition per pane ID |
| `session_id`, `session_read_at`, `session_binding` | `00a_terminalIntersection.ts:102-104` | `boop_mux_session` Query state; derived binding `Signal(() => ...)` | Query reads endpoint result; interval is 5s known, 1s null/error; distinct session/harness emits host binding | Endpoint key includes target and socket; no second binding copy |
| `events`, `visible`, `settled` | `00b_terminalLineAnchors.ts:27-29` | Bare event signal; `Signal(source$, initial)` line state | Snapshot, duplicate indices, compare prior, emit batch, settle after 80ms | Line ID hashes text plus duplicate index within viewport |
| `elementsByBufferRow` | `00b_terminalLineAnchors.ts:30` | Nested line-state map in source signal | Build row map from visible xterm DOM, stamp, publish with lines | One element per visible buffer row |
| `frame`, `lifetime`, `previousTop` | `00b_terminalLineAnchors.ts:31-33` | Animation scheduler; returned effects connection; `runtime.anchors.previousTop` | Coalesce frame, compare top, write top, emit jump | One pending frame per pane |
| `updates`, `settles`, `visible` | `0_terminalTurnVisibility.ts:293-299` | Bare change/settled signals; `Signal(source$, initial)` visibility | Complete scan, compare IDs/content, emit changed projection and settle | Turn ID is `session:turn` |
| `generation`, `viewportRevision` | `0_terminalTurnVisibility.ts:300-301` | `runtime.scan.generation`, `runtime.viewportRevision` | Increment at new scan/change, capture at query start, reject stale result | Generation monotonic within one pane lifetime |
| `frame`, `disposed`, `scanning`, `rescanPending` | `0_terminalTurnVisibility.ts:302-305` | Animation scheduler, `paneClosed`, nested `runtime.scan` | Gate hidden, start one scan, set pending during flight, settle, start pending next frame | At most one running scan and one pending trigger |
| `activityAt`, `subscription` | `0_terminalTurnVisibility.ts:306-307` | `runtime.scan.activityAt`; query `refetchInterval` / `pauseWhen`; outer effect connection | Write/scroll updates time; lease stream unpauses query; teardown releases poll | 5s lease, no free-running interval source |
| Candidate fallback floor | `favorites.ts:160-186`; `terminal.ts:785` | `runtime.turns.recentSince` in the grouped root | Start at now minus six hours, retry at zero after empty recent result, reset on harness change | One candidate floor per pane and harness |
| `events`, `state`, `subscription` | `0_terminalWheel.ts:37-39` | Bare event signal; `Signal(source$, initial)` wheel state; outer effect connection | Sync or wheel event, pure reducer, publish state | One wheel state per pane |
| `parsed`, `wheelRows`, `wheelFrame` | `0_terminalWheel.ts:40-42` | Native Observable teardown; `runtime.wheel.accumulatedRows`; animation scheduler | Normalize deltas, accumulate, emit one capped command, reset rows | One scroll mutation per nonzero frame; `concatMap` preserves order |
| `root`, `selection`, `captured`, `anchor`, `dragging` | `0_terminalPinnedSelection.ts:70-74` | DOM resource in `defer`; nested `runtime.selection` paths | Press, capture buffer text, drag, settle, copy | One overlay root per connected pane |
| `frame`, `render`, `resize`, mouse handlers | `0_terminalPinnedSelection.ts:75-80` | Animation scheduler, xdom/Observable registration teardowns | Repaint or resize, verify captured text, clear or paint | One pending paint frame; drag listeners only while dragging |

## 5. Callback ledger

| Current callback or imperative call | File:line | R2 replacement | Direction |
| --- | --- | --- | --- |
| `register(emit)` for write/scroll/resize | `00a_terminalIntersection.ts:37-45` | Cold `new Observable` adapters; native `dispose()` in each source teardown | host->pkg |
| `onSessionBinding(binding)` | `00a_terminalIntersection.ts:107,129`; `terminal.ts:775` | Derived `paneSession.data` stream, host `tap(setPaneSessionBinding)` | pkg->host |
| `captureVisible()` | `00a_terminalIntersection.ts:97,111` | `createQuery(ports.boop_mux_capture, inputSignal, options)` | pkg->host->pkg |
| `session()` | `00a_terminalIntersection.ts:115`; `terminal.ts:780,807` | `createQuery(ports.boop_mux_session, inputSignal, options)` | pkg->host->pkg |
| `turns: () => Promise<BoopTurn[]>` | `0_terminalTurnVisibility.ts:312`; `terminal.ts:779-797` | `boop_turns` and `boop_turns_recent` queries plus host `tabSessionIds` | host->pkg |
| `TurnLocator` / `locate(lines, turns)` | `0_terminalTurnVisibility.ts:258,315,417`; `terminal.ts:799` | `createQuery(ports.boop_locate_turns, inputSignal, options)` | pkg->host->pkg |
| `ingest: () => void` | `0_terminalTurnVisibility.ts:319,352`; `terminal.ts:800` | `createMutation(ports.boop_sync_session, inputSignal)` | pkg->host->pkg |
| `scrollTmux(up, lines)` | `0_terminalWheel.ts:46,79`; `terminal.ts:893` | `createMutation(ports.scroll_session, inputSignal)` | pkg->host->pkg |
| `activity()` | `0_terminalWheel.ts:47,64`; `terminal.ts:894-897` | Bare `wheel.activity` event signal, host consumes in diagram/visibility stream | pkg->host |
| xterm parsed-write and custom wheel handlers | `0_terminalWheel.ts:52-53` | Cold xterm adapters with teardown; synchronous wheel return | host->pkg |
| `PinnedSelectionOptions.copy(text)` | `0_terminalPinnedSelection.ts:66`; `terminal.ts:903-907` | Bare `pinned.copy` event gated by `clipboardEnabled` | pkg->host |
| pinned mouse/render/resize handlers | `0_terminalPinnedSelection.ts:77-80,91-94` | xdom DOM event stream plus native Observable adapters | host->pkg |
| `XtermViewport.visible()` | `00a_terminalIntersection.ts:21,49` | Host `paneVisible: SignalSource<boolean>` | host->pkg |
| `readVisibleLogicalLines()` | `00a_terminalIntersection.ts:17,55` | `viewport.snapshot` signal, xterm read in source map | host->pkg |
| `bufferRowAtClientY(clientY)` | `00a_terminalIntersection.ts:18,77` | `pointQuery` event to `bufferRowAtPoint` stream | host->pkg->host |
| `lineAnchors.elementForBufferRow(row)` | `00b_terminalLineAnchors.ts:95` | `anchors.state.elementsByBufferRow.$()` path | pkg->host |
| `turnAtClientPoint` / `regionAtClientPoint` | `0_terminalTurnVisibility.ts:433-441`; `chrome.ts:377` | `pointQuery` to `turnAtPoint` / `regionAtPoint` | host->pkg->host |
| pinned `text()` / `hasSelection()` / `clear()` | `0_terminalPinnedSelection.ts:125-130,258`; `terminal.ts:1193-1194,1407,1423,1431,1445` | `pinned.text.$()`, `runtime.selection` paths, `selectionClear` event | pkg->host / host->pkg |
| `BoopConversation` Promise methods | `00a_terminalIntersection.ts:145-150` | Type-only interface retained; no wave 2 runtime call site | none |
| private `lastIndexWhere` predicate | `0_terminalTurnVisibility.ts:107-112` | Same private pure helper; no host effect or public function-typed parameter | internal |

## 6. Host composition sketch

```ts
// instant/src/terminal.ts, wave 2 composition sketch.
// Each constant below is a stable Endpoint instance made with existing generated API.
// Domain I types are the BoopXtermPorts field declarations in section 1.
const endpoint = <I extends NativeCommandInput, O>(name: CommandName): Endpoint<I, O> =>
  commandEndpoint<O>(name) as Endpoint<I, O>;
const ports: BoopXtermPorts = {
  boop_mux_session: endpoint<{ target: string; socket: string | null }, PaneSessionBinding | null>("boop_mux_session"),
  boop_mux_capture: endpoint<{ target: string; socket: string | null }, string>("boop_mux_capture"),
  boop_turns: endpoint<{ session: string }, BoopTurn[]>("boop_turns"),
  boop_turns_recent: endpoint<{ since: number; harness: string }, BoopTurn[]>("boop_turns_recent"),
  boop_sync_session: endpoint<{ session: string; harness: string }, BoopSyncStat>("boop_sync_session"),
  boop_locate_turns: endpoint<{ lines: LogicalLine[]; turns: BoopTurn[] }, TurnSpan[]>("boop_locate_turns"),
  scroll_session: endpoint<{ name: string; up: boolean; lines: number }, void>("scroll_session"),
  paneVisible: tabSignals.visible,
  paneClosed: tabSignals.closed,
  harness: tabSignals.harness,
  clipboardEnabled: settings.clipboardFromTerminal,
  tabSessionIds: tabSignals.sessionIds,
  scanRequested: tabSignals.scanRequested,
  pointQuery: tabSignals.pointQuery,
  selectionClear: tabSignals.selectionClear,
};
const pane = createBoopXtermPane(term, el, {
  id, target: tmuxTarget ?? name, socket: null,
}, ports);
const terminalEffects = merge(
  pane.effects,
  pane.paneSession.$.pipe(tap(state => setPaneSessionBinding(id, state.isError ? null : state.data ?? null))),
  pane.wheel.activity.$.pipe(tap(() => diagrams?.viewportScrolled())),
  pane.pinned.copy.$.pipe(tap(text => {
    if (text) void navigator.clipboard.writeText(text);
  })),
).pipe(takeUntil(tabSignals.closed.$.pipe(filter(Boolean))));
// terminal.ts returns terminalEffects as the pane's one composed stream.
// main.ts merges it with other app effects at its sole explicit root subscription.
// A later-wave JSX reader uses pane.visibility.state.visible.$(),
// pane.visibility.scanning.$(), pane.anchors.state.visible.$(),
// pane.wheel.state.native.$(), pane.pinned.text.$(), and
// pane.paneSession.data.$() in plain JSX under signalsJsx().
```

| Target boundary | Explicit root connections |
| --- | ---: |
| `packages/boop-xterm` source | 0 |
| `instant/src/main.ts` after app composition | 1 |

## 7. Test plan

```ts
// TestScheduler.run supplies virtual time and animation frames.
// A real Endpoint configured with a test EndpointTransport returns cold marble
// EndpointResponse streams; assertions inspect command URL, body, cancellation,
// and query/mutation state. No product module is mocked.
```

| Function | Case | Input marbles | Expected marbles | Why it exists |
| --- | --- | --- | --- | --- |
| `createBoopXtermPane` | cold until observed | pane `p---|`, reader `--r---u` | transport `--q--|` | A model allocation does not start commands or xterm listeners; last reader releases them |
| `viewportStream` | semantic events | xterm `--w-s-r-|` | snapshot `v-v-v-v-|` | Initial shape plus write, scroll, resize; one native registration each |
| `viewportStream` | close teardown | events `--w-s-r-`, close `----c` | snapshot `v-w-|` | No xterm reads after pane close |
| `paneSessionStream` | null then known | transport `--n--b`, virtual time `1s/5s` | poll `q-q-----q`, binding `--n--b` | Interval switches from 1s to 5s by Query state |
| `paneSessionStream` | hidden and resume | visibility `t--f----t`, response `--b` | poll `q-------q` | `pauseWhen` stops hidden polling and refetches stale binding on resume |
| `lineAnchorsStream` | renderer burst | viewport `--ww----|` | state `v--a----|`, settled `t--f--t-|` | Frame coalescing and 80ms quiet phase |
| `lineAnchorsStream` | duplicate text | rows `--(aa)-|` | IDs `--(a0a1)-|` | Duplicate index stays unique in viewport |
| `turnVisibilityStream` | stale scan | viewport `a---b---|`, locate `----A-b-|` | visible `------B-|`, settled `----s--s|` | Revision/generation guard discards stale result |
| `turnVisibilityStream` | in-flight activity | trigger `a-bc----|`, endpoint `----A---B|` | starts `a---b---|` | At most one pending scan survives a burst |
| `turnVisibilityStream` | locator error | locator `--#-|` | local visible `--v-|` | Pure fallback preserves composer trim |
| `turnVisibilityStream` | lease expires | activity `a------|`, virtual time `1s..5s` | capture `q-qqqqq-|` | Query polling ends after the activity lease |
| `turnVisibilityStream` | sync changes | mutation `--0--1--|` | capture refresh `-----q--|` | Only written/dropped count triggers reread |
| `wheelStream` | tracked mouse and Shift | wheels `--n-s--|` | scroll mutation `----m--|`, state `--N-S--|` | Native mouse forwarding and bypass |
| `wheelStream` | rapid frames | wheels `--(abc)de-|` | mutations `---m---n-|` | Frame aggregation and sequential writes |
| `pinnedSelectionStream` | drag/copy | mouse `--d-m-u-|` | text `------t-|`, copy `------c-|` | Finished text copied once |
| `pinnedSelectionStream` | repaint invalidation | mouse `--d-m-u-r-|` | text `------t-e|` | Changed buffer cells clear painted selection |
| `pinnedSelectionStream` | clear during drag | mouse `--d-m---|`, clear `----x` | copy `--------|` | Document drag listeners release without copying |
| `pinnedSelectionStream` | clipboard disabled | enabled `f-------|`, mouse `--d-m-u-|` | state `------s-|`, copy `--------|` | Highlight remains while host receives no copy event |

## 8. Open questions

| Question | Source |
| --- | --- |
| Does `attachCustomWheelEventHandler` replace an existing handler with a removable value? The current call stores no teardown token. | `0_terminalWheel.ts:53,83-89` |
| The wheel callback must return a boolean and prevent default synchronously. Confirm same-turn delivery through the connected effect stream. | `0_terminalWheel.ts:57-65` |
| `TerminalLineAnchors` hashes text into its ID but also emits `changed` for a stable ID with different text. Is that event reachable? | `00b_terminalLineAnchors.ts:24,71-83` |
| `BoopConversation` has no wave 2 runtime constructor or call site. Should its type-only export stay in the package surface? | `00a_terminalIntersection.ts:145-150` |
| `commandEndpoint<T>(name)` fixes input to `NativeCommandInput`; the host sketch narrows each domain input with an assertion. Should the generator add an input generic to remove those assertions? | `generated/native.ts:124-150`; `reactive/nativeTransport.ts:10` |
| Query polling drops ticks during an in-flight request, and refetch cancels the current request. Does the one-pending scan state need to retry after both capture and locator finish? | `packages/signals/src/4_Query.ts:190-225`; `0_terminalTurnVisibility.ts:359-379` |
