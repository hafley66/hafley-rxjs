import type { IDisposable, Terminal } from "@xterm/xterm";
import { Signal, toSignal, type SignalSource, type Signal as SignalType } from "@hafley66/signals";
import { DiagramLightbox, diagramSvgMarkup, renderDiagram$, type DiagramLightboxEntry, type DiagramPalette, type RenderedDiagram } from "@hafley66/md";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { EMPTY, Observable, animationFrameScheduler, auditTime, catchError, defer, filter, forkJoin, map, merge, of, share, shareReplay, switchMap, take, tap, timer } from "rxjs";
import type { ProjectedTurnRegion } from "./0_turnRegions.js";
import { diagramElementAtPoint, diagramElementKey, findDiagramFences, mergeLocatedDiagrams, projectedDiagramIsCurrent, svgAspectRatio, type DiagramFence, type DiagramInference, type TerminalDiagramLayout } from "./1_terminalDiagrams.js";
import type { TurnVisibilityModel } from "./3_ports.js";

export type DiagramInputs = {
  enabled: SignalSource<boolean>;
  inference: SignalSource<DiagramInference>;
  scrollGesture: SignalType<void | undefined>;
  activate: SignalType<void | undefined>;
  layout: TerminalDiagramLayout;
};
export type DiagramOverlayModel = {
  opened: SignalType<DiagramLightboxEntry | undefined>;
  /** Host request to open the diagram under a point (e.g. a context-menu item); a null clientX matches the row alone. */
  openAt: SignalType<{ clientX: number | null; clientY: number } | undefined>;
  effects: Observable<void>;
};
type OverlayEvent = "mount" | "write" | "scroll" | "resize" | "click";
type Drawn = { fence: DiagramFence; result: RenderedDiagram | null; error: string };
type Plan = { dark: boolean; palette: DiagramPalette; fingerprint: string; fences: DiagramFence[] };
const MAX_RENDER_CACHE_ENTRIES = 32;
const MAX_LIGHTBOX_ENTRIES = 32;

function darkBackground(host: HTMLElement): boolean {
  const channels = getComputedStyle(host).backgroundColor.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  return !!channels && channels.reduce((sum, channel) => sum + channel, 0) < 384;
}
function paletteFor(host: HTMLElement, dark: boolean): DiagramPalette {
  const style = getComputedStyle(host);
  const key = dark ? "dark" : "light";
  const read = (name: string) => style.getPropertyValue(`--boop-xterm-diagram-${key}-${name}`).trim();
  return {
    background: read("bg"), surface: read("surface"), surfaceAlt: read("surface-alt"),
    surfaceMuted: read("surface-muted"), text: read("fg"), border: read("border"), line: read("line"),
  };
}
function fenceFor(region: ProjectedTurnRegion & { kind: "mermaid" | "d2" }): DiagramFence {
  return {
    language: region.kind, code: region.text, start: region.bufferStart, end: region.bufferEnd,
    inferred: false, locator: `boop:${region.turnId}`, messageId: region.turnId,
  };
}
function planFor(term: Terminal, host: HTMLElement, visibility: TurnVisibilityModel,
  inference: DiagramInference, paintedKeys: ReadonlySet<string>, settledKeys: ReadonlySet<string>): Plan {
  const viewportTop = term.buffer.active.viewportY;
  const viewportEnd = viewportTop + term.rows - 1;
  const dark = darkBackground(host);
  const palette = paletteFor(host, dark);
  const projected = visibility.state.visible.$().flatMap((turn) => turn.regions
    .filter((region): region is ProjectedTurnRegion & { kind: "mermaid" | "d2" } =>
      (region.kind === "mermaid" || region.kind === "d2") && projectedDiagramIsCurrent(term, region))
    .map(fenceFor));
  const direct = findDiagramFences(term, inference).filter((fence) => {
    if (fence.stripped && visibility.scanning.$()) {
      const key = diagramElementKey(fence, dark);
      return paintedKeys.has(key) || settledKeys.has(key);
    }
    if (!fence.inferred) return true;
    if (fence.language !== "mermaid") return false;
    return !projected.some((region) => region.language === fence.language && region.start <= fence.end && fence.start <= region.end);
  });
  const fences = mergeLocatedDiagrams(direct, projected).filter((fence) => fence.end >= viewportTop && fence.start <= viewportEnd);
  const fingerprint = `${JSON.stringify(palette)}:${viewportTop}:${fences.map((fence) => `${diagramElementKey(fence, dark)}#${fence.code.length}`).sort().join("|")}`;
  return { dark, palette, fingerprint, fences };
}
function positionElements(term: Terminal, host: HTMLElement, root: HTMLElement): void {
  const screen = host.querySelector<HTMLElement>(".xterm-screen");
  if (!screen) return;
  const hostRect = host.getBoundingClientRect();
  const screenRect = screen.getBoundingClientRect();
  const cellHeight = screenRect.height / term.rows;
  const viewportTop = term.buffer.active.viewportY;
  const viewportEnd = viewportTop + term.rows - 1;
  root.querySelectorAll<HTMLElement>(".term-diagram").forEach((element) => {
    const start = Number(element.dataset.bufferStart);
    const end = Number(element.dataset.bufferEnd);
    const visibleStart = Math.max(start, viewportTop);
    const visibleEnd = Math.min(end, viewportEnd);
    element.hidden = visibleStart > visibleEnd;
    if (element.hidden) return;
    Object.assign(element.style, {
      left: `${screenRect.left - hostRect.left}px`,
      top: `${screenRect.top - hostRect.top + (visibleStart - viewportTop) * cellHeight}px`,
      width: `${screenRect.width}px`,
      height: `${(visibleEnd - visibleStart + 1) * cellHeight}px`,
    });
  });
}
function paint(term: Terminal, host: HTMLElement, root: HTMLElement, layout: TerminalDiagramLayout, plan: Plan, drawn: Drawn[]): void {
  const screen = host.querySelector<HTMLElement>(".xterm-screen");
  if (!screen) return;
  const screenRect = screen.getBoundingClientRect();
  const cellHeight = screenRect.height / term.rows;
  const existing = new Map(Array.from(root.querySelectorAll<HTMLElement>(".term-diagram"))
    .map((element) => [element.dataset.diagramKey ?? "", element]));
  const occurrences = new Map<string, number>();
  const elements = drawn.filter((entry) => entry.result).map(({ fence, result }) => {
    if (!result) throw new Error("Missing rendered diagram");
    const adjusted = result.lineCount < fence.code.split("\n").length
      ? { ...fence, code: result.code, end: Math.min(fence.end, fence.start + result.lineCount) } : fence;
    const base = diagramElementKey(adjusted, plan.dark);
    const seen = occurrences.get(base) ?? 0;
    occurrences.set(base, seen + 1);
    const key = seen === 0 ? base : `${base}#${seen}`;
    const element = existing.get(key) ?? document.createElement("div");
    const created = !element.dataset.diagramKey;
    element.dataset.diagramKey = key;
    element.dataset.language = adjusted.language;
    element.dataset.diagramTheme = plan.dark ? "dark" : "light";
    element.dataset.diagramCode = adjusted.code;
    element.dataset.diagramLocator = adjusted.locator ?? "terminal buffer";
    element.dataset.diagramInferred = String(adjusted.inferred);
    const aspectRatio = svgAspectRatio(result.svg);
    const sourceRows = adjusted.end - adjusted.start + 1;
    const requestedHeight = aspectRatio
      ? Math.min(screenRect.height * layout.maxViewportHeightRatio, screenRect.width / aspectRatio)
      : sourceRows * cellHeight;
    const requestedRows = Math.max(sourceRows, Math.ceil(requestedHeight / cellHeight));
    let allocatedEnd = adjusted.end;
    const blankLimit = Math.min(term.buffer.active.length - 1, adjusted.end + layout.maxBlankRows, adjusted.start + requestedRows - 1);
    while (allocatedEnd < blankLimit) {
      const next = term.buffer.active.getLine(allocatedEnd + 1);
      if (!next || next.translateToString(true).trim()) break;
      allocatedEnd++;
    }
    element.dataset.sourceRows = String(sourceRows);
    element.dataset.allocatedRows = String(allocatedEnd - adjusted.start + 1);
    element.dataset.bufferStart = String(adjusted.start);
    element.dataset.bufferEnd = String(allocatedEnd);
    if (created) {
      element.className = "term-diagram";
      element.title = "Click to expand diagram";
    }
    const markup = diagramSvgMarkup(result.svg);
    if (element.innerHTML !== markup) element.innerHTML = markup;
    return element;
  });
  const current = Array.from(root.children);
  if (current.length !== elements.length || elements.some((element, index) => current[index] !== element)) root.replaceChildren(...elements);
  positionElements(term, host, root);
}

function entryAt(root: ParentNode, clientX: number | null, clientY: number): DiagramLightboxEntry | null {
  const element = diagramElementAtPoint(Array.from(root.querySelectorAll<HTMLElement>(".term-diagram")), clientX, clientY);
  if (!element) return null;
  return {
    id: `${element.dataset.diagramKey}:${performance.now()}`, svg: element.innerHTML,
    language: element.dataset.language === "d2" ? "d2" : "mermaid",
    dark: element.dataset.diagramTheme === "dark", code: element.dataset.diagramCode ?? "",
    locator: element.dataset.diagramLocator ?? "terminal buffer",
    bufferStart: Number(element.dataset.bufferStart), bufferEnd: Number(element.dataset.bufferEnd), inferred: false,
  };
}

export function diagramOverlayStream(term: Terminal, host: HTMLElement,
  visibility: TurnVisibilityModel, inputs: DiagramInputs): DiagramOverlayModel {
  const opened = Signal<DiagramLightboxEntry | undefined>(undefined);
  const openAt = Signal<{ clientX: number | null; clientY: number }>();
  const enabled = toSignal(inputs.enabled);
  const inference = toSignal(inputs.inference);
  const mount$ = new Observable<{ root: HTMLDivElement; events: Observable<OverlayEvent> }>((observer) => {
    const root = document.createElement("div");
    root.className = "term-diagrams";
    host.appendChild(root);
    const events = Signal<OverlayEvent>();
    const onClick = (event: MouseEvent) => {
      if (event.metaKey || event.button !== 0) return;
      const entry = entryAt(root, event.clientX, event.clientY);
      if (!entry) return;
      opened.$(entry);
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    host.addEventListener("click", onClick, { capture: true });
    const disposables: IDisposable[] = [
      term.onWriteParsed(() => events.$("write")),
      term.onScroll(() => events.$("scroll")),
      term.onResize(() => events.$("resize")),
    ];
    observer.next({ root, events: events.$.pipe(filter((event): event is OverlayEvent => event !== undefined)) });
    events.$("mount");
    return function unsubscribe() {
      host.removeEventListener("click", onClick, { capture: true });
      disposables.forEach((disposable) => disposable.dispose());
      root.remove();
    };
  });
  const overlay$ = defer(() => {
    const paintedKeys = Signal<ReadonlySet<string>>(new Set<string>());
    const settledKeys = Signal<ReadonlySet<string>>(new Set<string>());
    const fingerprint = Signal("");
    const retryDelay = Signal(2_000);
    const scrolling = Signal(false);
    const retryRequested = Signal<void>();
    const cache = new Map<string, Observable<RenderedDiagram>>();
    return mount$.pipe(switchMap(({ root, events }) => {
      const trigger$ = merge(
        events,
        visibility.changes.$.pipe(map(() => "write" as const)),
        visibility.settled.$.pipe(tap(() => {
          const dark = darkBackground(host);
          settledKeys.$(new Set(findDiagramFences(term, inference.$()).filter((fence) => fence.stripped)
            .map((fence) => diagramElementKey(fence, dark))));
        }), map(() => "write" as const)),
        inputs.activate.$.pipe(tap(() => { root.hidden = true; }), map(() => "mount" as const)),
        inputs.scrollGesture.$.pipe(tap(() => { root.hidden = true; scrolling.$(true); }), switchMap(() => timer(80).pipe(tap(() => scrolling.$(false)), map(() => "scroll" as const)))),
        enabled.$.pipe(map(() => "mount" as const)),
        inference.$.pipe(map(() => "mount" as const)),
        retryRequested.$.pipe(map(() => "mount" as const)),
      ).pipe(share());
      return trigger$.pipe(
        tap(() => positionElements(term, host, root)),
        auditTime(0, animationFrameScheduler),
        map(() => enabled.$() && !scrolling.$() ? planFor(term, host, visibility, inference.$(), paintedKeys.$(), settledKeys.$()) : null),
        switchMap((plan) => {
          if (!plan) { root.hidden = true; return EMPTY; }
          if (plan.fingerprint === fingerprint.$() && !root.hidden) return EMPTY;
          const render$ = plan.fences.length ? forkJoin(plan.fences.map((fence) => {
            const key = `${JSON.stringify(plan.palette)}:${fence.language}:${fence.code}`;
            let rendering = cache.get(key);
            if (!rendering) {
              rendering = renderDiagram$(fence, plan.palette, plan.dark).pipe(shareReplay({ bufferSize: 1, refCount: true }));
              cache.set(key, rendering);
              if (cache.size > MAX_RENDER_CACHE_ENTRIES) {
                const oldest = cache.keys().next().value;
                if (oldest !== undefined) cache.delete(oldest);
              }
            }
            return rendering.pipe(
              map((result): Drawn => ({ fence, result, error: "" })),
              catchError((reason: unknown) => {
                cache.delete(key);
                return of({ fence, result: null, error: reason instanceof Error ? reason.message : `Failed to render ${fence.language}` });
              }),
            );
          })) : of([] as Drawn[]);
          return render$.pipe(
            tap((drawn) => {
              const failures = drawn.filter((entry) => entry.error && !entry.fence.inferred);
              paintedKeys.$(new Set(drawn.filter((entry) => entry.result).map((entry) => diagramElementKey(entry.fence, plan.dark))));
              if (failures.length) root.dataset.diagramError = failures.map((entry) => entry.error).join("\n");
              else delete root.dataset.diagramError;
              paint(term, host, root, inputs.layout, plan, drawn);
              root.hidden = false;
              if (!failures.length) { fingerprint.$(plan.fingerprint); retryDelay.$(2_000); }
            }),
            switchMap((drawn) => {
              const failures = drawn.some((entry) => entry.error && !entry.fence.inferred);
              if (!failures) return of(void 0);
              const delay = retryDelay.$();
              retryDelay.$(Math.min(delay * 2, 30_000));
              return timer(delay).pipe(tap(() => retryRequested.$(undefined)), map(() => void 0));
            }),
          );
        }),
      );
    }));
  });
  const lightbox$ = defer(() => {
    const entries: DiagramLightboxEntry[] = [];
    return opened.$.pipe(switchMap((entry) => {
      if (!entry) return EMPTY;
      return new Observable<void>(() => {
        entries.push(entry);
        if (entries.length > MAX_LIGHTBOX_ENTRIES) entries.shift();
        const mount = document.createElement("div");
        document.body.appendChild(mount);
        const root = createRoot(mount);
        const render = (activeIndex: number) => root.render(createElement(DiagramLightbox, {
          entries, activeIndex, label: `${entry.language === "d2" ? "d2" : "Mermaid"} diagram`,
          onSelect: render, onClose: () => opened.$(undefined),
        }));
        render(entries.length - 1);
        return function unsubscribe() { root.unmount(); mount.remove(); };
      });
    }));
  });
  const openAt$ = openAt.$.pipe(tap((point) => {
    const entry = point && entryAt(host, point.clientX, point.clientY);
    if (entry) opened.$(entry);
  }));
  return { opened, openAt, effects: merge(overlay$, lightbox$, openAt$).pipe(map(() => void 0)) };
}
