// A markdown reader sized to exactly what this package's documentation writes, and nothing else.
//
// Two stages, both exported: `parseBlocks` turns a source string into a block list, `renderBlocks`
// turns a block list into DOM. The split is what lets the parity page read the same tables the
// prose page renders, and the search index read every page's text without building nodes.
//
// The closing rule: anything the grammar does not recognise becomes a `literal` block and reaches
// the page as text. A construct is never dropped in silence, so a doc rewrite that reaches for a
// syntax this reader lacks shows up on the page as itself rather than as a gap.

export type Align = "left" | "center" | "right"

export interface ListItem {
  readonly text: string
  /** Nested blocks under this item: a deeper list, or a continuation paragraph. */
  readonly children: readonly Block[]
}

export type Block =
  | { readonly kind: "heading"; readonly level: number; readonly text: string }
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "code"; readonly lang: string; readonly text: string }
  | { readonly kind: "mermaid"; readonly text: string }
  | {
      readonly kind: "table"
      readonly header: readonly string[]
      readonly align: readonly Align[]
      readonly rows: readonly (readonly string[])[]
    }
  | { readonly kind: "list"; readonly ordered: boolean; readonly items: readonly ListItem[] }
  | { readonly kind: "quote"; readonly blocks: readonly Block[] }
  | { readonly kind: "rule" }
  | { readonly kind: "literal"; readonly text: string }

export interface Heading {
  readonly level: number
  readonly text: string
  readonly id: string
}

export interface Rendered {
  readonly node: DocumentFragment
  readonly headings: readonly Heading[]
}

const FENCE = /^(\s*)(```+|~~~+)\s*([^\s`]*)\s*$/
const HEADING = /^(#{1,6})\s+(.*?)\s*$/
const RULE = /^(-{3,}|\*{3,}|_{3,})\s*$/
const UNORDERED = /^(\s*)[-*+]\s+(.*)$/
const ORDERED = /^(\s*)\d+[.)]\s+(.*)$/
const QUOTE = /^\s*>\s?(.*)$/
const TABLE_DELIM = /^\s*\|?(\s*:?-{1,}:?\s*\|)+\s*:?-{1,}:?\s*\|?\s*$/
const HTML_BLOCK = /^\s*<(?!br\b)[a-zA-Z!/]/

const line = (lines: readonly string[], index: number): string => lines[index] ?? ""

/** Splits a table row on the pipes that sit outside a code span. */
function cells(row: string): string[] {
  const out: string[] = []
  let current = ""
  let ticks = 0
  for (const char of row.trim()) {
    if (char === "`") ticks += 1
    if (char === "|" && ticks % 2 === 0) {
      out.push(current)
      current = ""
      continue
    }
    current += char
  }
  out.push(current)
  if (out.length > 0 && (out[0] ?? "").trim() === "") out.shift()
  if (out.length > 0 && (out[out.length - 1] ?? "").trim() === "") out.pop()
  return out.map((cell) => cell.trim())
}

function alignOf(spec: string): Align {
  const text = spec.trim()
  if (text.startsWith(":") && text.endsWith(":")) return "center"
  if (text.endsWith(":")) return "right"
  return "left"
}

const isBlockStart = (text: string): boolean =>
  text.trim() === "" ||
  HEADING.test(text) ||
  FENCE.test(text) ||
  RULE.test(text) ||
  UNORDERED.test(text) ||
  ORDERED.test(text) ||
  QUOTE.test(text) ||
  text.trim().startsWith("|") ||
  HTML_BLOCK.test(text)

const indentOf = (text: string): number => text.length - text.trimStart().length

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n")
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const raw = line(lines, index)

    if (raw.trim() === "") {
      index += 1
      continue
    }

    const fence = FENCE.exec(raw)
    if (fence) {
      const marker = fence[2] ?? "```"
      const lang = (fence[3] ?? "").toLowerCase()
      const body: string[] = []
      let cursor = index + 1
      let closed = false
      while (cursor < lines.length) {
        const next = line(lines, cursor)
        if (next.trimStart().startsWith(marker.slice(0, 3)) && next.trim().replace(/[`~]/g, "") === "") {
          closed = true
          break
        }
        body.push(next)
        cursor += 1
      }
      if (!closed) {
        // An unterminated fence is a broken document, not a code block. Show the raw text.
        blocks.push({ kind: "literal", text: lines.slice(index).join("\n") })
        break
      }
      const text = body.join("\n")
      blocks.push(lang === "mermaid" ? { kind: "mermaid", text } : { kind: "code", lang, text })
      index = cursor + 1
      continue
    }

    const heading = HEADING.exec(raw)
    if (heading) {
      blocks.push({ kind: "heading", level: (heading[1] ?? "#").length, text: heading[2] ?? "" })
      index += 1
      continue
    }

    if (RULE.test(raw)) {
      blocks.push({ kind: "rule" })
      index += 1
      continue
    }

    if (raw.trim().startsWith("|") && TABLE_DELIM.test(line(lines, index + 1))) {
      const header = cells(raw)
      const align = cells(line(lines, index + 1)).map(alignOf)
      const rows: string[][] = []
      let cursor = index + 2
      while (cursor < lines.length && line(lines, cursor).trim().startsWith("|")) {
        rows.push(cells(line(lines, cursor)))
        cursor += 1
      }
      blocks.push({ kind: "table", header, align, rows })
      index = cursor
      continue
    }

    if (QUOTE.test(raw)) {
      const body: string[] = []
      let cursor = index
      while (cursor < lines.length) {
        const quoted = QUOTE.exec(line(lines, cursor))
        if (!quoted) break
        body.push(quoted[1] ?? "")
        cursor += 1
      }
      blocks.push({ kind: "quote", blocks: parseBlocks(body.join("\n")) })
      index = cursor
      continue
    }

    if (UNORDERED.test(raw) || ORDERED.test(raw)) {
      const [list, next] = parseList(lines, index)
      blocks.push(list)
      index = next
      continue
    }

    if (HTML_BLOCK.test(raw)) {
      const body: string[] = []
      let cursor = index
      while (cursor < lines.length && line(lines, cursor).trim() !== "") {
        body.push(line(lines, cursor))
        cursor += 1
      }
      blocks.push({ kind: "literal", text: body.join("\n") })
      index = cursor
      continue
    }

    const paragraph: string[] = [raw]
    let cursor = index + 1
    while (cursor < lines.length && !isBlockStart(line(lines, cursor))) {
      paragraph.push(line(lines, cursor))
      cursor += 1
    }
    blocks.push({ kind: "paragraph", text: paragraph.join("\n") })
    index = cursor
  }

  return blocks
}

/** Reads one list run and returns it with the index of the first line after it. */
function parseList(lines: readonly string[], start: number): [Block, number] {
  const first = line(lines, start)
  const ordered = ORDERED.test(first)
  const baseIndent = indentOf(first)
  const items: ListItem[] = []
  let index = start
  let text = ""
  let nested: string[] = []
  let open = false

  const close = (): void => {
    if (!open) return
    items.push({ text, children: nested.length === 0 ? [] : parseBlocks(dedent(nested)) })
    text = ""
    nested = []
    open = false
  }

  while (index < lines.length) {
    const raw = line(lines, index)
    if (raw.trim() === "") {
      // A blank line ends the list unless an indented continuation follows it.
      const ahead = line(lines, index + 1)
      if (ahead.trim() === "" || indentOf(ahead) <= baseIndent) break
      nested.push("")
      index += 1
      continue
    }
    const marker = ORDERED.exec(raw) ?? UNORDERED.exec(raw)
    const indent = indentOf(raw)
    if (marker && indent === baseIndent) {
      close()
      text = marker[2] ?? ""
      open = true
      index += 1
      continue
    }
    if (indent > baseIndent && open) {
      nested.push(raw)
      index += 1
      continue
    }
    break
  }
  close()
  return [{ kind: "list", ordered, items }, index]
}

function dedent(lines: readonly string[]): string {
  const widths = lines.filter((text) => text.trim() !== "").map(indentOf)
  const least = widths.length === 0 ? 0 : Math.min(...widths)
  return lines.map((text) => text.slice(least)).join("\n")
}

// --- Inline -----------------------------------------------------------------

// Built fresh per call. `inline` recurses into the content of a link or a strong run, and a shared
// `lastIndex` on one global regex would have the inner walk move the outer walk's cursor.
const INLINE =
  "(`+)([^]*?)\\1|(\\*\\*)([^]+?)\\*\\*|(\\[)([^\\]]*)\\]\\(([^)\\s]+)(?:\\s+\"[^\"]*\")?\\)|(<br\\s*/?>)|(\\*)([^\\s*][^*]*?)\\*"

/** Everything a slot may put inside a line: code, strong, emphasis, links, and a hard break. */
export function inline(text: string): Node[] {
  const out: Node[] = []
  const scan = new RegExp(INLINE, "g")
  let last = 0
  for (let match = scan.exec(text); match !== null; match = scan.exec(text)) {
    if (match.index > last) out.push(document.createTextNode(text.slice(last, match.index)))
    last = match.index + match[0].length
    if (match[1] !== undefined) {
      const code = document.createElement("code")
      code.textContent = (match[2] ?? "").trim()
      out.push(code)
    } else if (match[3] !== undefined) {
      const strong = document.createElement("strong")
      for (const node of inline(match[4] ?? "")) strong.append(node)
      out.push(strong)
    } else if (match[5] !== undefined) {
      const anchor = document.createElement("a")
      anchor.href = match[7] ?? ""
      if (/^https?:/.test(anchor.getAttribute("href") ?? "")) {
        anchor.target = "_blank"
        anchor.rel = "noreferrer noopener"
      }
      for (const node of inline(match[6] ?? "")) anchor.append(node)
      out.push(anchor)
    } else if (match[8] !== undefined) {
      out.push(document.createElement("br"))
    } else {
      const em = document.createElement("em")
      for (const node of inline(match[10] ?? "")) em.append(node)
      out.push(em)
    }
  }
  if (last < text.length) out.push(document.createTextNode(text.slice(last)))
  return out
}

/** The same walk with the markup stripped: what search matches on and what a slug is built from. */
export function plain(text: string): string {
  return inline(text)
    .map((node) => (node.nodeName === "BR" ? " " : (node.textContent ?? "")))
    .join("")
}

export function slugify(text: string): string {
  const slug = plain(text)
    .toLowerCase()
    .replace(/[^\da-z]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug === "" ? "section" : slug
}

// --- Render -----------------------------------------------------------------

function copyButton(source: string): HTMLButtonElement {
  const button = document.createElement("button")
  button.type = "button"
  button.className = "md-copy"
  button.textContent = "Copy"
  button.addEventListener("click", () => {
    const done = (label: string): void => {
      button.textContent = label
      setTimeout(() => (button.textContent = "Copy"), 1200)
    }
    const clipboard = navigator.clipboard
    if (clipboard === undefined) {
      done("No clipboard")
      return
    }
    clipboard.writeText(source).then(() => done("Copied"), () => done("Copy failed"))
  })
  return button
}

function renderTable(block: Extract<Block, { kind: "table" }>): HTMLElement {
  const wrap = document.createElement("div")
  wrap.className = "md-table-wrap"
  const table = document.createElement("table")
  const head = document.createElement("thead")
  const headRow = document.createElement("tr")
  block.header.forEach((cell, column) => {
    const th = document.createElement("th")
    th.style.textAlign = block.align[column] ?? "left"
    for (const node of inline(cell)) th.append(node)
    headRow.append(th)
  })
  head.append(headRow)
  const body = document.createElement("tbody")
  for (const row of block.rows) {
    const tr = document.createElement("tr")
    // A short row is padded rather than dropped, so a ragged generated table still lines up.
    for (let column = 0; column < block.header.length; column += 1) {
      const td = document.createElement("td")
      td.style.textAlign = block.align[column] ?? "left"
      for (const node of inline(row[column] ?? "")) td.append(node)
      tr.append(td)
    }
    body.append(tr)
  }
  table.append(head, body)
  wrap.append(table)
  return wrap
}

function renderList(block: Extract<Block, { kind: "list" }>): HTMLElement {
  const list = document.createElement(block.ordered ? "ol" : "ul")
  for (const item of block.items) {
    const li = document.createElement("li")
    for (const node of inline(item.text)) li.append(node)
    if (item.children.length > 0) li.append(renderBlocks(item.children).node)
    list.append(li)
  }
  return list
}

/** Builds the DOM for a block list and reports the headings it passed, in document order. */
export function renderBlocks(blocks: readonly Block[], seen = new Map<string, number>()): Rendered {
  const node = document.createDocumentFragment()
  const headings: Heading[] = []

  for (const block of blocks) {
    if (block.kind === "heading") {
      const element = document.createElement(`h${Math.min(6, Math.max(1, block.level))}`)
      const base = slugify(block.text)
      const count = seen.get(base) ?? 0
      seen.set(base, count + 1)
      const id = count === 0 ? base : `${base}-${count}`
      element.id = id
      const anchor = document.createElement("a")
      anchor.className = "md-anchor"
      anchor.href = `#${id}`
      anchor.textContent = "#"
      anchor.setAttribute("aria-label", `Link to ${plain(block.text)}`)
      for (const child of inline(block.text)) element.append(child)
      element.append(anchor)
      headings.push({ level: block.level, text: plain(block.text), id })
      node.append(element)
      continue
    }
    if (block.kind === "paragraph") {
      const p = document.createElement("p")
      for (const child of inline(block.text)) p.append(child)
      node.append(p)
      continue
    }
    if (block.kind === "code") {
      const figure = document.createElement("figure")
      figure.className = "md-code"
      const caption = document.createElement("figcaption")
      const lang = document.createElement("span")
      lang.className = "md-lang"
      lang.textContent = block.lang === "" ? "text" : block.lang
      caption.append(lang, copyButton(block.text))
      const pre = document.createElement("pre")
      const code = document.createElement("code")
      code.className = block.lang === "" ? "" : `language-${block.lang}`
      code.textContent = block.text
      pre.append(code)
      figure.append(caption, pre)
      node.append(figure)
      continue
    }
    if (block.kind === "mermaid") {
      // Passed through with the source untouched, for whoever mounts a mermaid runtime over it.
      const pre = document.createElement("pre")
      pre.className = "mermaid"
      pre.dataset.mermaidSource = ""
      pre.textContent = block.text
      node.append(pre)
      continue
    }
    if (block.kind === "table") {
      node.append(renderTable(block))
      continue
    }
    if (block.kind === "list") {
      node.append(renderList(block))
      continue
    }
    if (block.kind === "quote") {
      const quote = document.createElement("blockquote")
      const inner = renderBlocks(block.blocks, seen)
      quote.append(inner.node)
      for (const heading of inner.headings) headings.push(heading)
      node.append(quote)
      continue
    }
    if (block.kind === "rule") {
      node.append(document.createElement("hr"))
      continue
    }
    const literal = document.createElement("pre")
    literal.className = "md-literal"
    literal.textContent = block.text
    node.append(literal)
  }

  return { node, headings }
}

export function renderMarkdown(source: string): Rendered {
  return renderBlocks(parseBlocks(source))
}

/** The searchable text of one block. Code and mermaid included: an api name is worth finding. */
export function blockText(block: Block): string {
  if (block.kind === "heading" || block.kind === "paragraph") return plain(block.text)
  if (block.kind === "code" || block.kind === "mermaid" || block.kind === "literal") return block.text
  if (block.kind === "table") {
    return [block.header, ...block.rows].map((row) => row.map(plain).join(" ")).join("\n")
  }
  if (block.kind === "list") {
    return block.items
      .map((item) => [plain(item.text), ...item.children.map(blockText)].join(" "))
      .join("\n")
  }
  if (block.kind === "quote") return block.blocks.map(blockText).join("\n")
  return ""
}
