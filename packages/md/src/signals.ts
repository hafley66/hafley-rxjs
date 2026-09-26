// Signals-backed state for the mdview panel: the per-path doc cache, per-path
// collapse sets, and the persisted UI options. Follows the
// reactive/statusModel.ts idiom — Signal for state, SignalReact in the panel
// reads it; mutations go through the helpers so signal + pluginState stay in
// sync no matter where they're toggled from.
import { Signal, type Signal as SignalNode, type Signal$ } from "@hafley66/signals";
import { CAT_PARSE, CAT_READ, LOG, mdNow } from "./0_log.js";
import { getMdviewHost } from "./ports.js";
import { allSectionIds, mdDocument, type MdDoc, type MdDocument } from "./model.js";
import {
  clampProseWidth,
  DEFAULT_PROSE_WIDTH,
  DEFAULT_PROSE_WIDTH_BOUNDS,
  normalizeProseWidthBounds,
  type ProseWidthBounds,
} from "./lib/1_proseWidth.js";

const PLUGIN_ID = "md";

export interface MdUi {
  startFolded: boolean; // open docs fully folded (TOC/outline first) — default ON
  layout: number[] | null; // global default [explorer, content] percentages
  layouts: Record<string, number[]>; // per-tab split overrides, keyed by panel id
  explorerHidden: boolean; // explorer sidebar collapsed (global)
  proseWidth: number; // global default prose width in CSS pixels
  proseWidths: Record<string, number>; // per-panel prose width overrides
  proseWidthMin: number; // global editable lower bound in CSS pixels
  proseWidthMax: number; // global editable upper bound in CSS pixels
  diagramRenderer: DiagramRenderer; // sequence fences: raw renderer SVG, or the experimental grapht canvas (global)
}

export type DiagramRenderer = "svg" | "grapht";

const DEFAULT_UI: MdUi = {
  startFolded: true,
  layout: null,
  layouts: {},
  explorerHidden: false,
  proseWidth: DEFAULT_PROSE_WIDTH,
  proseWidths: {},
  proseWidthMin: DEFAULT_PROSE_WIDTH_BOUNDS.min,
  proseWidthMax: DEFAULT_PROSE_WIDTH_BOUNDS.max,
  diagramRenderer: "svg",
};

// Seeded with defaults at module load (before a host may exist); the real
// persisted values are applied by loadPersistedMdUi(), which registerMdview()
// calls once a host is installed and before any panel can read this signal.
export const mdUi = Signal<MdUi>(DEFAULT_UI);

export function loadPersistedMdUi(): void {
  const saved = getMdviewHost().readPluginState<Partial<MdUi>>(PLUGIN_ID, {});
  const bounds = normalizeProseWidthBounds({ min: saved.proseWidthMin, max: saved.proseWidthMax });
  const proseWidths = saved.proseWidths ?? {};
  mdUi.$({
    ...DEFAULT_UI,
    ...mdUi.$(),
    ...saved,
    layouts: saved.layouts ?? mdUi.$().layouts,
    proseWidths,
    proseWidthMin: bounds.min,
    proseWidthMax: bounds.max,
    proseWidth: clampProseWidth(saved.proseWidth ?? DEFAULT_UI.proseWidth, bounds),
  });
}

export function setMdUi(patch: Partial<MdUi>): void {
  mdUi.$({ ...mdUi.$(), ...patch });
  getMdviewHost().savePluginState<MdUi>(PLUGIN_ID, patch);
}

const FALLBACK_LAYOUT = [26, 74];

// Persist a drag result for this tab AND as the global default new tabs open
// with ("remember globally/per panel/tab").
export function setLayoutFor(pid: string, layout: number[]): void {
  setMdUi({ layout, layouts: { ...mdUi.$().layouts, [pid]: layout } });
}

export function layoutFor(pid: string): number[] {
  const ui = mdUi.$();
  return ui.layouts[pid] ?? ui.layout ?? FALLBACK_LAYOUT;
}

export function toggleExplorer(): void {
  setMdUi({ explorerHidden: !mdUi.$().explorerHidden });
}

const proseWidthSignals = new Map<string, SignalNode<number>>();

export function proseWidthBounds(): ProseWidthBounds {
  const ui = mdUi.$();
  return normalizeProseWidthBounds({ min: ui.proseWidthMin, max: ui.proseWidthMax });
}

export function proseWidthFor(pid: string): number {
  const ui = mdUi.$();
  return clampProseWidth(ui.proseWidths[pid] ?? ui.proseWidth, proseWidthBounds());
}

// xdom's gutter reads and writes a Signal. The actual persistence write stays
// in setProseWidthFor so pointer gestures and sliders use the same mdUi path.
export function proseWidthSignalFor(pid: string): SignalNode<number> {
  let signal = proseWidthSignals.get(pid);
  if (!signal) {
    signal = Signal(proseWidthFor(pid));
    proseWidthSignals.set(pid, signal);
  }
  return signal;
}

function syncProseWidthSignals(): void {
  for (const [pid, signal] of proseWidthSignals) {
    const next = proseWidthFor(pid);
    if (signal.$() !== next) signal.$(next);
  }
}

export function setProseWidthFor(pid: string, value: number): void {
  const width = clampProseWidth(value, proseWidthBounds());
  setMdUi({ proseWidth: width, proseWidths: { ...mdUi.$().proseWidths, [pid]: width } });
  syncProseWidthSignals();
}

export function setProseWidthBounds(patch: Partial<ProseWidthBounds>): void {
  const current = proseWidthBounds();
  const bounds = normalizeProseWidthBounds({ ...current, ...patch });
  const proseWidths = Object.fromEntries(
    Object.entries(mdUi.$().proseWidths).map(([pid, value]) => [pid, clampProseWidth(value, bounds)]),
  );
  setMdUi({
    proseWidthMin: bounds.min,
    proseWidthMax: bounds.max,
    proseWidth: clampProseWidth(mdUi.$().proseWidth, bounds),
    proseWidths,
  });
  syncProseWidthSignals();
}

// Per-panel current document path. Keyed by panel id so navigation survives a
// dock remount (the React subtree remounts, the panel id doesn't change).
export type StrSignal = { $: Signal$<string> };
const panelPaths = new Map<string, StrSignal>();

export function pathSignalFor(pid: string, initial: string): StrSignal {
  let sig = panelPaths.get(pid);
  if (!sig) {
    sig = Signal(initial);
    panelPaths.set(pid, sig);
  }
  return sig;
}

export type MdDocState =
  | { status: "loading" }
  | { status: "ready"; text: string; doc: MdDoc; document: MdDocument }
  | { status: "error"; error: string };

export const mdDocs: SignalNode<Record<string, MdDocState>> = Signal<Record<string, MdDocState>>({});

/** When each path's current load began, so the panel can time open → commit → paint. */
export const mdOpenedAt = new Map<string, number>();

async function readAndParse(path: string): Promise<{ text: string; document: MdDocument }> {
  const started = mdNow();
  mdOpenedAt.set(path, started);
  const text = await getMdviewHost().readText(path);
  const read = mdNow();
  if (LOG.on) LOG.emit(CAT_READ, "read {path} {durationMs}ms {bytes}B", { path, durationMs: Math.round(read - started), bytes: text.length });
  const document = mdDocument(path, text);
  if (LOG.on) LOG.emit(CAT_PARSE, "parse {path} {durationMs}ms", { path, durationMs: Math.round(mdNow() - read), bytes: text.length });
  return { text, document };
}

export async function loadMdDoc(path: string): Promise<void> {
  const cur = mdDocs.$()[path];
  if (cur && cur.status !== "error") return;
  mdDocs.$({ ...mdDocs.$(), [path]: { status: "loading" } });
  try {
    const { text, document } = await readAndParse(path);
    mdDocs.$({ ...mdDocs.$(), [path]: { status: "ready", text, doc: document.doc, document } });
  } catch (e) {
    mdDocs.$({ ...mdDocs.$(), [path]: { status: "error", error: String(e) } });
  }
}

export async function reloadMdDoc(path: string): Promise<void> {
  try {
    const { text, document } = await readAndParse(path);
    mdDocs.$({ ...mdDocs.$(), [path]: { status: "ready", text, doc: document.doc, document } });
  } catch (e) {
    mdDocs.$({ ...mdDocs.$(), [path]: { status: "error", error: String(e) } });
  }
}

// Per-open-panel collapse state (session-only — a reopen re-applies the
// startFolded default). One Signal per path so a fold only re-renders its own
// panel. The lib's node type isn't exported (only the Signal$ accessor type
// is), so the map is typed structurally.
type SetSignal = { $: Signal$<Set<string>> };
const collapsedSignals = new Map<string, SetSignal>();
// Paths whose collapse set has already been initialized from a ready doc (vs a
// signal created while the doc was still loading, which got the empty set).
const readyInited = new Set<string>();

export function collapsedFor(path: string): SetSignal {
  let sig = collapsedSignals.get(path);
  if (!sig) {
    sig = Signal<Set<string>>(defaultCollapsed(path));
    collapsedSignals.set(path, sig);
  }
  return sig;
}

function defaultCollapsed(path: string): Set<string> {
  if (!mdUi.$().startFolded) return new Set();
  const state = mdDocs.$()[path];
  return state?.status === "ready" ? allSectionIds(state.doc) : new Set();
}

// Called by the panel when its doc flips to ready: a collapse set created
// during loading (empty) now gets the folded default applied once.
export function initCollapsedForReadyDoc(path: string): void {
  if (readyInited.has(path)) return;
  readyInited.add(path);
  collapsedFor(path).$(defaultCollapsed(path));
}

export function toggleCollapsed(path: string, id: string): void {
  const sig = collapsedFor(path);
  const next = new Set(sig.$());
  if (next.has(id)) next.delete(id);
  else next.add(id);
  sig.$(next);
}

export function expandIds(path: string, ids: string[]): void {
  const sig = collapsedFor(path);
  const next = new Set(sig.$());
  for (const id of ids) next.delete(id);
  sig.$(next);
}

// Per-path list fold state (offsets from MdDoc.folds.lists as keys). Default
// is empty: lists start unfolded even under startFolded (which collapses
// sections only); "fold all" folds every list too.
type NumSetSignal = { $: Signal$<Set<number>> };
const blockFoldSignals = new Map<string, NumSetSignal>();

export function blockFoldsFor(path: string): NumSetSignal {
  let sig = blockFoldSignals.get(path);
  if (!sig) {
    sig = Signal<Set<number>>(new Set<number>());
    blockFoldSignals.set(path, sig);
  }
  return sig;
}

export function toggleBlockFold(path: string, offset: number): void {
  const sig = blockFoldsFor(path);
  const next = new Set(sig.$());
  if (next.has(offset)) next.delete(offset);
  else next.add(offset);
  sig.$(next);
}

export function setAllCollapsed(path: string, collapsed: boolean): void {
  readyInited.add(path); // an explicit user gesture, not the auto-default
  collapsedFor(path).$(collapsed ? defaultCollapsedAll(path) : new Set());
  // fold all also folds every list; unfold all clears them. Lists are the only
  // rendered fold unit, so item offsets in folds.all stay out of the set.
  const state = mdDocs.$()[path];
  blockFoldsFor(path).$(
    collapsed && state?.status === "ready" ? new Set(state.doc.folds.lists.keys()) : new Set(),
  );
}

function defaultCollapsedAll(path: string): Set<string> {
  const state = mdDocs.$()[path];
  return state?.status === "ready" ? allSectionIds(state.doc) : new Set();
}

export function closeMdDoc(path: string): void {
  collapsedSignals.delete(path);
  blockFoldSignals.delete(path);
  readyInited.delete(path);
  const next = { ...mdDocs.$() };
  delete next[path];
  mdDocs.$(next);
}
