// The demo panel prints the source of whichever rendering is running. An alternate shipping the DOM
// file's text turns its button into a claim about code no reader is ever shown.
import { describe, expect, test } from "vitest"
import type { Example } from "../examples/0_types.js"
import { flatList } from "../examples/1_flat_list.js"
import { multiSort } from "../examples/2_multi_sort.js"
import { treeExpand } from "../examples/3_tree_expand.js"

const OFFERED: readonly Example[] = [flatList, multiSort, treeExpand]

describe("an example that offers a second rendering", () => {
  test.each(OFFERED)("$id labels it and brings a file of its own", (example) => {
    expect(example.alternate?.label).toBe("React")
    expect(example.alternate?.source).not.toBe(example.source)
    expect(example.alternate?.source ?? "").toContain("react-dom")
  })

  // One set of signals under both renderings. A second `grid()` call with the fields written again
  // would make the two buttons a claim about the signals layer rather than evidence of it.
  test.each(OFFERED)("$id draws both renderings from the one factory", (example) => {
    expect(example.alternate?.source ?? "").toMatch(/^import \{ open \} from "\.\/\d+_\w+\.js"$/m)
    expect(example.alternate?.source ?? "").not.toContain("grid<")
  })
})
