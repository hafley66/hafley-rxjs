import type { Endpoint, Query, Signal, SignalSource } from "@hafley66/signals";
import type { Observable } from "rxjs";
import type { ProjectedTurnRegion } from "./0_turnRegions.js";
import type { BoopTurn, HarnessId, LogicalLine, VisibleTurn } from "./0_types.js";
import type { PinnedSelection, SelectionCell } from "./2_pinnedSelectionPure.js";
import type { TurnSpan, TurnVisibilityEvent } from "./2_turnLocate.js";
import type { TerminalWheelState } from "./2_wheelReduce.js";

export type PaneIdentity = { id: string; target: string; socket: string | null };
export type PaneSessionBinding = { session: string; harness: string | null };
export type BoopSyncStat = { written: number; dropped: number };
export type ViewportPoint = { clientX: number; clientY: number };
export type ViewportChange = {
  kind: "write" | "scroll" | "resize";
  cols: number;
  rows: number;
  viewportY: number;
  bufferLength: number;
};
export type ViewportGeometry = { top: number; cellHeight: number; viewportY: number; rows: number };
export type ViewportSnapshot = { change: ViewportChange; lines: LogicalLine[]; visible: boolean; geometry: ViewportGeometry };
export type SelectionState = {
  selection: PinnedSelection | null;
  captured: string[];
  anchor: SelectionCell | null;
  dragging: boolean;
};
export type PaneRuntimeState = { viewportRevision: number; selection: SelectionState };
export type TurnVisibilityState = { visible: VisibleTurn[] };
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
  selectionClear: Signal<void | undefined>;
};
export type ViewportModel = {
  snapshot: Signal<ViewportSnapshot>;
  changes: Signal<ViewportChange | undefined>;
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
export type TurnAtPoint = { point: ViewportPoint; turn: VisibleTurn | null };
export type RegionAtPoint = { point: ViewportPoint; region: ProjectedTurnRegion | null };
