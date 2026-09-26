import { Terminal, type ITerminalOptions } from "@xterm/xterm";
import { afterEach } from "vitest";

const opened: Array<{ term: Terminal; host: HTMLElement }> = [];

export function openRealTerminal(options: ITerminalOptions = {}) {
  const host = document.createElement("div");
  host.style.cssText = "position:relative;width:800px;height:400px";
  document.body.appendChild(host);
  const term = new Terminal({ cols: 80, rows: 20, allowProposedApi: true, ...options });
  term.open(host);
  opened.push({ term, host });
  return { term, host };
}

export function writeTerminal(term: Terminal, data: string): Promise<void> {
  return new Promise((resolve) => term.write(data, resolve));
}

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export async function waitFor(check: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (!check()) {
    if (performance.now() >= deadline) throw new Error(`condition was false after ${timeoutMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

afterEach(() => {
  for (const { term, host } of opened.splice(0)) {
    term.dispose();
    host.remove();
  }
});
