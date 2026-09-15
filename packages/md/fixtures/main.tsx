// The e2e fixture: the mdview panel over an in-memory host, so a real browser
// renders real mermaid and d2 output. tests/*.e2e.test.ts drive this page.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { MdPanel } from "../src/MdPanel.js";
import { installMdviewHost, type MdviewHost } from "../src/ports.js";
import { loadPersistedMdUi, pathSignalFor } from "../src/signals.js";
import "../src/mdview.css";
import { DOCS, FIXTURE_PATH } from "./docs.js";

// Persisted defaults a host would supply: sections open (startFolded off) and the
// explorer collapsed, so the page shows the document without a file tree.
const HOST_STATE = { startFolded: false, explorerHidden: true, layout: null, layouts: {} };

const host: MdviewHost = {
  readText: async (path: string) => {
    const text = DOCS[path];
    if (text === undefined) throw new Error(`fixture has no document at ${path}`);
    return text;
  },
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
  // The host owns persisted UI state; the fixture declares its defaults instead.
  readPluginState: (<State,>(_pluginId: string, _fallback: State) => HOST_STATE as State) as MdviewHost["readPluginState"],
  savePluginState: () => undefined,
  useAppState: () => ({ dark: false, panelZoom: {} }),
  openMdPanel: () => undefined,
  mdPanelId: (path: string) => `md:${path}`,
  registerPlugin: () => undefined,
};

installMdviewHost(host);
loadPersistedMdUi();

const app = document.getElementById("app");
if (!app) throw new Error("fixture page has no #app");
createRoot(app).render(
  createElement(MdPanel, { pid: "fixture", pathSig: pathSignalFor("fixture", FIXTURE_PATH), onNavigate: () => undefined }),
);
