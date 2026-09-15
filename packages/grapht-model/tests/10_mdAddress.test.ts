import { afterEach, expect, it, vi } from "vitest"
import {
  mdAddressIndex,
  mdAddressOf,
  mdDocument,
  relocateAddress,
  sha256Hex,
  type MdDocument,
} from "../src/index.js"

const DOC = [
  "# Alpha",
  "",
  "intro paragraph",
  "",
  "```mermaid",
  "sequenceDiagram",
  "  Alice->>Bob: hi",
  "```",
  "",
  "## Beta",
  "",
  "- one",
  "  - nested",
  "",
  "~~~d2",
  "a -> b",
].join("\n")

const fenceOf = (document: MdDocument) => document.blocks.find((block) => block.language === "mermaid")!

// The same document with the paragraph above the fence rewritten in place: the
// block count is untouched, so the fence keeps its ordinal.
const EDITED_ABOVE = DOC.replace("intro paragraph", "intro paragraph, now much longer")

// The same document with the fence body rewritten in place.
const EDITED_INSIDE = DOC.replace("Alice->>Bob: hi", "Alice->>Bob: hello there")

const addressOf = async (document: MdDocument, blockId: string) => (await mdAddressOf(document, blockId))!

afterEach(() => vi.unstubAllGlobals())

it("hashes utf-8 bytes to lowercase hex", async () => {
  expect(await sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
  expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
  // Multi-byte input is hashed as bytes, not as UTF-16 code units.
  expect(await sha256Hex("ä")).toBe(await sha256Hex("\u00e4"))
  expect(await sha256Hex("ä")).not.toBe(await sha256Hex("a"))
})

it("refuses to hash when WebCrypto is unavailable", async () => {
  vi.stubGlobal("crypto", {})
  await expect(sha256Hex("abc")).rejects.toThrow(/crypto\.subtle/)
})

it("addresses every block by locator, content, and document hash", async () => {
  const document = mdDocument("docs/example.md", DOC)
  const index = await mdAddressIndex(document)
  const fence = fenceOf(document)
  const address = index.byBlockId.get(fence.id)!

  expect(index.path).toBe("docs/example.md")
  expect(index.docHash).toBe(await sha256Hex(DOC))
  expect(index.byBlockId.size).toBe(document.blocks.length)
  expect(index.byLocator.size).toBe(document.blocks.length)
  expect(address).toEqual({
    path: "docs/example.md",
    section: "alpha",
    block: fence.ordinal,
    blockId: fence.id,
    span: fence.span,
    locatorHash: await sha256Hex(`docs/example.md#${fence.id}`),
    contentHash: await sha256Hex(DOC.slice(fence.span.start, fence.span.end)),
    docHash: index.docHash,
  })
  expect(index.byLocator.get(address.locatorHash)).toBe(address)
  expect(await mdAddressOf(document, fence.id)).toEqual(address)
  expect(await mdAddressOf(document, "alpha/99")).toBeUndefined()
})

it("keeps the locator hash and the fence bytes when text above the fence changes", async () => {
  const before = mdDocument("docs/example.md", DOC)
  const after = mdDocument("docs/example.md", EDITED_ABOVE)
  const previous = await addressOf(before, fenceOf(before).id)
  const next = await addressOf(after, fenceOf(after).id)

  expect(next.locatorHash).toBe(previous.locatorHash)
  expect(next.contentHash).toBe(previous.contentHash)
  expect(next.span.start).toBeGreaterThan(previous.span.start)
  expect(next.docHash).not.toBe(previous.docHash)

  const relocation = await relocateAddress(previous, after)
  expect(relocation).toEqual({ state: "anchored", address: next })
})

it("changes the content hash when the fence body changes", async () => {
  const before = mdDocument("docs/example.md", DOC)
  const after = mdDocument("docs/example.md", EDITED_INSIDE)
  const previous = await addressOf(before, fenceOf(before).id)
  const next = await addressOf(after, fenceOf(after).id)

  expect(next.locatorHash).toBe(previous.locatorHash)
  expect(next.span.start).toBe(previous.span.start)
  expect(next.contentHash).not.toBe(previous.contentHash)
})

it("reanchors a moved block onto its unique copy and keeps the old span", async () => {
  const before = mdDocument("docs/example.md", "# S\n\nkeep\n\nmove me\n")
  const after = mdDocument("docs/example.md", "# S\n\nmove me\n\nkeep\n")
  const previous = await addressOf(before, "s/2")
  const relocation = await relocateAddress(previous, after)

  expect(relocation.state).toBe("reanchored")
  if (relocation.state !== "reanchored") return
  expect(relocation.previousSpan).toEqual(previous.span)
  expect(relocation.address.blockId).toBe("s/1")
  expect(relocation.address.contentHash).toBe(previous.contentHash)
  expect(relocation.address.span.start).toBeLessThan(previous.span.start)
})

it("orphans a block whose text now appears twice, because ambiguity blocks transfer", async () => {
  const before = mdDocument("docs/example.md", "# S\n\nfirst\n\nalpha\n")
  const after = mdDocument("docs/example.md", "# S\n\nfirst\n\nchanged\n\nalpha\n\nalpha\n")
  const previous = await addressOf(before, "s/2")
  const relocation = await relocateAddress(previous, after)

  expect(relocation).toEqual({ state: "orphaned", previousSpan: previous.span, reason: "ambiguous" })
})

it("orphans a removed block", async () => {
  const before = mdDocument("docs/example.md", "# S\n\nkeep\n\nremove me\n")
  const after = mdDocument("docs/example.md", "# S\n\nkeep\n")
  const previous = await addressOf(before, "s/2")

  expect(await relocateAddress(previous, after)).toEqual({
    state: "orphaned",
    previousSpan: previous.span,
    reason: "missing",
  })
})
