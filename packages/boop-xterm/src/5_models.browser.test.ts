import { toSignal } from "@hafley66/signals";
import { Terminal } from "@xterm/xterm";
import { afterEach, describe, expect, it } from "vitest";
import { createBoopXtermPane } from "./7_pane.js";
import { testPorts, type Script } from "./test/0_endpointTransport.js";
import { of } from "rxjs";

const opened: Array<{ term: Terminal; host: HTMLElement }> = [];

function terminal() {
  const host = document.createElement("div");
  host.style.cssText = "position:relative;width:800px;height:400px";
  document.body.appendChild(host);
  const term = new Terminal({ cols: 80, rows: 20, allowProposedApi: true });
  term.open(host);
  opened.push({ term, host });
  return { term, host };
}

function write(term: Terminal, data: string): Promise<void> {
  return new Promise((resolve) => term.write(data, resolve));
}

function frame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function dragFirstFive(term: Terminal, host: HTMLElement, finish = true) {
  const box = host.querySelector<HTMLElement>(".xterm-screen")?.getBoundingClientRect();
  if (!box) throw new Error("xterm screen missing");
  const y = box.top + box.height / term.rows / 2;
  const x = box.left + box.width / term.cols / 2;
  const endX = x + box.width / term.cols * 4;
  host.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: x, clientY: y }));
  document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: endX, clientY: y }));
  if (finish) document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: endX, clientY: y }));
  return { endX, y };
}

afterEach(() => {
  for (const { term, host } of opened.splice(0)) {
    term.dispose();
    host.remove();
  }
});

describe("real xterm model adapters", () => {
  it("viewport reads writes, scrolls, and resizes from a Terminal", async () => {
    const { term, host } = terminal();
    const ports = testPorts(() => of({ status: 200, body: null }));
    const pane = createBoopXtermPane(term, host, { id: "p", target: "p", socket: null }, ports);
    const changes: string[] = [];
    const subscription = pane.viewport.snapshot.$.subscribe((snapshot) => changes.push(snapshot.change.kind));
    await write(term, "alpha\r\nbeta");
    term.scrollLines(1);
    term.resize(81, 20);
    await frame();
    expect(changes).toContain("write");
    expect(changes).toContain("resize");
    expect(pane.viewport.snapshot.lines.$().map((line) => line.text.trim()).filter(Boolean)).toEqual(["alpha", "beta"]);
    expect(pane.viewport.snapshot.geometry.$().cellHeight).toBeGreaterThan(0);
    subscription.unsubscribe();
  });

  it("Shift wheel in tracked mouse mode reaches the scroll endpoint", async () => {
    const requests: string[] = [];
    const script: Script = (request) => {
      requests.push(request.url);
      return of({ status: 200, body: null });
    };
    const { term, host } = terminal();
    const ports = testPorts(script);
    const pane = createBoopXtermPane(term, host, { id: "p", target: "p", socket: null }, ports);
    const subscription = pane.effects.subscribe();
    await write(term, "\x1b[?1000h");
    const screen = host.querySelector<HTMLElement>(".xterm-screen");
    expect(screen).not.toBeNull();
    screen?.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 48, shiftKey: true }));
    await frame();
    await frame();
    expect(requests).toContain("scroll_session");
    subscription.unsubscribe();
  });

  it("pinned drag paints DOM and emits copied text once", async () => {
    const { term, host } = terminal();
    const ports = testPorts(() => of({ status: 200, body: null }));
    const pane = createBoopXtermPane(term, host, { id: "p", target: "p", socket: null }, ports);
    const copied: string[] = [];
    const effects = pane.effects.subscribe();
    const copy = pane.pinned.copy.$.subscribe((value) => { if (value) copied.push(value); });
    await write(term, "hello world\x1b[?1000h");
    dragFirstFive(term, host);
    await frame();
    expect(pane.pinned.text.$()).toBe("hello");
    expect(copied).toEqual(["hello"]);
    expect(host.querySelectorAll(".term-pinned-selection").length).toBe(1);
    copy.unsubscribe();
    effects.unsubscribe();
    expect(host.querySelector(".term-pinned-root")).toBeNull();
  });

  it("pinned repaint invalidation clears changed buffer cells", async () => {
    const { term, host } = terminal();
    const ports = testPorts(() => of({ status: 200, body: null }));
    const pane = createBoopXtermPane(term, host, { id: "p", target: "p", socket: null }, ports);
    const subscription = pane.effects.subscribe();
    await write(term, "hello world\x1b[?1000h");
    dragFirstFive(term, host);
    await frame();
    expect(pane.pinned.text.$()).toBe("hello");
    await write(term, "\rxxxxx");
    await frame();
    expect(pane.pinned.text.$()).toBe("");
    expect(host.querySelectorAll(".term-pinned-selection").length).toBe(0);
    subscription.unsubscribe();
  });

  it("pinned clear during drag releases document listeners without copying", async () => {
    const { term, host } = terminal();
    const ports = testPorts(() => of({ status: 200, body: null }));
    const pane = createBoopXtermPane(term, host, { id: "p", target: "p", socket: null }, ports);
    const copied: string[] = [];
    const subscription = pane.effects.subscribe();
    const copy = pane.pinned.copy.$.subscribe((value) => { if (value) copied.push(value); });
    await write(term, "hello world\x1b[?1000h");
    const { endX, y } = dragFirstFive(term, host, false);
    ports.selectionClear.$(undefined);
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: endX, clientY: y }));
    await frame();
    expect(pane.runtime.selection.dragging.$()).toBe(false);
    expect(pane.pinned.text.$()).toBe("");
    expect(copied).toEqual([]);
    copy.unsubscribe();
    subscription.unsubscribe();
  });

  it("pinned clipboard disabled retains highlight without a copy event", async () => {
    const { term, host } = terminal();
    const ports = testPorts(() => of({ status: 200, body: null }));
    toSignal(ports.clipboardEnabled).$(false);
    const pane = createBoopXtermPane(term, host, { id: "p", target: "p", socket: null }, ports);
    const copied: string[] = [];
    const subscription = pane.effects.subscribe();
    const copy = pane.pinned.copy.$.subscribe((value) => { if (value) copied.push(value); });
    await write(term, "hello world\x1b[?1000h");
    dragFirstFive(term, host);
    await frame();
    expect(pane.pinned.text.$()).toBe("hello");
    expect(host.querySelectorAll(".term-pinned-selection").length).toBe(1);
    expect(copied).toEqual([]);
    copy.unsubscribe();
    subscription.unsubscribe();
  });
});
