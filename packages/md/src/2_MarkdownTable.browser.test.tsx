import { act } from "react";
import { createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Signal } from "@hafley66/signals";
import type { GridState } from "@hafley66/signal-grid";
import { expect, it } from "vitest";
import { page } from "vitest/browser";
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

    expect(host.querySelectorAll(".mdview-table-header-actions")).toHaveLength(2);
    expect(getComputedStyle(host.querySelector<HTMLElement>(".sg-cell")!).borderInlineEndWidth).toBe("1px");
    const visibility = host.querySelector<HTMLElement>(".mdview-table-action-visibility");
    expect(visibility).not.toBeNull();
    await act(() => visibility!.click());
    const valueColumn = host.querySelector<HTMLInputElement>(".mdview-table-column-menu [data-md-table-column=\"column-1\"] input");
    expect(valueColumn?.checked).toBe(true);
    await act(() => valueColumn!.click());
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))); });
    expect(host.querySelector('[data-col-id="column-1"]')).toBeNull();
    await expect.poll(() => [...host.querySelectorAll(".sg-cell")].map((node) => node.textContent)).toEqual(["alpha", "beta"]);
    await expect.poll(() => host.querySelector(".mdview-table-hidden-affordance")).not.toBeNull();
    expect([...host.querySelectorAll<HTMLElement>(".mdview-table-column-menu")[0]!.querySelectorAll(".mdview-table-column-menu-section")].map((section) => section.getAttribute("data-md-table-section"))).toEqual(["Visible columns", "Hidden columns"]);
    const nameColumn = host.querySelector<HTMLInputElement>(".mdview-table-column-menu [data-md-table-column=\"column-0\"] input");
    expect(nameColumn?.disabled).toBe(true);
    expect(nameColumn?.checked).toBe(true);
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
    await page.getByRole("columnheader").first().hover();
    await expect.poll(() => getComputedStyle(host.querySelector<HTMLElement>(".mdview-table-header-actions")!).opacity).toBe("1");
    const header = host.querySelector<HTMLElement>(".sg-head-cell");
    const strip = host.querySelector<HTMLElement>(".mdview-table-header-actions");
    expect(header).not.toBeNull();
    expect(strip).not.toBeNull();
    const headerRect = header!.getBoundingClientRect();
    const stripRect = strip!.getBoundingClientRect();
    expect(Math.abs(stripRect.left - headerRect.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(stripRect.right - headerRect.right)).toBeLessThanOrEqual(1);
    expect(stripRect.bottom).toBeLessThanOrEqual(headerRect.top + 1);
    expect(host.querySelector(".mdview-table-toolbar")).toBeNull();
    await page.screenshot({ path: "./out/md-table-controls.png" });
    const visibility = host.querySelector<HTMLButtonElement>(".mdview-table-action-visibility");
    expect(visibility).not.toBeNull();
    visibility!.focus();
    await expect.poll(() => getComputedStyle(host.querySelector<HTMLElement>(".mdview-table-column-menu")!).display).toBe("grid");
    await page.screenshot({ path: "./out/md-table-controls-menu.png" });
    const initialViewport = { width: window.innerWidth, height: window.innerHeight };
    await page.viewport(600, 700);
    host.style.width = "560px";
    await page.getByRole("columnheader").first().hover();
    const compact = host.querySelector<HTMLElement>(".mdview-table-actions-compact");
    const wide = host.querySelector<HTMLElement>(".mdview-table-actions-wide");
    expect(compact).not.toBeNull();
    expect(wide).not.toBeNull();
    expect(getComputedStyle(compact!).display).toBe("block");
    expect(getComputedStyle(wide!).display).toBe("none");
    const summary = compact!.querySelector<HTMLElement>("summary");
    expect(summary).not.toBeNull();
    await page.elementLocator(summary!).click();
    expect(compact!.querySelector(".mdview-table-actions-compact-menu")).not.toBeNull();
    await page.viewport(initialViewport.width, initialViewport.height);
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

it("keeps the action strip and visibility menu inside viewport edges", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  host.style.cssText = "width: 900px; height: 420px; margin: 0; padding: 0; box-sizing: border-box";
  document.body.append(host);
  const root = createRoot(host);
  const initialViewport = { width: window.innerWidth, height: window.innerHeight };
  const children = [
    createElement("thead", null, row("th", "Name", "Details", "Evidence")),
    createElement("tbody", null, row("td", "alpha", "long details ".repeat(24), "long evidence ".repeat(24))),
  ];
  try {
    await page.viewport(800, 480);
    await act(() => root.render(createElement(MarkdownTable, { children })));
    await expect.poll(() => host.querySelectorAll(".sg-head-cell")).toHaveLength(3);
    const actions = host.querySelectorAll<HTMLElement>(".mdview-table-header-actions");
    const strip = actions.item(2);
    const stripRect = strip.getBoundingClientRect();
    expect(stripRect.top).toBeGreaterThanOrEqual(-1);
    expect(stripRect.left).toBeGreaterThanOrEqual(-1);
    expect(stripRect.right).toBeLessThanOrEqual(window.innerWidth + 1);
    const visibility = strip.querySelector<HTMLButtonElement>(".mdview-table-action-visibility");
    expect(visibility).not.toBeNull();
    visibility!.focus();
    await expect.poll(() => getComputedStyle(strip).opacity).toBe("1");
    const menu = strip.querySelector<HTMLElement>(".mdview-table-column-menu");
    expect(menu).not.toBeNull();
    await expect.poll(() => getComputedStyle(menu!).display).toBe("grid");
    const menuRect = menu!.getBoundingClientRect();
    expect(menuRect.top).toBeGreaterThanOrEqual(-1);
    expect(menuRect.right).toBeLessThanOrEqual(window.innerWidth + 1);
  } finally {
    await page.viewport(initialViewport.width, initialViewport.height);
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
    const valueColumn = host.querySelector<HTMLInputElement>(".mdview-table-column-menu [data-md-table-column=\"column-1\"] input");
    expect(valueColumn).not.toBeNull();
    await act(() => valueColumn!.click());
    await expect.poll(() => [...host.querySelectorAll(".sg-head-cell")].map((node) => node.textContent)).toEqual(["Value", "Name"]);
    expect(tableState.$().colHidden).toEqual({ "column-1": false });
  } finally {
    await act(() => root.unmount());
    host.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
