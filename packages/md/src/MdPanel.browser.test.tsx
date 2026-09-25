import { act } from "react";
import { userEvent } from "vitest/browser";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { MdPanel } from "./MdPanel.js";
import { installMdviewHost, type MdviewHost } from "./ports.js";
import { blockFoldsFor, loadPersistedMdUi, pathSignalFor } from "./signals.js";

const HOST_STATE = { startFolded: false, explorerHidden: true, layout: null, layouts: {} };
const DOCS: Record<string, string> = {};
const OPENED_REFS: { token: string; docPath: string }[] = [];
const APP_STATE: ReturnType<MdviewHost["useAppState"]> = { dark: false, panelZoom: {} };

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
});
loadPersistedMdUi();

const LIST_DOC = [
  "# Lists",
  "",
  "- one",
  "- two",
  "  - nested-a",
  "  - nested-b",
  "- three",
  "",
  "1. first",
  "2. second",
].join("\n");

const LAYOUT_DOC = [
  "# Alpha",
  "",
  "Alpha paragraph one.",
  "",
  "Alpha paragraph two.",
  "",
  "- one",
  "- two",
  "  - nested-a",
  "  - nested-b",
  "- three",
  "",
  "1. first",
  "2. second",
  "",
  "| Name | Value |",
  "| --- | --- |",
  "| a | 1 |",
  "",
  "```text",
  "alpha code",
  "```",
  "",
  "```mermaid",
  "graph LR",
  "  A --> B",
  "```",
  "",
  "## Beta",
  "",
  "Beta paragraph.",
  "",
  "### Gamma",
  "",
  "Gamma paragraph.",
  "",
  "- g1",
  "- g2",
  "",
  "| Name | Value |",
  "| --- | --- |",
  "| g | 3 |",
  "",
  "```text",
  "gamma code",
  "```",
  "",
  "```mermaid",
  "graph LR",
  "  C --> D",
  "```",
  "",
  "# Delta",
  "",
  "Delta paragraph.",
].join("\n");

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  host.style.cssText = "width: 1100px; font: 16px/1.4 system-ui; --frame: rgb(1, 2, 3)";
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

async function mount(path: string, text: string): Promise<void> {
  DOCS[path] = text;
  await act(() => root.render(<MdPanel pid={path} pathSig={pathSignalFor(path, path)} onNavigate={() => undefined} />));
  await expect.poll(() => host.querySelectorAll(".md-body li").length, { timeout: 10_000 }).toBeGreaterThan(0);
  for (let frame = 0; frame < 3; frame += 1) {
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))); });
  }
}

const section = (title: string): HTMLElement =>
  [...host.querySelectorAll<HTMLElement>(".mdview-sec")].find((sec) => sec.querySelector(":scope > .mdview-head .mdview-title")?.textContent?.endsWith(` ${title}`))!;

// One line per list, fold row, and item. `(twisty)` marks an item that carries a twisty of its own.
function outline(list: Element, depth = 0): string[] {
  const pad = "  ".repeat(depth);
  const lines = [`${pad}${list.tagName.toLowerCase()}`];
  for (const li of list.children) {
    if (li.classList.contains("md-list-fold")) {
      lines.push(`${pad}  [${li.querySelector(".md-twisty")?.textContent ?? "?"}]`);
      continue;
    }
    const own = [...li.childNodes]
      .filter((node) => !(node instanceof Element && (node.matches("ul, ol") || node.classList.contains("md-twisty"))))
      .map((node) => node.textContent)
      .join("")
      .trim();
    const twisty = li.querySelector(":scope > .md-twisty, :scope > * > .md-twisty") === null ? "" : " (twisty)";
    lines.push(`${pad}  - ${own}${twisty}`);
    for (const nested of li.querySelectorAll(":scope > ul, :scope > ol")) lines.push(...outline(nested, depth + 2));
  }
  return lines;
}

const sectionOutline = (title: string): string =>
  [...section(title).querySelectorAll(":scope > .mdview-body > .md-body :is(ul, ol)")]
    .filter((list) => list.parentElement?.closest("li") === null)
    .flatMap((list) => outline(list))
    .join("\n");

it("gives each list one fold twisty at its own top and folds the whole list", async () => {
  const path = "/docs/lists.md";
  await mount(path, LIST_DOC);
  const lists = [...section("Lists").querySelectorAll<HTMLElement>(".md-body :is(ul, ol)")];
  const geometry = lists.map((list) => {
    const twisty = list.querySelector<HTMLElement>(":scope > .md-list-fold > .md-twisty");
    if (twisty === null) return "no twisty";
    const box = twisty.getBoundingClientRect();
    const frame = list.getBoundingClientRect();
    return {
      atTop: Math.abs(box.top - frame.top) <= 2,
      onGuide: Math.abs((box.left + box.right) / 2 - frame.left) <= 1,
    };
  });
  const expanded = sectionOutline("Lists");

  const click = (selector: string) => act(() => section("Lists").querySelector<HTMLElement>(selector)?.click());
  await click(".md-body ul .md-twisty");
  const topFolded = sectionOutline("Lists");
  const foldedKeys = [...blockFoldsFor(path).$()];
  await click(".md-body ul .md-twisty");
  await click("li ul .md-twisty");
  const nestedFolded = sectionOutline("Lists");

  expect({
    geometry,
    twistyCount: section("Lists").querySelectorAll(".md-twisty").length,
    foldedKeys: foldedKeys.map((offset) => LIST_DOC.slice(offset, offset + 5)),
    nestedKeys: [...blockFoldsFor(path).$()].map((offset) => LIST_DOC.slice(offset, offset + 10)),
  }).toMatchInlineSnapshot(`
    {
      "foldedKeys": [
        "- one",
      ],
      "geometry": [
        {
          "atTop": true,
          "onGuide": true,
        },
        {
          "atTop": true,
          "onGuide": true,
        },
        {
          "atTop": true,
          "onGuide": true,
        },
      ],
      "nestedKeys": [
        "- nested-a",
      ],
      "twistyCount": 3,
    }
  `);
  expect(`${expanded}\n---\n${topFolded}\n---\n${nestedFolded}`).toMatchInlineSnapshot(`
    "ul
      [▾]
      - one
      - two
        ul
          [▾]
          - nested-a
          - nested-b
      - three
    ol
      [▾]
      - first
      - second
    ---
    ul
      [▸]
      - … 3 items
    ol
      [▾]
      - first
      - second
    ---
    ul
      [▾]
      - one
      - two
        ul
          [▸]
          - … 2 items
      - three
    ol
      [▾]
      - first
      - second"
  `);
});

it("spaces sections, blocks, and list items; rules h1; indents section content with level guides", async () => {
  const path = "/docs/layout.md";
  await mount(path, LAYOUT_DOC);
  await expect.poll(() => host.querySelectorAll(".mdview-table").length, { timeout: 10_000 }).toBe(2);
  await expect.poll(() => host.querySelectorAll('[data-streamdown="code-block"]').length, { timeout: 10_000 }).toBe(2);
  await expect.poll(() => host.querySelectorAll(".mdview-mermaid svg, .mdview-mermaid-error").length, { timeout: 20_000 }).toBe(2);
  const px = (value: string) => Math.round(Number.parseFloat(value) * 100) / 100;
  const rect = (node: Element) => node.getBoundingClientRect();
  const alpha = section("Alpha");
  const beta = section("Beta");
  const gamma = section("Gamma");
  const delta = section("Delta");
  const head = (sec: HTMLElement) => sec.querySelector<HTMLElement>(":scope > .mdview-head")!;
  const own = (sec: HTMLElement, selector: string) => sec.querySelector<HTMLElement>(`:scope > .mdview-body > .md-body ${selector}`)!;
  const margins = (node: Element) => {
    const style = getComputedStyle(node);
    return `${px(style.marginTop)} ${px(style.marginBottom)}`;
  };
  const alphaItems = [...own(alpha, "ul").querySelectorAll<HTMLElement>(":scope > li:not(.md-list-fold)")];
  const nestedItems = [...own(alpha, "ul ul").querySelectorAll<HTMLElement>(":scope > li:not(.md-list-fold)")];
  const olItems = [...own(alpha, "ol").querySelectorAll<HTMLElement>(":scope > li:not(.md-list-fold)")];
  const paragraphs = [...alpha.querySelectorAll<HTMLElement>(":scope > .mdview-body > .md-body p")];

  const content = host.querySelector<HTMLElement>(".mdview-content")!;
  const contentStyle = getComputedStyle(content);
  const columnRight = rect(content).left + content.clientLeft + content.clientWidth - px(contentStyle.paddingRight);

  const probe = document.createElement("span");
  content.append(probe);
  const resolve = (value: string) => {
    probe.style.color = value;
    return getComputedStyle(probe).color;
  };
  const palette = [1, 2, 3, 4, 5, 6].map((level) => resolve(`var(--md-guide-${level})`));
  const guideOf = (node: Element) => {
    const style = getComputedStyle(node);
    const level = palette.indexOf(style.borderInlineStartColor);
    return `${px(style.borderInlineStartWidth)}px ${style.borderInlineStartStyle} guide-${level + 1}`;
  };
  const body = (sec: HTMLElement) => sec.querySelector<HTMLElement>(":scope > .mdview-body")!;

  const offsets = (sec: HTMLElement) => {
    const left = rect(head(sec)).left;
    const at = (node: Element | null) => (node === null ? "none" : Math.round(rect(node).left - left));
    return {
      paragraph: at(own(sec, "p")),
      list: at(own(sec, "ul")),
      table: at(sec.querySelector(":scope > .mdview-body > .md-body .mdview-table")),
      code: at(sec.querySelector(':scope > .mdview-body > .md-body [data-streamdown="code-block"]')),
      childHead: at(sec.querySelector(":scope > .mdview-body > .mdview-sec > .mdview-head")),
      tableEnd: Math.round(columnRight - rect(sec.querySelector(":scope > .mdview-body > .md-body .mdview-table")!).right),
      codeEnd: Math.round(columnRight - rect(sec.querySelector(':scope > .mdview-body > .md-body [data-streamdown="code-block"]')!).right),
      diagram: at(sec.querySelector(":scope > .mdview-body > .md-body :is(.mdview-mermaid, .mdview-mermaid-error)")),
      diagramEnd: Math.round(columnRight - rect(sec.querySelector(":scope > .mdview-body > .md-body :is(.mdview-mermaid, .mdview-mermaid-error)")!).right),
    };
  };

  const h1 = getComputedStyle(head(alpha));
  const alphaHead = head(alpha);
  const received = {
    margins: {
      h1: margins(head(delta)),
      h2: margins(head(beta)),
      h3: margins(head(gamma)),
      paragraph: margins(paragraphs[0]!),
      list: margins(own(alpha, "ul")),
      ol: margins(own(alpha, "ol")),
      secondItem: margins(alphaItems[1]!),
      secondNestedItem: margins(nestedItems[1]!),
      secondOlItem: margins(olItems[1]!),
    },
    gaps: {
      paragraphToParagraph: Math.round(rect(paragraphs[1]!).top - rect(paragraphs[0]!).bottom),
      itemToItem: Math.round(rect(alphaItems[1]!).top - rect(alphaItems[0]!).bottom),
      nestedItemToItem: Math.round(rect(nestedItems[1]!).top - rect(nestedItems[0]!).bottom),
      olItemToItem: Math.round(rect(olItems[1]!).top - rect(olItems[0]!).bottom),
      alphaLastBlockToBetaHead: Math.round(rect(head(beta)).top - rect(own(alpha, ":is(.mdview-mermaid, .mdview-mermaid-error)")).bottom),
      gammaLastBlockToDeltaHead: Math.round(rect(head(delta)).top - rect(own(gamma, ":is(.mdview-mermaid, .mdview-mermaid-error)")).bottom),
    },
    h1Rule: {
      border: `${h1.borderBottomWidth} ${h1.borderBottomStyle} ${h1.borderBottomColor}`,
      fullWidth: Math.round(rect(alphaHead).width) === Math.round(rect(alphaHead.parentElement!).width),
      h2Border: getComputedStyle(head(beta)).borderBottomWidth,
      h3Border: getComputedStyle(head(gamma)).borderBottomWidth,
    },
    guides: {
      depth1: guideOf(body(alpha)),
      depth2: guideOf(body(beta)),
      depth3: guideOf(body(gamma)),
      list1: guideOf(own(alpha, "ul")),
      list2: guideOf(own(alpha, "ul ul")),
      distinct: new Set(palette).size,
    },
    sectionIndent: px(getComputedStyle(content).getPropertyValue("--md-section-indent")) > 0
      ? getComputedStyle(content).getPropertyValue("--md-section-indent").trim()
      : "unset",
    indent: {
      depth1: offsets(alpha),
      depth3: offsets(gamma),
      depth3HeadFromDepth1Head: Math.round(rect(head(gamma)).left - rect(head(alpha)).left),
    },
  };

  host.style.setProperty("--md-guide-1", "rgb(10, 20, 30)");
  const themed = getComputedStyle(body(alpha)).borderInlineStartColor;
  probe.remove();

  expect({ ...received, themedGuide: themed }).toMatchInlineSnapshot(`
    {
      "gaps": {
        "alphaLastBlockToBetaHead": 26,
        "gammaLastBlockToDeltaHead": 34,
        "itemToItem": 6,
        "nestedItemToItem": 6,
        "olItemToItem": 6,
        "paragraphToParagraph": 11,
      },
      "guides": {
        "depth1": "1px solid guide-1",
        "depth2": "1px solid guide-2",
        "depth3": "1px solid guide-3",
        "distinct": 6,
        "list1": "1px solid guide-1",
        "list2": "1px solid guide-2",
      },
      "h1Rule": {
        "border": "1px solid rgb(1, 2, 3)",
        "fullWidth": true,
        "h2Border": "0px",
        "h3Border": "0px",
      },
      "indent": {
        "depth1": {
          "childHead": 14,
          "code": 14,
          "codeEnd": 0,
          "diagram": 14,
          "diagramEnd": 0,
          "list": 14,
          "paragraph": 14,
          "table": 14,
          "tableEnd": 0,
        },
        "depth3": {
          "childHead": "none",
          "code": 14,
          "codeEnd": 0,
          "diagram": 14,
          "diagramEnd": 0,
          "list": 14,
          "paragraph": 14,
          "table": 14,
          "tableEnd": 0,
        },
        "depth3HeadFromDepth1Head": 27,
      },
      "margins": {
        "h1": "33.75 9",
        "h2": "26.25 7.5",
        "h3": "22.5 7.5",
        "list": "10.5 10.5",
        "ol": "10.5 10.5",
        "paragraph": "10.5 10.5",
        "secondItem": "6 0",
        "secondNestedItem": "6 0",
        "secondOlItem": "6 0",
      },
      "sectionIndent": "0.85em",
      "themedGuide": "rgb(10, 20, 30)",
    }
  `);
});

const REF_DOC = [
  "# Refs",
  "",
  "- see `src/lang/rust/2_call.rs:790-801` and `2_call.rs:561,583`",
  "- the hook `useState` is not a file",
].join("\n");

it("⌘-click on inline code that names a file emits the token and the document path; a plain click does not", async () => {
  const path = "/repo/docs/refs.md";
  OPENED_REFS.length = 0;
  await mount(path, REF_DOC);
  const code = (text: string) =>
    [...host.querySelectorAll<HTMLElement>(".md-body code")].find((element) => element.textContent === text)!;
  const click = (text: string, metaKey: boolean) =>
    act(() => {
      code(text).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, metaKey }));
    });

  await click("src/lang/rust/2_call.rs:790-801", false);
  const afterPlain = [...OPENED_REFS];
  await click("src/lang/rust/2_call.rs:790-801", true);
  await click("2_call.rs:561,583", true);
  await click("useState", true);

  await userEvent.hover(code("2_call.rs:561,583"));
  const cursorWithoutMeta = getComputedStyle(code("2_call.rs:561,583")).cursor;
  await userEvent.keyboard("{Meta>}");
  const cursorWithMeta = getComputedStyle(code("2_call.rs:561,583")).cursor;
  const plainCodeWithMeta = getComputedStyle(code("useState")).cursor;
  await userEvent.keyboard("{/Meta}");
  const cursorAfterRelease = getComputedStyle(code("2_call.rs:561,583")).cursor;

  expect({
    afterPlain,
    opened: OPENED_REFS,
    marked: [...host.querySelectorAll(".md-body code[data-md-ref]")].map((element) => element.textContent),
    cursorWithoutMeta,
    cursorWithMeta,
    plainCodeWithMeta,
    cursorAfterRelease,
  }).toEqual({
    afterPlain: [],
    opened: [
      { token: "src/lang/rust/2_call.rs:790-801", docPath: path },
      { token: "2_call.rs:561,583", docPath: path },
    ],
    marked: ["src/lang/rust/2_call.rs:790-801", "2_call.rs:561,583"],
    cursorWithoutMeta: "auto",
    cursorWithMeta: "pointer",
    plainCodeWithMeta: "auto",
    cursorAfterRelease: "auto",
  });
});

it("starts the first heading at the content's top padding, draws no rule across the top, and resizes the reading column from its left edge", async () => {
  host.style.height = "600px";
  host.style.display = "flex";
  host.style.flexDirection = "column";
  const path = "/repo/docs/top.md";
  await mount(path, LAYOUT_DOC);
  const content = host.querySelector<HTMLElement>(".mdview-content")!;
  const firstHead = host.querySelector<HTMLElement>(".mdview-head")!;
  const column = host.querySelector<HTMLElement>(".mdview-content > .mdview-sec")!;
  const handle = host.querySelector<HTMLElement>(".mdview-prose-handle")!;
  const ruledAcrossTop = [...content.querySelectorAll<HTMLElement>("*")].filter((element) => {
    const box = element.getBoundingClientRect();
    return box.top < firstHead.getBoundingClientRect().top && box.width > 100 && getComputedStyle(element).borderTopStyle !== "none";
  }).map((element) => element.className);
  const handleBox = handle.getBoundingClientRect();
  const columnLeft = column.getBoundingClientRect().left;
  const widthBefore = content.style.getPropertyValue("--md-prose-width");
  const x = handleBox.left + handleBox.width / 2;
  const y = handleBox.top + 200;
  // A synthetic pointer has no active pointer id to capture.
  Object.assign(handle, { setPointerCapture: () => undefined, releasePointerCapture: () => undefined });
  handle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: x, clientY: y, pointerId: 7 }));
  handle.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x - 50, clientY: y, pointerId: 7 }));
  const guide = getComputedStyle(handle, "::after");
  const guideWhileDragging = { style: guide.borderInlineStartStyle, reachesBottom: handle.getBoundingClientRect().bottom >= content.getBoundingClientRect().bottom - 1 };
  await act(async () => {
    handle.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: x - 50, clientY: y, pointerId: 7 }));
  });
  expect({
    headGap: Math.round(firstHead.getBoundingClientRect().top - content.getBoundingClientRect().top),
    ruledAcrossTop,
    handleOnColumnEdge: Math.abs(x - columnLeft) <= 8,
    handleBottomGap: Math.round(content.getBoundingClientRect().bottom - handleBox.bottom),
    guideWhileDragging,
    guideAfter: getComputedStyle(handle, "::after").borderInlineStartStyle,
    width: [widthBefore, content.style.getPropertyValue("--md-prose-width")],
  }).toEqual({
    headGap: 4,
    ruledAcrossTop: [],
    handleOnColumnEdge: true,
    handleBottomGap: 0,
    guideWhileDragging: { style: "dotted", reachesBottom: true },
    guideAfter: "none",
    width: ["900px", "1000px"],
  });
});

it("a handled ⌘-click on a code ref opens it once and reaches no other handler, in a table cell or a paragraph", async () => {
  const path = "/repo/docs/table-refs.md";
  OPENED_REFS.length = 0;
  await mount(path, [
    "# Refs",
    "",
    "| Key | Source |",
    "| --- | --- |",
    "| grid | `src/lang/rust/2_call.rs:790-801` |",
    "",
    "- see `2_call.rs:561,583` here",
  ].join("\n"));
  await expect.poll(() => host.querySelectorAll(".mdview-table code[data-md-ref]").length, { timeout: 10_000 }).toBe(1);
  const escaped: string[] = [];
  const record = (event: Event) => {
    if ((event as MouseEvent).metaKey) escaped.push(event.type);
  };
  const types = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"] as const;
  types.forEach((type) => window.addEventListener(type, record));
  try {
    await userEvent.keyboard("{Meta>}");
    await userEvent.click(host.querySelector<HTMLElement>(".mdview-table code[data-md-ref]")!);
    await userEvent.click(host.querySelector<HTMLElement>(".md-body li code[data-md-ref]")!);
    await userEvent.keyboard("{/Meta}");
  } finally {
    types.forEach((type) => window.removeEventListener(type, record));
  }
  expect({
    opened: OPENED_REFS,
    escaped,
    selected: host.querySelectorAll('.mdview-table [data-selected="true"]').length,
  }).toEqual({
    opened: [
      { token: "src/lang/rust/2_call.rs:790-801", docPath: path },
      { token: "2_call.rs:561,583", docPath: path },
    ],
    escaped: [],
    selected: 0,
  });
});

const STICKY_DOC = (() => {
  const prose = (label: string) => Array.from({ length: 14 }, (_, index) => `${label} paragraph ${index}.\n`).join("\n");
  return [
    "# Alpha", "", prose("alpha"),
    "## Alpha one", "", prose("alpha-one"),
    "### Alpha one deep", "", prose("deep"),
    "## Alpha two", "", prose("alpha-two"),
    "# Bravo", "", prose("bravo"),
  ].join("\n");
})();

it("stacks section headers by level while their section is in view when the host turns sticky headers on", async () => {
  const path = "/docs/sticky.md";
  DOCS[path] = STICKY_DOC;
  const sized = document.createElement("style");
  sized.textContent = ".mdview-content { height: 420px }";
  document.head.append(sized);
  const settle = async () => {
    for (let frame = 0; frame < 3; frame += 1) {
      await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))); });
    }
  };
  // Top of each header relative to the scroller's top edge, at a scroll offset that puts the
  // paragraph with `text` at the top of the viewport.
  const tops = async (text: string) => {
    const content = host.querySelector<HTMLElement>(".mdview-content")!;
    const target = [...content.querySelectorAll<HTMLElement>("p")].find((p) => p.textContent === text)!;
    content.scrollTop += target.getBoundingClientRect().top - content.getBoundingClientRect().top;
    await settle();
    const top = content.getBoundingClientRect().top;
    return Object.fromEntries(["Alpha", "Alpha one", "Alpha one deep", "Alpha two", "Bravo"].map((title) => {
      const head = section(title).querySelector<HTMLElement>(":scope > .mdview-head")!;
      return [title, Math.round(head.getBoundingClientRect().top - top)];
    }));
  };
  const heights = () => Object.fromEntries([1, 2, 3].map((level) => [`h${level}`, Math.round(host.querySelector<HTMLElement>(`.mdview-h${level}`)!.getBoundingClientRect().height)]));
  try {
    APP_STATE.mdStickyHeaders = true;
    await act(() => root.render(<MdPanel pid={path} pathSig={pathSignalFor(path, path)} onNavigate={() => undefined} />));
    await expect.poll(() => host.querySelectorAll(".mdview-head").length, { timeout: 10_000 }).toBe(5);
    await expect.poll(() => [...host.querySelectorAll("p")].some((p) => p.textContent === "bravo paragraph 13."), { timeout: 10_000 }).toBe(true);
    await settle();
    const h = heights();
    const attribute = host.querySelector(".mdview-root")!.hasAttribute("data-md-sticky-headers");
    const deep = await tops("deep paragraph 6.");
    const alphaTwo = await tops("alpha-two paragraph 6.");
    const bravo = await tops("bravo paragraph 6.");
    APP_STATE.mdStickyHeaders = false;
    await act(() => root.render(<MdPanel pid={path} pathSig={pathSignalFor(path, path)} onNavigate={() => undefined} />));
    await settle();
    const off = await tops("deep paragraph 6.");
    const stuck = (row: Record<string, number>) => Object.fromEntries(Object.entries(row).map(([title, top]) => [
      title,
      top === 0 ? "top" : top === h.h1 ? "below h1" : top === h.h1! + h.h2! ? "below h1+h2" : top < 0 ? "scrolled away" : "further down",
    ]));
    expect({
      attribute,
      deep: stuck(deep),
      alphaTwo: stuck(alphaTwo),
      bravo: stuck(bravo),
      off: stuck(off),
    }).toMatchInlineSnapshot(`
      {
        "alphaTwo": {
          "Alpha": "top",
          "Alpha one": "scrolled away",
          "Alpha one deep": "scrolled away",
          "Alpha two": "below h1",
          "Bravo": "further down",
        },
        "attribute": true,
        "bravo": {
          "Alpha": "scrolled away",
          "Alpha one": "scrolled away",
          "Alpha one deep": "scrolled away",
          "Alpha two": "scrolled away",
          "Bravo": "top",
        },
        "deep": {
          "Alpha": "top",
          "Alpha one": "below h1",
          "Alpha one deep": "below h1+h2",
          "Alpha two": "further down",
          "Bravo": "further down",
        },
        "off": {
          "Alpha": "scrolled away",
          "Alpha one": "scrolled away",
          "Alpha one deep": "scrolled away",
          "Alpha two": "further down",
          "Bravo": "further down",
        },
      }
    `);
  } finally {
    Reflect.deleteProperty(APP_STATE, "mdStickyHeaders");
    sized.remove();
  }
});
