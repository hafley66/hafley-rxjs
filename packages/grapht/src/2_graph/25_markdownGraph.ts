// Markdown is a grapht source language: every block is a node, every heading is the group
// its own blocks and its child headings nest inside, and a link that lands inside the
// document is an edge. Source text is never rewritten, so a node's span still names the
// bytes the renderer paints and the board addresses.
import {
  blockAt,
  normalizeMdPath,
  resolveMdLink,
  type Graph,
  type GraphId,
  type GraphItem,
  type MdBlock,
  type MdBlockKind,
  type MdDocument,
  type MdSection,
  type SourceSpan,
} from "@hafley66/grapht-model"

/** A heading: the group its own blocks and its child headings nest inside. */
export type MarkdownSectionData = {
  kind: "section"
  /** Section id — the anchor a link fragment names. */
  section: string
  /** Heading text, for a renderer's sticky header or label. */
  label: string
  depth: number
  /** The whole section, child headings included. */
  span: SourceSpan
}

/** One addressable block: prose, a heading, a list, a fence, a quote. */
export type MarkdownBlockData = {
  kind: MdBlockKind
  /** Owning section id, or "preamble" before the first heading. */
  section: string
  ordinal: number
  span: SourceSpan
  /** Fence language, when the block is a fenced code block with an info string. */
  language?: string
}

export type MarkdownNodeData = MarkdownSectionData | MarkdownBlockData

export type MarkdownEdgeData = { kind: "link"; href: string }

export type MarkdownGraph = Graph<MarkdownNodeData, MarkdownEdgeData>

/** Inline `[text](href)` links. Reference-style links and autolinks are not followed. */
const INLINE_LINK = /\[[^\]\n]*\]\(\s*([^)\s]+?)(?:\s+"[^"\n]*")?\s*\)/g

// A fence and an html block are verbatim text: a `[x](y)` inside one is not a link.
const VERBATIM_KINDS: Partial<Record<MdBlockKind, true>> = { code: true, html: true }

function lineStarts(text: string): number[] {
  const starts = [0]
  for (let index = 0; index < text.length; index++) if (text.charCodeAt(index) === 10) starts.push(index + 1)
  return starts
}

/** 1-based line of `offset`, the numbering mdast reports in a block span. */
function lineAt(starts: readonly number[], offset: number): number {
  let low = 0
  let high = starts.length - 1
  while (low < high) {
    const middle = (low + high + 1) >> 1
    if ((starts[middle] as number) <= offset) low = middle
    else high = middle - 1
  }
  return low + 1
}

function spanOf(starts: readonly number[], start: number, end: number): SourceSpan {
  return { start, end, lineStart: lineAt(starts, start), lineEnd: lineAt(starts, Math.max(start, end - 1)) }
}

/** The deepest heading whose span covers the offset, or undefined in the preamble. */
function ownSectionId(sections: readonly MdSection[], offset: number): string | undefined {
  let owner: MdSection | undefined
  for (const section of sections) {
    if (offset < section.start || offset >= section.end) continue
    if (!owner || section.depth > owner.depth) owner = section
  }
  return owner?.id
}

// A fragment names a heading anchor (`#usage`) or a block (`#usage/2`). Anything the
// model classifies as external, remote, or non-markdown is not in this document, and
// `resolveMdLink` delegates a bare in-page anchor to its caller — this one.
function anchorOf(document: MdDocument, href: string): string | undefined {
  if (href.startsWith("#")) return href.slice(1) || undefined
  const resolved = resolveMdLink(document.path, href)
  if (!resolved?.frag) return undefined
  return resolved.path === normalizeMdPath(document.path) ? resolved.frag : undefined
}

/** Blocks become nodes, headings become groups, in-document links become edges. */
export function markdownGraph(document: MdDocument): MarkdownGraph {
  const starts = lineStarts(document.text)
  const sections = [...document.doc.byId.values()]
  const blockIds = new Set(document.blocks.map(block => block.id))
  const graph: Record<GraphId, GraphItem<MarkdownNodeData, MarkdownEdgeData>> = {}

  const addSection = (section: MdSection, parentId?: GraphId): void => {
    graph[section.id] = {
      id: section.id,
      type: "node",
      ...(parentId === undefined ? {} : { parentId }),
      data: {
        kind: "section",
        section: section.id,
        label: section.title,
        depth: section.depth,
        span: spanOf(starts, section.start, section.end),
      },
    }
    for (const child of section.children) addSection(child, section.id)
  }
  for (const section of document.doc.tree) addSection(section)

  for (const block of document.blocks) {
    // Nested blocks (a list item, a quoted paragraph) stay inside their enclosing block;
    // the rest sit in the section whose span covers them.
    const parentId = block.parent ?? ownSectionId(sections, block.span.start)
    graph[block.id] = {
      id: block.id,
      type: "node",
      ...(parentId === undefined ? {} : { parentId }),
      data: {
        kind: block.kind,
        section: block.section,
        ordinal: block.ordinal,
        span: block.span,
        ...(block.language === undefined ? {} : { language: block.language }),
      },
    }
  }

  const addLink = (owner: MdBlock, href: string): void => {
    const anchor = anchorOf(document, href)
    const target = anchor === undefined ? undefined : document.doc.byId.has(anchor) || blockIds.has(anchor) ? anchor : undefined
    if (target === undefined || target === owner.id) return
    const id = `${owner.id}->${target}`
    if (graph[id]) return // one edge per pair: two links to the same anchor are one relation
    graph[id] = { id, type: "edge", fromId: owner.id, toId: target, direction: "forward", data: { kind: "link", href } }
  }

  for (const match of document.text.matchAll(INLINE_LINK)) {
    const at = match.index
    const href = (match[1] as string).replace(/^<|>$/g, "")
    if (at === undefined || !href) continue
    const owner = blockAt(document, at)
    if (!owner || VERBATIM_KINDS[owner.kind]) continue
    addLink(owner, href)
  }

  return graph
}