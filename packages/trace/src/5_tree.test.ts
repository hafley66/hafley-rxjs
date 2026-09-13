import { describe, expect, it } from "vitest"
import { ident } from "./1_ident.js"
import { gantt, key, tree } from "./5_tree.js"
import type { Death, Edge, Ident, Span } from "./0_types.js"

const t = 1_700_000_000_000
const at = (ms: number, over: Parameters<typeof ident>[0]) => ident({ born: t + ms, ...over })

const span = (id: Ident, died: Death | undefined): Span => ({
  key: key(id),
  ident: id,
  born: id.born,
  died,
  seen: id.born,
})

const SESSION = [
  at(0, { service: "pnpm", pid: "40112", parent: undefined, runtime: "nodejs" }),
  at(180, { service: "vite", pid: "48231", parent: "40112", runtime: "nodejs" }),
  at(1900, { service: "grid", pid: "tab1", parent: undefined, runtime: "browser" }),
  at(2400, { service: "sorter", pid: "w2", parent: "tab1", runtime: "worker" }),
  at(2300, { service: "sorter", pid: "w1", parent: "tab1", runtime: "worker" }),
]

describe("key", () => {
  it("joins the pid to its birth, because an operating system reuses a pid", () => {
    const first = ident({ pid: "40112", born: t })
    const reused = ident({ pid: "40112", born: t + 5000 })
    expect(first.pid).toBe(reused.pid)
    expect(key(first)).not.toBe(key(reused))
  })
})

describe("tree", () => {
  it("indents a child under its parent", () => {
    const drawn = tree(SESSION).split("\n")
    expect(drawn[0]?.startsWith("node pnpm 40112@")).toBe(true)
    expect(drawn[1]?.startsWith("`-- node vite 48231@")).toBe(true)
  })

  it("orders siblings by birth, not by list position", () => {
    const drawn = tree(SESSION)
    expect(drawn.indexOf("w1@")).toBeLessThan(drawn.indexOf("w2@"))
  })

  it("draws a parentless ident as its own root, so node and browser stay two forests", () => {
    const roots = tree(SESSION).split("\n").filter((line) => !line.startsWith(" ") && !line.startsWith("|") && !line.startsWith("`"))
    expect(roots.length).toBe(2)
  })

  it("roots an ident whose parent is not in the list", () => {
    expect(tree([at(0, { pid: "orphan", parent: "gone", runtime: "worker" })]).startsWith("wrk ")).toBe(true)
  })

  it("ends a reported span's row with x at its death", () => {
    const dead = span(at(180, { service: "vite", pid: "48231", parent: "40112", runtime: "nodejs" }), { at: t + 500, how: "reported" })
    const drawn = tree([at(0, { service: "pnpm", pid: "40112", parent: undefined, runtime: "nodejs" }), dead]).split("\n")
    expect(drawn[1]).toContain("x@" + (t + 500))
  })

  it("prints a question mark instead of x for a timeout", () => {
    const dead = span(at(100, { service: "sorter", pid: "w1", parent: undefined, runtime: "worker" }), { at: t + 900, how: "timeout" })
    expect(tree([dead]).split("\n")[0]).toContain("?@" + (t + 900))
  })

  it("draws a child under the parent an ended edge says it had, and tags the until", () => {
    const old = at(0, { service: "old", pid: "old", parent: undefined, runtime: "nodejs" })
    const c = at(100, { service: "sorter", pid: "w1", parent: undefined, runtime: "worker" })
    const e: Edge = { child: key(c), parent: key(old), since: t + 100, until: t + 500, cause: "reparent" }
    const drawn = tree([old, c], [e]).split("\n")
    expect(drawn[0]?.startsWith("node old")).toBe(true)
    expect(drawn[1]?.startsWith("`-- wrk sorter")).toBe(true)
    expect(drawn[1]).toContain("until +400ms")
  })
})

describe("gantt", () => {
  it("puts the earliest at the top and offsets every bar from it", () => {
    const rows = gantt(SESSION, { width: 40, until: t + 4000 }).split("\n")
    expect(rows[0]?.includes("0 to 4000ms")).toBe(true)
    expect(rows[1]?.includes("0ms")).toBe(true)
    expect(rows[1]?.includes("|#")).toBe(true)
    expect(rows[2]?.includes("180ms")).toBe(true)
    expect(rows[rows.length - 1]?.includes("2400ms")).toBe(true)
  })

  it("draws every bar the same width whatever the offset", () => {
    const widths = gantt(SESSION, { width: 40, until: t + 4000 }).split("\n").slice(1)
      .map((line) => (line.match(/\|([^|]*)\|/)?.[1] ?? "").length)
    expect(new Set(widths)).toEqual(new Set([40]))
  })

  it("returns nothing for nothing", () => {
    expect(gantt([])).toBe("")
  })

  it("stops a dead span's bar at its death with the marker", () => {
    const dead = span(at(100, { service: "grid", pid: "tab1", parent: undefined, runtime: "browser" }), { at: t + 800, how: "reported" })
    const row = gantt([dead], { width: 40, until: t + 4000 }).split("\n")[1]
    expect(row).toContain("x@" + (t + 800))
  })
})
