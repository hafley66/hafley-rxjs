import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { of } from "rxjs";
import { installMdviewHost, type MdviewAppState, type MdviewHost } from "./ports.js";
import { MdPanel } from "./MdPanel.js";
import { loadPersistedMdUi, pathSignalFor } from "./signals.js";
import { commandPlugin } from "./plugins/index.js";
import type { MdFenceCommandRequest } from "./plugins/0_types.js";

const HOST_STATE = { startFolded: false, explorerHidden: true, layout: null, layouts: {} };
const DOCS: Record<string, string> = {};
const APP_STATE: MdviewAppState = { dark: false, panelZoom: {} };
const requests: MdFenceCommandRequest[] = [];

installMdviewHost({
  readText: async (path: string) => {
    const text = DOCS[path];
    if (text === undefined) throw new Error(`no document at ${path}`);
    return text;
  },
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
  useAppState: () => APP_STATE,
  openMdPanel: () => undefined,
  mdPanelId: (path: string) => `md:${path}`,
  registerPlugin: () => undefined,
  mdPlugins: [commandPlugin({ match: "^fmt$", command: "fmt $WIDTH", as: "replace" })],
  runFenceCommand: (request) => {
    requests.push(request);
    return of({ stdout: request.text, stderr: "", code: 0 });
  },
});
loadPersistedMdUi();

const DOC = [
  "# Cols",
  "",
  "```fmt",
  "const a={b:1}",
  "```",
  "",
].join("\n");

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  host.id = "cols-probe";
  host.style.cssText = "width: 1100px; font: 16px/1.4 system-ui";
  document.body.append(host);
  document.head.insertAdjacentHTML("beforeend", "<style id='cols-probe-style'>#cols-probe .mdview-streamdown code { font: 20px monospace !important; }</style>");
  root = createRoot(host);
});

afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  document.getElementById("cols-probe-style")?.remove();
  requests.length = 0;
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

it("hands the command runner columns from the measured code font, not the fallback", async () => {
  DOCS["cols.md"] = DOC;
  await act(() => root.render(<MdPanel pid="cols.md" pathSig={pathSignalFor("cols.md", "cols.md")} onNavigate={() => undefined} />));
  await expect.poll(() => requests.length, { timeout: 10_000 }).toBeGreaterThan(0);
  // The scoped stylesheet makes the code font advance ~12px, well past the
  // 7.8px fallback: 900 prose pixels measure to 74 columns, not 115.
  await expect.poll(() => requests.at(-1)?.columns, { timeout: 10_000 }).toBeLessThan(Math.floor(900 / 7.8));
  expect(requests.at(-1)?.columns).toMatchInlineSnapshot(`74`);
});
