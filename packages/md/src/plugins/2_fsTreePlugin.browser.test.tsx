import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import StreamdownBody from "../0_Streamdown.js";
import { fsTreePlugin } from "./index.js";
import { MdPluginContext } from "./4_MdPluginContext.js";
import { installMdviewHost, type MdviewHost } from "../ports.js";
import "../mdview.css";

installMdviewHost({
  useRenderProbe: () => undefined,
  useLifecycleProbe: () => undefined,
  recordOperation: () => undefined,
} as unknown as MdviewHost);

const fence = "```";
const markdown = [
  `${fence}tree`,
  ".",
  "├── src/          # sources",
  "│   ├── index.ts",
  "│   └── lib",
  "│       └── 0_types.ts",
  "├── styles.css",
  "└── README.md",
  fence,
  "",
].join("\n");

let host: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  host.style.width = "900px";
  document.body.append(host);
  root = createRoot(host);
  await act(() => root.render(
    <MdPluginContext.Provider value={{ plugins: [fsTreePlugin()], columns: 80 }}>
      <StreamdownBody components={{}} dark={false}>{markdown}</StreamdownBody>
    </MdPluginContext.Provider>,
  ));
});

afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

const rowOf = (path: string): HTMLElement => {
  const row = host.querySelector<HTMLElement>(`.sg-row[data-row-id="${path}"]`);
  if (row === null) throw new Error(`no row ${path}`);
  return row;
};

const scroller = (): HTMLElement => host.querySelector<HTMLElement>(".mdview-fs-tree .sg-scroll")!;

/** One line per rendered row: depth, open state, kind, extension, label, note. */
const rows = () => [...host.querySelectorAll<HTMLElement>(".mdview-fs-tree .sg-row")].map((row) => {
  const entry = row.querySelector<HTMLElement>(".mdview-fs-entry");
  return [
    row.style.getPropertyValue("--sg-depth") || "0",
    row.getAttribute("aria-expanded") ?? "-",
    entry?.dataset.kind,
    entry?.dataset.ext || "-",
    entry?.querySelector(".mdview-fs-name")?.textContent,
    entry?.querySelector(".mdview-fs-note")?.textContent ?? "",
  ].join(" ").trim();
});

it("renders a ```tree fence as a collapsed tree whose folders open from the glyph and the label", async () => {
  await vi.waitFor(() => expect(host.querySelectorAll(".mdview-fs-tree .sg-row")).toHaveLength(1));
  const collapsed = rows();
  await act(async () => rowOf(".").querySelector<HTMLElement>(".sg-expander")!.click());
  await vi.waitFor(() => expect(rows()).toHaveLength(4));
  const rootOpen = rows();
  await act(async () => rowOf("./src").querySelector<HTMLElement>(".mdview-fs-name")!.click());
  await vi.waitFor(() => expect(rows()).toHaveLength(6));
  const srcOpen = rows();
  await act(async () => rowOf("./src").querySelector<HTMLElement>(".mdview-fs-name")!.click());
  await vi.waitFor(() => expect(rows()).toHaveLength(4));
  expect({
    codeBlocks: host.querySelectorAll('[data-streamdown="code-block"]').length,
    collapsed,
    rootOpen,
    srcOpen,
    srcClosed: rows(),
    gridHeight: host.querySelector(".mdview-fs-tree-grid")!.getBoundingClientRect().height,
    rowHeights: [...host.querySelectorAll<HTMLElement>(".mdview-fs-tree .sg-row")].map((row) => row.getBoundingClientRect().height),
    overflows: scroller().scrollHeight > scroller().clientHeight,
    headerShown: host.querySelector<HTMLElement>(".mdview-fs-tree .sg-head")?.offsetHeight ?? 0,
  }).toMatchInlineSnapshot(`
    {
      "codeBlocks": 0,
      "collapsed": [
        "0 false dir - .",
      ],
      "gridHeight": 100,
      "headerShown": 0,
      "overflows": false,
      "rootOpen": [
        "0 true dir - .",
        "1 false dir - src sources",
        "1 - file css styles.css",
        "1 - file md README.md",
      ],
      "rowHeights": [
        24,
        24,
        24,
        24,
      ],
      "srcClosed": [
        "0 true dir - .",
        "1 false dir - src sources",
        "1 - file css styles.css",
        "1 - file md README.md",
      ],
      "srcOpen": [
        "0 true dir - .",
        "1 true dir - src sources",
        "2 - file ts index.ts",
        "2 false dir - lib",
        "1 - file css styles.css",
        "1 - file md README.md",
      ],
    }
  `);
});
