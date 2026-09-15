// Markdown is a grapht source language. One structural pass with remark-parse
// produces the heading tree the viewer folds and the flat block list the graph
// and the board address. Offsets are absolute into the original text, so a
// section, a fence, and a diagram statement can all name the same bytes.
import { unified } from "unified"
import remarkParse from "remark-parse"
import type { Heading, PhrasingContent, Root } from "mdast"

import type { SourceSpan } from "./0_sourceSpan.js"

export interface MdSection {
  id: string // slug of the title, deduped ("usage", "usage-1", …)
  depth: number // heading level 1-6
  title: string // plain text (inline markdown stripped)
  start: number // offset of the heading's first char in the source
  ownStart: number // offset just past the heading (start of the own body)
  ownEnd: number // first child's start, else `end`
  end: number // next same-or-shallower heading's start, else EOF
  children: MdSection[]
}

export interface MdDoc {
  tree: MdSection[]
  preamble: string // source before the first heading ("" when only whitespace)
  byId: Map<string, MdSection>
  folds: ListFolds // foldable lists / multi-block list items (VSCode-style)
}

export interface ListFolds {
  lists: Map<number, number> // list start offset -> direct item count (≥2 items)
  firstItemToList: Map<number, number> // a list's first item start -> list start (twisty handle)
  items: Set<number> // multi-block listItem start offsets (foldable items)
  all: number[] // every foldable offset (for "fold all")
}

export type MdBlockKind =
  | "heading"
  | "paragraph"
  | "list"
  | "listItem"
  | "table"
  | "code"
  | "blockquote"
  | "html"

export type MdBlock = {
  /** `${section}/${ordinal}`: stable across content edits, independent of the file path. */
  id: string
  kind: MdBlockKind
  /** Owning section id, or "preamble" before the first heading. */
  section: string
  /** Nearest enclosing block id, when this block is nested. */
  parent?: string
  /** Position among the blocks of that section, in document order. */
  ordinal: number
  span: SourceSpan
  /** Fence language, when the block is a fenced code block with an info string. */
  language?: string
  /** Fence body offsets: the join from a fence-relative span to an absolute one. */
  codeStart?: number
  codeEnd?: number
}

export type MdDocument = {
  path: string
  text: string
  /** Offset just past masked YAML frontmatter, so a caller can slice the body. */
  contentStart: number
  doc: MdDoc
  blocks: readonly MdBlock[]
}

// YAML frontmatter is metadata for the document host. remark-parse treats its
// opening/closing `---` lines as thematic breaks and the intervening YAML as
// ordinary Markdown, which can produce malformed lists, headings, and very
// wide rendered blocks. Mask it with spaces so all later mdast offsets remain
// absolute offsets into the original source.
function maskYamlFrontmatter(text: string): { markdown: string; contentStart: number } {
  const bom = text.charCodeAt(0) === 0xfeff ? 1 : 0
  const openingEnd = text.indexOf("\n", bom)
  const opening = text.slice(bom, openingEnd < 0 ? text.length : openingEnd).replace(/\r$/, "")
  if (opening !== "---" || openingEnd < 0) return { markdown: text, contentStart: 0 }

  const closing = /^---[\t ]*\r?$/gm
  closing.lastIndex = openingEnd + 1
  const match = closing.exec(text)
  if (!match) return { markdown: text, contentStart: 0 }
  const contentStart = match.index + match[0].length
  const masked = text.slice(0, contentStart).replace(/[^\r\n]/g, " ") + text.slice(contentStart)
  return { markdown: masked, contentStart }
}

// VSCode's markdown folding lets a list collapse to its first line and folds
// long (multi-block) list items. Offsets are the identity: stable across
// renders, unique per occurrence (unlike text), and absolute in the source —
// section slices re-base them by adding the slice's start offset.
function computeListFolds(root: Root): ListFolds {
  const lists = new Map<number, number>()
  const firstItemToList = new Map<number, number>()
  const items = new Set<number>()
  const visit = (node: BlockNode) => {
    if (node.type === "list") {
      const kids = node.children ?? []
      const start = node.position?.start.offset
      if (kids.length >= 2 && start != null) {
        lists.set(start, kids.length)
        const firstStart = kids[0]?.position?.start.offset
        if (firstStart != null) firstItemToList.set(firstStart, start)
      }
    } else if (node.type === "listItem") {
      const blocks = (node.children ?? []).length
      const start = node.position?.start.offset
      if (blocks >= 2 && start != null) items.add(start)
    }
    for (const c of node.children ?? []) visit(c)
  }
  visit(root as unknown as BlockNode)
  return { lists, firstItemToList, items, all: [...lists.keys(), ...items] }
}

// GitHub-ish slug: lowercase, drop punctuation, whitespace/underscores -> "-".
export function slugify(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/[\s_]+/g, "-")
  return s || "section"
}

const EXPLICIT_SECTION_NUMBER = /^[\p{L}\p{N}]+\.\s+\S/u

export function sectionDisplayTitle(title: string, siblingIndex: number): string {
  return EXPLICIT_SECTION_NUMBER.test(title) ? title : `${siblingIndex + 1}. ${title}`
}

function headingText(h: Heading): string {
  const walk = (nodes: PhrasingContent[]): string =>
    nodes
      .map((n) => ("value" in n ? String(n.value) : "children" in n ? walk(n.children as PhrasingContent[]) : ""))
      .join("")
  return walk(h.children).trim()
}

function parseMarkdown(text: string): { root: Root; contentStart: number } {
  const { markdown, contentStart } = maskYamlFrontmatter(text)
  return { root: unified().use(remarkParse).parse(markdown) as Root, contentStart }
}

function sectionsOf(root: Root, text: string, contentStart: number): MdDoc {
  const tree: MdSection[] = []
  const stack: MdSection[] = [] // open sections, shallow -> deep
  const byId = new Map<string, MdSection>()
  const seen = new Map<string, number>()
  let first = -1

  for (const child of root.children) {
    if (child.type !== "heading") continue
    const start = child.position?.start.offset
    const ownStart = child.position?.end.offset
    if (start == null || ownStart == null) continue
    if (first < 0) first = start
    const title = headingText(child)
    const base = slugify(title)
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    const sec: MdSection = {
      id: n ? `${base}-${n}` : base,
      depth: child.depth,
      title,
      start,
      ownStart,
      ownEnd: 0, // finalized below
      end: text.length,
      children: [],
    }
    // Close every open section at this depth or deeper: its span ends here.
    while (stack.length && stack[stack.length - 1]!.depth >= sec.depth) {
      stack.pop()!.end = start
    }
    const parent = stack[stack.length - 1]
    if (parent) parent.children.push(sec)
    else tree.push(sec)
    stack.push(sec)
    byId.set(sec.id, sec)
  }

  // A section's own body ends where its first subsection's heading begins.
  const finalize = (secs: MdSection[]) => {
    for (const s of secs) {
      s.ownEnd = s.children.length ? s.children[0]!.start : s.end
      finalize(s.children)
    }
  }
  finalize(tree)

  const pre = first > contentStart ? text.slice(contentStart, first) : first < 0 ? text.slice(contentStart) : ""
  return { tree, preamble: pre.trim() ? pre : "", byId, folds: computeListFolds(root) }
}

export function parseMdSections(text: string): MdDoc {
  const { root, contentStart } = parseMarkdown(text)
  return sectionsOf(root, text, contentStart)
}

// A section's own body (its subsections render separately, nested below it).
export function sliceOwn(text: string, sec: MdSection): string {
  return text.slice(sec.ownStart, sec.ownEnd)
}

export function allSectionIds(doc: MdDoc): Set<string> {
  return new Set(doc.byId.keys())
}

// The id chain from a top-level section down to `id` (inclusive) — what must
// be expanded for that section (or a #anchor naming it) to become visible.
export function expandChain(doc: MdDoc, id: string): string[] {
  const chain: string[] = []
  const walk = (secs: MdSection[], trail: string[]): boolean => {
    for (const s of secs) {
      if (s.id === id) {
        chain.push(...trail, s.id)
        return true
      }
      if (walk(s.children, [...trail, s.id])) return true
    }
    return false
  }
  walk(doc.tree, [])
  return chain
}

// The one path rule in the repository: drop empty and "." segments, fold "..".
// `resolveMdLink` resolves through it, and a caller comparing a resolved link
// against a document's own path (grapht's markdown graph) must use the same
// rule rather than a private copy of it.
export function normalizeMdPath(p: string): string {
  const abs = p.startsWith("/")
  const parts: string[] = []
  for (const seg of p.split("/")) {
    if (!seg || seg === ".") continue
    if (seg === "..") parts.pop()
    else parts.push(seg)
  }
  return (abs ? "/" : "") + parts.join("/")
}

export const MD_LINK_RE = /\.(md|markdown|mdx)$/i

// Classify a link href clicked inside the viewer. Returns a resolved markdown
// target to open in the viewer, or null when the caller should fall back to
// other handling (external http, in-page #anchor, non-md file).
export function resolveMdLink(currentPath: string, href: string): { path: string; frag?: string } | null {
  const m = href.match(/^([^#]*?)(?:#(.*))?$/)
  const raw = m?.[1] ?? ""
  const frag = m?.[2] || undefined
  if (!raw || !MD_LINK_RE.test(raw)) return null
  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(raw)) return null // remote .md: external
  let path = raw
  if (!raw.startsWith("/") && !raw.startsWith("~")) {
    const dir = currentPath.replace(/\/[^/]*$/, "")
    path = `${dir}/${raw}`
  }
  return { path: normalizeMdPath(path), frag }
}

// Structural view of an mdast tree: enough for the walks here without the full
// node union. Same shape of cast computeListFolds has always used.
type BlockNode = {
  type: string
  lang?: string | null
  position?: {
    start: { offset?: number; line?: number }
    end: { offset?: number; line?: number }
  }
  children?: readonly BlockNode[]
}

const BLOCK_KINDS: Record<string, MdBlockKind> = {
  heading: "heading",
  paragraph: "paragraph",
  blockquote: "blockquote",
  list: "list",
  listItem: "listItem",
  table: "table",
  code: "code",
  html: "html",
}

// Only these node types carry nested blocks worth addressing.
const BLOCK_CONTAINERS: Record<string, true> = {
  blockquote: true,
  list: true,
  listItem: true,
  table: true,
}

const FENCE_OPEN = /^[ \t]*(`{3,}|~{3,})[^\n]*\n/

// The body of a fenced code block: everything after the opening marker line and
// before the closing marker line. An unclosed fence runs to the block end.
function fenceBody(span: SourceSpan, text: string): { codeStart: number; codeEnd: number } | undefined {
  const raw = text.slice(span.start, span.end)
  const open = FENCE_OPEN.exec(raw)
  if (!open) return undefined
  const marker = open[1] as string
  const codeStart = span.start + open[0].length
  const lines = raw.split("\n")
  const last = lines[lines.length - 1] as string
  const closed = lines.length > 1 && new RegExp(`^[ \\t]*${marker[0]}{${marker.length},}[ \\t]*$`).test(last)
  return { codeStart, codeEnd: closed ? span.end - last.length - 1 : span.end }
}

function flattenSections(tree: readonly MdSection[], into: MdSection[] = []): MdSection[] {
  for (const section of tree) {
    into.push(section)
    flattenSections(section.children, into)
  }
  return into
}

// The deepest section containing the offset, or "preamble".
function sectionAt(sections: readonly MdSection[], offset: number): string {
  let best: MdSection | undefined
  for (const section of sections) {
    if (offset < section.start || offset >= section.end) continue
    if (!best || section.depth > best.depth) best = section
  }
  return best?.id ?? "preamble"
}

function blocksOf(root: Root, text: string, sections: readonly MdSection[]): MdBlock[] {
  const blocks: MdBlock[] = []
  const counters = new Map<string, number>()
  const visit = (node: BlockNode, parentId: string | undefined) => {
    let enclosing = parentId
    const kind = BLOCK_KINDS[node.type]
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (kind && start != null && end != null && end > start) {
      const span: SourceSpan = {
        start,
        end,
        lineStart: node.position?.start.line ?? 0,
        lineEnd: node.position?.end.line ?? 0,
      }
      const section = sectionAt(sections, start)
      const ordinal = counters.get(section) ?? 0
      counters.set(section, ordinal + 1)
      const block: MdBlock = { id: `${section}/${ordinal}`, kind, section, ordinal, span }
      if (parentId) block.parent = parentId
      if (kind === "code") {
        const body = fenceBody(span, text)
        if (body) {
          if (typeof node.lang === "string") block.language = node.lang
          block.codeStart = body.codeStart
          block.codeEnd = body.codeEnd
        }
      }
      blocks.push(block)
      enclosing = block.id
    }
    if (BLOCK_CONTAINERS[node.type]) for (const child of node.children ?? []) visit(child, enclosing)
  }
  for (const child of root.children) visit(child as unknown as BlockNode, undefined)
  return blocks
}

// A document's sections and blocks, sharing one parse.
export function mdDocument(path: string, text: string): MdDocument {
  const { root, contentStart } = parseMarkdown(text)
  const doc = sectionsOf(root, text, contentStart)
  return { path, text, contentStart, doc, blocks: blocksOf(root, text, flattenSections(doc.tree)) }
}

// The innermost block containing the offset — a paragraph inside a list item
// inside a list resolves to the paragraph.
export function blockAt(document: MdDocument, offset: number): MdBlock | undefined {
  let best: MdBlock | undefined
  for (const block of document.blocks) {
    if (offset < block.span.start || offset >= block.span.end) continue
    if (!best || block.span.end - block.span.start < best.span.end - best.span.start) best = block
  }
  return best
}
