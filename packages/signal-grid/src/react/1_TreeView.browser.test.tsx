import { act, createElement, StrictMode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { FsTreeRow, TreeSpec } from "../index.js"
import { FsTreeView, TreeView } from "./index.js"
import "../theme.css"
import "../tree.css"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const file = (path: string, note?: string): FsTreeRow => ({
  name: path.slice(path.lastIndexOf("/") + 1),
  path,
  kind: "file",
  children: [],
  ...(note === undefined ? {} : { note }),
})
const dir = (path: string, children: FsTreeRow[], note?: string): FsTreeRow => ({ ...file(path, note), kind: "dir", children })

const FILES: readonly FsTreeRow[] = [
  dir("src", [file("src/index.ts"), dir("src/lib", [file("src/lib/0_types.ts")])], "sources"),
  file("styles.css"),
  file("README.md"),
]

interface Heading { readonly title: string; readonly sub: readonly Heading[] }
const HEADINGS: readonly Heading[] = [{ title: "Intro", sub: [{ title: "Goals", sub: [] }] }]
const HEADING_SPEC: TreeSpec<Heading> = {
  id: (it) => it.title,
  children: (it) => (it.sub.length > 0 ? it.sub : undefined),
  entry: (it) => ({ label: it.title, kind: "heading" }),
}

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement("div")
  host.style.inlineSize = "400px"
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

const rows = (): string[] =>
  [...host.querySelectorAll<HTMLElement>(".sg-row")].map((row) => {
    const entry = row.querySelector<HTMLElement>(".sg-tree-entry")!
    return [
      row.style.getPropertyValue("--sg-depth") || "0",
      row.getAttribute("data-open"),
      entry.dataset.kind,
      entry.dataset.ext || "-",
      entry.querySelector(".sg-tree-label")?.textContent,
      entry.querySelector(".sg-tree-note")?.textContent ?? "",
    ].join(" ").trim()
  })

const labelOf = (text: string): HTMLElement =>
  [...host.querySelectorAll<HTMLElement>(".sg-tree-label")].find((it) => it.textContent === text)!

it("renders files through the file preset: closed folders, label click opens, new rows keep what is open", async () => {
  await act(async () => root.render(createElement(StrictMode, null, createElement(FsTreeView, { rows: FILES }))))
  await vi.waitFor(() => expect(rows()).toHaveLength(3))
  const closed = rows()
  await act(async () => labelOf("src").click())
  await vi.waitFor(() => expect(rows()).toHaveLength(5))
  const open = rows()
  await act(async () => root.render(createElement(StrictMode, null, createElement(FsTreeView, { rows: [...FILES, file("LICENSE")] }))))
  await vi.waitFor(() => expect(rows()).toHaveLength(6))
  const tree = host.querySelector<HTMLElement>(".sg-tree")!
  expect({
    closed,
    open,
    rewritten: rows(),
    rowHeights: [...host.querySelectorAll(".sg-row")].map((it) => it.getBoundingClientRect().height),
    treeHeight: tree.getBoundingClientRect().height,
    header: host.querySelector<HTMLElement>(".sg-head")?.offsetHeight ?? 0,
  }).toMatchInlineSnapshot(`
    {
      "closed": [
        "0 false dir - src sources",
        "0 false file css styles.css",
        "0 false file md README.md",
      ],
      "header": 0,
      "open": [
        "0 true dir - src sources",
        "1 false file ts index.ts",
        "1 false dir - lib",
        "0 false file css styles.css",
        "0 false file md README.md",
      ],
      "rewritten": [
        "0 true dir - src sources",
        "1 false file ts index.ts",
        "1 false dir - lib",
        "0 false file css styles.css",
        "0 false file md README.md",
        "0 false file - LICENSE",
      ],
      "rowHeights": [
        24,
        24,
        24,
        24,
        24,
        24,
      ],
      "treeHeight": 146,
    }
  `)
})

it("renders any tree through a spec, with the same entry and expand behaviour", async () => {
  await act(async () => root.render(createElement(TreeView<Heading>, { rows: HEADINGS, spec: HEADING_SPEC })))
  await vi.waitFor(() => expect(rows()).toHaveLength(1))
  await act(async () => labelOf("Intro").click())
  await vi.waitFor(() => expect(rows()).toHaveLength(2))
  expect(rows()).toMatchInlineSnapshot(`
    [
      "0 true heading - Intro",
      "1 false heading - Goals",
    ]
  `)
})
