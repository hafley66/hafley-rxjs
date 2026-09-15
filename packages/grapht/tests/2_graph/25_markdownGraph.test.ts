import { describe, expect, test } from "vitest"
import { indexGraph, mdDocument, validateGraph, type GraphId } from "@hafley66/grapht-model"
import {
  markdownGraph,
  type MarkdownBlockData,
  type MarkdownGraph,
  type MarkdownSectionData,
} from "../../src/index.js"

const PATH = "docs/example.md"

// One document that carries every case: prose with two links to the same anchor, an
// external link, an anchor nothing defines, a self-link written as a path, a link to a
// block, and a link inside a fence.
const INTRO =
  "Intro paragraph with a [self link](#usage) and the same [self link](#usage) again, plus an\n" +
  "[external link](https://example.com/notes.md) and a [broken link](#nowhere)."
const USAGE_BODY = "The [top section](./example.md#board-notes) is above."
const FENCE = '```ts\nconst target = "[not a link](#usage)"\n```'
const DETAILS_BODY = "Nested body text, pointing at [the fence](#usage/2) above."
const FIXTURE = `# Board notes\n\n${INTRO}\n\n## Usage\n\n${USAGE_BODY}\n\n${FENCE}\n\n### Details\n\n${DETAILS_BODY}\n`

const INSERTED = "# Overview\n\nAdded above the fixture.\n\n"

function blockData(graph: MarkdownGraph, id: GraphId): MarkdownBlockData {
  const item = graph[id]
  if (item.type !== "node") throw new Error(`not a node: ${id}`)
  const data = item.data
  if (data === undefined || data.kind === "section") throw new Error(`not a block: ${id}`)
  return data
}

function sectionData(graph: MarkdownGraph, id: GraphId): MarkdownSectionData {
  const item = graph[id]
  if (item.type !== "node") throw new Error(`not a node: ${id}`)
  const data = item.data
  if (data?.kind !== "section") throw new Error(`not a section: ${id}`)
  return data
}

const nodeIds = (graph: MarkdownGraph): string[] =>
  Object.values(graph)
    .filter(item => item.type === "node")
    .map(item => item.id)

const edgeItems = (graph: MarkdownGraph) => Object.values(graph).filter(item => item.type === "edge")

describe("markdown graph", () => {
  test("makes one node per block and one group node per heading", () => {
    const document = mdDocument(PATH, FIXTURE)
    const graph = markdownGraph(document)

    expect(validateGraph(graph)).toEqual([])
    expect(nodeIds(graph)).toEqual([
      "board-notes",
      "usage",
      "details",
      "board-notes/0",
      "board-notes/1",
      "usage/0",
      "usage/1",
      "usage/2",
      "details/0",
      "details/1",
    ])
    expect(nodeIds(graph).filter(id => id.includes("/"))).toHaveLength(document.blocks.length)
    expect(sectionData(graph, "usage")).toEqual({
      kind: "section",
      section: "usage",
      label: "Usage",
      depth: 2,
      span: {
        start: FIXTURE.indexOf("## Usage"),
        end: FIXTURE.length,
        lineStart: 6,
        lineEnd: FIXTURE.split("\n").length - 1,
      },
    })
    // A box is the kind, the owning heading, its position there, and the bytes it covers;
    // a fence also names its language.
    expect(blockData(graph, "usage/2")).toEqual({
      kind: "code",
      section: "usage",
      ordinal: 2,
      language: "ts",
      span: {
        start: FIXTURE.indexOf(FENCE),
        end: FIXTURE.indexOf(FENCE) + FENCE.length,
        lineStart: 10,
        lineEnd: 12,
      },
    })
    expect(FIXTURE.slice(blockData(graph, "board-notes/1").span.start, blockData(graph, "board-notes/1").span.end)).toBe(INTRO)
  })

  test("nests each child heading and its own blocks inside the parent heading", () => {
    const graph = markdownGraph(mdDocument(PATH, FIXTURE))

    expect({
      sectionParents: ["board-notes", "usage", "details"].map(id => graph[id].parentId),
      blockParents: ["board-notes/0", "board-notes/1", "usage/1", "details/1"].map(id => graph[id].parentId),
      usageChildren: [...(indexGraph(graph).childrenByParent.get("usage") ?? [])],
    }).toEqual({
      sectionParents: [undefined, "board-notes", "usage"],
      blockParents: ["board-notes", "board-notes", "usage", "details"],
      usageChildren: ["details", "usage/0", "usage/1", "usage/2"],
    })
    // The three headings exist at three nesting depths.
    expect(["board-notes", "usage", "details"].map(id => sectionData(graph, id).depth)).toEqual([1, 2, 3])
  })

  test("keeps block ids when a heading is inserted above them", () => {
    const beforeDocument = mdDocument(PATH, FIXTURE)
    const afterDocument = mdDocument(PATH, INSERTED + FIXTURE)
    const before = markdownGraph(beforeDocument)
    const after = markdownGraph(afterDocument)

    expect([...nodeIds(after)].sort()).toEqual(
      [...nodeIds(before), "overview", "overview/0", "overview/1"].sort(),
    )
    expect(edgeItems(after)).toEqual(edgeItems(before))
    // Every block moved, yet every address stayed: ids are section/ordinal, not global indices.
    const beforeHeading = blockData(before, "usage/0")
    const afterHeading = blockData(after, "usage/0")
    const lines = INSERTED.split("\n").length - 1
    expect({
      id: after["usage/0"].id,
      kind: afterHeading.kind,
      section: afterHeading.section,
      ordinal: afterHeading.ordinal,
      span: afterHeading.span,
      globalIndex: afterDocument.blocks.findIndex(block => block.id === "usage/0"),
    }).toEqual({
      id: "usage/0",
      kind: "heading",
      section: "usage",
      ordinal: 0,
      span: {
        start: beforeHeading.span.start + INSERTED.length,
        end: beforeHeading.span.end + INSERTED.length,
        lineStart: beforeHeading.span.lineStart + lines,
        lineEnd: beforeHeading.span.lineEnd + lines,
      },
      globalIndex: beforeDocument.blocks.findIndex(block => block.id === "usage/0") + 2,
    })
  })

  test("edges only the links this document contains", () => {
    const graph = markdownGraph(mdDocument(PATH, FIXTURE))

    // The external link, the undefined anchor, and the link inside the fence are absent;
    // the two links to #usage from one paragraph are one relation.
    expect(edgeItems(graph)).toEqual([
      {
        id: "board-notes/1->usage",
        type: "edge",
        fromId: "board-notes/1",
        toId: "usage",
        direction: "forward",
        data: { kind: "link", href: "#usage" },
      },
      {
        id: "usage/1->board-notes",
        type: "edge",
        fromId: "usage/1",
        toId: "board-notes",
        direction: "forward",
        data: { kind: "link", href: "./example.md#board-notes" },
      },
      {
        id: "details/1->usage/2",
        type: "edge",
        fromId: "details/1",
        toId: "usage/2",
        direction: "forward",
        data: { kind: "link", href: "#usage/2" },
      },
    ])
    // What a section's hover needs: its outgoing links and the backlinks that land on it.
    expect({
      intoUsage: [...(indexGraph(graph).incomingByEndpoint.get("usage") ?? [])],
      outOfUsage: [...(indexGraph(graph).outgoingByEndpoint.get("usage") ?? [])],
      outOfIntro: [...(indexGraph(graph).outgoingByEndpoint.get("board-notes/1") ?? [])],
      intoFenceBlock: [...(indexGraph(graph).incomingByEndpoint.get("usage/2") ?? [])],
    }).toEqual({
      intoUsage: ["board-notes/1->usage"],
      outOfUsage: [],
      outOfIntro: ["board-notes/1->usage"],
      intoFenceBlock: ["details/1->usage/2"],
    })
  })
})