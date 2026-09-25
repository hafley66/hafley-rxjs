import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, inject, it } from "vitest";
import { cdp } from "vitest/browser";
import { MdPanel } from "./MdPanel.js";
import { installMdviewHost, type MdviewHost } from "./ports.js";
import { loadPersistedMdUi, pathSignalFor } from "./signals.js";

declare module "vitest" {
  export interface ProvidedContext {
    instantRoot: string;
  }
}

const HOST_STATE = { startFolded: false, explorerHidden: true, layout: null, layouts: {} };
const DOCS: Record<string, string> = {};
let panelZoom: Record<string, number> = {};

installMdviewHost({
  readText: async (path: string) => DOCS[path] ?? "",
  readImage: async () => "",
  listDir: async () => ({ entries: [] }),
  openHref: async () => undefined,
  openPath: async () => undefined,
  openCodeRef: async () => undefined,
  watchFile: async () => () => undefined,
  FileTree: () => null,
  PanZoomViewport: () => null,
  useRenderProbe: () => undefined,
  useLifecycleProbe: () => undefined,
  recordOperation: () => undefined,
  registerZoomKind: () => undefined,
  resetPanelZoom: () => undefined,
  readPluginState: (<State,>(_pluginId: string, _fallback: State) => HOST_STATE as State) as MdviewHost["readPluginState"],
  savePluginState: () => undefined,
  useAppState: () => ({ dark: document.body.dataset.mode === "dark", panelZoom }),
  openMdPanel: () => undefined,
  mdPanelId: (path: string) => `md:${path}`,
  registerPlugin: () => undefined,
});
loadPersistedMdUi();

// instant's own cascade, in instant's order: xp.css and the source fonts from main.ts, then
// index.html's styles.css. Prepended so the md stylesheets this module imported stay after them,
// as `@hafley66/md/style.css` lands after them in the app.
async function loadInstantCascade(): Promise<() => void> {
  const root = inject("instantRoot");
  if (root === "") throw new Error("instant checkout not found beside hafley-rxjs; this test reads its stylesheets");
  const sheets = [`${root}/node_modules/xp.css/dist/XP.css`, `${root}/src/0_sourceFonts.css`, `${root}/src/styles.css`];
  const links = sheets.map((path) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `/@fs${path}`;
    return link;
  });
  document.head.prepend(...links);
  await Promise.all(links.map((link) => new Promise((resolve, reject) => {
    if (link.sheet !== null) resolve(undefined);
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", () => reject(new Error(`stylesheet ${link.href} failed`)), { once: true });
  })));
  await document.fonts.ready;
  return () => links.forEach((link) => link.remove());
}

const TABLE_DOC = [
  "# Tables",
  "",
  "| Surface | Behaviour | Source |",
  "| --- | --- | --- |",
  "| reading column | sizes the table to header plus rows under the viewport cap and scrolls inside above it `--md-table-cap` | `packages/md/src/1_reading.css` |",
  "| grid renderer | writes the row run height and the header band count onto the grid root on every pass | `packages/signal-grid/src/10_render.ts` |",
  "| row measure | reports each measured row height back into the axis so wrapped cells grow their row | `packages/signal-grid/src/14_measure.ts` |",
  "",
  "| Key | Meaning |",
  "| --- | --- |",
  "| `referencesMode` | whether the panel lists references or definitions, and which of the two the reader toggled last |",
  "| `l` | the lane |",
  "",
  "| Item | Status | Notes |",
  "| --- | --- | --- |",
  "| md-table-1px-overflow | open | owner still sees a vertical scrollbar on short tables that wrap their prose |",
  "| md-table-selection-style | open | selected cell looks harsh |",
  "| md-cmdclick-propagation | open | a handled ⌘-click must reach exactly one opener |",
].join("\n");

const settle = async (): Promise<void> => {
  for (let frame = 0; frame < 6; frame += 1) {
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))); });
  }
};

it("fits short wrapping tables with no vertical overflow under instant's stylesheets, skins, zoom steps and 2x pixels", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const unload = await loadInstantCascade();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const path = "/repo/docs/tables.md";
  DOCS[path] = TABLE_DOC;
  const skins = [
    { skin: "xp", mode: "light", pixel: false },
    { skin: "xp", mode: "dark", pixel: false },
    { skin: "xp", mode: "light", pixel: true },
    { skin: "p5", mode: "dark", pixel: false },
    { skin: "ac3", mode: "dark", pixel: false },
  ] as const;
  // md registers step 0.1 and instant adds it to the stored factor, so the factors carry float error.
  const panelZooms = [0.8, 0.9, 1, 1 + 0.1, 1 + 0.1 + 0.1, 1.5];
  // instant's chrome zoom is the webview's page zoom, which Chromium folds into the device scale:
  // a 2x Retina screen at page zoom z lays out at 2z device pixels per CSS pixel.
  const chromeZooms = [1, 0.9, 1.1, 1.2];
  const widths = [520, 760, 1100];
  const overflowing: string[] = [];
  let measured = 0;
  const session = cdp() as unknown as { send(method: string, params: object): Promise<unknown> };
  try {
    for (const chrome of chromeZooms) {
      await session.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 2 * chrome, mobile: false });
      expect(window.devicePixelRatio).toBeCloseTo(2 * chrome, 5);
      for (const { skin, mode, pixel } of skins) {
        document.body.dataset.skin = skin;
        document.body.dataset.mode = mode;
        document.body.classList.toggle("xp-pixel", pixel);
        for (const width of widths) {
          host.style.cssText = `width: ${width}px; height: 780px; display: flex; flex-direction: column`;
          for (const zoom of panelZooms) {
            panelZoom = { [path]: zoom };
            await act(() => root.render(<MdPanel key={`${chrome}-${skin}-${mode}-${pixel}-${width}-${zoom}`} pid={path} pathSig={pathSignalFor(path, path)} onNavigate={() => undefined} />));
            await expect.poll(() => host.querySelectorAll(".mdview-table .sg-center .sg-row").length, { timeout: 10_000 }).toBe(8);
            await settle();
            for (const [index, scroll] of [...host.querySelectorAll<HTMLElement>(".mdview-table .sg-scroll")].entries()) {
              const grid = scroll.closest<HTMLElement>(".mdview-table-grid")!;
              // A table at its 70vh cap scrolls by design; every other table must fit its rows.
              if (Math.abs(grid.offsetHeight - window.innerHeight * 0.7) <= 1) continue;
              measured += 1;
              const overflowY = scroll.scrollHeight - scroll.clientHeight;
              if (overflowY !== 0) overflowing.push(`dpr=${2 * chrome} ${skin}/${mode}${pixel ? "/pixel" : ""} width=${width} zoom=${zoom} table=${index} overflowY=${overflowY}`);
            }
          }
        }
      }
    }
    expect({ measured: measured > 0, overflowing }).toEqual({ measured: true, overflowing: [] });
  } finally {
    await session.send("Emulation.clearDeviceMetricsOverride", {});
    await act(() => root.unmount());
    host.remove();
    unload();
    delete document.body.dataset.skin;
    delete document.body.dataset.mode;
    document.body.classList.remove("xp-pixel");
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
