# boop-xterm wave 2 design

## 1. Type signatures

| Source exports | Current signature | Proposed signature |
| --- | --- | --- |
| `00a_terminalIntersection.ts`: `LogicalLine`, `ViewportChange`, `BoopFavorite` | Declarations below, unchanged | Re-export from `0_types.ts`; declarations below |
| `00a_terminalIntersection.ts`: `XtermViewport`, `XtermViewportAdapter` | Interface and class below | `viewportStream` and `ViewportSnapshot` below |
| `00a_terminalIntersection.ts`: `TmuxPane`, `NativeTmuxPane` | Interface and class below | `paneSessionStream` and IPC port streams below |
| `00a_terminalIntersection.ts`: `BoopConversation` | Interface below | Same type-only interface in `0_types.ts`; no implementation in this wave |
| `00b_terminalLineAnchors.ts`: `VisibleTerminalLine`, `TerminalLineAnchorEvent`, `terminalLineId` | Declarations below, unchanged | Same declarations in `1_lineAnchors.ts` |
| `00b_terminalLineAnchors.ts`: `TerminalLineAnchors` | Class below | `lineAnchorsStream` below |
| `0_terminalTurnVisibility.ts`: `normalizeTurnLine`, `BoopTurn`, `VisibleTurn`, `TurnVisibilityEvent`, `selectProjectionTurns`, `tmuxConfirms`, `dropTmuxStatusRow`, `TerminalInputRegion`, `terminalInputRegion`, `dropTerminalInputRows`, `locateVisibleTurns`, `extendTo`, `TurnSpan`, `TURN_ACTIVITY_POLL_MS`, `TURN_ACTIVITY_LEASE_MS`, `attachTurnRegions` | Declarations below, unchanged | Same declarations in `0_types.ts`, `0_turnMatching.ts`, and `1_turnVisibility.ts` |
| `0_terminalTurnVisibility.ts`: `TurnLocator`, `TerminalTurnVisibilityV2` | Alias and class below | `LocateTurnRequest`, `LocateTurnResponse`, `turnVisibilityStream` below |
| `0_terminalWheel.ts`: `TerminalMouseMode`, `TerminalWheelState`, `TerminalWheelEvent`, `initialTerminalWheelState`, `reduceTerminalWheel` | Declarations below, unchanged | Same declarations in `1_wheel.ts` |
| `0_terminalWheel.ts`: `TerminalWheelRouter` | Class below | `wheelStream` below |
| `0_terminalPinnedSelection.ts`: `SelectionCell`, `PinnedSelection`, `PinnedRowSpan`, `orderedSelection`, `pinnedRowSpans`, `wordSpanAt`, `lineSpanAt`, `isEmptySelection`, `joinPinnedRows` | Declarations below, unchanged | Same declarations in `1_pinnedSelection.ts` |
| `0_terminalPinnedSelection.ts`: `PinnedSelectionOptions`, `TerminalPinnedSelection` | Alias and class below | `pinnedSelectionStream` below |
| `0b_ompTurnBinding.ts`: `OmpTurnSources`, `projectionTurnSources` | Declarations below, unchanged | Same declarations in `0_turnMatching.ts` |
| New wave 2 export | No current signature | `BoopXtermPorts` below |

```ts
// Current: 00a_terminalIntersection.ts, public surface.
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
// Proposed unchanged exports: identical bodies and signatures move by layer.
export type LogicalLine = { text: string; start: number; end: number };
export type ViewportChange = {
  kind: "write" | "scroll" | "resize";
  cols: number; rows: number; viewportY: number; bufferLength: number;
};
export type BoopFavorite = {
  favorite_id: number; note: string; source: string; created_ts: number;
  bytes: number; body: string; tags?: string[];
};
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
export { normalizeTurnLine } from "./1_turnMatching.js";
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
export type TurnVisibilityEvent = { visible: VisibleTurn[]; entered: VisibleTurn[]; exited: VisibleTurn[] };
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
export const TURN_ACTIVITY_POLL_MS: 1_000;
export const TURN_ACTIVITY_LEASE_MS: 5_000;
export function attachTurnRegions(spans: TurnSpan[], lines: LogicalLine[], tmuxBacked?: boolean): VisibleTurn[];
export type TerminalMouseMode = Terminal["modes"]["mouseTrackingMode"];
export type TerminalWheelState = { mouseMode: TerminalMouseMode; native: boolean; wheels: number };
export type TerminalWheelEvent =
  | { type: "sync"; mouseMode: TerminalMouseMode }
  | { type: "wheel"; mouseMode: TerminalMouseMode; bypass?: boolean };
export const initialTerminalWheelState: TerminalWheelState;
export function reduceTerminalWheel(state: TerminalWheelState, event: TerminalWheelEvent): TerminalWheelState;
export type SelectionCell = { row: number; col: number };
export type PinnedSelection = { anchor: SelectionCell; focus: SelectionCell };
export type PinnedRowSpan = { row: number; startCol: number; endCol: number };
export function orderedSelection(selection: PinnedSelection): PinnedSelection;
export function pinnedRowSpans(selection: PinnedSelection, cols: number): PinnedRowSpan[];
export function wordSpanAt(text: string, col: number): { startCol: number; endCol: number } | null;
export function lineSpanAt(text: string): { startCol: number; endCol: number } | null;
export function isEmptySelection(selection: PinnedSelection): boolean;
export function joinPinnedRows(rows: string[]): string;
export type OmpTurnSources = { direct: BoopTurn[]; candidates: BoopTurn[] };
export function projectionTurnSources(
  harness: HarnessId | null, boundSession: string | null,
  paneTurns: BoopTurn[], tabTurns: BoopTurn[], candidates: BoopTurn[],
): OmpTurnSources;
```

```ts
// Current: 00b_terminalLineAnchors.ts, public surface.
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
// Current: 0_terminalTurnVisibility.ts, public surface.
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
// Current: 0_terminalWheel.ts, 0_terminalPinnedSelection.ts, 0b_ompTurnBinding.ts.
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
// Proposed: types in 0_types.ts and 1_*.ts; pure declarations above retain
// their exact signatures and bodies, including normalizeTurnLine's re-export.
export type PaneSessionBinding = { session: string; harness: string | null };
export type RpcResponse<T> =
  | { requestId: number; ok: true; value: T }
  | { requestId: number; ok: false; error: unknown };
export type ViewportSnapshot = {
  change: ViewportChange;
  lines: LogicalLine[];
  visible: boolean;
};
export type ViewportPoint = { clientX: number; clientY: number };
export type LocateTurnRequest = { requestId: number; lines: LogicalLine[]; turns: BoopTurn[] };
export type LocateTurnResponse = RpcResponse<TurnSpan[]>;
export type TurnSourceRequest = { requestId: number; paneId: string };
export type TurnSourceResponse = RpcResponse<{
  paneTurns: BoopTurn[]; tabTurns: BoopTurn[]; candidates: BoopTurn[];
}>;
export type PaneRequest = { requestId: number; target: string; socket: string | null };
export type WheelScrollRequest = { name: string; up: boolean; lines: number };
export type TurnVisibilityState = {
  visible: VisibleTurn[]; scanning: boolean; viewportRevision: number;
  generation: number; activityAt: number; rescanPending: boolean;
};
export type SelectionState = {
  selection: PinnedSelection | null; captured: string[];
  anchor: SelectionCell | null; dragging: boolean;
};
export type BoopXtermPorts = {
  pane_closed$: Observable<void>;
  pane_visible$: Observable<boolean>;
  activity_clock$: Observable<number>;
  scan_requested$: Observable<void>;
  point_query$: Observable<ViewportPoint>;
  selection_clear$: Observable<void>;
  clipboard_enabled$: Observable<boolean>;
  harness$: Observable<HarnessId | null>;
  boop_mux_capture: Observable<RpcResponse<string>>;
  boop_mux_session: Observable<RpcResponse<PaneSessionBinding | null>>;
  boop_turns: Observable<RpcResponse<BoopTurn[]>>;
  boop_turns_recent: Observable<RpcResponse<BoopTurn[]>>;
  boop_sync_session: Observable<RpcResponse<{ written: number; dropped: number }>>;
  boop_locate_turns: Observable<LocateTurnResponse>;
  turn_sources_response$: Observable<TurnSourceResponse>;
};
export type ViewportStreams = {
  changes$: Observable<ViewportChange>;
  snapshot$: Observable<ViewportSnapshot>;
  buffer_row_at_point$: Observable<{ point: ViewportPoint; row: number | null }>;
};
export type PaneSessionStreams = {
  boop_mux_session_request$: Observable<PaneRequest>;
  pane_session_binding$: Observable<PaneSessionBinding | null>;
  session_id$: Observable<string | null>;
};
export type LineAnchorStreams = {
  visible$: Observable<VisibleTerminalLine[]>;
  events$: Observable<TerminalLineAnchorEvent[]>;
  settled$: Observable<boolean>;
  element_by_buffer_row$: Observable<ReadonlyMap<number, HTMLElement>>;
  effects$: Observable<void>;
};
export type TurnVisibilityStreams = {
  state$: Observable<TurnVisibilityState>;
  changes$: Observable<TurnVisibilityEvent>;
  settled$: Observable<void>;
  turn_at_point$: Observable<{ point: ViewportPoint; turn: VisibleTurn | null }>;
  region_at_point$: Observable<{ point: ViewportPoint; region: ProjectedTurnRegion | null }>;
  boop_mux_capture_request$: Observable<PaneRequest>;
  turn_sources_request$: Observable<TurnSourceRequest>;
  boop_locate_turns_request$: Observable<LocateTurnRequest>;
  boop_sync_session_request$: Observable<{ session: string; harness: string }>;
  effects$: Observable<void>;
};
export type WheelStreams = {
  events$: Observable<TerminalWheelEvent>;
  state$: Observable<TerminalWheelState>;
  activity$: Observable<void>;
  scroll_session_request$: Observable<WheelScrollRequest>;
  effects$: Observable<void>;
};
export type PinnedSelectionStreams = {
  state$: Observable<SelectionState>;
  copy$: Observable<string>;
  text$: Observable<string>;
  effects$: Observable<void>;
};
export function viewportStream(term: Terminal, ports: BoopXtermPorts): ViewportStreams;
export function paneSessionStream(
  paneId: string, target: string, socket: string | null,
  ports: BoopXtermPorts,
): PaneSessionStreams;
export function lineAnchorsStream(
  term: Terminal, viewport: ViewportStreams, ports: BoopXtermPorts,
): LineAnchorStreams;
export function turnVisibilityStream(
  paneId: string, target: string, socket: string | null,
  viewport: ViewportStreams, pane: PaneSessionStreams,
  ports: BoopXtermPorts,
): TurnVisibilityStreams;
export function wheelStream(
  term: Terminal, name: string, ports: BoopXtermPorts,
): WheelStreams;
export function pinnedSelectionStream(
  term: Terminal, host: HTMLElement, ports: BoopXtermPorts,
): PinnedSelectionStreams;
export interface BoopConversation<TTurn> {
  readonly session: string;
  turns(): Promise<TTurn[]>;
  favorites(): Promise<BoopFavorite[]>;
  toggleFavorite(turn: TTurn): Promise<BoopFavorite[]>;
}
```

## 2. Pseudo-code bodies

```ts
// viewportStream(term, ports)
// defer registration of onWriteParsed, onScroll, onResize until effects$/snapshot$ is run;
// adapt each xterm registration to a cold Observable with its own teardown;
// merge write/scroll/resize, map each to one ViewportChange, share();
// withLatestFrom(pane_visible$), map to synchronous xterm logical lines and visibility;
// shareReplay({ bufferSize: 1, refCount: true }) after snapshot construction;
// point_query$ maps through xterm screen geometry; share();
// takeUntil(pane_closed$) on all three returned streams.

// paneSessionStream(paneId, target, socket, ports)
// merge(initial request, leased scan requests), scan requestId and TTL state;
// known session: 5000 ms TTL; null session: 1000 ms TTL;
// emit boop_mux_session_request$ only when TTL expires;
// match ports.boop_mux_session by requestId, convert errors to null;
// scan last binding; distinctUntilChanged on session and harness;
// shareReplay({ bufferSize: 1, refCount: true }) on session_id$ and binding$;
// takeUntil(pane_closed$), no command execution in this function.

// lineAnchorsStream(term, viewport, ports)
// merge(initial snapshot, viewport.snapshot$); share();
// immediate branch auditTime(0, animationFrameScheduler), map project lines/DOM row map;
// trailing branch debounceTime(80), map final project lines/DOM row map;
// merge branches; scan previousTop/visible to derive ordered events and equality;
// shareReplay({ bufferSize: 1, refCount: true }) on state after scan;
// visible$/events$/element_by_buffer_row$ derive from shared state, share();
// settled$ merges false on activity and true on trailing refresh, starts true;
// effects$ taps to stamp data attributes and anchor-name, removes stamps in finalize;
// takeUntil(pane_closed$) cancels frame and debounce scheduler work.

// turnVisibilityStream(paneId, target, socket, viewport, pane, ports)
// share() viewport.changes$; scan viewportRevision on every change;
// scan activityAt on write or scroll; filter activity_clock$ by 5000 ms lease;
// merge initial trigger, nonwrite changes, debounced write at 120 ms,
// leased clock ticks, scan_requested$, and successful sync results;
// gate triggers with pane_visible$; keep one pending bit during an active scan;
// auditTime(0, animationFrameScheduler) before scan start;
// scan state machine: idle -> running; running trigger -> pending=true;
// running completion -> emit settled, then schedule one pending run after observers paint;
// each run emits correlated boop_mux_capture_request$ and turn_sources_request$;
// join ports.boop_mux_capture / turn_sources_response$ by requestId;
// capture failure becomes empty string;
// dropTmuxStatusRow once; pass untrimmed pane rows to boop_locate_turns_request$;
// on ports.boop_locate_turns error use dropTerminalInputRows + locateVisibleTurns locally;
// attachTurnRegions with the composer-trimmed rows on native success;
// discard results when generation or viewportRevision changed;
// scan previous visible into entered/exited/changed; emit only changed projections;
// shareReplay({ bufferSize: 1, refCount: true }) after state scan;
// changes$ and settled$ derive from the shared state/event stream, share();
// boop_sync_session_request$ derives from debounced writes and leased ticks,
// gated by pane visibility and non-null session/harness, throttled to 1000 ms;
// sync response with written+dropped > 0 queues another scan;
// turn_at_point$/region_at_point$ combine point_query$ with latest visible state;
// takeUntil(pane_closed$) and refCount cancellation invalidate in-flight IDs.

// wheelStream(term, name, ports)
// defer xterm parsed-write registration and custom wheel handler registration;
// handler computes mouse mode and Shift bypass synchronously, emits event, returns
// true for native mouse forwarding or false for app scroll; no public callback;
// merge initial sync, parsed sync, wheel events; scan(reduceTerminalWheel);
// shareReplay({ bufferSize: 1, refCount: true }) after scan;
// wheel events map to activity$, share();
// app-owned wheels map deltaMode to rows, scan frame accumulator;
// auditTime(0, animationFrameScheduler), round/clamp 1..50, map to scroll_session_request$;
// effects$ taps preventDefault on app-owned wheel before xterm handler returns;
// takeUntil(pane_closed$), finalize xterm registration teardown where available.

// pinnedSelectionStream(term, host, ports)
// defer root DOM creation and mousedown/onRender/onResize registration;
// merge mouse down/move/up, render, resize, selection_clear$;
// scan SelectionState for capture, drag, click-count word/line, invalidation;
// shareReplay({ bufferSize: 1, refCount: true }) after scan;
// auditTime(0, animationFrameScheduler) render branch;
// effects$ taps paint/clear and registers document drag listeners only for drag;
// copy$ filters finished nonempty selections; withLatestFrom(clipboard_enabled$);
// text$ maps captured rows through joinPinnedRows; shareReplay(1, refCount);
// takeUntil(pane_closed$); finalize removes listeners, pending frame, and root.
```

## 3. Instance timelines

| Current class | Creation | Held while live | End | Proposed stream start | Proposed stream end |
| --- | --- | --- | --- | --- | --- |
| `XtermViewportAdapter` | `terminal.ts:771`, after `term.open` | `closed` Subject, merged xterm event registrations, `term` | `terminal.ts:630,1346` calls `dispose` | Root runs `viewport.snapshot$`/`changes$` through composed effects | `pane_closed$` or root unsubscribe tears down xterm registrations |
| `NativeTmuxPane` | `terminal.ts:772` | target/socket, cached session, read timestamp, binding callback | Abandoned with tab; no `dispose` | Root runs session request and binding streams | `pane_closed$` or root unsubscribe cancels response correlation |
| `TerminalLineAnchors` | `terminal.ts:826`; constructor refreshes immediately | three signals, DOM map, frame, previousTop, subscription | `terminal.ts:626,1342` | Root runs `lineAnchors.effects$`, projections shared with consumers | `pane_closed$` or root unsubscribe removes row stamps and frame work |
| `TerminalTurnVisibilityV2` | `terminal.ts:777`; constructor schedules immediately | Subjects, visible turns, revisions, generation, frame, lease and subscription | `terminal.ts:629,1345` | Root runs requests/effects and projection consumers | `pane_closed$` or root unsubscribe invalidates pending request IDs |
| `TerminalWheelRouter` | `terminal.ts:891`; constructor syncs immediately | event/state Subjects, xterm registration, wheel rows/frame, subscription | `terminal.ts:632,1348` | Root runs `wheel.effects$`, requests, activity, state | `pane_closed$` or root unsubscribe cancels frame and xterm registration |
| `TerminalPinnedSelection` | `terminal.ts:901`; constructor creates overlay | root, selection/captured/drag, render/resize registrations, mouse listeners/frame | `terminal.ts:633,1349` | Root runs `pinnedSelection.effects$`, state, copy | `pane_closed$` or root unsubscribe removes overlay and listeners |

```text
viewport changes       --w---s-r--------|     w=write s=scroll r=resize
viewport snapshot      --v---v-v--------|     snapshot on each semantic change
pane session requests  r----r-------r---|     r only after 1s unknown / 5s known TTL
pane binding           ----b-----------|     b only when session or harness changes
line anchor visible    v---v--v--------|     initial, next frame, 80ms settled
line anchor settled    t-f---f--t------|     false on activity, true after quiet
turn scan trigger      i--w---c--q-----|     i=initial w=write c=clock q=manual
turn visibility        ----V-----V-----|     stale revisions yield no V
turn settled           ----s-----s-----|     one s per completed/discarded scan
wheel state            n--w--w---------|     initial sync and every wheel
scroll request         ----r---r-------|     frame-coalesced rows
pinned state           n--d-m-u--x-----|     down/move/up and external clear
pinned copy            -------c--------|     finished nonempty selection
```

## 4. Storage and sequence

| Current storage | Location | Proposed owner | Read/write order | Uniqueness / lifetime condition |
| --- | --- | --- | --- | --- |
| `closed` Subject | intersection:27 | `pane_closed$` input | host close emits, `takeUntil` completes | one close per pane ID |
| `session_id`, `session_read_at`, `session_binding` | intersection:102-104 | `paneSessionStream` scan state | read TTL, request, correlate response, compare binding, write timestamp | one outstanding session lookup per pane; 5s known / 1s unknown |
| `events`, `visible`, `settled` signals | lineAnchors:27-29 | shared line state plus derived streams | snapshot, compute IDs, compare prior, emit events, set settled | line ID = text hash plus duplicate index within viewport |
| `elementsByBufferRow` | lineAnchors:30 | shared line state map | read xterm row elements, stamp, publish map | one element per visible buffer row |
| `frame`, `lifetime`, `previousTop` | lineAnchors:31-33 | animation scheduler, root subscription, scan state | coalesce frame, compare top, publish, cancel on teardown | one scheduled refresh per frame per pane |
| `updates`, `settles`, `visible` | turnVisibility:293-299 | shared projection state and derived streams | receive completed scan, diff IDs, emit changes and settle | turn ID = `session:turn` |
| `generation`, `viewportRevision` | turnVisibility:300-301 | scan state | increment revision on change, capture revision at scan read, reject mismatched completion | requestId and generation scoped to pane subscription |
| `frame`, `disposed`, `scanning`, `rescanPending` | turnVisibility:302-305 | scheduler and scan state | gate hidden, queue one frame, mark running, mark pending, settle, schedule pending | at most one active scan and one pending scan per pane |
| `activityAt`, `subscription` | turnVisibility:306-307 | scan state and root subscription | write/scroll time, lease comparison, root teardown | 5s lease, shared 1s clock |
| `events`, `state`, `subscription` | wheel:37-39 | `events$` and `scan(reduceTerminalWheel)` | sync/wheel event, reduce, replay latest | one wheel state per pane |
| `parsed`, `wheelRows`, `wheelFrame` | wheel:40-42 | deferred registration and frame accumulation | read delta, accumulate within frame, emit rounded capped scroll | one scroll request per nonzero frame |
| `root`, `selection`, `captured`, `anchor`, `dragging` | pinnedSelection:70-74 | subscription-owned DOM root plus `SelectionState` scan | press, capture rows, drag, settle, emit copy | one overlay root per active pane subscription |
| `frame`, `render`, `resize`, mouse handlers | pinnedSelection:75-80 | scheduler and deferred event registrations | render/resize invalidate or paint; teardown all listeners | one pending paint per frame; document listeners only during drag |

## 5. Callback ledger

| Callback / effect | File:line | Replacement stream | Direction |
| --- | --- | --- | --- |
| `register(emit)` and `emit` for write/scroll/resize | `00a_terminalIntersection.ts:37-45` | `viewport.changes$` via deferred xterm registration | host xterm -> pkg |
| `onSessionBinding(binding)` | `00a_terminalIntersection.ts:107,129`; `terminal.ts:775` | `pane_session_binding$` | pkg -> host |
| `captureVisible()` Promise method | `00a_terminalIntersection.ts:97,111` | `boop_mux_capture_request$` / `BoopXtermPorts.boop_mux_capture` | pkg -> host / host -> pkg |
| `session()` Promise method | `00a_terminalIntersection.ts:115`; `terminal.ts:780,807` | `boop_mux_session_request$` / `BoopXtermPorts.boop_mux_session` | pkg -> host / host -> pkg |
| `turns: () => Promise<BoopTurn[]>` | `0_terminalTurnVisibility.ts:312`; `terminal.ts:779-797` | `turn_sources_request$` / `turn_sources_response$`; host uses `boop_turns` and `boop_turns_recent` | pkg -> host / host -> pkg |
| `TurnLocator` / `locate(lines, turns)` | `0_terminalTurnVisibility.ts:258,315,417`; `terminal.ts:799` | `boop_locate_turns_request$` / `BoopXtermPorts.boop_locate_turns` | pkg -> host / host -> pkg |
| `ingest: () => void` | `0_terminalTurnVisibility.ts:319,352`; `terminal.ts:800` | `boop_sync_session_request$` / `BoopXtermPorts.boop_sync_session` | pkg -> host / host -> pkg |
| `scrollTmux(up, lines)` | `0_terminalWheel.ts:46,79`; `terminal.ts:893` | `scroll_session_request$` | pkg -> host |
| `activity()` | `0_terminalWheel.ts:47,64`; `terminal.ts:894-897` | `activity$` to diagram and scan trigger streams | pkg -> host |
| xterm parsed-write / custom wheel handlers | `0_terminalWheel.ts:52-53` | `wheel.events$`, `wheel.effects$` | host xterm -> pkg |
| `PinnedSelectionOptions.copy(text)` | `0_terminalPinnedSelection.ts:66`; `terminal.ts:903-907` | `copy$` plus `clipboard_enabled$` | pkg -> host / host -> pkg |
| pinned mouse/render/resize handlers | `0_terminalPinnedSelection.ts:77-80,91-94` | `pinnedSelection.state$` and `effects$` | host DOM/xterm -> pkg |
| `XtermViewport.visible()` | `00a_terminalIntersection.ts:21,49`; `0_terminalTurnVisibility.ts:350,366` | `pane_visible$` | host -> pkg |
| `XtermViewport.readVisibleLogicalLines()` | `00a_terminalIntersection.ts:17,55`; `0_terminalTurnVisibility.ts:392` | `viewport.snapshot$` | host xterm -> pkg |
| `XtermViewport.bufferRowAtClientY(clientY)` | `00a_terminalIntersection.ts:18,77`; `0_terminalTurnVisibility.ts:426` | `point_query$` / `buffer_row_at_point$` | host -> pkg / pkg -> host |
| `lineAnchors.elementForBufferRow(row)` | `00b_terminalLineAnchors.ts:95` | `element_by_buffer_row$` | pkg -> host |
| `turnAtClientPoint` / `regionAtClientPoint` | `0_terminalTurnVisibility.ts:433-441`; `chrome.ts:377` | `point_query$` / `turn_at_point$` / `region_at_point$` | host -> pkg / pkg -> host |
| pinned `text()` / `hasSelection()` / `clear()` | `0_terminalPinnedSelection.ts:125-130,258`; `terminal.ts:1193-1194,1407,1423,1431,1445` | `text$`, `state$`, `selection_clear$` | pkg -> host / host -> pkg |

## 6. Host composition sketch

```ts
// instant/src/terminal.ts; design sketch, one pane scope under the app root.
// All native command names below are the Rust/IPC spellings.
// `requestBus` subjects belong to instant and only bridge output requests to
// native response Observables; no package owns or executes invoke.
// const boop_mux_capture = requestBus.boop_mux_capture$.pipe(
//   mergeMap(({ requestId, target, socket }) =>
//     from(invoke<string>("boop_mux_capture", { target, socket })).pipe(
//       map(value => ({ requestId, ok: true as const, value })),
//       catchError(error => of({ requestId, ok: false as const, error })),
//     ))), share());
// Repeat for boop_mux_session, boop_turns, boop_turns_recent,
// boop_sync_session, boop_locate_turns; scroll_session is an output effect.
// turn_sources_response$ preserves the existing favorites.ts cache, tab-session
// aggregation, candidate window, projectionTurnSources, selectProjectionTurns.
// Its host construction reads boop_turns and boop_turns_recent responses;
// request IDs distinguish pane, tab, and candidate reads for the same pane.
// const ports: BoopXtermPorts = { pane_closed$, pane_visible$, activity_clock$,
//   scan_requested$, point_query$, selection_clear$, clipboard_enabled$, harness$,
//   boop_mux_capture, boop_mux_session, boop_turns, boop_turns_recent,
//   boop_sync_session, boop_locate_turns,
//   turn_sources_response$ };
// const viewport = viewportStream(term, ports);
// const pane = paneSessionStream(id, tmuxTarget ?? name, null, ports);
// const anchors = lineAnchorsStream(term, viewport, ports);
// const visibility = turnVisibilityStream(id, tmuxTarget ?? name, null, viewport, pane, ports);
// const wheel = wheelStream(term, tmuxTarget ?? name, ports);
// const pinned = pinnedSelectionStream(term, el, ports);
// const paneEffects$ = merge(
//   viewport.snapshot$.pipe(ignoreElements()), anchors.effects$,
//   visibility.effects$, wheel.effects$, pinned.effects$,
//   pane.boop_mux_session_request$.pipe(tap(request => requestBus.boop_mux_session$.next(request))),
//   visibility.boop_mux_capture_request$.pipe(tap(request => requestBus.boop_mux_capture$.next(request))),
//   visibility.turn_sources_request$.pipe(tap(request => requestBus.turn_sources$.next(request))),
//   visibility.boop_locate_turns_request$.pipe(tap(request => requestBus.boop_locate_turns$.next(request))),
//   visibility.boop_sync_session_request$.pipe(tap(request => requestBus.boop_sync_session$.next(request))),
//   wheel.scroll_session_request$.pipe(mergeMap(request =>
//     from(invoke("scroll_session", request)).pipe(catchError(() => EMPTY)))),
//   wheel.activity$.pipe(tap(() => diagrams?.viewportScrolled())),
//   pinned.copy$.pipe(tap(text => navigator.clipboard.writeText(text))),
//   pane.pane_session_binding$.pipe(tap(binding => setPaneSessionBinding(id, binding))),
// );
// terminal.ts returns paneEffects$; tab close feeds pane_closed$.
// main.ts merges terminal effects with other application effects and owns
// the one root subscription. Pane graph is share/refCount scoped by pane_closed$.
```

## 7. Test plan

```ts
// TestScheduler.run uses virtual time for 80ms/120ms/1000ms/5000ms gates.
// Supply animate("---x---x---x") for animationFrameScheduler branches.
// Cold RPC response marbles carry requestId; assertions include teardown frames.
```

| Function | Case | Input marbles | Expected marbles | Why it exists |
| --- | --- | --- | --- | --- |
| `viewportStream` | write/scroll/resize | `--w-s-r-|` | `--w-s-r-|` | Exact semantic event order, one snapshot each |
| `viewportStream` | close tears registrations | `--w-s-r-`, close `----c` | `--w-|` | No events after pane close |
| `paneSessionStream` | unknown then known TTL | requests `i-1s-5s` / replies `--n--b` | bindings `--n--b` | 1s retry while unknown, 5s when known |
| `paneSessionStream` | equal binding | replies `--b-b-c` | binding `--b---c` | Session and harness pair controls change emission |
| `lineAnchorsStream` | two writes in one frame | `--ww----|` | visible `---v----|`; settled `--f--t--|` | Frame coalescing and 80ms quiet branch |
| `lineAnchorsStream` | duplicate text | snapshot `--(aa)-|` | IDs `--(a0a1)-|` | Per-viewport duplicate index is unique |
| `turnVisibilityStream` | revision changes during locate | trigger `a---b---|`, reply `----A-b-|` | changes `------B-|`; settled `----s--s|` | Stale result discarded but scan settles |
| `turnVisibilityStream` | pending scan coalesces | trigger `a-bc----|`, reply `----A---B|` | requests `a---b---|` | One in-flight and one pending scan |
| `turnVisibilityStream` | native locator fails | locate reply `--#-|` | local projection `--v-|` | Pure fallback and composer trim |
| `turnVisibilityStream` | hidden lease | visible `f-----t`, clock `-c-c-c-` | request `------r` | No hidden scan or ingest; lease survives |
| `turnVisibilityStream` | sync no change / changed | stat `--0--1--|` | rescan `-----r--|` | Only written/dropped counts retrigger |
| `wheelStream` | tracked mouse vs Shift bypass | wheel `--n-s--|` | scroll `----r--|`, state `--N-S--|` | Native forwarding and bypass |
| `wheelStream` | accumulated wheel pixels | wheel `--(abc)--|` | scroll `---r----|` | One rounded, capped request per frame |
| `pinnedSelectionStream` | drag ends with text | mouse `--d-m-u-|` | copy `------c-|` | Captured rows copied once at mouse-up |
| `pinnedSelectionStream` | text changes on repaint | mouse `--d-m-u-r-|` | text `------t--|` then empty | Invalidated highlight never names changed cells |
| `pinnedSelectionStream` | clear while dragging | mouse `--d-m---|`, clear `----x` | copy `--------|` | External clear cancels drag and listeners |

## 8. Open questions

| Question | Source |
| --- | --- |
| `attachCustomWheelEventHandler` currently has no stored unregistration token; confirm xterm's contract for replacing/removing the handler on pane teardown. | `0_terminalWheel.ts:53,83-89` |
| A synchronous wheel handler must return `boolean` and call `preventDefault` before return; confirm that synchronous delivery through the returned effects stream is retained by the host root. | `0_terminalWheel.ts:57-65` |
| `lineAnchors` emits `changed` only when a stable ID has different text, while the ID hashes text; identify whether that event is reachable and whether compatibility requires retaining it. | `00b_terminalLineAnchors.ts:24,71-83` |
| Current `NativeTmuxPane` swallows session lookup errors as null and may notify a binding change; confirm whether errors should remain indistinguishable from a missing binding. | `00a_terminalIntersection.ts:122-129` |
| `TerminalTurnVisibilityV2.scan(supplied)` is public and tests use direct supplied turns; identify non-test call sites before replacing it with a test port emission. | `0_terminalTurnVisibility.ts:382`; `0_terminalTurnVisibility.test.ts:73-211` |
| Existing `TerminalPinnedSelection` copies on settle while the host checks a clipboard setting; confirm whether disabled copy still retains the painted selection. | `0_terminalPinnedSelection.ts:213-218`; `terminal.ts:903-907` |
| `BoopConversation` appears as an exported interface with no constructor in the wave 2 caller graph; confirm whether its stream record belongs in wave 2 exports or a later transport lane. | `00a_terminalIntersection.ts:145-150` |
