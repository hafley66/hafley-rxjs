import { describe, expect, it } from "vitest"
import { compactSingleChildChains } from "./7_compactChains"

type Node = { id: string; label: string; children?: Node[] }

const node = (id: string, label: string, children?: Node[]): Node => ({ id, label, children })

function combine(chain: Node[], children: Node[]): Node {
  const tail = chain.reduce((_, item) => item)
  return { id: tail.id, label: chain.map((n) => n.label).join(" › "), children }
}

const options = { getSubRows: (row: Node) => row.children, combine }

describe("compactSingleChildChains", () => {
  it("merges a run of single-child rows into one", () => {
    const tree = [node("a", "sh -c", [node("b", "node", [node("c", "vitest run --shard=1/2")])])]
    const [root] = compactSingleChildChains(tree, options)
    expect(root!.label).toBe("sh -c › node › vitest run --shard=1/2")
    expect(root!.id).toBe("c")
    expect(root!.children).toEqual([])
  })

  it("stops the chain at a fork (more than one child)", () => {
    const tree = [node("a", "root", [node("b", "mid", [node("c", "left"), node("d", "right")])])]
    const [root] = compactSingleChildChains(tree, options)
    expect(root!.label).toBe("root › mid")
    expect(root!.children?.map((c) => c.label)).toEqual(["left", "right"])
  })

  it("stops the chain at a leaf even with a longer ancestor run above it", () => {
    const tree = [node("a", "root", [node("b", "leaf")])]
    const [root] = compactSingleChildChains(tree, options)
    expect(root!.label).toBe("root › leaf")
    expect(root!.children).toEqual([])
  })

  it("does not merge past a row isLeafPayload marks as payload", () => {
    const payload = new Set(["b"])
    const tree = [node("a", "root", [node("b", "test-row", [node("c", "span")])])]
    const [root] = compactSingleChildChains(tree, { ...options, isLeafPayload: (row) => payload.has(row.id) })
    expect(root!.label).toBe("root › test-row")
    expect(root!.children?.map((c) => c.label)).toEqual(["span"])
  })

  it("leaves an already-single node alone", () => {
    const tree = [node("a", "solo")]
    const [root] = compactSingleChildChains(tree, options)
    expect(root!.label).toBe("solo")
    expect(root!.id).toBe("a")
  })
})
