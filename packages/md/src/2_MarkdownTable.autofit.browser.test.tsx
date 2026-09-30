import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import MarkdownTable from "./2_MarkdownTable.js";
import "./1_reading.css";

const row = (tag: "th" | "td", ...cells: ReactNode[]) =>
  createElement("tr", null, cells.map((cell, index) => createElement(tag, { key: index }, cell)));

const prose = (seed: string) => `${seed} contracts pass everything while demand does not reach this rule shape and signatures are not colons`;

it("sizes a one-digit column to its content and keeps the resize target thin", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  host.style.cssText = "width: 900px; height: 600px; box-sizing: border-box";
  document.body.append(host);
  const root = createRoot(host);
  const children = [
    createElement("thead", null, row("th", "#", "cause", "found by", "effect")),
    createElement("tbody", null, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => row("td", String(n), prose(`cause ${n}`), `fable S${n}`, prose(`effect ${n}`)))),
  ];
  try {
    await act(() => root.render(createElement(MarkdownTable, { children })));
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))); });
    await expect.poll(() => host.querySelectorAll(".sg-head-cell").length).toBe(4);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });

    const header = host.querySelector<HTMLElement>('.sg-head-cell[data-col-id="column-0"]')!;
    const textWidth = (node: HTMLElement) => {
      const range = document.createRange();
      range.selectNodeContents(node.querySelector<HTMLElement>(".mdview-table-cell, .mdview-table-header-label")!);
      return range.getBoundingClientRect().width;
    };
    const widest = Math.max(...[...host.querySelectorAll<HTMLElement>('[data-col-id="column-0"]')].map(textWidth));
    const cause = host.querySelector<HTMLElement>('.sg-head-cell[data-col-id="column-1"]')!.getBoundingClientRect().width;
    const hit = host.querySelector<HTMLElement>(".sg-resize")!.getBoundingClientRect().width;
    const hash = header.getBoundingClientRect().width;
    const measured = { hash, widest: Math.round(widest), cause, hit };
    expect(measured).toMatchInlineSnapshot(`
      {
        "cause": 395,
        "hash": 32,
        "hit": 4,
        "widest": 8,
      }
    `);
    expect(hash).toBeLessThanOrEqual(40);
    expect(cause).toBeGreaterThan(hash * 4);
    expect(hit).toBeLessThanOrEqual(4);
  } finally {
    await act(() => root.unmount());
    host.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
