import uFuzzy from "@leeoniya/ufuzzy"
import { readHandles, writeHandles } from "./4_handleStore.js"
import { footerLine } from "./5_render.js"

export type Block = { text: string; attrs: Record<string, string>; links: string[] }

/** Post and comment containers; own-text blocks keep one comment per row instead of whole threads. */
export const FIND_CONTAINERS = "article, [role=article], shreddit-post, shreddit-comment, .thing.link, .thing.comment"
/** Used when a page has no containers, or they hold no text of their own. */
export const FIND_PARAGRAPHS = "p, li, pre, blockquote, h1, h2, h3, h4, td, dd"

const LABEL_PREFERENCE = ["author", "score", "title", "name"]
const SNIPPET_CHARS = 90
const SNIPPET_LEAD = 25
const HANDLE_PREFIX = "F"

function label(attrs: Record<string, string>): string {
  return LABEL_PREFERENCE.filter(name => attrs[name] !== undefined)
    .slice(0, 2)
    .map(name => attrs[name])
    .join(" ")
}

function snippet(text: string, needle: string): string {
  const lower = text.toLowerCase()
  const at = needle
    .toLowerCase()
    .split(/\s+/)
    .map(term => lower.indexOf(term))
    .filter(index => index >= 0)
    .sort((a, b) => a - b)[0]
  const start = at === undefined ? 0 : Math.max(0, at - SNIPPET_LEAD)
  const cut = text.slice(start, start + SNIPPET_CHARS)
  return `${start > 0 ? "…" : ""}${cut}${start + SNIPPET_CHARS < text.length ? "…" : ""}`
}

/** Fuzzy-ranked hits; each full block is stored under its own handle so `bew x F3` reads just that one. */
export function renderFind(input: { tabId: number; needle: string; blocks: Block[]; source: string; limit: number; showNext: boolean }) {
  const haystack = input.blocks.map(block => block.text)
  const [indexes, info, order] = new uFuzzy({ intraMode: 1 }).search(haystack, input.needle, 1)
  const ranked = order && info ? order.map(position => info.idx[position]!) : (indexes ?? [])
  const hits = ranked.slice(0, input.limit)

  const table = readHandles()
  for (const key of Object.keys(table.regions)) if (key.startsWith(HANDLE_PREFIX)) delete table.regions[key]
  const rows = hits.map((index, rank) => {
    const block = input.blocks[index]!
    const handle = `${HANDLE_PREFIX}${rank + 1}`
    const links = block.links.length ? `\n${block.links.join("\n")}` : ""
    table.regions[handle] = { kind: "text", tabId: input.tabId, text: `${block.text}${links}` }
    const who = label(block.attrs)
    return `${handle.padEnd(4)}${who ? `${who}  ` : ""}${snippet(block.text, input.needle)}  (${block.text.length})`
  })
  writeHandles(table)

  const lines = [`${ranked.length} of ${haystack.length} blocks match "${input.needle}" in ${input.source}`, ...rows]
  if (input.showNext && hits.length)
    lines.push(
      "",
      "next",
      footerLine(`bew x ${HANDLE_PREFIX}1`, "read hit 1 in full"),
      footerLine(`bew find . "<text>" --in <css>`, "search other blocks"),
    )
  return `${lines.join("\n")}\n`
}
