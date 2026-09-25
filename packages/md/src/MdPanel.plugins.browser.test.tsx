import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { MdPanel } from "./MdPanel.js";
import {
  codePlugin,
  d2Plugin,
  defaultMdPlugins,
  imagePlugin,
  linkPlugin,
  mermaidPlugin,
  tablePlugin,
  type MdInlineCodeProps,
  type MdPlugin,
} from "./plugins/index.js";
import { installMdviewHost, type MdviewHost } from "./ports.js";
import { loadPersistedMdUi, pathSignalFor } from "./signals.js";

const HOST_STATE = { startFolded: false, explorerHidden: true, layout: null, layouts: {} };
const DOCS: Record<string, string> = {};
const OPENED_REFS: { token: string; docPath: string }[] = [];
const OPENED_HREFS: { href: string; sourcePath: string }[] = [];
const NAVIGATED: string[] = [];
const APP_STATE: ReturnType<MdviewHost["useAppState"]> = { dark: false, panelZoom: {} };

const HOST: MdviewHost = {
  readText: async (path: string) => {
    const text = DOCS[path];
    if (text === undefined) throw new Error(`no document at ${path}`);
    return text;
  },
  readImage: async (path: string) => `data:image/gif;base64,R0lGODlhAQABAAAAACw=#${path}`,
  listDir: async () => ({ entries: [] }),
  openHref: async (href: string, sourcePath: string) => {
    OPENED_HREFS.push({ href, sourcePath });
  },
  openPath: async () => undefined,
  openCodeRef: async (token: string, docPath: string) => {
    OPENED_REFS.push({ token, docPath });
  },
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
};
installMdviewHost(HOST);
loadPersistedMdUi();

const DOC = [
  "# Inline",
  "",
  "- see `src/lang/rust/2_call.rs:790-801` and `useState`",
  "- [jump](#inline), [sibling](other.md#part), [abs](/repo/docs/other.md#part), [site](https://example.com/x)",
  "- ![local](img/a.png) ![abs](/repo/docs/img/b.png) ![remote](https://example.com/c.png)",
].join("\n");

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  host.style.cssText = "width: 1100px; font: 16px/1.4 system-ui";
  document.body.append(host);
  root = createRoot(host);
  OPENED_REFS.length = 0;
  OPENED_HREFS.length = 0;
  NAVIGATED.length = 0;
});

afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  HOST.mdPlugins = undefined;
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

async function mount(path: string, plugins: readonly MdPlugin[] | undefined): Promise<void> {
  HOST.mdPlugins = plugins;
  DOCS[path] = DOC;
  await act(() => root.render(<MdPanel pid={path} pathSig={pathSignalFor(path, path)} onNavigate={(next) => NAVIGATED.push(next)} />));
  await expect.poll(() => host.querySelectorAll(".md-body li code").length, { timeout: 10_000 }).toBe(2);
}

const inlineCode = () => [...host.querySelectorAll<HTMLElement>(".md-body li code")];

async function metaClickCode(): Promise<void> {
  for (const element of inlineCode()) {
    await act(() => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true }));
    });
  }
}

function Shout({ node: _node, children, doc, ...rest }: MdInlineCodeProps) {
  return <code {...rest} data-shout={doc.path}>{typeof children === "string" ? children.toUpperCase() : children}</code>;
}
const shoutCodePlugin = (): MdPlugin => ({ name: "shout-code", inlineCode: Shout });

it("gives inline code to a custom plugin placed before codeRefPlugin in the array", async () => {
  const path = "/repo/docs/shout.md";
  await mount(path, [shoutCodePlugin(), ...defaultMdPlugins]);
  await metaClickCode();
  expect({ code: inlineCode().map((element) => element.outerHTML), opened: OPENED_REFS }).toMatchInlineSnapshot(`
    {
      "code": [
        "<code data-shout="/repo/docs/shout.md">SRC/LANG/RUST/2_CALL.RS:790-801</code>",
        "<code data-shout="/repo/docs/shout.md">USESTATE</code>",
      ],
      "opened": [],
    }
  `);
});

it("renders plain inline code with no ⌘-click when the array holds no codeRefPlugin", async () => {
  const path = "/repo/docs/plain.md";
  await mount(path, [mermaidPlugin(), d2Plugin(), tablePlugin(), codePlugin(), linkPlugin(), imagePlugin()]);
  await metaClickCode();
  expect({ code: inlineCode().map((element) => element.outerHTML), opened: OPENED_REFS }).toMatchInlineSnapshot(`
    {
      "code": [
        "<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-sm" data-streamdown="inline-code">src/lang/rust/2_call.rs:790-801</code>",
        "<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-sm" data-streamdown="inline-code">useState</code>",
      ],
      "opened": [],
    }
  `);
});

it("the default array marks code refs, routes links, and loads local images through the host", async () => {
  const path = "/repo/docs/defaults.md";
  await mount(path, undefined);
  await metaClickCode();
  for (const anchor of host.querySelectorAll<HTMLAnchorElement>(".md-body li a")) {
    await act(() => {
      anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
  }
  await expect.poll(() => host.querySelectorAll(".md-body li img").length).toBe(2);
  expect({
    code: inlineCode().map((element) => element.outerHTML),
    anchors: [...host.querySelectorAll(".md-body li a")].map((element) => element.outerHTML),
    images: [...host.querySelectorAll(".md-body li img")].map((element) => element.outerHTML),
    opened: OPENED_REFS,
    hrefs: OPENED_HREFS,
    navigated: NAVIGATED,
  }).toMatchInlineSnapshot(`
    {
      "anchors": [
        "<a href="#inline">jump</a>",
        "<a href="/repo/docs/other.md#part">abs</a>",
        "<a href="https://example.com/x">site</a>",
      ],
      "code": [
        "<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-sm" data-streamdown="inline-code" data-md-ref="">src/lang/rust/2_call.rs:790-801</code>",
        "<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-sm" data-streamdown="inline-code">useState</code>",
      ],
      "hrefs": [
        {
          "href": "https://example.com/x",
          "sourcePath": "/repo/docs/defaults.md",
        },
      ],
      "images": [
        "<img alt="abs" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=#/repo/docs/img/b.png">",
        "<img alt="remote" src="https://example.com/c.png">",
      ],
      "navigated": [
        "/repo/docs/other.md",
      ],
      "opened": [
        {
          "docPath": "/repo/docs/defaults.md",
          "token": "src/lang/rust/2_call.rs:790-801",
        },
      ],
    }
  `);
});
