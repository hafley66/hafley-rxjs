import type { Terminal } from "@xterm/xterm";

type EventKind = "write" | "scroll" | "resize" | "render";

export function testTerminal(lines: string[] = ["alpha"]): {
  term: Terminal;
  fire(kind: EventKind): void;
  listeners(kind: EventKind): number;
  wheel(event: WheelEvent): boolean;
  setMouseMode(mode: Terminal["modes"]["mouseTrackingMode"]): void;
  setLines(next: string[]): void;
} {
  const callbacks: Record<EventKind, Set<() => void>> = {
    write: new Set(), scroll: new Set(), resize: new Set(), render: new Set(),
  };
  const buffer = { viewportY: 0, length: lines.length, getLine: (row: number) =>
    row < lines.length ? { isWrapped: false, translateToString: () => lines[row] } : undefined };
  let mouseMode: Terminal["modes"]["mouseTrackingMode"] = "none";
  let wheelHandler: (event: WheelEvent) => boolean = () => true;
  const register = (kind: EventKind, callback: () => void) => {
    callbacks[kind].add(callback);
    return { dispose: () => { callbacks[kind].delete(callback); } };
  };
  const term = {
    cols: 80, rows: 20, buffer: { active: buffer }, element: undefined,
    modes: { get mouseTrackingMode() { return mouseMode; } },
    onWriteParsed: (callback: () => void) => register("write", callback),
    onScroll: (callback: () => void) => register("scroll", callback),
    onResize: (callback: () => void) => register("resize", callback),
    onRender: (callback: () => void) => register("render", callback),
    attachCustomWheelEventHandler: (handler: (event: WheelEvent) => boolean) => { wheelHandler = handler; },
  } as unknown as Terminal;
  return {
    term,
    fire: (kind) => { for (const callback of callbacks[kind]) callback(); },
    listeners: (kind) => callbacks[kind].size,
    wheel: (event) => wheelHandler(event),
    setMouseMode: (mode) => { mouseMode = mode; },
    setLines: (next) => { lines = next; buffer.length = next.length; },
  };
}
