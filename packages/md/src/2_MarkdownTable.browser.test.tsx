import { act } from "react";
import { createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Signal } from "@hafley66/signals";
import type { GridState } from "@hafley66/signal-grid";
import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import MarkdownTable from "./2_MarkdownTable.js";
import StreamdownBody from "./0_Streamdown.js";
import { MdDocumentIdentityProvider } from "./4_documentIdentity.js";
import { installMdviewHost, type MdviewHost } from "./ports.js";
import { pathSignalFor } from "./signals.js";
import "./1_reading.css";

const row = (tag: "th" | "td", ...cells: ReactNode[]) =>
  createElement("tr", null, cells.map((cell, index) => createElement(tag, { key: index }, cell)));

it("renders markdown cells through signal-grid sorting and column visibility", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  host.style.cssText = "width: 900px; height: 480px; margin-top: 120px; padding-top: 120px; box-sizing: border-box";
  document.body.append(host);
  const root = createRoot(host);
  const children = [
    createElement("thead", null, row("th", "Name", "Value")),
    createElement("tbody", null, row("td", "beta", "2"), row("td", "alpha", "1")),
  ];
  try {
    await act(() => root.render(createElement(MarkdownTable, { children })));
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))); });
    await expect.poll(() => [...host.querySelectorAll(".sg-head-cell")].map((node) => node.textContent)).toEqual(["Name", "Value"]);
    await expect.poll(() => [...host.querySelectorAll(".sg-cell")].map((node) => node.textContent)).toEqual(["beta", "2", "alpha", "1"]);

    const nameHeader = host.querySelector<HTMLElement>('[data-col-id="column-0"]');
    expect(nameHeader).not.toBeNull();
    await act(() => nameHeader!.click());
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))); });
    await expect.poll(() => [...host.querySelectorAll(".sg-cell")].map((node) => node.textContent)).toEqual(["alpha", "1", "beta", "2"]);

    expect(getComputedStyle(host.querySelector<HTMLElement>(".sg-cell")!).borderInlineEndWidth).toBe("1px");
  } finally {
    await act(() => root.unmount());
    host.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});

it("adapts an actual Streamdown GFM table and keeps inline cell markup", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  host.style.cssText = "width: 900px; height: 480px; margin-top: 120px; padding-top: 120px; box-sizing: border-box";
  document.body.append(host);
  const root = createRoot(host);
  installMdviewHost({
    repoRootFor: async () => "/repo",
    readPluginState: (_pluginId: string, fallback: unknown): unknown => fallback,
    savePluginState: () => undefined,
  } as unknown as MdviewHost);
  const pathSignal = pathSignalFor("markdown-table-browser", "/repo/guide.md");
  const markdown = [
    "| Name | Details |",
    "| :--- | ---: |",
    "| **alpha** | `one` |",
    "| [beta](/beta) | two |",
    `| ${"long-cell-content ".repeat(24)} | ${"wrapped details ".repeat(24)} |`,
  ].join("\n");
  try {
    await act(() => root.render(
      createElement(MdDocumentIdentityProvider, { pathSignal },
        createElement(StreamdownBody, { components: {}, dark: false, children: markdown }),
      ),
    ));
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))); });
    expect(host.querySelectorAll(".mdview-table")).toHaveLength(1);
    await expect.poll(() => [...host.querySelectorAll(".sg-head-cell")].map((node) => node.textContent)).toEqual(["Name", "Details"]);
    await expect.poll(() => host.querySelector('.sg-cell [data-streamdown="strong"]')?.textContent).toBe("alpha");
    await expect.poll(() => host.querySelector('.sg-cell [data-streamdown="inline-code"]')?.textContent).toBe("one");
    await expect.poll(() => host.querySelector('.sg-cell [data-streamdown="link"]')?.textContent).toBe("beta");
    await expect.poll(() => Number.parseFloat(host.querySelector<HTMLElement>(".mdview-table-grid")?.style.getPropertyValue("--sg-total-h") ?? "0")).toBeGreaterThan(144);
    expect(host.querySelector(".mdview-table-toolbar")).toBeNull();
    await page.screenshot({ path: "./out/md-table-controls.png" });
  } finally {
    await act(() => root.unmount());
    host.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});

it("rebinds the grid when the caller replaces its state signal", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  host.style.cssText = "width: 900px; height: 320px; margin-top: 120px; padding-top: 120px; box-sizing: border-box";
  document.body.append(host);
  const root = createRoot(host);
  const firstState = Signal<Partial<GridState>>({ colHidden: { "column-1": true } });
  const secondState = Signal<Partial<GridState>>({ colHidden: { "column-0": true } });
  const children = [
    createElement("thead", null, row("th", "Name", "Value")),
    createElement("tbody", null, row("td", "alpha", "1")),
  ];
  try {
    await act(() => root.render(createElement(MarkdownTable, { children, tableState: firstState })));
    await expect.poll(() => [...host.querySelectorAll(".sg-head-cell")].map((node) => node.textContent)).toEqual(["Name"]);
    await act(() => root.render(createElement(MarkdownTable, { children, tableState: secondState })));
    await expect.poll(() => [...host.querySelectorAll(".sg-head-cell")].map((node) => node.textContent)).toEqual(["Value"]);
  } finally {
    await act(() => root.unmount());
    host.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});

it("consumes and mirrors caller-owned table state", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  host.style.cssText = "width: 900px; height: 320px; margin-top: 120px; padding-top: 120px; box-sizing: border-box";
  document.body.append(host);
  const root = createRoot(host);
  const tableState = Signal<Partial<GridState>>({
    colHidden: { "column-1": true },
    colOrder: ["column-1", "column-0"],
    colWidth: { "column-0": 240 },
  });
  const children = [
    createElement("thead", null, row("th", "Name", "Value")),
    createElement("tbody", null, row("td", "alpha", "1")),
  ];
  try {
    await act(() => root.render(createElement(MarkdownTable, { children, tableState })));
    await expect.poll(() => [...host.querySelectorAll(".sg-head-cell")].map((node) => node.textContent)).toEqual(["Name"]);
    await userEvent.click(host.querySelector<HTMLElement>(".sg-head-cell .sg-head-label")!);
    await expect.poll(() => tableState.$().sort).toEqual([{ field: "column-0", sort: "asc" }]);
    expect(tableState.$().colHidden).toEqual({ "column-1": true });
  } finally {
    await act(() => root.unmount());
    host.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});

it("sizes the grid to header plus rows under the 70vh cap, scrolls inside above it, and resizes within the content", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  host.style.cssText = "width: 900px; margin: 0; padding: 0";
  document.body.append(host);
  const root = createRoot(host);
  const initialViewport = { width: window.innerWidth, height: window.innerHeight };
  const tableOf = (count: number) => [
    createElement("thead", null, row("th", "Name", "Value")),
    createElement("tbody", null, ...Array.from({ length: count }, (_, index) => row("td", `name-${index}`, String(index)))),
  ];
  const settle = async () => {
    for (let frame = 0; frame < 4; frame += 1) {
      await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))); });
    }
  };
  const gridEl = () => host.querySelector<HTMLElement>(".mdview-table-grid")!;
  const scrollEl = () => host.querySelector<HTMLElement>(".sg-scroll")!;
  // The element the UA resize handle writes `height` onto, whichever box carries `resize`.
  const resizer = () => [gridEl(), scrollEl()].find((node) => getComputedStyle(node).resize === "vertical")!;
  const measure = () => {
    const scroll = scrollEl();
    const scrollRect = scroll.getBoundingClientRect();
    const rows = [...host.querySelectorAll<HTMLElement>(".sg-center .sg-row")];
    const head = host.querySelector<HTMLElement>(".sg-head")!.getBoundingClientRect();
    const gridRect = gridEl().getBoundingClientRect();
    const innerBottom = gridRect.bottom - Number.parseFloat(getComputedStyle(gridEl()).borderBottomWidth);
    const lastRow = rows.at(-1)!.getBoundingClientRect();
    return {
      // Empty strip between the last row and the grid's inner bottom edge. Negative when rows continue below.
      gap: Math.round(innerBottom - lastRow.bottom),
      scrollHeight: Math.round(scrollRect.height),
      content: Math.round(head.height + rows.reduce((sum, node) => sum + node.getBoundingClientRect().height, 0)),
      renderedRows: rows.length,
      rowsCoverViewport: lastRow.bottom >= scrollRect.bottom - 1,
      scrolls: scroll.scrollHeight > scroll.clientHeight,
    };
  };
  try {
    await page.viewport(1280, 800);
    const cap = Math.round(window.innerHeight * 0.7);
    await act(() => root.render(createElement(MarkdownTable, { children: tableOf(3) })));
    await expect.poll(() => host.querySelectorAll(".sg-center .sg-row").length).toBe(3);
    await settle();
    const short = measure();
    resizer().style.height = `${short.content + 200}px`;
    await settle();
    const shortGrown = measure();

    await act(() => root.render(createElement(MarkdownTable, { children: tableOf(200) })));
    await expect.poll(() => host.querySelectorAll(".sg-center .sg-row").length).toBeGreaterThan(3);
    resizer().style.removeProperty("height");
    await settle();
    const long = measure();
    resizer().style.height = "200px";
    await settle();
    const longShrunk = measure();
    resizer().style.height = `${cap + 100}px`;
    await settle();
    const longGrown = measure();

    expect({
      cap,
      short: { gap: short.gap, heightIsContent: short.scrollHeight === short.content, rowsCoverViewport: short.rowsCoverViewport, scrolls: short.scrolls },
      shortGrown: { gap: shortGrown.gap, heightIsContent: shortGrown.scrollHeight === short.content },
      long: { scrollHeight: long.scrollHeight, virtualized: long.renderedRows < 200, rowsCoverViewport: long.rowsCoverViewport, scrolls: long.scrolls },
      longShrunk: { belowCap: longShrunk.scrollHeight < cap, rowsCoverViewport: longShrunk.rowsCoverViewport },
      longGrown: { scrollHeight: longGrown.scrollHeight, rowsCoverViewport: longGrown.rowsCoverViewport },
    }).toMatchInlineSnapshot(`
      {
        "cap": 560,
        "long": {
          "rowsCoverViewport": true,
          "scrollHeight": 560,
          "scrolls": true,
          "virtualized": true,
        },
        "longGrown": {
          "rowsCoverViewport": true,
          "scrollHeight": 660,
        },
        "longShrunk": {
          "belowCap": true,
          "rowsCoverViewport": true,
        },
        "short": {
          "gap": 0,
          "heightIsContent": true,
          "rowsCoverViewport": true,
          "scrolls": false,
        },
        "shortGrown": {
          "gap": 0,
          "heightIsContent": true,
        },
      }
    `);
  } finally {
    await page.viewport(initialViewport.width, initialViewport.height);
    await act(() => root.unmount());
    host.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});

it("fits short wrapping tables without a vertical scrollbar when scrollbars take layout width", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  // Classic scrollbars, the way a host that styles `::-webkit-scrollbar` gets them: each bar
  // takes 15px out of the scroller's layout box instead of floating over the content. Border-box
  // everywhere, as instant sets it.
  const classic = document.createElement("style");
  classic.textContent = "* { box-sizing: border-box } ::-webkit-scrollbar { width: 15px; height: 15px } ::-webkit-scrollbar-thumb { background: #888 }";
  document.head.append(classic);
  const host = document.createElement("div");
  host.style.cssText = "width: 720px; margin: 0; padding: 0";
  document.body.append(host);
  const root = createRoot(host);
  const initialViewport = { width: window.innerWidth, height: window.innerHeight };
  const code = (text: string) => createElement("code", null, text);
  const prose = (text: string, ...refs: string[]) => createElement("span", null, text, ...refs.flatMap((ref) => [" ", code(ref)]));
  const wrapping = [
    createElement("thead", null, row("th", "Surface", "Behaviour", "Source")),
    createElement("tbody", null,
      row("td", "reading column", prose("sizes the table to header plus rows under the viewport cap and scrolls inside above it", "--md-table-cap", "--sg-total-h"), code("packages/md/src/1_reading.css")),
      row("td", "grid renderer", prose("writes the row run height and the header band count onto the grid root on every pass", "--sg-head-rows"), code("packages/signal-grid/src/10_render.ts")),
      row("td", "row measure", prose("reports each measured row height back into the axis so wrapped cells grow their row"), code("packages/signal-grid/src/14_measure.ts")),
      row("td", "persistence", prose("stores column order, widths and visibility per document and per table anchor", "tableState"), code("packages/md/src/3_tablePersistence.ts")),
    ),
  ];
  const wide = [
    createElement("thead", null, row("th", ...Array.from({ length: 14 }, (_, index) => `column-heading-${index}`))),
    createElement("tbody", null, ...Array.from({ length: 3 }, (_, rowIndex) => row("td", ...Array.from({ length: 14 }, (_, index) => `value-${rowIndex}-${index}`)))),
  ];
  const long = [
    createElement("thead", null, row("th", "Name", "Details")),
    createElement("tbody", null, ...Array.from({ length: 200 }, (_, index) => row("td", `name-${index}`, prose(`row ${index} carries enough prose to wrap inside a narrow column of the reading layout`, "code-ref")))),
  ];
  const settle = async () => {
    for (let frame = 0; frame < 6; frame += 1) {
      await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))); });
    }
  };
  const measure = () => {
    const scroll = host.querySelector<HTMLElement>(".sg-scroll")!;
    return {
      scrolls: scroll.scrollHeight > scroll.clientHeight,
      overflowY: scroll.scrollHeight - scroll.clientHeight,
      verticalBar: scroll.offsetWidth - scroll.clientWidth,
      scrollsInline: scroll.scrollWidth > scroll.clientWidth,
      horizontalBar: scroll.offsetHeight - scroll.clientHeight,
    };
  };
  try {
    await page.viewport(1280, 800);
    const cap = Math.round(window.innerHeight * 0.7);
    await act(() => root.render(createElement(MarkdownTable, { children: wrapping })));
    await expect.poll(() => host.querySelectorAll(".sg-center .sg-row").length).toBe(4);
    await settle();
    const short = measure();
    await page.screenshot({ path: "./out/md-table-classic-scrollbar.png" });

    // A zoomed page (instant's zoom setting) lays rows out in fractions of a pixel that the
    // measured --sg-total-h rounds away.
    host.style.zoom = "0.9";
    await settle();
    const zoomed = measure();
    host.style.removeProperty("zoom");

    await act(() => root.render(createElement(MarkdownTable, { children: wide })));
    await expect.poll(() => host.querySelectorAll(".sg-head-cell").length).toBe(14);
    await settle();
    const wideTable = measure();

    await act(() => root.render(createElement(MarkdownTable, { children: long })));
    await expect.poll(() => host.querySelectorAll(".sg-center .sg-row").length).toBeGreaterThan(4);
    await settle();
    const longTable = measure();
    const longHeight = Math.round(host.querySelector<HTMLElement>(".mdview-table-grid")!.getBoundingClientRect().height);

    expect({
      short: { scrolls: short.scrolls, overflowY: short.overflowY, verticalBar: short.verticalBar },
      zoomed: { scrolls: zoomed.scrolls, overflowY: zoomed.overflowY },
      wide: { scrolls: wideTable.scrolls, overflowY: wideTable.overflowY, verticalBar: wideTable.verticalBar, scrollsInline: wideTable.scrollsInline, horizontalBar: wideTable.horizontalBar },
      long: { scrolls: longTable.scrolls, verticalBar: longTable.verticalBar, atCap: longHeight === cap },
    }).toMatchInlineSnapshot(`
      {
        "long": {
          "atCap": true,
          "scrolls": true,
          "verticalBar": 15,
        },
        "short": {
          "overflowY": 0,
          "scrolls": false,
          "verticalBar": 0,
        },
        "wide": {
          "horizontalBar": 15,
          "overflowY": 0,
          "scrolls": false,
          "scrollsInline": true,
          "verticalBar": 0,
        },
        "zoomed": {
          "overflowY": 0,
          "scrolls": false,
        },
      }
    `);
  } finally {
    await page.viewport(initialViewport.width, initialViewport.height);
    await act(() => root.unmount());
    host.remove();
    classic.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});

const channels = (color: string): readonly number[] => {
  const srgb = /^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)/.exec(color);
  if (srgb !== null) return srgb.slice(1, 4).map(Number);
  const rgb = /^rgba?\((\d+(?:\.\d+)?),? (\d+(?:\.\d+)?),? (\d+(?:\.\d+)?)/.exec(color);
  if (rgb !== null) return rgb.slice(1, 4).map((value) => Number(value) / 255);
  throw new Error(`unparsed color ${color}`);
};
const luminance = (color: string): number => {
  const [r, g, b] = channels(color).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (fg: string, bg: string): number => {
  const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return Math.round(((light! + 0.05) / (dark! + 0.05)) * 100) / 100;
};

it("keeps inline code in a cell on one line and no column narrower than its longest code token", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  host.style.cssText = "width: 320px; margin: 0; padding: 0; font-size: 15px";
  document.body.append(host);
  const root = createRoot(host);
  const code = (text: string) => createElement("code", { "data-streamdown": "inline-code" }, text);
  const prose = "whether the panel lists references or definitions, and which of the two the reader toggled last";
  const children = [
    createElement("thead", null, row("th", "Key", "Meaning", "Source")),
    createElement("tbody", null,
      row("td", code("referencesModel"), prose, code("packages/md/src/1_reading.css")),
      row("td", code("l"), "the lane", code("x")),
    ),
  ];
  try {
    await act(() => root.render(createElement(MarkdownTable, { children })));
    await expect.poll(() => host.querySelectorAll(".sg-center .sg-cell code").length).toBe(4);
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))); });
    const codes = [...host.querySelectorAll<HTMLElement>(".sg-center .sg-cell code")];
    const lines = codes.map((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
    });
    const tooNarrow = codes.filter((element) => element.closest<HTMLElement>(".sg-cell")!.clientWidth < element.scrollWidth).map((element) => element.textContent);
    expect({ lines, tooNarrow, scrolls: host.querySelector<HTMLElement>(".sg-scroll")!.scrollWidth > 320 }).toEqual({ lines: [1, 1, 1, 1], tooNarrow: [], scrolls: true });
  } finally {
    await act(() => root.unmount());
    host.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});

it("keeps a selected cell's text readable on dark and light panels under a light color-scheme", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  // A host that pins color-scheme to light and paints the panel through its own variables.
  host.style.cssText = "width: 700px; margin: 0; padding: 0; color-scheme: light";
  document.body.append(host);
  const root = createRoot(host);
  const children = [
    createElement("thead", null, row("th", "Name", "Value")),
    createElement("tbody", null, row("td", "alpha", "1"), row("td", "beta", "2")),
  ];
  const panels = {
    dark: "--panel-bg: #252526; --panel-fg: #d4d4d4; --row-active-bg: #094771",
    light: "--panel-bg: #fff; --panel-fg: #222; --row-active-bg: #316ac5",
  };
  try {
    await act(() => root.render(createElement(MarkdownTable, { children })));
    await expect.poll(() => host.querySelectorAll(".sg-center .sg-cell").length).toBe(4);
    await page.elementLocator(host.querySelector<HTMLElement>(".sg-center .sg-cell")!).click();
    await expect.poll(() => host.querySelectorAll(".sg-cell[data-selected]").length).toBe(1);
    const readings: Record<string, number> = {};
    for (const [name, vars] of Object.entries(panels)) {
      host.style.cssText = `width: 700px; margin: 0; padding: 0; color-scheme: light; ${vars}`;
      const selected = host.querySelector<HTMLElement>(".sg-cell[data-selected]")!;
      const style = getComputedStyle(selected);
      readings[name] = contrast(style.color, style.backgroundColor);
    }
    expect({
      darkReadable: readings.dark! >= 4.5,
      lightReadable: readings.light! >= 4.5,
      readings,
    }).toMatchInlineSnapshot(`
      {
        "darkReadable": true,
        "lightReadable": true,
        "readings": {
          "dark": 9.86,
          "light": 13.16,
        },
      }
    `);
  } finally {
    await act(() => root.unmount());
    host.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});

it("tints a selection faintly and edges it without moving or recolouring the cell's text", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const children = [
    createElement("thead", null, row("th", "Name", "Value")),
    createElement("tbody", null, row("td", "alpha", "1"), row("td", "beta", "2")),
  ];
  // instant's skins: xp light, xp dark, p5, ac3.
  const panels = {
    xpLight: "--panel-bg: #fff; --panel-fg: #222; --row-active-bg: #316ac5",
    xpDark: "--panel-bg: #252526; --panel-fg: #d4d4d4; --row-active-bg: #094771",
    p5: "--panel-bg: #000; --panel-fg: #fff; --row-active-bg: #ff1133",
    ac3: "--panel-bg: #0a0f0a; --panel-fg: #aed47e; --row-active-bg: #ff8c1a",
  };
  const look = (cell: HTMLElement) => {
    const style = getComputedStyle(cell);
    const text = cell.querySelector<HTMLElement>(".mdview-table-cell")!.getBoundingClientRect();
    return { color: style.color, weight: style.fontWeight, left: text.left, top: text.top, width: text.width };
  };
  try {
    await act(() => root.render(createElement(MarkdownTable, { children })));
    await expect.poll(() => host.querySelectorAll(".sg-center .sg-cell").length).toBe(4);
    const readings: Record<string, unknown> = {};
    for (const [name, vars] of Object.entries(panels)) {
      host.style.cssText = `width: 700px; margin: 0; padding: 0; color-scheme: light; ${vars}`;
      const cell = host.querySelector<HTMLElement>(".sg-center .sg-cell")!;
      await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))); });
      const before = look(cell);
      await page.elementLocator(cell).click();
      await expect.poll(() => cell.hasAttribute("data-selected")).toBe(true);
      const after = look(cell);
      const bg = getComputedStyle(cell).backgroundColor;
      readings[name] = { unchanged: JSON.stringify(before) === JSON.stringify(after), readable: contrast(after.color, bg) >= 7 };
      await userEvent.keyboard("{Escape}");
    }
    expect(readings).toEqual(Object.fromEntries(Object.keys(panels).map((name) => [name, { unchanged: true, readable: true }])));
  } finally {
    await act(() => root.unmount());
    host.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});

it("copies selected cells as JSON naming the table, row, column and value", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  host.style.cssText = "width: 900px; margin: 0; padding: 0";
  document.body.append(host);
  const root = createRoot(host);
  installMdviewHost({
    readPluginState: (_pluginId: string, fallback: unknown): unknown => fallback,
    savePluginState: () => undefined,
  } as unknown as MdviewHost);
  const pathSignal = pathSignalFor("markdown-table-copy", "/repo/guide.md");
  const markdown = [
    "| Name | Details |",
    "| --- | --- |",
    "| **alpha** | `one` two |",
    "| beta | *three* |",
  ].join("\n");
  // The page's own listener runs after the table's, so it reads what the table wrote.
  const copied: string[] = [];
  const capture = (event: ClipboardEvent) => { copied.push(event.clipboardData?.getData("text/plain") ?? ""); };
  document.addEventListener("copy", capture);
  const cellAt = (rowIndex: number, colIndex: number) =>
    host.querySelectorAll<HTMLElement>(".sg-center .sg-row")[rowIndex]!.querySelectorAll<HTMLElement>(".sg-cell")[colIndex]!;
  try {
    await act(() => root.render(
      createElement(MdDocumentIdentityProvider, { pathSignal },
        createElement(StreamdownBody, { components: {}, dark: false, sectionId: "overview", sourceStart: 0, tableStarts: [0], children: markdown }),
      ),
    ));
    await expect.poll(() => host.querySelectorAll(".sg-center .sg-cell").length).toBe(4);
    await page.elementLocator(cellAt(0, 1)).click();
    await expect.poll(() => host.querySelectorAll(".sg-cell[data-selected]").length).toBe(1);
    await userEvent.copy();
    await page.elementLocator(cellAt(1, 0)).click({ modifiers: ["Shift"] });
    await expect.poll(() => host.querySelectorAll(".sg-cell[data-selected]").length).toBe(4);
    await userEvent.copy();
    expect(copied).toMatchInlineSnapshot(`
      [
        "{"table":"/repo/guide.md#overview:0","row_id":"row-0","col":"Details","value":"one two"}",
        "[{"table":"/repo/guide.md#overview:0","row_id":"row-0","col":"Name","value":"alpha"},{"table":"/repo/guide.md#overview:0","row_id":"row-0","col":"Details","value":"one two"},{"table":"/repo/guide.md#overview:0","row_id":"row-1","col":"Name","value":"beta"},{"table":"/repo/guide.md#overview:0","row_id":"row-1","col":"Details","value":"three"}]",
      ]
    `);
  } finally {
    document.removeEventListener("copy", capture);
    await act(() => root.unmount());
    host.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
