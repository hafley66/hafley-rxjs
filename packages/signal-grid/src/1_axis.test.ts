import { describe, expect, it } from "vitest"
import type { Axis } from "./0_types.js"
import { isGroupKey } from "./0_types.js"
import {
  ancestorsOf,
  axisOfEntries,
  axisOfTree,
  descendantsOf,
  filterAxis,
  flattenAxis,
  groupAxis,
  mapAxis,
  sortAxis,
} from "./1_axis.js"

// One fixture, read two ways. The same eight rows build a flat axis (no parentOf) and a three level
// forest (parentOf reads `up`), which is what lets a test run one call sequence over both.
//
//   a            g
//   |- b         |- h
//   |  |- d
//   |  |- e
//   |- c
//      |- f
interface Row {
  readonly name: string
  readonly up?: string
  readonly size: number
  readonly dept: string
}

const ROWS: readonly (readonly [string, Row])[] = [
  ["a", { name: "alpha", size: 2, dept: "ops" }],
  ["b", { name: "bravo", up: "a", size: 1, dept: "ops" }],
  ["c", { name: "charlie", up: "a", size: 2, dept: "dev" }],
  ["d", { name: "delta", up: "b", size: 3, dept: "dev" }],
  ["e", { name: "echo", up: "b", size: 1, dept: "ops" }],
  ["f", { name: "foxtrot", up: "c", size: 2, dept: "dev" }],
  ["g", { name: "golf", size: 3, dept: "ops" }],
  ["h", { name: "hotel", up: "g", size: 1, dept: "dev" }],
]

const tree = (): Axis<string, Row> => axisOfEntries(ROWS, (_key, row) => row.up)
const flat = (): Axis<string, Row> => axisOfEntries(ROWS)

const keys = (axis: Axis<string, unknown>): readonly string[] =>
  flattenAxis(axis, () => true).map((node) => node.key)

const kids = (axis: Axis<string, unknown>, key: string): readonly string[] => [
  ...(axis.children.get(key) ?? []),
]

const roots = (axis: Axis<string, unknown>): readonly string[] => [...axis.roots]

const group = (path: readonly unknown[], key: string): Row => ({
  name: key,
  size: 0,
  dept: path.map(String).join("/"),
})

describe("a flat relation is the degenerate forest", () => {
  it("runs one filter, sort and flatten sequence over both shapes", () => {
    const run = (axis: Axis<string, Row>): readonly string[] => {
      const kept = filterAxis(axis, (_key, row) => row.size <= 2, "prune")
      const sorted = sortAxis(kept, (a, b) => a.size - b.size)
      return flattenAxis(sorted, () => true).map((node) => node.key)
    }
    expect(run(flat())).toEqual(["b", "e", "h", "a", "c", "f"])
    expect(run(tree())).toEqual(["a", "b", "e", "c", "f"])
  })

  it("puts every key in roots and leaves children empty with no parentOf", () => {
    const axis = flat()
    expect(roots(axis)).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"])
    expect(axis.children.size).toBe(0)
    expect(axis.parent.size).toBe(0)
  })

  it("reports depth zero and no children for every node of a flat axis", () => {
    const nodes = flattenAxis(flat(), () => true)
    expect(nodes.map((node) => node.depth)).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
    expect(nodes.every((node) => node.hasChildren === false)).toBe(true)
    expect(nodes.every((node) => node.parent === null)).toBe(true)
  })
})

describe("axisOfEntries", () => {
  it("keeps siblings in first-seen order", () => {
    const axis = tree()
    expect(roots(axis)).toEqual(["a", "g"])
    expect(kids(axis, "a")).toEqual(["b", "c"])
    expect(kids(axis, "b")).toEqual(["d", "e"])
    expect(kids(axis, "c")).toEqual(["f"])
    expect(kids(axis, "g")).toEqual(["h"])
  })

  it("lets a repeated key replace the value while it keeps its first position", () => {
    const axis = axisOfEntries<string, Row>([
      ...ROWS,
      ["a", { name: "alpha-again", size: 9, dept: "ops" }],
    ])
    expect(roots(axis)).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"])
    expect(axis.by.get("a")?.name).toBe("alpha-again")
    expect(axis.by.size).toBe(8)
  })

  it("makes a node whose parent is absent a root instead of a dangling edge", () => {
    const axis = axisOfEntries<string, Row>(
      [
        ["x", { name: "x", up: "ghost", size: 1, dept: "ops" }],
        ["y", { name: "y", up: "x", size: 1, dept: "ops" }],
      ],
      (_key, row) => row.up,
    )
    expect(roots(axis)).toEqual(["x"])
    expect(axis.parent.get("x")).toBeUndefined()
    expect(kids(axis, "x")).toEqual(["y"])
  })

  it("makes a node that names itself a root", () => {
    const axis = axisOfEntries<string, Row>(
      [["x", { name: "x", up: "x", size: 1, dept: "ops" }]],
      (_key, row) => row.up,
    )
    expect(roots(axis)).toEqual(["x"])
    expect(axis.parent.size).toBe(0)
  })

  it("turns a two node parent cycle into roots rather than hanging", () => {
    const axis = axisOfEntries<string, Row>(
      [
        ["x", { name: "x", up: "y", size: 1, dept: "ops" }],
        ["y", { name: "y", up: "x", size: 1, dept: "ops" }],
      ],
      (_key, row) => row.up,
    )
    expect(roots(axis)).toEqual(["x", "y"])
    expect(axis.parent.size).toBe(0)
    expect(keys(axis)).toEqual(["x", "y"])
  })

  it("turns a three node parent cycle into roots rather than hanging", () => {
    const axis = axisOfEntries<string, Row>(
      [
        ["x", { name: "x", up: "z", size: 1, dept: "ops" }],
        ["y", { name: "y", up: "x", size: 1, dept: "ops" }],
        ["z", { name: "z", up: "y", size: 1, dept: "ops" }],
      ],
      (_key, row) => row.up,
    )
    expect(roots(axis)).toEqual(["x", "y", "z"])
    expect(axis.parent.size).toBe(0)
    expect(keys(axis)).toEqual(["x", "y", "z"])
  })

  it("keeps the edge of a node hanging below a cycle", () => {
    const axis = axisOfEntries<string, Row>(
      [
        ["x", { name: "x", up: "y", size: 1, dept: "ops" }],
        ["y", { name: "y", up: "x", size: 1, dept: "ops" }],
        ["w", { name: "w", up: "x", size: 1, dept: "ops" }],
      ],
      (_key, row) => row.up,
    )
    expect(roots(axis)).toEqual(["x", "y"])
    expect(kids(axis, "x")).toEqual(["w"])
    expect(keys(axis)).toEqual(["x", "w", "y"])
  })
})

describe("axisOfTree", () => {
  interface Nest {
    readonly id: string
    kids?: readonly Nest[]
  }

  const NEST: readonly Nest[] = [
    {
      id: "a",
      kids: [{ id: "b", kids: [{ id: "d" }, { id: "e" }] }, { id: "c", kids: [{ id: "f" }] }],
    },
    { id: "g", kids: [{ id: "h" }] },
  ]

  const nested = (): Axis<string, Nest> =>
    axisOfTree(
      NEST,
      (item) => item.id,
      (item) => item.kids,
    )

  it("builds the same forest a parentOf pass builds", () => {
    const axis = nested()
    expect(roots(axis)).toEqual(["a", "g"])
    expect(kids(axis, "a")).toEqual(["b", "c"])
    expect(kids(axis, "b")).toEqual(["d", "e"])
    expect(kids(axis, "c")).toEqual(["f"])
    expect(kids(axis, "g")).toEqual(["h"])
    expect(keys(axis)).toEqual(keys(tree()))
  })

  it("visits nested items depth first", () => {
    expect(keys(nested())).toEqual(["a", "b", "d", "e", "c", "f", "g", "h"])
  })

  it("stops on a payload whose children loop back", () => {
    const loop: Nest = { id: "x" }
    loop.kids = [loop]
    const axis = axisOfTree(
      [loop, { id: "y", kids: [{ id: "x" }] }],
      (item) => item.id,
      (item) => item.kids,
    )
    expect(roots(axis)).toEqual(["x", "y"])
    expect(kids(axis, "x")).toEqual([])
    expect(kids(axis, "y")).toEqual([])
  })
})

describe("filterAxis", () => {
  const small = (_key: string, row: Row): boolean => row.size <= 2
  const dev = (_key: string, row: Row): boolean => row.dept === "dev"

  it("returns the same axis reference when nothing was removed", () => {
    const axis = tree()
    expect(filterAxis(axis, () => true, "prune")).toBe(axis)
    expect(filterAxis(axis, () => true, "ancestors")).toBe(axis)
    expect(filterAxis(axis, () => true, "subtree")).toBe(axis)
  })

  it("prunes a node whose ancestor fails even when the node itself passes", () => {
    const axis = filterAxis(tree(), small, "prune")
    expect(keys(axis)).toEqual(["a", "b", "e", "c", "f"])
    // h passes on its own but g does not, so the whole branch leaves.
    expect(axis.by.has("h")).toBe(false)
  })

  it("keeps every ancestor of a match so a matching leaf stays reachable", () => {
    const axis = filterAxis(tree(), dev, "ancestors")
    expect(keys(axis)).toEqual(["a", "b", "d", "c", "f", "g", "h"])
    expect(roots(axis)).toEqual(["a", "g"])
    // a and b are kept only as the road to d, never because they matched.
    expect(axis.by.has("e")).toBe(false)
  })

  it("keeps the whole subtree of a match", () => {
    const axis = filterAxis(tree(), (key) => key === "b", "subtree")
    expect(keys(axis)).toEqual(["b", "d", "e"])
    expect(kids(axis, "b")).toEqual(["d", "e"])
  })

  it("reattaches a subtree match whose parent was dropped to the root", () => {
    const axis = filterAxis(tree(), (key) => key === "b", "subtree")
    expect(roots(axis)).toEqual(["b"])
    expect(axis.parent.get("b")).toBeUndefined()
  })

  it("preserves sibling order in every mode", () => {
    // c and f both fail, so nothing pulls that branch back and a is left with one child.
    const reached = filterAxis(tree(), (key) => key !== "c" && key !== "f", "ancestors")
    expect(kids(reached, "a")).toEqual(["b"])
    expect(kids(reached, "b")).toEqual(["d", "e"])
    expect(roots(filterAxis(flat(), (key) => key !== "c", "prune"))).toEqual([
      "a",
      "b",
      "d",
      "e",
      "f",
      "g",
      "h",
    ])
    const kept = filterAxis(tree(), (_key, row) => row.dept === "ops", "subtree")
    expect(roots(kept)).toEqual(["a", "g"])
    expect(kids(kept, "a")).toEqual(["b", "c"])
    expect(kids(kept, "b")).toEqual(["d", "e"])
  })

  it("filters a flat axis with the same call that filters a tree", () => {
    expect(roots(filterAxis(flat(), small, "prune"))).toEqual(["a", "b", "c", "e", "f", "h"])
    expect(roots(filterAxis(flat(), small, "ancestors"))).toEqual(["a", "b", "c", "e", "f", "h"])
    expect(roots(filterAxis(flat(), small, "subtree"))).toEqual(["a", "b", "c", "e", "f", "h"])
  })
})

describe("sortAxis", () => {
  const bySize = (a: Row, b: Row): number => a.size - b.size

  it("returns the same axis reference for a null comparator", () => {
    const axis = tree()
    expect(sortAxis(axis, null)).toBe(axis)
  })

  it("keeps equal elements in source order", () => {
    const axis = sortAxis(flat(), bySize)
    expect(roots(axis)).toEqual(["b", "e", "h", "a", "c", "f", "d", "g"])
    // Every comparison is a tie, so the whole list has to come back untouched.
    expect(roots(sortAxis(flat(), () => 0))).toEqual(roots(flat()))
  })

  it("sorts roots and every children array", () => {
    const axis = sortAxis(tree(), (a, b) => b.size - a.size)
    expect(roots(axis)).toEqual(["g", "a"])
    expect(kids(axis, "a")).toEqual(["c", "b"])
    expect(kids(axis, "b")).toEqual(["d", "e"])
    expect(kids(axis, "g")).toEqual(["h"])
  })

  it("moves nothing between parents", () => {
    const axis = sortAxis(tree(), bySize)
    expect([...axis.parent.entries()].sort()).toEqual([...tree().parent.entries()].sort())
    expect(axis.by.size).toBe(8)
  })
})

describe("groupAxis", () => {
  const byDept = (row: Row): unknown => row.dept
  const bySize = (row: Row): unknown => row.size

  it("returns the same axis reference for an empty key list", () => {
    const axis = flat()
    expect(groupAxis(axis, [], group)).toBe(axis)
  })

  it("puts every synthesized key in the group namespace", () => {
    const axis = groupAxis(flat(), [byDept, bySize], group)
    const made = keys(axis).filter((key) => isGroupKey(key))
    expect(made).toEqual([
      'g:["ops"]',
      'g:["ops",2]',
      'g:["ops",1]',
      'g:["ops",3]',
      'g:["dev"]',
      'g:["dev",2]',
      'g:["dev",3]',
      'g:["dev",1]',
    ])
    expect(made.every((key) => ROWS.every(([id]) => id !== key))).toBe(true)
  })

  it("nests one level per key function", () => {
    const axis = groupAxis(flat(), [byDept, bySize], group)
    expect(roots(axis)).toEqual(['g:["ops"]', 'g:["dev"]'])
    expect(kids(axis, 'g:["ops"]')).toEqual(['g:["ops",2]', 'g:["ops",1]', 'g:["ops",3]'])
    expect(kids(axis, 'g:["ops",1]')).toEqual(["b", "e"])
    expect(kids(axis, 'g:["dev",2]')).toEqual(["c", "f"])
    const depths = flattenAxis(axis, () => true).map((node) => node.depth)
    expect(depths.slice(0, 6)).toEqual([0, 1, 2, 1, 2, 2])
  })

  it("gives a value with an undefined key a group with a stable label", () => {
    const partial = (row: Row): unknown => (row.size > 2 ? undefined : row.dept)
    const once = groupAxis(flat(), [partial], group)
    const twice = groupAxis(flat(), [partial], group)
    expect(roots(once)).toEqual(['g:["ops"]', 'g:["dev"]', "g:[null]"])
    expect(kids(once, "g:[null]")).toEqual(["d", "g"])
    expect(roots(twice)).toEqual(roots(once))
    expect(once.by.get("g:[null]")?.name).toBe("g:[null]")
  })

  it("rebuilds the group nodes of an already grouped axis instead of nesting under them", () => {
    const once = groupAxis(flat(), [byDept], group)
    const twice = groupAxis(once, [byDept], group)
    expect(keys(twice)).toEqual(keys(once))
    expect(roots(twice)).toEqual(['g:["ops"]', 'g:["dev"]'])
    expect(twice.by.size).toBe(once.by.size)
  })

  it("regroups only the top of the forest, so a grouped node keeps its own children", () => {
    const axis = groupAxis(tree(), [byDept], group)
    expect(roots(axis)).toEqual(['g:["ops"]'])
    expect(kids(axis, 'g:["ops"]')).toEqual(["a", "g"])
    expect(kids(axis, "a")).toEqual(["b", "c"])
    expect(kids(axis, "b")).toEqual(["d", "e"])
    expect(keys(axis)).toEqual(['g:["ops"]', "a", "b", "d", "e", "c", "f", "g", "h"])
  })
})

describe("flattenAxis", () => {
  it("emits a closed node and skips its subtree", () => {
    const nodes = flattenAxis(tree(), (key) => key !== "b")
    expect(nodes.map((node) => node.key)).toEqual(["a", "b", "c", "f", "g", "h"])
  })

  it("reports hasChildren for a closed node too", () => {
    const nodes = flattenAxis(tree(), (key) => key !== "b")
    expect(nodes.find((node) => node.key === "b")?.hasChildren).toBe(true)
    expect(nodes.find((node) => node.key === "f")?.hasChildren).toBe(false)
  })

  it("numbers index by position in the returned list", () => {
    const nodes = flattenAxis(tree(), (key) => key !== "b")
    expect(nodes.map((node) => node.index)).toEqual([0, 1, 2, 3, 4, 5])
    const all = flattenAxis(tree(), () => true)
    expect(all.map((node) => node.index)).toEqual(all.map((_node, at) => at))
  })

  it("carries depth and parent down each branch", () => {
    const nodes = flattenAxis(tree(), () => true)
    expect(nodes.map((node) => node.key)).toEqual(["a", "b", "d", "e", "c", "f", "g", "h"])
    expect(nodes.map((node) => node.depth)).toEqual([0, 1, 2, 2, 1, 2, 0, 1])
    expect(nodes.map((node) => node.parent)).toEqual([
      null,
      "a",
      "b",
      "b",
      "a",
      "c",
      null,
      "g",
    ])
  })
})

describe("walks", () => {
  const cyclic = (): Axis<string, Row> => ({
    roots: ["x"],
    children: new Map([
      ["x", ["y"]],
      ["y", ["x"]],
    ]),
    parent: new Map([
      ["x", "y"],
      ["y", "x"],
    ]),
    by: new Map([
      ["x", { name: "x", size: 1, dept: "ops" }],
      ["y", { name: "y", size: 1, dept: "ops" }],
    ]),
  })

  it("returns ancestors nearest first", () => {
    expect(ancestorsOf(tree(), "d")).toEqual(["b", "a"])
    expect(ancestorsOf(tree(), "a")).toEqual([])
    expect(ancestorsOf(flat(), "d")).toEqual([])
  })

  it("returns descendants depth first", () => {
    expect(descendantsOf(tree(), "a")).toEqual(["b", "d", "e", "c", "f"])
    expect(descendantsOf(tree(), "f")).toEqual([])
    expect(descendantsOf(flat(), "a")).toEqual([])
  })

  it("terminates on a malformed cyclic axis", () => {
    expect(ancestorsOf(cyclic(), "x")).toEqual(["y"])
    expect(descendantsOf(cyclic(), "x")).toEqual(["y"])
    expect(flattenAxis(cyclic(), () => true).map((node) => node.key)).toEqual(["x", "y"])
  })
})

describe("mapAxis", () => {
  it("changes values and leaves the structure alone", () => {
    const axis = mapAxis(tree(), (row) => row.name.toUpperCase())
    expect(roots(axis)).toEqual(["a", "g"])
    expect(kids(axis, "b")).toEqual(["d", "e"])
    expect(axis.by.get("d")).toBe("DELTA")
    expect([...axis.by.keys()]).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"])
    expect(keys(axis)).toEqual(keys(tree()))
  })
})
