// Pure and synchronous: no grid, no epic, no pointer. Everything here is a function of a range and
// two key lists, which is the whole reason the model was lifted out of the gesture.
import { describe, expect, it } from "vitest"
import { cellId } from "./0_types.js"
import {
  beginAt,
  blocksOf,
  clearSelection,
  columnAnchor,
  commitBlock,
  extendTo,
  isRangeEmpty,
  isSelected,
  rangeOf,
  rectOf,
  rowAnchor,
  selectedKeys,
  selectionTest,
  EMPTY_RANGE,
  type Block,
  type GridSelection,
} from "./15_selection.js"

const VERTICAL: readonly string[] = ["r1", "r2", "r3", "r4"]
const HORIZONTAL: readonly string[] = ["c1", "c2", "c3"]

const at = (vertical: string, horizontal: string): string => cellId(vertical, horizontal)

const block = (anchor: string, head: string, mode: Block["mode"] = "cell"): Block => ({
  anchor,
  head,
  mode,
})

/** Every address the range covers, in run order, spelled `vertical/horizontal` for readability. */
const covered = (range: GridSelection): string[] => {
  const covers = selectionTest(range, VERTICAL, HORIZONTAL)
  const out: string[] = []
  for (const down of VERTICAL) {
    for (const across of HORIZONTAL) {
      if (covers(at(down, across))) out.push(`${down}/${across}`)
    }
  }
  return out
}

describe("rectOf", () => {
  it("gives both ordered key lists a cell block covers", () => {
    expect(rectOf(block(at("r1", "c1"), at("r3", "c3")), VERTICAL, HORIZONTAL)).toEqual({
      vertical: ["r1", "r2", "r3"],
      horizontal: ["c1", "c2", "c3"],
    })
  })

  it("reads the same rect when the anchor sits after the head in either axis", () => {
    const forward = rectOf(block(at("r1", "c1"), at("r3", "c2")), VERTICAL, HORIZONTAL)
    expect(rectOf(block(at("r3", "c2"), at("r1", "c1")), VERTICAL, HORIZONTAL)).toEqual(forward)
    expect(rectOf(block(at("r3", "c1"), at("r1", "c2")), VERTICAL, HORIZONTAL)).toEqual(forward)
  })

  it("covers one cell when the anchor and the head are the same address", () => {
    expect(rectOf(block(at("r2", "c2"), at("r2", "c2")), VERTICAL, HORIZONTAL)).toEqual({
      vertical: ["r2"],
      horizontal: ["c2"],
    })
  })

  it("covers every horizontal key for a row block, whatever its own horizontal half says", () => {
    expect(rectOf(block(rowAnchor("r2"), rowAnchor("r3"), "row"), VERTICAL, HORIZONTAL)).toEqual({
      vertical: ["r2", "r3"],
      horizontal: ["c1", "c2", "c3"],
    })
  })

  it("covers every vertical key for a column block", () => {
    const spanned = block(columnAnchor("c1"), columnAnchor("c2"), "column")
    expect(rectOf(spanned, VERTICAL, HORIZONTAL)).toEqual({
      vertical: ["r1", "r2", "r3", "r4"],
      horizontal: ["c1", "c2"],
    })
  })

  it("takes the axis orders it is handed, so the two seats swap with the arguments", () => {
    expect(rectOf(block(at("c1", "r1"), at("c2", "r3")), HORIZONTAL, VERTICAL)).toEqual({
      vertical: ["c1", "c2"],
      horizontal: ["r1", "r2", "r3"],
    })
  })

  it("drops a block whose anchor left the axis rather than throwing", () => {
    const gone = block(at("r9", "c1"), at("r3", "c2"))
    expect(rectOf(gone, VERTICAL, HORIZONTAL)).toEqual({ vertical: [], horizontal: [] })
  })

  it("drops a row block whose vertical key left the axis and keeps one whose column did", () => {
    expect(rectOf(block(rowAnchor("r9"), rowAnchor("r9"), "row"), VERTICAL, HORIZONTAL).vertical)
      .toEqual([])
    expect(rectOf(block(at("r2", "gone"), at("r2", "gone"), "row"), VERTICAL, HORIZONTAL)).toEqual({
      vertical: ["r2"],
      horizontal: ["c1", "c2", "c3"],
    })
  })
})

describe("isSelected", () => {
  it("answers for the live drag", () => {
    const range: GridSelection = { anchor: at("r1", "c1"), head: at("r2", "c2"), mode: "cell", blocks: [] }
    expect(isSelected(range, VERTICAL, HORIZONTAL, at("r2", "c2"))).toBe(true)
    expect(isSelected(range, VERTICAL, HORIZONTAL, at("r3", "c2"))).toBe(false)
  })

  it("answers for every committed block as well", () => {
    const range: GridSelection = {
      anchor: at("r1", "c1"),
      head: at("r1", "c1"),
      mode: "cell",
      blocks: [block(at("r4", "c3"), at("r4", "c3"))],
    }
    expect(covered(range)).toEqual(["r1/c1", "r4/c3"])
  })

  it("says no to every address of an empty range", () => {
    expect(covered(EMPTY_RANGE)).toEqual([])
  })

  it("says no to an address outside the runs it was handed", () => {
    const range: GridSelection = { anchor: at("r1", "c1"), head: at("r4", "c3"), mode: "cell", blocks: [] }
    expect(isSelected(range, VERTICAL, HORIZONTAL, at("r9", "c1"))).toBe(false)
  })
})

describe("selectedKeys", () => {
  it("lists a vertical key only when the whole run beside it is covered", () => {
    const range: GridSelection = { anchor: rowAnchor("r2"), head: rowAnchor("r2"), mode: "row", blocks: [] }
    expect(selectedKeys(range, VERTICAL, HORIZONTAL)).toEqual({
      vertical: ["r2"],
      horizontal: [],
    })
  })

  it("lists a horizontal key when a column block covers it", () => {
    const range: GridSelection = {
      anchor: columnAnchor("c2"),
      head: columnAnchor("c3"),
      mode: "column",
      blocks: [],
    }
    expect(selectedKeys(range, VERTICAL, HORIZONTAL)).toEqual({
      vertical: [],
      horizontal: ["c2", "c3"],
    })
  })

  it("lists neither when the rectangle is partial", () => {
    const range: GridSelection = { anchor: at("r1", "c1"), head: at("r2", "c2"), mode: "cell", blocks: [] }
    expect(selectedKeys(range, VERTICAL, HORIZONTAL)).toEqual({ vertical: [], horizontal: [] })
  })

  it("lists both when a cell rectangle happens to cover every key of a run", () => {
    const range: GridSelection = { anchor: at("r1", "c1"), head: at("r4", "c3"), mode: "cell", blocks: [] }
    expect(selectedKeys(range, VERTICAL, HORIZONTAL)).toEqual({
      vertical: VERTICAL,
      horizontal: HORIZONTAL,
    })
  })

  it("is empty for an empty range even though an empty run covers vacuously", () => {
    expect(selectedKeys(EMPTY_RANGE, VERTICAL, [])).toEqual({ vertical: [], horizontal: [] })
  })
})

describe("beginAt", () => {
  it("opens one cell, never an empty range", () => {
    const range = beginAt(EMPTY_RANGE, at("r2", "c2"), "cell", false)
    expect(range.anchor).toBe(at("r2", "c2"))
    expect(range.head).toBe(at("r2", "c2"))
    expect(covered(range)).toEqual(["r2/c2"])
  })

  it("drops every earlier block when it is not additive", () => {
    const first = commitBlock(beginAt(EMPTY_RANGE, at("r1", "c1"), "cell", false))
    const second = beginAt(first, at("r4", "c3"), "cell", false)
    expect(second.blocks).toEqual([])
    expect(covered(second)).toEqual(["r4/c3"])
  })

  it("keeps every earlier block when it is additive", () => {
    const first = commitBlock(beginAt(EMPTY_RANGE, at("r1", "c1"), "cell", false))
    const second = beginAt(first, at("r4", "c3"), "cell", true)
    expect(covered(second)).toEqual(["r1/c1", "r4/c3"])
  })

  it("carries the mode the gesture opened in", () => {
    expect(beginAt(EMPTY_RANGE, rowAnchor("r1"), "row", false).mode).toBe("row")
  })
})

describe("extendTo", () => {
  it("moves the head and keeps the anchor", () => {
    const opened = beginAt(EMPTY_RANGE, at("r1", "c1"), "cell", false)
    const grown = extendTo(extendTo(opened, at("r2", "c2")), at("r3", "c3"))
    expect(grown.anchor).toBe(at("r1", "c1"))
    expect(covered(grown)).toHaveLength(9)
  })

  it("takes the head as the anchor when there is none", () => {
    const grown = extendTo(EMPTY_RANGE, at("r2", "c2"))
    expect(grown.anchor).toBe(at("r2", "c2"))
    expect(covered(grown)).toEqual(["r2/c2"])
  })

  it("leaves the committed blocks alone", () => {
    const first = commitBlock(beginAt(EMPTY_RANGE, at("r1", "c1"), "cell", false))
    const second = extendTo(beginAt(first, at("r4", "c1"), "cell", true), at("r4", "c3"))
    expect(second.blocks).toHaveLength(1)
    expect(covered(second)).toEqual(["r1/c1", "r4/c1", "r4/c2", "r4/c3"])
  })
})

describe("commitBlock", () => {
  it("keeps the pair live so a shift-click still extends it", () => {
    const done = commitBlock(extendTo(beginAt(EMPTY_RANGE, at("r1", "c1"), "cell", false), at("r2", "c2")))
    expect(done.anchor).toBe(at("r1", "c1"))
    expect(extendTo(done, at("r3", "c3")).anchor).toBe(at("r1", "c1"))
  })

  it("replaces its own earlier commit rather than appending a second block", () => {
    const opened = beginAt(EMPTY_RANGE, at("r1", "c1"), "cell", false)
    const once = commitBlock(opened)
    const twice = commitBlock(extendTo(once, at("r2", "c2")))
    expect(twice.blocks).toHaveLength(1)
    expect(covered(twice)).toEqual(["r1/c1", "r1/c2", "r2/c1", "r2/c2"])
  })

  it("is identity for a range with no live pair", () => {
    expect(commitBlock(EMPTY_RANGE)).toBe(EMPTY_RANGE)
  })
})

describe("clearSelection", () => {
  it("drops the live pair and every block", () => {
    const range = commitBlock(beginAt(EMPTY_RANGE, at("r1", "c1"), "cell", false))
    expect(isRangeEmpty(clearSelection(range))).toBe(true)
    expect(covered(clearSelection(range))).toEqual([])
  })

  it("is identity when there was nothing to clear", () => {
    expect(clearSelection(EMPTY_RANGE)).toBe(EMPTY_RANGE)
  })
})

describe("rangeOf", () => {
  it("widens the narrow state shape", () => {
    expect(rangeOf({ anchor: null, head: null })).toEqual(EMPTY_RANGE)
    expect(rangeOf({ anchor: at("r1", "c1"), head: at("r2", "c2") }).mode).toBe("cell")
  })

  it("hands back the same reference when the state already carries the richer shape", () => {
    const range = beginAt(EMPTY_RANGE, at("r1", "c1"), "row", false)
    expect(rangeOf(range)).toBe(range)
  })
})

describe("blocksOf", () => {
  it("puts the live pair ahead of what earlier gestures committed", () => {
    const first = commitBlock(beginAt(EMPTY_RANGE, at("r1", "c1"), "cell", false))
    const second = beginAt(first, at("r4", "c3"), "row", true)
    expect(blocksOf(second).map((entry) => entry.mode)).toEqual(["row", "cell"])
  })
})
