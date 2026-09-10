// Client-side search over every page's text.
//
// The index is the block list each page already parses for rendering, so a match carries the
// heading it sits under and the anchor that scrolls to it. Heading ids are minted with the same
// counter `renderBlocks` uses, which is what keeps a hit's link pointing at the right section when
// a document repeats a heading title.
import { PAGES } from "./content.js"
import { blockText, parseBlocks, plain, slugify } from "./md.js"

interface Entry {
  readonly slug: string
  readonly title: string
  /** Heading titles from h1 down to the section this text sits in. */
  readonly path: readonly string[]
  readonly anchor: string
  readonly text: string
  readonly lower: string
  readonly heading: boolean
}

export interface Hit {
  readonly slug: string
  readonly title: string
  readonly path: readonly string[]
  readonly anchor: string
  readonly before: string
  readonly match: string
  readonly after: string
}

function indexOfPages(): Entry[] {
  const entries: Entry[] = []
  for (const page of PAGES) {
    const seen = new Map<string, number>()
    const stack: { level: number; text: string; id: string }[] = []
    for (const block of parseBlocks(page.source)) {
      if (block.kind === "heading") {
        const base = slugify(block.text)
        const count = seen.get(base) ?? 0
        seen.set(base, count + 1)
        const id = count === 0 ? base : `${base}-${count}`
        while (stack.length > 0 && (stack[stack.length - 1]?.level ?? 0) >= block.level) stack.pop()
        stack.push({ level: block.level, text: plain(block.text), id })
        const path = stack.map((item) => item.text)
        entries.push({
          slug: page.slug,
          title: page.title,
          path,
          anchor: id,
          text: plain(block.text),
          lower: plain(block.text).toLowerCase(),
          heading: true,
        })
        continue
      }
      const text = blockText(block)
      if (text.trim() === "") continue
      entries.push({
        slug: page.slug,
        title: page.title,
        path: stack.map((item) => item.text),
        anchor: stack[stack.length - 1]?.id ?? "",
        text,
        lower: text.toLowerCase(),
        heading: false,
      })
    }
  }
  return entries
}

const INDEX = indexOfPages()

export const indexSize = INDEX.length

const CONTEXT = 70

export function search(query: string, limit = 40): Hit[] {
  const needle = query.trim().toLowerCase()
  if (needle.length < 2) return []
  const scored: { hit: Hit; score: number }[] = []
  for (const entry of INDEX) {
    const at = entry.lower.indexOf(needle)
    if (at === -1) continue
    const start = Math.max(0, at - CONTEXT)
    const end = Math.min(entry.text.length, at + needle.length + CONTEXT)
    scored.push({
      score: (entry.heading ? 0 : 100) + at,
      hit: {
        slug: entry.slug,
        title: entry.title,
        path: entry.path,
        anchor: entry.anchor,
        before: (start > 0 ? "…" : "") + entry.text.slice(start, at).replace(/\s+/g, " "),
        match: entry.text.slice(at, at + needle.length),
        after:
          entry.text.slice(at + needle.length, end).replace(/\s+/g, " ") +
          (end < entry.text.length ? "…" : ""),
      },
    })
  }
  scored.sort((a, b) => a.score - b.score)
  return scored.slice(0, limit).map((item) => item.hit)
}
