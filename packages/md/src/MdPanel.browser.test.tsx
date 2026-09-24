import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { MdPanel } from "./MdPanel.js";
import { installMdviewHost, type MdviewHost } from "./ports.js";
import { blockFoldsFor, loadPersistedMdUi, pathSignalFor } from "./signals.js";

const HOST_STATE = { startFolded: false, explorerHidden: true, layout: null, layouts: {} };
const DOCS: Record<string, string> = {};

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
  useAppState: () => ({ dark: false, panelZoom: {} }),
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
