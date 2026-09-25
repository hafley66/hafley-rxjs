import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { DockviewReact, type DockviewApi, type IDockviewPanelProps } from "dockview";
import "dockview/dist/styles/dockview.css";
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { registerMdview } from "./index.js";
import { installMdviewHost, type MdviewHost, type MdviewPluginRegistration } from "./ports.js";

const DOC = ["# Long", "", ...Array.from({ length: 120 }, (_, index) => `Paragraph ${index} of a document long enough to scroll.\n`)].join("\n");
const TABLE_DOC = ["# Table", "", "| Name | Value |", "| --- | --- |", "| alpha | 1 |", "| beta | 2 |", ""].join("\n");
const registered: MdviewPluginRegistration[] = [];

installMdviewHost({
  readText: async (path: string) => path === "/table.md" ? TABLE_DOC : DOC,
  readImage: async () => "",
  listDir: async () => ({ entries: [] }),
  openHref: async () => undefined,
  openPath: async () => undefined,
  watchFile: async () => () => undefined,
  FileTree: () => null,
  PanZoomViewport: () => null,
  useRenderProbe: () => undefined,
  useLifecycleProbe: () => undefined,
  recordOperation: () => undefined,
  registerZoomKind: () => undefined,
  resetPanelZoom: () => undefined,
  readPluginState: (<State,>(_pluginId: string, fallback: State) => ({ ...(fallback as object), explorerHidden: true, startFolded: false }) as State) as MdviewHost["readPluginState"],
  savePluginState: () => undefined,
  useAppState: () => ({ dark: false, panelZoom: {} }),
  openMdPanel: () => undefined,
  mdPanelId: (path: string) => `md:${path}`,
  registerPlugin: (plugin) => { registered.push(plugin); },
});

const frame = () => act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))); });

it("keeps a markdown tab's DOM and scroll offset across a tab switch in a real dock", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  registerMdview();
  const instance = registered.flatMap((plugin) => plugin.instances ?? []).find((entry) => entry.prefix === "md:")!;
  const host = document.createElement("div");
  host.style.cssText = "width: 800px; height: 500px";
  document.body.append(host);
  const root = createRoot(host);
  let api: DockviewApi | undefined;
  try {
    await act(() => root.render(createElement(DockviewReact, {
      components: {
        [instance.componentName]: instance.component as (props: IDockviewPanelProps) => ReturnType<typeof createElement>,
        other: (_props: IDockviewPanelProps) => createElement("div", null, "other"),
      },
      onReady: (event) => { api = event.api; },
    })));
    // The same call the host's dock makes when it opens a panel instance.
    await act(() => {
      api!.addPanel({ id: "other", component: "other", title: "other" });
      api!.addPanel({
        id: "md:/doc.md",
        component: instance.componentName,
        params: { panelId: "md:/doc.md", path: "/doc.md" },
        title: "doc.md",
        position: { referencePanel: "other", direction: "within" },
        ...(instance.keepAlive ? { renderer: "always" as const } : {}),
      });
    });
    await expect.poll(() => host.querySelector(".mdview-content")?.textContent ?? "").toContain("Paragraph 119");
    const content = host.querySelector<HTMLElement>(".mdview-content")!;
    content.scrollTop = 900;
    const scrolled = content.scrollTop;

    await act(() => api!.getPanel("other")!.api.setActive());
    await frame();
    await act(() => api!.getPanel("md:/doc.md")!.api.setActive());
    await frame();

    const after = host.querySelector<HTMLElement>(".mdview-content");
    expect({
      keepAlive: instance.keepAlive,
      scrolled: scrolled > 0,
      sameNode: after === content,
      scrollTop: after?.scrollTop,
    }).toEqual({ keepAlive: true, scrolled: true, sameNode: true, scrollTop: scrolled });
  } finally {
    await act(() => root.unmount());
    host.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});

it("keeps an inactive markdown panel's DOM and scroll offset when a right-click activates it", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  if (!registered.length) registerMdview();
  const instance = registered.flatMap((plugin) => plugin.instances ?? []).find((entry) => entry.prefix === "md:")!;
  const host = document.createElement("div");
  host.style.cssText = "width: 1000px; height: 500px";
  document.body.append(host);
  const root = createRoot(host);
  let api: DockviewApi | undefined;
  try {
    await act(() => root.render(createElement(DockviewReact, {
      components: {
        [instance.componentName]: instance.component as (props: IDockviewPanelProps) => ReturnType<typeof createElement>,
        other: (_props: IDockviewPanelProps) => createElement("div", null, "other"),
      },
      onReady: (event) => { api = event.api; },
    })));
    // The terminal beside the document, the way a ⌘-click opens a preview: its own group,
    // and the terminal keeps the active group.
    await act(() => {
      api!.addPanel({ id: "other", component: "other", title: "other" });
      api!.addPanel({
        id: "md:/doc.md",
        component: instance.componentName,
        params: { panelId: "md:/doc.md", path: "/doc.md" },
        title: "doc.md",
        position: { referencePanel: "other", direction: "right" },
        ...(instance.keepAlive ? { renderer: "always" as const } : {}),
      });
    });
    await act(() => api!.getPanel("other")!.api.setActive());
    await expect.poll(() => host.querySelector(".mdview-content")?.textContent ?? "").toContain("Paragraph 119");
    await frame();
    const content = host.querySelector<HTMLElement>(".mdview-content")!;
    // An always-rendered panel sits in dockview's overlay, positioned on the next frame.
    await expect.poll(() => content.clientHeight).toBeGreaterThan(100);
    content.scrollTop = 900;
    const scrolled = content.scrollTop;
    const inView = () => [...content.querySelectorAll<HTMLElement>("p")].find((node) => {
      const box = node.getBoundingClientRect();
      const frameBox = content.getBoundingClientRect();
      return box.top > frameBox.top + 20 && box.bottom < frameBox.bottom - 20;
    });
    await expect.poll(() => inView() !== undefined).toBe(true);
    const paragraph = inView()!;
    // The driver scrolls the target into view before it presses, so the offset the press
    // lands on is the one that must survive.
    let pressedAt = -1;
    const onPress = () => { pressedAt = content.scrollTop; };
    document.addEventListener("pointerdown", onPress, { capture: true, once: true });
    await userEvent.click(paragraph, { button: "right" });
    await frame();

    const after = host.querySelector<HTMLElement>(".mdview-content");
    expect({
      activated: api!.activePanel?.id,
      scrolled: scrolled > 0 && pressedAt > 0,
      sameNode: after === content,
      scrollTop: after?.scrollTop,
    }).toEqual({ activated: "md:/doc.md", scrolled: true, sameNode: true, scrollTop: pressedAt });
  } finally {
    await act(() => root.unmount());
    host.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});

it("places a table header's action strip inside its header and opens its column menu unclipped in a kept-alive dock panel", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  if (!registered.length) registerMdview();
  const instance = registered.flatMap((plugin) => plugin.instances ?? []).find((entry) => entry.prefix === "md:")!;
  const host = document.createElement("div");
  // Offset from the viewport origin, the way instant's rail and toolbar offset the dock.
  host.style.cssText = "width: 900px; height: 500px; margin: 90px 0 0 160px";
  document.body.append(host);
  const root = createRoot(host);
  let api: DockviewApi | undefined;
  try {
    await act(() => root.render(createElement(DockviewReact, {
      components: {
        [instance.componentName]: instance.component as (props: IDockviewPanelProps) => ReturnType<typeof createElement>,
        other: (_props: IDockviewPanelProps) => createElement("div", null, "other"),
      },
      onReady: (event) => { api = event.api; },
    })));
    await act(() => {
      api!.addPanel({ id: "other", component: "other", title: "other" });
      api!.addPanel({
        id: "md:/table.md",
        component: instance.componentName,
        params: { panelId: "md:/table.md", path: "/table.md" },
        title: "table.md",
        position: { referencePanel: "other", direction: "right" },
        ...(instance.keepAlive ? { renderer: "always" as const } : {}),
      });
    });
    await expect.poll(() => host.querySelectorAll(".sg-head-cell").length).toBe(2);
    await frame();
    const header = host.querySelector<HTMLElement>(".sg-head-cell")!;
    await userEvent.hover(header);
    await frame();
    const strip = header.querySelector<HTMLElement>(".mdview-table-header-actions")!;
    await expect.poll(() => getComputedStyle(strip).opacity).toBe("1");
    const headerBox = header.getBoundingClientRect();
    const stripBox = strip.getBoundingClientRect();
    // Painted, not clipped: the topmost element at a box's centre belongs to that box.
    const paints = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
    };
    const visibility = strip.querySelector<HTMLButtonElement>(".mdview-table-action-visibility")!;
    await userEvent.click(visibility);
    const menu = host.querySelector<HTMLElement>(".mdview-table-column-menu:popover-open");
    expect({
      renderer: api!.getPanel("md:/table.md")!.api.renderer,
      stripInsideHeader: stripBox.top >= headerBox.top - 0.5 && stripBox.bottom <= headerBox.bottom + 0.5 && stripBox.left >= headerBox.left - 0.5 && Math.abs(stripBox.right - headerBox.right) <= 1,
      stripPaints: paints(visibility),
      menuOpen: menu !== null,
      menuPaints: menu !== null && paints(menu),
      menuBelowButton: menu !== null && Math.abs(menu.getBoundingClientRect().top - visibility.getBoundingClientRect().bottom) <= 4,
    }).toEqual({ renderer: "always", stripInsideHeader: true, stripPaints: true, menuOpen: true, menuPaints: true, menuBelowButton: true });
  } finally {
    await act(() => root.unmount());
    host.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
