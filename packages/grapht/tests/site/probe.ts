// A module the site suite hands to the docs page. The page's own dev server transforms it, so the
// markdown lane it runs is this repository's source — `mdDocument` from `@hafley66/grapht-model` and
// `markdownGraph` from `src/` — rather than a bundle built for a test. Both are pure: a page can
// parse and index a document without a renderer, a DOM measure, or a frame.
//
// `markdownGraph` is imported from its own module rather than from `src/index.js`: this package's
// barrel is the whole toolkit, and a page that imported it would pull the bench harness, the node
// fixtures, and the renderer adapters into the browser — `1_sequence/3_geometry.ts` reaches for
// playwright, which no browser graph can load.
import { mdDocument, validateGraph } from "@hafley66/grapht-model"
import { markdownGraph } from "../../src/2_graph/25_markdownGraph.js"

const PATH = "docs/site-probe.md"

// One document that carries the cases the graph lane has to get right: a heading a link points at,
// a link written twice to the same anchor (one relation, not two), a link that leaves the document,
// and a link that names this same file by path and so resolves inside it.
const MARKDOWN = [
  "# Board notes",
  "",
  "Intro paragraph with a [self link](#usage) and the same [self link](#usage) again, plus an",
  "[external link](https://example.com/notes.md).",
  "",
  "## Usage",
  "",
  "The [top section](./site-probe.md#board-notes) is above.",
  "",
  "### Details",
  "",
  "Nested body text.",
  "",
].join("\n")

/** Mount the markdown lane's result into a host the caller owns, and hand back what removes it. */
export function mountProbe(host: HTMLElement): () => void {
  const graph = markdownGraph(mdDocument(PATH, MARKDOWN))
  const items = Object.values(graph)
  const nodes = items.filter((item) => item.type === "node")
  const edges = items.filter((item) => item.type === "edge")

  const root = document.createElement("div")
  root.dataset.probe = "markdown"
  const metric = (name: string, value: number): void => {
    const line = document.createElement("p")
    line.dataset.metric = name
    line.textContent = String(value)
    root.append(line)
  }
  metric("nodes", nodes.length)
  metric("edges", edges.length)
  // A graph the model's own validator rejects is not one a page should draw, so the check the
  // renderer would run is part of what the probe reports rather than a detail of its own.
  metric("diagnostics", validateGraph(graph).length)

  const ids = document.createElement("ul")
  ids.dataset.ids = "node"
  for (const node of nodes) {
    const item = document.createElement("li")
    item.dataset.nodeId = node.id
    item.textContent = node.id
    ids.append(item)
  }
  root.append(ids)

  host.append(root)
  return () => root.remove()
}