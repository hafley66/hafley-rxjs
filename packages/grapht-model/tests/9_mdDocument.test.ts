import { expect, it } from "vitest"
import { blockAt, mdDocument, parseMdSections, type MdDocument } from "../src/index.js"

const DOC = [
  "---",
  "title: example",
  "---",
  "",
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

it("addresses blocks with offsets into the original text, frontmatter included", () => {
  const document = mdDocument("docs/example.md", DOC)
  expect(document.blocks.map((block) => [block.id, block.kind, block.span.start])).toEqual([
    ["alpha/0", "heading", DOC.indexOf("# Alpha")],
    ["alpha/1", "paragraph", DOC.indexOf("intro paragraph")],
    ["alpha/2", "code", DOC.indexOf("```mermaid")],
    ["beta/0", "heading", DOC.indexOf("## Beta")],
    ["beta/1", "list", DOC.indexOf("- one")],
    ["beta/2", "listItem", DOC.indexOf("- one")],
    ["beta/3", "paragraph", DOC.indexOf("one")],
    ["beta/4", "list", DOC.indexOf("- nested")],
    ["beta/5", "listItem", DOC.indexOf("- nested")],
    ["beta/6", "paragraph", DOC.indexOf("nested")],
    ["beta/7", "code", DOC.indexOf("~~~d2")],
  ])
  expect(document.doc.tree.map((section) => [section.id, section.children.map((child) => child.id)])).toEqual([
    ["alpha", ["beta"]],
  ])
})

it("slices the fence body out of the block, markers excluded", () => {
  const document = mdDocument("docs/example.md", DOC)
  const [mermaid, d2] = document.blocks.filter((block) => block.kind === "code")

  expect(DOC.slice(mermaid!.codeStart, mermaid!.codeEnd)).toBe("sequenceDiagram\n  Alice->>Bob: hi")
  expect(mermaid!.language).toBe("mermaid")
  // The tilde fence is never closed, so its body runs to the end of the block.
  expect(DOC.slice(d2!.codeStart, d2!.codeEnd)).toBe("a -> b")
  expect(d2!.codeEnd).toBe(d2!.span.end)
})

it("resolves an offset to the innermost block that contains it", () => {
  const document = mdDocument("docs/example.md", DOC)
  expect(blockAt(document, DOC.indexOf("nested"))?.id).toBe("beta/6")
  expect(blockAt(document, DOC.indexOf("sequenceDiagram"))?.id).toBe("alpha/2")
  expect(blockAt(document, DOC.indexOf("intro paragraph"))?.id).toBe("alpha/1")
  // Frontmatter is masked for the parse, so it owns no block of its own.
  expect(blockAt(document, DOC.indexOf("title: example"))).toBeUndefined()
})

it("keeps ids and fence bodies stable when text above a block changes", () => {
  const before = mdDocument("docs/example.md", DOC)
  const after = mdDocument("docs/example.md", `# Alpha\n\nintro paragraph\n\n${DOC.slice(DOC.indexOf("```mermaid"))}`)

  expect(fenceOf(after).id).toBe(fenceOf(before).id)
  expect(after.text.slice(fenceOf(after).codeStart, fenceOf(after).codeEnd)).toBe(
    before.text.slice(fenceOf(before).codeStart, fenceOf(before).codeEnd),
  )
  expect(fenceOf(after).span.start).toBe(after.text.indexOf("```mermaid"))
})

it("keeps the section model identical to the direct parse", () => {
  expect(mdDocument("docs/example.md", DOC).doc).toEqual(parseMdSections(DOC))
})
