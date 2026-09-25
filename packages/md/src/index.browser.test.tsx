import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { DockviewReact, type DockviewApi, type IDockviewPanelProps } from "dockview";
import "dockview/dist/styles/dockview.css";
import { expect, it } from "vitest";
import { registerMdview } from "./index.js";
import { installMdviewHost, type MdviewHost, type MdviewPluginRegistration } from "./ports.js";

const DOC = ["# Long", "", ...Array.from({ length: 120 }, (_, index) => `Paragraph ${index} of a document long enough to scroll.\n`)].join("\n");
const registered: MdviewPluginRegistration[] = [];

installMdviewHost({
  readText: async () => DOC,
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
