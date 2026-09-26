# boop-xterm wave 3 design

## 1. Type signatures

| Current export, instant `src/` | Current TypeScript signature | Proposed TypeScript signature, `packages/boop-xterm/src/` |
| --- | --- | --- |
| `0_terminalDiagrams.ts:11-20` | `type DiagramLanguage = "mermaid" \| "d2"; type DiagramFence = { language: DiagramLanguage; code: string; start: number; end: number; inferred: boolean; stripped?: boolean; locator?: string; messageId?: string };` | `type DiagramLanguage = "mermaid" \| "d2"; type DiagramFence = { language: DiagramLanguage; code: string; start: number; end: number; inferred: boolean; stripped?: boolean; locator?: string; messageId?: string };` |
| `0_terminalDiagrams.ts:29-36` | `type TerminalDiagramLayout = { maxViewportHeightRatio: number; maxBlankRows: number }; const defaultTerminalDiagramLayout: TerminalDiagramLayout;` | `type TerminalDiagramLayout = { maxViewportHeightRatio: number; maxBlankRows: number }; const defaultTerminalDiagramLayout: TerminalDiagramLayout;` |
| `0_terminalDiagrams.ts:81,119-122` | `function loadMermaid(): Promise<MermaidApi>; const DIAGRAM_INFERENCE: readonly ["explicit", "labels", "inferred"]; type DiagramInference = (typeof DIAGRAM_INFERENCE)[number]; function findDiagramFences(term: Terminal, inference?: DiagramInference): DiagramFence[];` | `function loadMermaid$(): Observable<MermaidApi>; const DIAGRAM_INFERENCE: readonly ["explicit", "labels", "inferred"]; type DiagramInference = (typeof DIAGRAM_INFERENCE)[number]; function findDiagramFences(term: Terminal, inference?: DiagramInference): DiagramFence[];` Script DOM acquisition and removal live in `new Observable`. |
| `0_terminalDiagrams.ts:231-280` | `function mergeLocatedDiagrams(direct: DiagramFence[], ledger: DiagramFence[]): DiagramFence[]; function projectedDiagramIsCurrent(term: Pick<Terminal, "buffer">, region: ProjectedTurnRegion): boolean; function diagramElementKey(fence: DiagramFence, dark: boolean): string;` | `function mergeLocatedDiagrams(direct: DiagramFence[], ledger: DiagramFence[]): DiagramFence[]; function projectedDiagramIsCurrent(term: Pick<Terminal, "buffer">, region: ProjectedTurnRegion): boolean; function diagramElementKey(fence: DiagramFence, dark: boolean): string;` Bodies move unchanged. |
| `0_terminalDiagrams.ts:326-399` | `function renderDiagram(fence: DiagramFence, dark: boolean): Promise<RenderedDiagram>; function svgAspectRatio(svg: unknown): number \| null; function diagramElementAtPoint(elements: HTMLElement[], clientX: number \| null, clientY: number): HTMLElement \| null;` | `function renderDiagram$(fence: DiagramFence, palette: DiagramPalette): Observable<RenderedDiagram>; function svgAspectRatio(svg: unknown): number \| null; function diagramElementAtPoint(elements: HTMLElement[], clientX: number \| null, clientY: number): HTMLElement \| null; type RenderedDiagram = { svg: string; code: string; lineCount: number };` The DOM SVG paint pass uses resolved palette values. |
| `0_terminalDiagrams.ts:403` | `class TerminalDiagramOverlay { constructor(term: Terminal, host: HTMLElement, layout?: TerminalDiagramLayout, projection?: Pick<TurnVisibilityModel, "state" \| "changes" \| "settled" \| "scanning">, enabled?: () => boolean, inference?: () => DiagramInference); viewportScrolled(): void; activate(): void; syncEnabled(): void; openAtClientY(clientY: number): boolean; openAtClientPoint(clientX: number, clientY: number): boolean; closeLarge(): void; dispose(): void }` | `function diagramOverlayStream(term: Terminal, host: HTMLElement, visibility: TurnVisibilityModel, inputs: DiagramInputs): DiagramOverlayModel;` |
| `1_terminalStructuredOverlay.ts:12,28` | `function structuredRegionMarkup(region: StructuredRegion): string; class TerminalStructuredOverlay { constructor(term: Terminal, host: HTMLElement, projection: Pick<TurnVisibilityModel, "state" \| "changes">); regions(): StructuredRegion[]; paint(): void; open(region: StructuredRegion): void; close(): void; dispose(): void }` | Pure `structuredRegionMarkup` unchanged; `function structuredOverlayStream(term: Terminal, host: HTMLElement, visibility: TurnVisibilityModel, enabled: SignalSource<boolean>): StructuredOverlayModel;` |
| `0_turnDebugOverlay.ts:17-90` | `export { shiftSpans }; type RowTag = { bufferRow: number; viewportRow: number; turnId: string \| null; turn: number \| null; role: string; confidence: VisibleTurn["confidence"] \| null; label: string; hue: number; spanStart: boolean; spanEnd: boolean; regionKind: TurnRegionKind \| null; pointer: boolean }; function turnHue(turnId: string): number; function rowTags(visible: VisibleTurn[], firstRow: number, rows: number, pointerRow: number \| null): RowTag[];` | `shiftSpans` remains a re-export; `RowTag`, `turnHue`, `rowTags` retain signatures and bodies; move `turnHue` to `8_turnHue.ts` so queue and square model have no dependency on the overlay. |
| `0_turnDebugOverlay.ts:90` | `class TerminalTurnDebugOverlay { constructor(term: Terminal, host: HTMLElement, projection: Pick<TurnVisibilityModel, "state" \| "changes">); markScan(): void; bufferShift(): number; screen(): HTMLElement \| null; bufferRowAtClientY(clientY: number): number \| null; schedule(): void; paint(): void; openPanel(row: HTMLElement, event: MouseEvent): Promise<void>; dispose(): void }` | `function turnDebugOverlayStream(term: Terminal, host: HTMLElement, visibility: TurnVisibilityModel, panel: TurnPanelModel, enabled: SignalSource<boolean>): TurnDebugModel;` |
| `1a_terminalContextQueue.ts:9-30` | `type PromptContextItem = { id: string; kind: "selection" \| "table" \| "list" \| "heading" \| "line"; text: string; note?: string; turnIds: string[]; enabled: boolean }; type TerminalSelectionSnapshot = { text: string; bufferStart: { row: number; col: number }; bufferEnd: { row: number; col: number }; turnIds: string[] };` | `type PromptContextItem = { id: string; kind: "selection" \| "table" \| "list" \| "heading" \| "line"; text: string; note?: string; turnIds: string[]; enabled: boolean }; type TerminalSelectionSnapshot = { text: string; bufferStart: { row: number; col: number }; bufferEnd: { row: number; col: number }; turnIds: string[] };` |
| `1a_terminalContextQueue.ts:32,49,55` | `function formatQueuedContext(items: PromptContextItem[]): string; function turnsAcrossRange(turns: VisibleTurn[], start: number, end: number): string[]; class TerminalContextQueue { constructor(term: Terminal, host: HTMLElement, projection: Pick<TurnVisibilityModel, "state" \| "changes">, anchors: LineAnchorModel, paste: (text: string) => Promise<void> \| void, enabled: () => boolean); addSelection(snapshot: Pick<TerminalSelectionSnapshot, "text" \| "turnIds"> & { id?: string; kind?: PromptContextItem["kind"]; note?: string }): string \| null; send(): Promise<boolean>; hydrate(items: PromptContextItem[]): void; focusNote(id: string): void; snapshotFor(text: string, startRow: number, endRow: number): Pick<TerminalSelectionSnapshot, "text" \| "turnIds">; toggleStructured(selectable: StructuredSelectable, checked: boolean): void; activate(): void; paintSelections(): void; dispose(): void }` | Pure functions unchanged; `function contextQueueStream(term: Terminal, host: HTMLElement, visibility: TurnVisibilityModel, anchors: LineAnchorModel, identity: PaneIdentity, ports: BoopXtermPorts): ContextQueueModel;` |
| `1a2_terminalContextGutter.ts:17-19,21-27` | `const gutter_offset_px: 42; const gutter_check_px: 16; type StructuredSelectable = { id: string; kind: "table" \| "list" \| "heading"; text: string; turnId: string; bufferRow: number };` | `StructuredSelectable` unchanged; geometry values read theme tokens `--boop-xterm-gutter-offset` and `--boop-xterm-gutter-check-size`. |
| `1a2_terminalContextGutter.ts:54,99,108,121` | `function structuredSelectables(turns: Array<Pick<VisibleTurn, "regions">>, visibleLines?: { bufferStart: number; text: string }[]): StructuredSelectable[]; type GutterPaint = { geometry: TerminalRowGeometry; turns: VisibleTurn[]; lines: VisibleTerminalLine[] }; type ContextGutterHost = { term: Terminal; host: HTMLElement; gutter: HTMLElement; projection: Pick<TurnVisibilityModel, "state" \| "changes">; anchors: LineAnchorModel; items: Map<string, PromptContextItem>; enabled: () => boolean; toggleStructured: (selectable: StructuredSelectable, checked: boolean) => void }; class TerminalContextGutter { constructor(queue: ContextGutterHost); schedule(): void; paint(): void; dispose(): void }` | Pure `structuredSelectables` and `GutterPaint` unchanged; `ContextGutterHost` deleted; `function contextGutterStream(term: Terminal, host: HTMLElement, queue: ContextQueueModel, visibility: TurnVisibilityModel, anchors: LineAnchorModel): ContextGutterModel;` |
| `1b_terminalContextSync.ts:6-48` | `type BoopTurnCommentTarget = { session: string; turn: number; role: string; replyTurn?: number \| null }; type BoopTurnComment = { commentId: number; clientId: string; kind: PromptContextItem["kind"]; quote: string; note: string \| null; enabled: boolean; tabName: string \| null; targets: BoopTurnCommentTarget[]; createdTs: number; updatedTs: number }; type BoopTurnCommentForkReply = { session: string; turn: number; said: string }; type BoopTurnCommentFork = { commentId: number; lane: string; branch: string; brief: string; createdTs: number; state: "running" \| "done" \| "dead"; rc: number \| null; reply: BoopTurnCommentForkReply \| null; tmux: string }; type SyncedShape = { text: string; note: string; enabled: boolean; turns: string };` | `type BoopTurnCommentTarget = { session: string; turn: number; role: string; replyTurn?: number \| null }; type BoopTurnComment = { commentId: number; clientId: string; kind: PromptContextItem["kind"]; quote: string; note: string \| null; enabled: boolean; tabName: string \| null; targets: BoopTurnCommentTarget[]; createdTs: number; updatedTs: number }; type BoopTurnCommentForkReply = { session: string; turn: number; said: string }; type BoopTurnCommentFork = { commentId: number; lane: string; branch: string; brief: string; createdTs: number; state: "running" \| "done" \| "dead"; rc: number \| null; reply: BoopTurnCommentForkReply \| null; tmux: string }; type SyncedShape = { text: string; note: string; enabled: boolean; turns: string };` |
| `1b_terminalContextSync.ts:50-129` | `function shapeOf(item: PromptContextItem): SyncedShape; function rowShowsOn(row: BoopTurnComment, tabName: string, visibleTurnIds: ReadonlySet<string>): boolean; function splitTurnId(id: string): { session: string; turn: number } \| null; function toComment(item: PromptContextItem, tabName: string): BoopTurnComment; function toItem(comment: BoopTurnComment): PromptContextItem; function diffItems(last: Map<string, SyncedShape>, next: PromptContextItem[]): { upserts: PromptContextItem[]; removals: string[] };` | `function shapeOf(item: PromptContextItem): SyncedShape; function rowShowsOn(row: BoopTurnComment, tabName: string, visibleTurnIds: ReadonlySet<string>): boolean; function splitTurnId(id: string): { session: string; turn: number } \| null; function toComment(item: PromptContextItem, tabName: string): BoopTurnComment; function toItem(comment: BoopTurnComment): PromptContextItem; function diffItems(last: Map<string, SyncedShape>, next: PromptContextItem[]): { upserts: PromptContextItem[]; removals: string[] };` |
| `1b_terminalContextSync.ts:129` | `class TerminalContextSync { constructor(queue: TerminalContextQueue, tabName: string, sessions: () => Promise<string[]>); activate(): void; flush(): Promise<void>; sendSelection(item: PromptContextItem): Promise<number \| null>; dispose(): void }` | `function contextSyncStream(queue: ContextQueueModel, tabName: SignalSource<string>, sessions: SignalSource<string[]>, visibleTurns: Signal<VisibleTurn[]>, ports: BoopXtermPorts): ContextSyncModel;` |
| `1c_terminalHoverCheck.ts:11-42` | `export { gutter_offset_px }; const hoverLineId: (line: VisibleTerminalLine) => string; function hoverTargetAt(lines: VisibleTerminalLine[], bufferRow: number): VisibleTerminalLine \| null; function screenRowAt(screen: { top: number; bottom: number; left: number; right: number; height: number }, rows: number, x: number, y: number): number \| null; class TerminalHoverCheck { constructor(queue: TerminalContextQueue); evaluate(geometry?: TerminalRowGeometry \| null): void; show(line: VisibleTerminalLine, geometry: TerminalRowGeometry): void; hide(): void; toggle(): void; dispose(): void }` | Pure functions unchanged; `function hoverCheckStream(term: Terminal, host: HTMLElement, queue: ContextQueueModel, gutter: ContextGutterModel, anchors: LineAnchorModel): HoverCheckModel;` |
| `1d_terminalTurnMarks.ts:13-65` | `type PlacedAnnotation = { comment: BoopTurnComment; turn: VisibleTurn; bufferRow: number }; function markRowFor(comment: BoopTurnComment, turn: Pick<VisibleTurn, "bufferStart" \| "bufferEnd" \| "anchorStart">, lines: VisibleTerminalLine[]): number \| null; function placeAnnotations(comments: BoopTurnComment[], turns: VisibleTurn[], lines: VisibleTerminalLine[]): PlacedAnnotation[]; function markTitle(placed: PlacedAnnotation[]): string; class TerminalTurnMarks { constructor(queue: TerminalContextQueue, annotations: Signal<BoopTurnComment[]>, forks: Signal<BoopTurnCommentFork[]>, onMenu?: (event: MouseEvent, entries: PlacedAnnotation[]) => void); requeue(entries: PlacedAnnotation[]): void; dispose(): void }` | Pure declarations unchanged; `function turnMarksStream(host: HTMLElement, queue: ContextQueueModel, gutter: ContextGutterModel, sync: ContextSyncModel): TurnMarksModel;` |
| `1e_terminalForkMarks.ts:6-50` | `type PlacedFork = PlacedAnnotation & { fork: BoopTurnCommentFork }; function placeForks(placed: PlacedAnnotation[], forks: BoopTurnCommentFork[]): PlacedFork[]; const FORK_PRESET: "flash4"; function wrapText(text: string, cols: number): string[]; type ForkBlock = { afterBufferRow: number; lines: string[] }; function forkBlock(fork: PlacedFork, cols: number): ForkBlock;` | Identical declarations and bodies in `8_forkMarks.ts`. |
| `1f_terminalForkRender.ts:11-200` | `type ForkShape = "overlay" \| "pane"; function forkShape(livePane: boolean): ForkShape; function forkKey(fork: BoopTurnCommentFork): string; function forkAge(createdTs: number, nowMs: number): string; function forkHeaderText(fork: BoopTurnCommentFork, expanded: boolean, nowMs: number): string; function forkBodyLines(fork: BoopTurnCommentFork, cols: number): string[]; const fork_indent_px: 26; const fork_pane_rows: 8; type ForkPlacement = { key: string; bufferRow: number; top: number; left: number; right: number; onScreen: boolean }; type ForkPanePlacement = ForkPlacement & { height: number; spacer: number }; function placeForkOverlays(geometry: TerminalRowGeometry, forks: PlacedFork[]): ForkPlacement[]; function placeForkPanes(geometry: TerminalRowGeometry, forks: PlacedFork[], paneRows?: number): ForkPanePlacement[]; function tailLines(capture: string, rows: number): string[]; function forkCommand(commentId: number, preset: string): string; const FORK_PRESETS: readonly ["flash4", "pro4", "opus"]; type ForkPreset = (typeof FORK_PRESETS)[number]; function selectionClientId(tabName: string, text: string, turnIds: string[]): string; function forkedLane(stdout: string): string \| null; type ForkTarget = { commentId: number; label: string }; function forkMenuTargets(entries: PlacedAnnotation[]): ForkTarget[]; const fork_capture_ms: 1200;` | Pure functions, types, `FORK_PRESET`, `FORK_PRESETS`, `fork_capture_ms`, `forkCommand`, `selectionClientId`, `forkedLane`, and `forkMenuTargets` move with unchanged signatures and bodies; geometry size defaults also enter `theme.css`. Instant retains execution/menu composition. |
| `1f_terminalForkRender.ts:186-204` | `type ForkRenderHost = { gutter: HTMLElement; gutterPaint: { followers: Set<(paint: GutterPaint) => void>; schedule: () => void }; term: { cols: number } }; type ForkRenderDeps = { livePane: Signal<boolean>; placedForks: () => PlacedFork[]; capture?: (target: string) => Promise<string>; now?: () => number }; class TerminalForkRender { constructor(queue: ForkRenderHost, deps: ForkRenderDeps); dispose(): void }` | `ForkRenderHost` and `ForkRenderDeps` deleted; `function forkRenderStream(term: Terminal, host: HTMLElement, gutter: ContextGutterModel, marks: TurnMarksModel, livePane: SignalSource<boolean>, ports: BoopXtermPorts): ForkRenderModel;` |
| `0_agentSquareVisual.ts:12-29` | `const SQUARE_SIZE: 12; const SQUARE_GAP: 5; const SQUARE_STEP: number; const SQUARE_SCALE: 1.55; const SQUARE_GUTTER: 32; const SQUARE_DIM: 0.42; const SQUARE_NEIGHBOURS: 1; const SQUARE_EASE: "cubic-bezier(.22,.9,.24,1)"; const SQUARE_MOVE_MS: 260; type SquareKind = "user" \| "agent" \| "tool" \| "other";` | Pure non-paint rules retained; painted sizes, gutter and motion defaults in `theme.css`. Geometry consumers read resolved tokens before calling pure projection functions. |
| `0_agentSquareVisual.ts:53-158` | `type SquareSeed = { id: string; kind: SquareKind; role: string; turn: number; hue: number; at: string; preview: string }; type SquareState = SquareSeed & { active: boolean; y: number; scale: number; strength: number }; type SquareVisual = Signal<SquareState>; function createSquareVisual(seed: SquareSeed): SquareVisual; function placeSquare(visual: SquareVisual, y: number, scale: number, strength: number): void; function activateSquare(visual: SquareVisual, active: boolean): void; function reseedSquare(visual: SquareVisual, seed: SquareSeed): void; function strengthAt(index: number, active: number, kind: SquareKind): number; function squareColor(kind: SquareKind, hue: number): string; function squareVars(state: SquareState): Record<string, string>;` | Pure functions move unchanged with the same signatures; `createSquareVisual(seed: SquareSeed): SquareVisual` uses `Signal<SquareState>(initial)`. Overlay paint uses new `themedSquareVars(state: SquareState, palette: SquarePalette): Record<string, string>` with resolved tokens; legacy `squareVars` is not called by overlay paint. |
| `1_agentSquaresMarks.ts:11-19` | `type TurnMark = { favorite: boolean; tags: string[] }; function marksOf(frame: Strip): Map<string, TurnMark>;` | `type TurnMark = { favorite: boolean; tags: string[] }; function marksOf(frame: Strip, favoriteSources: ReadonlySet<string>): Map<string, TurnMark>;` The existing body reads instant's `boopFavorites` global, so the source set becomes an explicit signal input; mark mapping stays pure. |
| `1_agentSquaresModel.ts:27-196` | `const PREVIEW_CHARS: 4000; type SquareGeometry = { cellHeight: number; track: number }; type SquareBox = { width: number; height: number }; function boxMoved(drawn: SquareBox \| undefined, width: number, height: number): boolean; type AgentSquare = { id: string; kind: SquareKind; role: string; turn: number; hue: number; at: string; preview: string; y: number; scale: number; active: boolean; pinned: boolean }; type AgentSquaresProps = { gap?: { y: number }; squares: AgentSquare[]; active: number; band: number; track: number }; function previewOf(said: string): string; function recentOffset(want: number, track: number, block: number): number; function squaresOf(frame: Strip, geometry: SquareGeometry, recent?: number): AgentSquaresProps;` | The same declarations move unchanged. The overlay adds `function themedSquaresOf(frame: Strip, geometry: SquareGeometry, recent: number, step: number): AgentSquaresProps` to rescale recent/band positions and gap to the resolved `--boop-xterm-squares-step` while preserving `squaresOf` for existing callers. |
| `1_agentSquaresFeed.ts:17-133` | `type SquaresOptions = { mode: "relative" \| "recent"; userKeep: number }; const SQUARES_EVENT: "squares-update"; type StripTurn = { session: string; harness: string; turn: number; ts: number; role: string; said: string; id: string; bufferStart: number; bufferEnd: number; anchorStart: number; anchorEnd: number; confidence: "anchored" \| "extended" \| "pinned" }; type Strip = { session: string; at: number; rows: number; turns: StripTurn[]; pinned: StripTurn[]; tags: Record<string, string[]>; layout: StripLayout \| null }; type SquareLayout = { id: string; kind: SquareKind; y: number; scale: number; active: boolean }; type StripLayout = { mode: "relative"; gap?: ToolGap \| null; squares: SquareLayout[]; band: number; rows: number } \| { mode: "recent"; gap?: ToolGap \| null; squares: SquareLayout[]; rows: number }; type ToolGap = { beforeId: string \| null; afterId: string \| null; startRow: number; endRow: number }; type SquaresWatch = { pty: string; session: string; target: string; socket?: string }; function squaresFeed(session: string, frames?: Observable<Strip>): Observable<Strip>; function watchSquares(input: SquaresWatch, options: SquaresOptions, send?: typeof invoke): Promise<() => Promise<void>>;` | Wire types and `SQUARES_EVENT` unchanged. `function squaresFeed(session: string, frames: Observable<Strip>): Observable<Strip>` retains its filter body. `watchSquares` replaced by `squares_watch` / `squares_unwatch` endpoints and `switchMap`/`finalize`. |
| `1_agentSquares.ts:51,93` | `type AgentSquaresInput = { pty: string; session: string; target: string; socket?: string }; class TerminalAgentSquares { constructor(el: HTMLElement, input: AgentSquaresInput, options: SquaresOptions, onGutter: () => void, newResize?: typeof ResizeObserver); start(): Promise<void>; retarget(input: AgentSquaresInput, options: SquaresOptions): Promise<void>; dispose(): Promise<void>; openPanel(id: string, point?: { x: number; y: number }): void }` | `AgentSquaresInput` unchanged; `function agentSquaresStream(term: Terminal, host: HTMLElement, input: SignalSource<AgentSquaresInput \| null>, options: SignalSource<SquaresOptions>, frames: Observable<Strip>, panel: TurnPanelModel, ports: BoopXtermPorts): AgentSquaresModel;` |
| `1_turnPanel.ts:30,36,47,186,203` | `export type { TurnMark }; type TurnPayload = { session: string; harness: string; turn: number; ts: number; role: string; said: string }; type TurnPanelTarget = { id: string; source: string; at: string; preview: string; marks: TurnMark; turn?: TurnPayload; x: number; y: number }; function cachedMarks(source: string): TurnMark; class TurnPanel { constructor(host: HTMLElement); get isOpen(): boolean; open(target: TurnPanelTarget): void; close(): void; dispose(): void }` | `export type { TurnMark }; type TurnPayload = { session: string; harness: string; turn: number; ts: number; role: string; said: string }; type TurnPanelTarget = { id: string; source: string; at: string; preview: string; marks: TurnMark; turn?: TurnPayload; x: number; y: number }; function turnPanelStream(host: HTMLElement, opened: Signal<TurnPanelTarget \| undefined>, marks: SignalSource<ReadonlyMap<string, TurnMark>>): TurnPanelModel;` `cachedMarks` stays in instant; package panel emits `favoriteToggle` and `tagEdit` events. |
| `graphics.ts:13,27` | `type GraphicsFrame = { id: string; action: string; img_id: number; format: number; width: number; height: number; x: number; y: number; no_scroll: boolean; delete: boolean; rgba_b64: string }; class GraphicsOverlay { constructor(host: HTMLElement); push(frame: GraphicsFrame): void; clear(): void; dispose(): void }` | `type GraphicsFrame = { id: string; action: string; img_id: number; format: number; width: number; height: number; x: number; y: number; no_scroll: boolean; delete: boolean; rgba_b64: string }; function graphicsOverlayStream(host: HTMLElement, id: string, frames: Observable<GraphicsFrame>): GraphicsOverlayModel;` |

```ts
// New public model types. `SignalSource` is the package's existing host-state convention.
export type DiagramInputs = {
  enabled: SignalSource<boolean>;
  inference: SignalSource<DiagramInference>;
  scrollGesture: Signal<void | undefined>;
  activate: Signal<void | undefined>;
  layout: TerminalDiagramLayout;
};
export type DiagramPalette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceMuted: string;
  text: string;
  border: string;
  line: string;
};
export type DiagramOverlayModel = {
  opened: Signal<DiagramLightboxEntry | undefined>;
  effects: Observable<void>;
};
export type StructuredOverlayModel = { effects: Observable<void> };
export type TurnDebugModel = { effects: Observable<void> };
export type ContextQueueModel = {
  state: Signal<{ items: PromptContextItem[]; sendError: string | null }>;
  sending: Signal<boolean>;
  add: Signal<Pick<TerminalSelectionSnapshot, "text" | "turnIds"> & { id?: string; kind?: PromptContextItem["kind"]; note?: string }>;
  hydrate: Signal<PromptContextItem[]>;
  sent: Signal<{ ids: string[]; items: PromptContextItem[] }>;
  focusNote: Signal<string>;
  structuredToggle: Signal<{ selectable: StructuredSelectable; checked: boolean }>;
  effects: Observable<void>;
};
export type ContextGutterModel = {
  paint: Signal<GutterPaint | undefined>;
  selectables: Signal<ReadonlyMap<string, StructuredSelectable>>;
  effects: Observable<void>;
};
export type ContextSyncModel = {
  annotations: Signal<BoopTurnComment[]>;
  forks: Signal<BoopTurnCommentFork[]>;
  refresh: Signal<void | undefined>;
  flush: Signal<void | undefined>;
  sendSelection: Signal<PromptContextItem>;
  selectionWritten: Signal<{ clientId: string; commentId: number | null }>;
  effects: Observable<void>;
};
export type HoverCheckModel = { effects: Observable<void> };
export type TurnMarksModel = {
  placedForks: Signal<PlacedFork[]>;
  menuRequested: Signal<{ clientX: number; clientY: number; entries: PlacedAnnotation[] }>;
  effects: Observable<void>;
};
export type ForkRenderModel = { effects: Observable<void> };
export type SquarePalette = { user: string; agent: string; tool: string; other: string };
export type AgentSquaresModel = {
  gutterChanged: Signal<void | undefined>;
  state: Signal<{ frame: Strip | null; recentOffsetPx: number }>;
  effects: Observable<void>;
};
export type TurnPanelModel = {
  opened: Signal<TurnPanelTarget | undefined>;
  favoriteToggle: Signal<TurnPanelTarget>;
  tagEdit: Signal<TurnPanelTarget>;
  effects: Observable<void>;
};
export type GraphicsOverlayModel = { effects: Observable<void> };
```

| `package.json` `exports` entry | Target | Reason |
| --- | --- | --- |
| `"."` | `./dist/index.js`, `./dist/index.d.ts` | Current root exports plus wave 3 model/type exports. |
| `"./theme.css"` | `./dist/theme.css` | Required default custom property sheet; consumer imports it once. |

## 2. Additions to `BoopXtermPorts`

| Port in `3_ports.ts` | Full TS type | Rust command and signature | Use |
| --- | --- | --- | --- |
| `boop_turn_comments` | `Endpoint<{ tab: string; sessions: string[] }, BoopTurnComment[]>` | `0_boop.rs:751` `pub async fn boop_turn_comments(tab: String, sessions: Vec<String>) -> Result<Vec<BoopTurnComment>, String>` | `createQuery`, initial and activation pull. |
| `boop_turn_annotations` | `Endpoint<{ sessions: string[] }, BoopTurnComment[]>` | `0_boop.rs:564` `pub async fn boop_turn_annotations(sessions: Vec<String>) -> Result<Vec<BoopTurnComment>, String>` | `createQuery` after pull and sent. |
| `boop_turn_comment_forks` | `Endpoint<{ commentIds: number[] }, BoopTurnCommentFork[]>` | `0_boop.rs:744` `pub async fn boop_turn_comment_forks(comment_ids: Vec<i64>) -> Result<Vec<BoopTurnCommentFork>, String>` | `createQuery` keyed by annotation IDs. |
| `boop_turn_comment_upsert` | `Endpoint<{ comment: BoopTurnComment }, number>` | `0_boop.rs:763` `pub async fn boop_turn_comment_upsert(comment: BoopTurnComment) -> Result<i64, String>` | `createMutation`, serialized writes. |
| `boop_turn_comment_delete` | `Endpoint<{ clientId: string }, void>` | `0_boop.rs:790` `pub async fn boop_turn_comment_delete(client_id: String) -> Result<(), String>` | `createMutation`, serialized writes. |
| `boop_turn_comments_sent` | `Endpoint<{ clientIds: string[] }, void>` | `0_boop.rs:803` `pub async fn boop_turn_comments_sent(client_ids: Vec<String>) -> Result<(), String>` | `createMutation` after final upsert. |
| `squares_watch` | `Endpoint<{ pty: string; session: string; target: string; socket?: string; options: SquaresOptions }, void>` | `lib.rs:683` `fn squares_watch(app: AppHandle, pty: String, session: String, target: String, socket: Option<String>, options: Option<squares::SquaresOptions>) -> Result<(), String>` | `createMutation`; `switchMap` replaces watcher on input/options change. |
| `squares_unwatch` | `Endpoint<{ pty: string }, void>` | `lib.rs:705` `fn squares_unwatch(pty: String) -> Result<(), String>` | `createMutation` when watcher inner stream finalizes. |
| `boop_mux_exit_copy_mode` | `Endpoint<{ target: string; socket: string | null }, boolean>` | `0_tmux.rs:27` `pub async fn boop_mux_exit_copy_mode(target: String, socket: Option<String>) -> Result<bool, String>` | `createMutation` before queue paste; failure does not prevent write. |
| `write_pty` | `Endpoint<{ id: string; data: string }, void>` | `pty.rs:869` `pub fn write_pty(services: State<Arc<Services>>, id: String, data: String) -> Result<(), String>` | `createMutation` for bracketed paste. |
| `"squares-update"` | `Observable<Strip>` | `1_squares.rs:40,452` `SQUARES_EVENT = "squares-update"`, host event | Host `nativeEvent$<Strip>(SQUARES_EVENT)` input, never transport code in package. |
| `pty-graphics` host stream | `Observable<GraphicsFrame>` | `kitty.rs` event forwarded as `pty-graphics` at `main.ts:413-414` | Host passes `nativeEvent$<GraphicsFrame>("pty-graphics")` directly to the graphics model beside the pane; it is not a `BoopXtermPorts` field. |
| `inlineDiagrams`, `diagramInference`, `inlineStructuredSelectors`, `turnDebugEnabled`, `agentSquaresEnabled`, `squaresOptions`, `forkLivePane`, `tabName`, `sessionIds` | `SignalSource<boolean>`, `SignalSource<DiagramInference>`, `SignalSource<boolean>`, `SignalSource<boolean>`, `SignalSource<boolean>`, `SignalSource<SquaresOptions>`, `SignalSource<boolean>`, `SignalSource<string>`, `SignalSource<string[]>` | Host state, `0_settings.ts`, `0_agentSquaresSettings.ts`, `0_forkRenderSettings.ts`, `terminal.ts:768-785`; no Rust command | Passed through `toSignal` once in `7_pane.ts`; no duplicated store. |
| `structuredOverlayEnabled` | `SignalSource<boolean>` | Instant gate `terminal.ts:126,800-802`; no Rust command | Defaults false in instant; separately controls the expandable table/list overlay. |
| `favoriteSources` | `SignalSource<ReadonlySet<string>>` | `favorites.ts`, `1_agentSquaresMarks.ts:19-30`; no Rust command | Host cache projected into the package's marks calculation. |

```ts
// Add these fields directly to the existing BoopXtermPorts record in 3_ports.ts.
export type BoopXtermPorts = {
  boop_mux_session: Endpoint<{ target: string; socket: string | null }, PaneSessionBinding | null>;
  boop_mux_capture: Endpoint<{ target: string; socket: string | null }, string>;
  boop_turns: Endpoint<{ session: string }, BoopTurn[]>;
  boop_turns_recent: Endpoint<{ since: number; harness: string }, BoopTurn[]>;
  boop_sync_session: Endpoint<{ session: string; harness: string }, BoopSyncStat>;
  boop_locate_turns: Endpoint<{ lines: LogicalLine[]; turns: BoopTurn[] }, TurnSpan[]>;
  scroll_session: Endpoint<{ name: string; up: boolean; lines: number }, void>;
  boop_turn_comments: Endpoint<{ tab: string; sessions: string[] }, BoopTurnComment[]>;
  boop_turn_annotations: Endpoint<{ sessions: string[] }, BoopTurnComment[]>;
  boop_turn_comment_forks: Endpoint<{ commentIds: number[] }, BoopTurnCommentFork[]>;
  boop_turn_comment_upsert: Endpoint<{ comment: BoopTurnComment }, number>;
  boop_turn_comment_delete: Endpoint<{ clientId: string }, void>;
  boop_turn_comments_sent: Endpoint<{ clientIds: string[] }, void>;
  squares_watch: Endpoint<{ pty: string; session: string; target: string; socket?: string; options: SquaresOptions }, void>;
  squares_unwatch: Endpoint<{ pty: string }, void>;
  boop_mux_exit_copy_mode: Endpoint<{ target: string; socket: string | null }, boolean>;
  write_pty: Endpoint<{ id: string; data: string }, void>;
  "squares-update": Observable<Strip>;
  paneVisible: SignalSource<boolean>;
  paneClosed: SignalSource<boolean>;
  harness: SignalSource<HarnessId | null>;
  clipboardEnabled: SignalSource<boolean>;
  tabSessionIds: SignalSource<string[]>;
  scanRequested: Signal<void | undefined>;
  selectionClear: Signal<void | undefined>;
  inlineDiagrams: SignalSource<boolean>;
  diagramInference: SignalSource<DiagramInference>;
  inlineStructuredSelectors: SignalSource<boolean>;
  structuredOverlayEnabled: SignalSource<boolean>;
  turnDebugEnabled: SignalSource<boolean>;
  agentSquaresEnabled: SignalSource<boolean>;
  squaresOptions: SignalSource<SquaresOptions>;
  favoriteSources: SignalSource<ReadonlySet<string>>;
  forkLivePane: SignalSource<boolean>;
  tabName: SignalSource<string>;
  sessionIds: SignalSource<string[]>;
};
```

## 3. Pseudo-code bodies

```ts
function diagramOverlayStream(term: Terminal, host: HTMLElement, visibility: TurnVisibilityModel, inputs: DiagramInputs): DiagramOverlayModel {
  // Signal(value): retained lightbox entry, successful painted keys, settled stripped keys.
  // Signal(() => derived): enabled and inferred fence plan from viewport, visibility and theme revision.
  // new Observable: acquire root, xterm registrations, host click listener; return unsubscribe teardown.
  // merge(viewport changes, visibility.changes, visibility.settled, scrollGesture, activate, enabled, inference).
  // tap(settled => record stripped keys); debounceTime(80) only for wheel quiet and recovery; auditTime(0, animationFrameScheduler).
  // switchMap(plan => forkJoin(plan.visibleFences.map(fence => renderDiagram$(fence, plan.palette)))) cancels stale commits; no generation counter.
  // retry({ delay: exponential timer bounded at 30000 }) for explicit/ledger failures; successful plan resets retry.
  // tap(render => reconcile keyed elements, read resolved --boop-xterm-* colors for SVG renderer and set SVG paints).
  // click event maps hit entry into opened; lightbox DOM acquired by switchMap over an Observable source.
  // effects = merge(paint$, lightbox$).pipe(map(() => void 0)); return effects, opened.
}
function structuredOverlayStream(term: Terminal, host: HTMLElement, visibility: TurnVisibilityModel, enabled: SignalSource<boolean>): StructuredOverlayModel {
  // enabled -> distinctUntilChanged -> switchMap(true => new Observable(root, click/mousedown/xterm listener, unsubscribe)).
  // merge(visibility.changes, viewport changes) -> auditTime(animation frame) -> tap(reconcile region IDs and positions).
  // click -> Signal<Event> of region -> switchMap(modal observable); close click/Escape -> takeUntil -> teardown modal.
  // return effects = merge(paint$, modal$).
}
function turnDebugOverlayStream(term: Terminal, host: HTMLElement, visibility: TurnVisibilityModel, panel: TurnPanelModel, enabled: SignalSource<boolean>): TurnDebugModel {
  // enabled -> switchMap(new Observable(root, pointer and xterm registrations, unsubscribe)); no constructor subscription.
  // visibility.changes -> scan shift mark; merge pointer and viewport -> auditTime(animation frame).
  // map(rowTags over shifted visibility spans) -> tap(reconcile row DOM, resolved CSS paint values).
  // row click -> map(TurnPanelTarget) -> tap(panel.opened.$(target)); return effects.
}
function contextQueueStream(term: Terminal, host: HTMLElement, visibility: TurnVisibilityModel, anchors: LineAnchorModel, identity: PaneIdentity, ports: BoopXtermPorts): ContextQueueModel {
  // Signal({items, sendError}); sending derives from the mutation's loading state; Signal<Event>() for add, hydrate, sent, focusNote, structuredToggle.
  // merge(add, hydrate, DOM note/edit/remove/toggle, structuredToggle) -> scan keyed items; local id wins hydrate.
  // send click -> exhaustMap(formatQueuedContext -> createMutation(exit copy mode) -> createMutation(write_pty)).
  // success -> emit sent({ids, items}) before clear; failure -> retain items and error.
  // state.$ -> tap(reconcile queue DOM); focusNote -> animationFrameScheduler -> tap(focus after menu restoration).
  // DOM acquisition/listeners in new Observable, unsubscribe removes root/listeners; return merged effects.
}
function contextGutterStream(term: Terminal, host: HTMLElement, queue: ContextQueueModel, visibility: TurnVisibilityModel, anchors: LineAnchorModel): ContextGutterModel {
  // merge(viewport, visibility.changes, anchors.state.visible.$, queue.state.$) -> auditTime(animation frame).
  // scan shift from TerminalScanShift's observable lifecycle; map(structuredSelectables) -> Signal(source$, initial).
  // tap(reconcile checkboxes and publish one GutterPaint); DOM listener source returns unsubscribe.
  // effects = merge(paint.$, DOM event reducer); no Set<callback> followers.
}
function contextSyncStream(queue: ContextQueueModel, tabName: SignalSource<string>, sessions: SignalSource<string[]>, visibleTurns: Signal<VisibleTurn[]>, ports: BoopXtermPorts): ContextSyncModel {
  // createQuery(comments, {tab, sessions}) on initial/refresh; filter(rowShowsOn); queue.hydrate.$(items).
  // queue.state.$ -> debounceTime(300) -> snapshot/diffItems; queue.sent.$ bypasses debounce with final item values.
  // pagehide new Observable -> flush event; merge writes -> concatMap(upserts, sent, deletes via createMutation).
  // scan last successful SyncedShape map; sent IDs suppress only matching trailing deletion by keyed event state.
  // sendSelection -> concatMap(upsert, sent mutation) -> selectionWritten({clientId, commentId}); clientId correlates host continuation.
  // annotations createQuery(sessions); fork IDs -> switchMap(createQuery(forks)); Signal(source$, []).
  // no Promise writing chain, pushSubscription, sentSubscription or skipRemovals mutable set.
  // return effects merging pull, write, annotations and forks.
}
function hoverCheckStream(term: Terminal, host: HTMLElement, queue: ContextQueueModel, gutter: ContextGutterModel, anchors: LineAnchorModel): HoverCheckModel {
  // new Observable acquires checkbox and host mouse listeners; unsubscribe removes both.
  // pointer stream + gutter.paint.$ -> map(screenRowAt, hoverTargetAt) -> distinctUntilChanged(line id).
  // tap(position/hide checkbox); change -> queue.add.$(line snapshot) or queue structured toggle/remove event.
}
function turnMarksStream(host: HTMLElement, queue: ContextQueueModel, gutter: ContextGutterModel, sync: ContextSyncModel): TurnMarksModel {
  // combineLatest(gutter.paint.$, annotations.$, forks.$) -> map(placeAnnotations, placeForks).
  // Signal(source$, []): placedForks, consumed by fork renderer; tap(reconcile mark buttons).
  // click -> queue.add; contextmenu -> menuRequested.$({clientX, clientY, entries}); no callback parameter.
  // acquire mark layer and native listeners inside new Observable; unsubscribe removes all.
}
function forkRenderStream(term: Terminal, host: HTMLElement, gutter: ContextGutterModel, marks: TurnMarksModel, livePane: SignalSource<boolean>, ports: BoopXtermPorts): ForkRenderModel {
  // combineLatest(gutter.paint.$, marks.placedForks.$, livePane.$) -> map(overlay/pane placements).
  // header click -> scan expanded keys; placed pane keys -> groupBy(key) -> exhaustMap(createQuery(boop_mux_capture)).
  // timer(0, fork_capture_ms) per visible live pane; switchMap drops a removed/replaced fork capture.
  // Signal(source$, initial) retains last capture text for dead lanes; no node.capturing/capturedAt flags.
  // tap(reconcile keyed DOM); new Observable owns root/listeners, unsubscribe removes them.
}
function agentSquaresStream(term: Terminal, host: HTMLElement, input: SignalSource<AgentSquaresInput | null>, options: SignalSource<SquaresOptions>, panel: TurnPanelModel, favoriteSources: SignalSource<ReadonlySet<string>>, ports: BoopXtermPorts): AgentSquaresModel {
  // combineLatest(input, options, enabled) -> distinctUntilChanged(value equality) -> switchMap(watch lifecycle).
  // new Observable acquires strip, ResizeObserver and pointer/focus/wheel listeners; teardown named unsubscribe.
  // watch/unwatch are serialized mutations: input changes produce {old,new}; concatMap(unwatch old, watch new).
  // paneClosed produces final input=null; concatMap completes squares_unwatch before model effects complete.
  // ports["squares-update"] is observed before watch starts; the host boundary holds effects until close completes.
  // frames -> filter(session) -> scan({lastFrame, heldFrame}, pointer/focus presence); leave releases newest held frame.
  // wheel -> buffer(auditTime(animation frame)) -> scan(recentOffsetPx); resize -> auditTime(animation frame).
  // merge(frame, wheel, resize) -> map(themedSquaresOf and marksOf(frame, favoriteSources)) -> tap(reconcile keyed nodes and apply themedSquareVars synchronously).
  // pointerup -> panel.opened.$(TurnPanelTarget); mount/unmount -> gutterChanged.$(undefined).
  // no per-square subscription; square state is read in the same paint pipeline.
}
function turnPanelStream(host: HTMLElement, opened: Signal<TurnPanelTarget | undefined>, marks: SignalSource<ReadonlyMap<string, TurnMark>>): TurnPanelModel {
  // opened.$ -> distinctUntilChanged(id) -> switchMap(new Observable(card, window key, document pointer, React root)).
  // favoriting/tag clicks emit Signal<Event>(); host merges instant favorite/tag effects.
  // marks input updates painted status; open target fixes click point once; close clears opened.
  // diagram body uses @hafley66/md; teardown unmounts React root and card.
}
function graphicsOverlayStream(host: HTMLElement, id: string, frames: Observable<GraphicsFrame>): GraphicsOverlayModel {
  // new Observable acquires canvas/context; unsubscribe cancels animation frame and removes canvas.
  // frames -> filter(host pane id) -> auditTime(animation frame) newest full frame -> tap(ImageData/putImageData).
  // delete frame -> clearRect; return effects.
}
```

## 4. Instance timelines

| Current class | Starts | Ends | Replacement owner |
| --- | --- | --- | --- |
| `TerminalDiagramOverlay` | `new` in `terminal.ts:792` | `dispose` at tab close | One `diagramOverlayStream` graph per pane; `effects` connection to pane close. |
| `TerminalStructuredOverlay` | `new` in `terminal.ts:800-802` when enabled | `dispose` at tab close | Enabled signal chooses mounted observable; close tears down. |
| `TerminalTurnDebugOverlay` | `applyTurnDebugOverlay` `terminal.ts:139-154` | setting off or tab close | `turnDebugEnabled` chooses mounted observable. |
| `TerminalContextQueue` | `new` in `terminal.ts:803` | tab close | Pane-owned queue state and DOM source. |
| `TerminalContextGutter` | queue constructor `1a_terminalContextQueue.ts:88` | queue disposal | Queue-owned gutter stream. |
| `TerminalContextSync` | `new` in `terminal.ts:832` | tab close | Pane-owned query/write stream. |
| `TerminalHoverCheck` | `new` in `terminal.ts:837` | tab close | Queue-owned pointer stream. |
| `TerminalTurnMarks` | `new` in `terminal.ts:838` | tab close | Gutter paint stream. |
| `TerminalForkRender` | `new` in `terminal.ts:846` | tab close | Gutter paint stream and per-fork capture inner stream. |
| `TerminalAgentSquares` | `applyAgentSquares` `terminal.ts:181-209`; `start` after constructor | disabled, retarget or tab close | Session/options `switchMap` lifecycle; `squares_unwatch` after replacement. |
| `TurnPanel` | lazy debug click `0_turnDebugOverlay.ts:255` or strip start `1_agentSquares.ts:175` | close, Escape, outside click, tab close | One pane-owned panel stream; each open inner stream releases card. |
| `GraphicsOverlay` | `new` for graphics tab `terminal.ts:766` | tab close | Graphics pane frame stream. |

| Proposed stream | Marble (`^` connect, `!` teardown, `x` cancel) |
| --- | --- |
| Diagram paint | `viewport     ^--v--v----v-----!`<br>`render       ^--r-xR----R-----!`<br>`DOM          ^--paint---paint--!` |
| Structured overlay | `enabled      ^f---t------f----!`<br>`DOM          ----^paint---!---!` |
| Turn debug | `enabled      ^f--t---v--f------!`<br>`rows         ---^r--r---!---!` |
| Context queue/send | `items        ^a--edit--send----!`<br>`paste        ---------^ok!-----!`<br>`sent/clear   ----------s,c------!` |
| Gutter/hover | `paint        ^p--p--p----------!`<br>`pointer      ^--m--m--leave----!`<br>`check        ^--c-----hide-----!` |
| Context sync | `queue        ^q--q----sent--q---!`<br>`writes       ^---u----u,s--d--!`<br>`queries      ^q------q---------!` |
| Marks/fork capture | `marks        ^m-----m----------!`<br>`pane fork    ^---f--cap--cap-x--!` |
| Squares watcher | `input        ^A-------B---------!`<br>`watch        ^wA------x-wB---uB!`<br>`frames       ^-f-f--f---f-f----!`<br>`paint        ^-p-hold-p--p------!` |
| Turn panel | `opened       ^--A----close--B---!`<br>`DOM          ---^render!----^---!` |
| Graphics | `frames       ^f-ff--delete-f----!`<br>`canvas       ^--paint-clear-p---!` |

## 5. Storage and sequence

| Current mutable fields | Destination | Read/write order and uniqueness |
| --- | --- | --- |
| Diagram `generation`, `painting`, `repaintPending`, `frame`, `scrolling`, `lastScrollAt`, `hideRequested`, `retryTimer`, `retryDelayMs` | Delete; `switchMap`, `auditTime`, `debounceTime`, `retry({delay})`, `finalize` | Latest plan cancels prior render commit; one frame paint per audit window; retry belongs to current inner stream. |
| Diagram `cache`, `elementCache`, `paintedKeys`, `settledKeys`, `lastPaintedFingerprint` | `Signal({paintedKeys, settledKeys, fingerprint})`; render cache in `defer` scope, bounded 32 entries | Settle records stripped keys before paint; key is resolved theme palette plus locator plus occurrence; failed render evicts its cache key. |
| Diagram `root`, lightbox root/mount/entries/active/sequence, disposables/subscriptions | DOM observable scope; `Signal` for active entry/history | One root per connected pane; one open lightbox per pane; `finalize` unmounts React and removes DOM. |
| Structured `root`, `elements`, `modal`, `disposables`, `subscription` | DOM observable local map and inner modal stream | Region ID unique in root; enabled false or pane close releases all. |
| Debug `root`, `nodes`, `panel`, `scan`, `frame`, `pointerRow`, `disposables`, `subscription` | DOM scope; pointer row `Signal<number \| null>`; scan shift stream | Pointer event writes row before frame projection; panel is the shared pane model; `auditTime` replaces frame flag. |
| Queue `items`, `sendError`, `sent`, `state`, `focusFrame`, `root/gutter/queue` | `state.items/sendError/sending`, `Signal<Event>()` sent, scheduled focus stream, DOM scope | Item ID unique within pane; hydrate adds only absent IDs; send snapshots IDs/items, successful PTY mutation emits sent before clearing. |
| Gutter `checkboxes`, `selectables`, `paintedLineIds`, `followers`, `scan`, `frame`, `disposables/subscription` | DOM scope maps; `selectables`/`paint` signals; `auditTime` | Selectable ID unique per region source row; paint publishes after checkbox reconciliation; follower Set deleted. |
| Sync `last`, `skipRemovals`, `writing`, `pushSubscription`, `sentSubscription`, `annotations`, `forks` | `scan` keyed successful shapes and sent IDs; `concatMap` write order; `Signal(source$, [])` queries | Upsert before sent marker before queue clear deletion; sent ID consumes exactly one matching removal; `concatMap` has one mutation active. Direct selection writes emit `{clientId, commentId}` for a correlated host fork. |
| Hover `check`, `line`, `pointer`, `follow` | DOM scope check; pointer/line projected stream | One hover checkbox per queue; structured line IDs suppress hover on same row. |
| Marks `layer`, `marks`, `placedByKey`, `placedForks`, `lifetime`, `follow` | DOM scope keyed map; `placedForks` signal | Comment stack key from ordered client IDs; paint computes fork placement once after annotation placement. |
| Fork `layer`, `nodes`, `lifetime`, `follow`, `now`; node `expanded`, `capturedAt`, `capturing` | DOM scope keyed nodes; expanded keys `Signal<ReadonlySet<string>>`; capture `timer` and `exhaustMap` | Fork key `${commentId}:${lane}`; one visible capture per fork per 1,200 ms; removed key cancels its inner stream. |
| Square `entries`, `frames`, `stop`, `disposed`, `resize`, `resizeFrame`, `wheelFrame`, `wheelPending` | DOM observable scope; watcher transitions via `concatMap`; frame `buffer(auditTime)` | One watcher per `(pty, session, target, socket, mode, userKeep)`; each change unwatch then watch; pane close emits final unwatch before effects complete; one keyed element per square ID. |
| Square `recentOffsetPx`, `lastFrame`, `held`, `pointerIn`, `focusIn`, `drawn`, `panelId` | `state.recentOffsetPx/frame`; `scan` latest/held frame; presence stream; measured box projection; panel `opened` | While pointer or focus is inside, newest frame replaces held frame; leave paints it once; wheel/resize reprojects last frame. |
| Square per-entry `visual`, `subscription`, `stamp`, `target` | `Signal` retained square state keyed by ID; synchronous `squareVars` paint; `distinctUntilChanged` stamp; target derived | One state path and DOM node per ID; no per-square subscription. |
| Panel `pinned`, `card/at/star/tagLane/body/md`, `target`, `tags`, `favorited` | One `opened` signal per pane; DOM inner scope; host marks input | Open target fixes position once; opening another cancels prior inner scope; favorite/tag result updates marks input. Global `pinned` deleted. |
| Graphics `canvas`, `ctx`, `pending`, `raf` | DOM scope canvas/context; `auditTime(animationFrameScheduler)` | Newest full frame per animation frame; delete clears immediately; frame `id` must equal pane ID. |

## 6. Callback ledger

| Callback | Current file:line | Replacement | Direction |
| --- | --- | --- | --- |
| Diagram `enabled`, `inference` | `0_terminalDiagrams.ts:439-440` | `DiagramInputs.enabled/inference: SignalSource` | host → package |
| Diagram lightbox `onSelect`, `onClose` | `0_terminalDiagrams.ts:805-809` | internal DOM/React adapter emits `opened` state | DOM → model |
| Queue `paste`, `enabled` | `1a_terminalContextQueue.ts:78-79` | `boop_mux_exit_copy_mode`, `write_pty` endpoints; `inlineStructuredSelectors` signal | package → host transport; host → package state |
| Gutter `enabled`, `toggleStructured` | `1a2_terminalContextGutter.ts:115-116` | `inlineStructuredSelectors` signal; `queue.structuredToggle` event | host → package; gutter → queue |
| Gutter `followers` | `1a2_terminalContextGutter.ts:128` | `gutter.paint: Signal<GutterPaint>` | gutter → marks/hover/fork |
| Sync `sessions` | `1b_terminalContextSync.ts:146` | `sessionIds: SignalSource<string[]>` | host → package |
| Marks `onMenu` | `1d_terminalTurnMarks.ts:83` | `menuRequested: Signal<Event>` | package → instant menu |
| Fork `gutterPaint.followers` | `1f_terminalForkRender.ts:189` | `gutter.paint` signal | gutter → fork |
| Fork `placedForks`, `capture`, `now` | `1f_terminalForkRender.ts:194-196` | `marks.placedForks` signal, `boop_mux_capture` endpoint, `timer` scheduler | marks/host → fork; fork → endpoint |
| Squares `send` / returned stop function | `1_agentSquaresFeed.ts:130` | `squares_watch`, `squares_unwatch` endpoints | package → host transport |
| Squares `onGutter`, `newResize` | `1_agentSquares.ts:138-144` | `gutterChanged` event; native `ResizeObserver` inside observable | package → host; DOM → package |
| Instant queue paste closure | `terminal.ts:817-830` | endpoint sequence in queue effect; host supplies ports | package → host transport |
| Instant marks menu closure | `terminal.ts:842-845` | merge `menuRequested.$` into host menu effect | package → host UI |
| Instant fork `placedForks`/`capture` closures | `terminal.ts:847-850` | marks signal and existing capture endpoint | package → package/host transport |
| Instant square gutter closure | `terminal.ts:196` | merge `gutterChanged.$` into host `refitForGutter` effect | package → host layout |

## 7. Theme token table

| `theme.css` token | Default | Current hard-coded value, instant file:line |
| --- | --- | --- |
| `--boop-xterm-diagram-layer-z` | `4` | `styles.css:1033` |
| `--boop-xterm-diagram-light-fg`, `--boop-xterm-diagram-light-bg` | `#111827`, `#f8fafc` | `styles.css:1289-1290` |
| `--boop-xterm-diagram-dark-fg`, `--boop-xterm-diagram-dark-bg` | `#f8fafc`, `#0f172a` | `styles.css:1293-1294` |
| `--boop-xterm-diagram-padding-block`, `--boop-xterm-diagram-padding-inline` | `3px`, `8px` | `styles.css:1274` |
| `--boop-xterm-diagram-light-surface`, `--boop-xterm-diagram-light-surface-alt`, `--boop-xterm-diagram-light-surface-muted`, `--boop-xterm-diagram-light-border`, `--boop-xterm-diagram-light-line` | `#e0e7ff`, `#dcfce7`, `#fef3c7`, `#475569`, `#334155` | `packages/md/src/0_diagramTheme.ts:3-10` via `0_terminalDiagrams.ts:345-350` |
| `--boop-xterm-diagram-dark-surface`, `--boop-xterm-diagram-dark-surface-alt`, `--boop-xterm-diagram-dark-surface-muted`, `--boop-xterm-diagram-dark-border`, `--boop-xterm-diagram-dark-line` | `#1e293b`, `#172554`, `#3f1d2e`, `#94a3b8`, `#cbd5e1` | `packages/md/src/0_diagramTheme.ts:11-19` via `0_terminalDiagrams.ts:345-350` |
| `--boop-xterm-structured-layer-z`, `--boop-xterm-structured-modal-z` | `5`, `10000` | `styles.css:1313,1359` |
| `--boop-xterm-structured-border`, `--boop-xterm-structured-fg`, `--boop-xterm-structured-bg` | `#5c9f72`, `#b9f6ca`, `color-mix(in srgb, var(--term-bg) 92%, #235c35)` | `styles.css:1345-1347` |
| `--boop-xterm-structured-font`, `--boop-xterm-structured-padding` | `12px Menlo, Monaco, monospace`, `4px 10px` | `styles.css:1348,1350` |
| `--boop-xterm-structured-modal-backdrop`, `--boop-xterm-structured-modal-max-width` | `#0008`, `900px` | `styles.css:1362,1365` |
| `--boop-xterm-structured-button-width`, `--boop-xterm-structured-button-height` | `190px`, `1.5` row heights | `1_terminalStructuredOverlay.ts:87-88` |
| `--boop-xterm-debug-layer-z`, `--boop-xterm-debug-font`, `--boop-xterm-debug-bg` | `8`, `10px Menlo, Monaco, monospace`, `rgba(0,0,0,.82)` | `styles.css:1319,1328,1330` |
| `--boop-xterm-debug-min-width`, `--boop-xterm-debug-padding` | `106px`, `0 5px` | `styles.css:1325-1326` |
| `--boop-xterm-debug-idle-fg`, `--boop-xterm-debug-pointer-bg` | `rgba(150,150,150,.45)`, `rgba(0,0,0,.45)` | `0_turnDebugOverlay.ts:200,206` |
| `--boop-xterm-debug-turn-saturation`, `--boop-xterm-debug-turn-lightness`, `--boop-xterm-debug-pointer-saturation`, `--boop-xterm-debug-pointer-lightness` | `75%`, `62%`, `100%`, `82%` | `0_turnDebugOverlay.ts:199` |
| `--boop-xterm-debug-edge-saturation`, `--boop-xterm-debug-edge-lightness`, `--boop-xterm-debug-region-saturation`, `--boop-xterm-debug-region-lightness` | `80%`, `55%`, `70%`, `60%` | `0_turnDebugOverlay.ts:201-205` |
| `--boop-xterm-debug-pointer-weight`, `--boop-xterm-debug-row-weight` | `700`, `400` | `0_turnDebugOverlay.ts:207` |
| `--boop-xterm-context-layer-z`, `--boop-xterm-context-font` | `7`, `11px/1.3 Menlo, Monaco, monospace` | `styles.css:1054-1056` |
| `--boop-xterm-gutter-offset`, `--boop-xterm-gutter-check-size` | `42px`, `16px` | `1a2_terminalContextGutter.ts:17-19` |
| `--boop-xterm-context-mark-font`, `--boop-xterm-context-mark-fg`, `--boop-xterm-context-mark-hover-bg` | `12px/14px Menlo, Monaco, monospace`, `var(--accent)`, `color-mix(in srgb, var(--accent) 18%, transparent)` | `styles.css:1074-1085` |
| `--boop-xterm-context-queue-bg`, `--boop-xterm-context-queue-fg`, `--boop-xterm-context-queue-border`, `--boop-xterm-context-queue-shadow` | `var(--panel-bg)`, `var(--panel-fg)`, `var(--frame-dark)`, `0 6px 22px rgb(0 0 0 / .34)` | `styles.css:1168-1178` |
| `--boop-xterm-context-queue-width`, `--boop-xterm-context-queue-max-height`, `--boop-xterm-context-status-fg` | `420px`, `52%`, `#e2a65a` | `styles.css:1168-1170,1134` |
| `--boop-xterm-context-chip-saturation`, `--boop-xterm-context-chip-lightness`, `--boop-xterm-context-chip-border-saturation`, `--boop-xterm-context-chip-border-lightness` | `75%`, `72%`, `70%`, `46%` | `1a_terminalContextQueue.ts:226-227` |
| `--boop-xterm-context-check-bg`, `--boop-xterm-context-check-border`, `--boop-xterm-context-check-fg` | `color-mix(in srgb, var(--term-bg) 82%, white)`, `color-mix(in srgb, var(--accent) 72%, white)`, `var(--accent)` | `styles.css:1145-1158` |
| `--boop-xterm-context-item-padding`, `--boop-xterm-context-item-radius`, `--boop-xterm-context-quote-bg`, `--boop-xterm-context-quote-fg`, `--boop-xterm-context-note-font` | `8px 9px`, `5px`, `color-mix(in srgb, var(--term-bg) 85%, transparent)`, `color-mix(in srgb, var(--term-fg) 85%, transparent)`, `11px/1.3 Menlo, Monaco, monospace` | `styles.css:1201-1271` |
| `--boop-xterm-fork-z`, `--boop-xterm-fork-font`, `--boop-xterm-fork-border`, `--boop-xterm-fork-bg`, `--boop-xterm-fork-fg` | `3`, `11px/16px Menlo, Monaco, monospace`, `var(--accent)`, `var(--panel-bg)`, `var(--panel-fg)` | `styles.css:1093-1100` |
| `--boop-xterm-fork-pane-border`, `--boop-xterm-fork-dead-border`, `--boop-xterm-fork-pane-header` | `#34d399`, `#b45309`, `#34d399` | `styles.css:1102,1105,1119` |
| `--boop-xterm-fork-indent`, `--boop-xterm-fork-pane-rows` | `26px`, `8` | `1f_terminalForkRender.ts:57-59` |
| `--boop-xterm-squares-layer-z`, `--boop-xterm-squares-popover-z`, `--boop-xterm-squares-gap-z` | `4`, `2`, `1` | `1_agentSquares.css:58,134,208` |
| `--boop-xterm-squares-size`, `--boop-xterm-squares-gap`, `--boop-xterm-squares-gutter` | `12px`, `5px`, `32px` | `0_agentSquareVisual.ts:12-20` |
| `--boop-xterm-squares-step`, `--boop-xterm-squares-hit`, `--boop-xterm-squares-tool-size`, `--boop-xterm-squares-tool-hit`, `--boop-xterm-squares-band-size` | `17px`, `24px`, `5px`, `10px`, `7px` | `1_agentSquares.css:16-28,202-203,230-231` |
| `--boop-xterm-squares-user-shape`, `--boop-xterm-squares-agent-shape`, `--boop-xterm-squares-tool-shape`, `--boop-xterm-squares-other-shape` | `50%`, `2.4px`, `1px`, `3px` | `0_agentSquareVisual.ts:35-39` |
| `--boop-xterm-squares-user-tone`, `--boop-xterm-squares-agent-tone`, `--boop-xterm-squares-tool-tone`, `--boop-xterm-squares-other-tone` | `82% 62%`, `58% 54%`, `24% 46%`, `12% 52%` | `0_agentSquareVisual.ts:134-140` |
| `--boop-xterm-squares-popover-bg`, `--boop-xterm-squares-popover-fg`, `--boop-xterm-squares-popover-border`, `--boop-xterm-squares-popover-muted` | `rgba(12,12,14,.96)`, `#e8e8ea`, `rgba(255,255,255,.16)`, `#9a9aa2` | `1_agentSquares.css:252-255,273` |
| `--boop-xterm-squares-popover-width`, `--boop-xterm-squares-popover-max-height`, `--boop-xterm-squares-pop-flip`, `--boop-xterm-squares-pop-anchor` | `36%`, `220px`, `140px`, `60px` | `1_agentSquares.css:246,249`; `1_agentSquares.ts:62,68` |
| `--boop-xterm-squares-popover-font`, `--boop-xterm-squares-popover-radius`, `--boop-xterm-squares-tool-gap-color`, `--boop-xterm-squares-track-fallback` | `11px/1.45 ui-monospace, Menlo, monospace`, `4px`, `#a8a8a8`, `320px` | `1_agentSquares.css:86,253-256,286` |
| `--boop-xterm-panel-z`, `--boop-xterm-panel-min-width`, `--boop-xterm-panel-max-width`, `--boop-xterm-panel-max-height` | `9`, `560px`, `920px`, `860px` | `1_turnPanel.css:12,21-23` |
| `--boop-xterm-panel-padding`, `--boop-xterm-panel-radius`, `--boop-xterm-panel-shadow`, `--boop-xterm-panel-tag-font` | `12px 14px`, `6px`, `0 6px 22px rgb(0 0 0 / .34)`, `10px` | `1_turnPanel.css:24,26,29,84` |
| `--boop-xterm-panel-bg`, `--boop-xterm-panel-fg`, `--boop-xterm-panel-border`, `--boop-xterm-panel-font` | `var(--panel-bg)`, `var(--panel-fg)`, `var(--frame-dark)`, `14px/1.55 Menlo, Monaco, monospace` | `1_turnPanel.css:25,27-30` |
| `--boop-xterm-panel-body-bg`, `--boop-xterm-panel-body-fg`, `--boop-xterm-panel-body-border`, `--boop-xterm-panel-star-active` | `color-mix(in srgb, var(--term-bg) 85%, transparent)`, `color-mix(in srgb, var(--term-fg) 88%, transparent)`, `color-mix(in srgb, var(--panel-fg) 30%, transparent)`, `var(--accent)` | `1_turnPanel.css:60,111-113` |
| `--boop-xterm-graphics-z` | `5` | `graphics.ts:42` |

| Theme resolution rule | Implementation |
| --- | --- |
| Default sheet | One `src/theme.css` defines every `--boop-xterm-<part>-<prop>` above and all remaining copied overlay CSS sizes/colors/fonts/z-indexes. No default value remains only in an inline style or `var()` fallback. |
| Canvas/SVG | `getComputedStyle(host).getPropertyValue(token)` at paint or theme revision. Mermaid receives the resolved seven-color `DiagramPalette`. The installed D2 renderer exposes `themeID` only (`packages/md/node_modules/@terrastruct/d2/index.d.ts:9-14`), so the package normalizes D2 SVG `fill`, `stroke`, background and text paints to the resolved palette before insertion, with a snapshot for each built-in theme. `GraphicsFrame` RGBA pixels are protocol data; canvas overlay z-index and size come from tokens. |
| xterm | Consumer still supplies `Terminal.options.theme: ITheme`; package theme sheet does not overwrite it. |

## 8. Host composition

```ts
// instant/src/terminal.ts, after wave 3 implementation and same-wave original deletion.
const ports: BoopXtermPorts = {
  ...wave2Ports,
  boop_turn_comments: commandEndpoint("boop_turn_comments"),
  boop_turn_annotations: commandEndpoint("boop_turn_annotations"),
  boop_turn_comment_forks: commandEndpoint("boop_turn_comment_forks"),
  boop_turn_comment_upsert: commandEndpoint("boop_turn_comment_upsert"),
  boop_turn_comment_delete: commandEndpoint("boop_turn_comment_delete"),
  boop_turn_comments_sent: commandEndpoint("boop_turn_comments_sent"),
  squares_watch: commandEndpoint("squares_watch"),
  squares_unwatch: commandEndpoint("squares_unwatch"),
  boop_mux_exit_copy_mode: commandEndpoint("boop_mux_exit_copy_mode"),
  write_pty: commandEndpoint("write_pty"),
  "squares-update": nativeEvent$<Strip>("squares-update"),
  inlineDiagrams: settings.inlineDiagrams,
  diagramInference: settings.inlineDiagramInference,
  inlineStructuredSelectors: settings.inlineStructuredSelectors,
  structuredOverlayEnabled: Signal(false),
  turnDebugEnabled: turnDebug.on,
  agentSquaresEnabled: agentSquares.on,
  squaresOptions: Signal(() => squaresOptions()),
  favoriteSources: favoriteSourcesSignal,
  forkLivePane: forkRender.livePane,
  tabName: Signal(name),
  sessionIds: paneHost.tabSessionIds,
};
// createBoopXtermPane constructs wave 2 first, then diagram/queue/gutter/sync/marks/fork/strip/panel.
// Graphics tabs construct graphicsOverlayStream(el, id, nativeEvent$<GraphicsFrame>("pty-graphics"))
// next to createBoopXtermPane.
// pane.effects merges every wave 3 `effects` with existing effects; paneClosed first drives final
// squares_unwatch through concatMap, then the graph completes. The host does not cut that mutation off with takeUntil.
// Host merges pane.pinned.copy, pane.agentSquares.gutterChanged, pane.turnMarks.menuRequested,
// pane.turnPanel.favoriteToggle/tagEdit, pane.contextSync.selectionWritten, pane.paneSession binding,
// and graphics.effects into its root effects. favoriteSourcesSignal is updated wherever boopFavorites changes.
// terminalSelectionSnapshot remains a pure synchronous read; askAboutSelection generates the item id,
// writes queue.add and queue.focusNote; activate writes diagram.activate and contextSync.refresh.
// forkSelection writes contextSync.sendSelection with selectionClientId; selectionWritten matching
// that clientId continues applyTags/spawnFork/openForkPanel in the host effect stream.
// `main.ts` owns the one application subscription per lift plan; terminal.ts returns effects to it.
// `@hafley66/boop-xterm/theme.css` is imported once beside other package styles.
```

| Instant-only behavior retained | File:line | Reason |
| --- | --- | --- |
| Favorites cache, favorite mutation, tag prompting/application, `cachedMarks`, status flash | `favorites.ts`; `1_turnPanel.ts:186,372-415` | App store, prompt UI and status chrome; package emits target events. |
| `BoopConversation` | `plans/boop-xterm-wave2.DESIGN.md:658-670` ruling 7 | Type-only instant interface, no package runtime. |
| `tablepanels` and dock/preview | `terminal.ts:28-40`; `1_turnPanel.ts:1-29` | App panel registry and preview chrome. |
| Fork menu, preset choices, `runFork`, `liveCwd` | `terminal.ts:214,838-850`; `1g_forkPresetMenu.ts` | Shell command launch, menu widget, workspace cwd and app preset policy. Pure `forkCommand`, `forkedLane`, `selectionClientId`, `forkMenuTargets` move unchanged and are imported back. |
| `bracketedPaste` body preparation, pane focus, `refitForGutter` | `terminal.ts:816-830,167-178` | PTY input convention, focus and fit addon layout owned by host. |
| Settings and theme selection, `THEMES`/`ITheme` | `terminal.ts:748,0_settings.ts` | Consumer controls xterm colors and package token overrides. |
| `liveProbe.record` | `1_agentSquares.ts:298-309` | Instant telemetry sink; package can emit projection events for host recording. |
| Kitty event listener and tab identity filter | `main.ts:413-414`; `terminal.ts:766` | Host transport and tab registry; package only receives the `"pty-graphics"` observable. |
| Click rules, cmd-click routing, inspector, OS clipboard | `terminal.ts:889-920` | App navigation and system effects. |

## 9. Lane split

| Lane | Disjoint instant source files owned | Source lines | Depends on |
| --- | --- | ---: | --- |
| 3a | `0_terminalDiagrams.ts` (871), `graphics.ts` (95), `0_agentSquareVisual.ts` (158), `1_agentSquaresMarks.ts` (30), `1_agentSquaresModel.ts` (196), `1_agentSquaresFeed.ts` (133) | 1,483 | Waves 1/2; `@hafley66/md` for diagrams. Add `8_turnHue.ts` with the unchanged pure body copied from `0_turnDebugOverlay.ts:37-45`; 3c owns the original debug file and re-exports it. |
| 3b | `1a_terminalContextQueue.ts` (332), `1b_terminalContextSync.ts` (273), `1a2_terminalContextGutter.ts` (227), `1c_terminalHoverCheck.ts` (127), `1d_terminalTurnMarks.ts` (166), `1e_terminalForkMarks.ts` (59), `1f_terminalForkRender.ts` (299) | 1,483 | 3a pure hue/diagram types and wave 2 pane/visibility/anchors. Queue/gutter import cycle breaks at `ContextQueueModel`/`GutterPaint` types. |
| 3c | `1_agentSquares.ts` (552), `1_turnPanel.ts` (418), `1_terminalStructuredOverlay.ts` (119), `0_turnDebugOverlay.ts` (269) | 1,358 | 3a model/feed/diagrams, 3b queue/marks events, wave 2 visibility. Host wiring and `theme.css` land after these models. |

## 10. Test plan

| Model | Case | Input | Expected | Why it exists |
| --- | --- | --- | --- | --- |
| Diagram | Scan settles without visibility change | Real `Terminal` with stripped fence, `settled` event | Fence appears once; no duplicate element | Current settled-keys gate. |
| Diagram | Fast source replacement | Real terminal writes two diagrams; first render delayed | Only latest SVG commits; teardown removes root | Replaces generation flag. |
| Structured | Open/close region | Real terminal table region, click and outside click | One modal, removed on close and pane teardown | DOM listener lifetime. |
| Debug | Pointer/scroll shift | Real terminal turns, pointermove, viewport scroll | Snapshot of row tags/positions and panel target | Shift and hit mapping. |
| Context queue | Send success/failure | Real terminal host, endpoint result streams | Success emits `sent` before clear; failure keeps note and rows | Data loss boundary. |
| Gutter/hover | Duplicate row | Real terminal table/list and hover pointer | One checkbox for structured row; stable key | Selection uniqueness. |
| Sync | Edit/send/delete ordering | Controlled endpoint responses with delayed upsert | Upsert, sent marker, later unrelated delete in order; local ID wins hydrate | Prevent resurrection and sent-row deletion. |
| Marks/forks | Same-row stack and two lanes | Two comments, two forks on real terminal | Stable mark and fork keys; one capture per visible live lane | Placement/capture uniqueness. |
| Squares | Retarget while frame arrives | Real terminal and pushed frames, change session/options | Old watcher unwatch, new watch, only new session frames painted | Watch lifetime. |
| Squares | Pointer hold and wheel burst | Real DOM events and server frames | Newest held frame paints once on leave; wheel sums per frame | Replaces timing flags. |
| Turn panel | Open, favorite/tag event, Escape | Real terminal click path and real DOM | One card, events carry target, React unmounts on close | App boundary and listener teardown. |
| Graphics | Two frames plus delete | Real canvas and `GraphicsFrame` input | Last frame drawn; delete clears; canvas removed | Compositor and lifetime. |
| Theme | Override tokens | Host sets CSS variables before real terminal paint | Computed colors/sizes/z-index and SVG palette use overrides | Themeability contract. |
| All models | Connect/disconnect | `test/1_realTerminal.ts` helper opens real `@xterm/xterm` in Vitest browser; subscribe to merged `effects`, then unsubscribe | All DOM nodes/listeners/watchers released; no source `.subscribe(` outside tests | Subscription law. |

```ts
// Test fixture contract: test/1_realTerminal.ts
export function openRealTerminal(): { term: Terminal; host: HTMLElement; unsubscribe(): void };
// Use browser runner, actual Terminal.open(host), actual DOM events and canvas.
// Endpoint response Observables may be controlled; xterm and DOM are never doubled.
// Assert snapshots with toMatchInlineSnapshot/toMatchSnapshot; no toBeDefined.
```

## 11. Open questions

| File:line | Question | Required resolution before implementation |
| --- | --- | --- |
| `0_terminalDiagrams.ts:55-93,326-373` | Should Mermaid's lazy `?url` bundle loader remain in boop-xterm or move into `@hafley66/md`? | Confirm package build can emit the asset and public theme inputs for Mermaid/D2. |
| `0_terminalDiagrams.ts:788-811` | Does `@hafley66/md` lightbox require callbacks in its internal React props? | Keep callbacks private to DOM adapter; expose only `opened` signal from boop-xterm. |
| `1_turnPanel.ts:1-29,97-115` | Which markdown rendering imports belong in boop-xterm's peer dependencies? | Confirm `Streamdown`, `@streamdown/code`, React and `@hafley66/md` package boundary. |
| `1_agentSquaresFeed.ts:107-133` | Is Rust `SquaresOptions` mode optional on the wire while host settings has concrete mode? | Preserve `serde(rename_all = "camelCase")` and type `options` to accepted generated command input. |
| `1f_terminalForkRender.ts:192-196,275-286` | Should lane capture use existing `boop_mux_capture` endpoint's `{target,socket}` input with `socket: null`? | Confirm fork lanes never require a non-default socket. |
| `1a_terminalContextQueue.ts:78-79`; `terminal.ts:817-830` | Should bracketed paste formatting be a pure package helper or host input stream? | Preserve host-owned PTY convention while keeping package send mutation typed. |
| `graphics.ts:51-77`; `terminal.ts:766` | Do partial Kitty graphics frames occur for current Awrit path? | Keep `putImageData(x,y)` behavior and only coalesce full-frame replacements. |
| `styles.css:1028-1380` | Which inherited app tokens become standalone defaults? | Copy each resolved default into `theme.css` while allowing consumer overrides; test without instant stylesheet. |
