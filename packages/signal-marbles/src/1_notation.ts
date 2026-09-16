// The notation an author (or a model) writes, and the inverse that prints it back.
//
// It is RxJS's own conventional marble syntax with two deliberate changes: `(ab)` covers one column
// rather than one column per element inside it, because in a drawing the parens are a shape and not
// a clock, and indentation carries the derivation instead of a separate declaration.
//
// A column is one element of the notation and one turn of the clock, and the document keeps the
// virtual milliseconds each column sits at. So an `Nms` token is a jump made on the column it is
// written on, and it is the document's clock that it jumps: the lanes share one, and all move with it.
import {
  laneDepth,
  MARBLES_VERSION,
  type MarbleDoc,
  type MarbleLane,
  type MarbleNotification,
  marbleEventId,
  normalizeMarbleDoc,
} from "./0_types.js"

export type MarbleParseDiagnostic = { line: number; message: string }
export type MarbleParse = { doc: MarbleDoc; diagnostics: MarbleParseDiagnostic[] }

/** One lane's scan: the notifications it produced, and the milliseconds each of its columns costs. */
export type MarbleScan = { notifications: MarbleNotification[]; advances: number[] }

/** Everything the scanner reads as structure, so nothing in here can be a value symbol. */
const RESERVED = new Set(["-", "(", ")", "|", "#", "^", "!", ":", "@"])

/** The pool symbols are drawn from when a value cannot print as itself. Digits are left out: a
 * digit at a token boundary starts a time jump, so a digit symbol would need quoting to be read. */
const SYMBOL_POOL = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

const TIME_TOKEN = /^(\d+(?:\.\d+)?)(ms|s|m)(?![a-z0-9])/i
const MS_PER_UNIT: Record<string, number> = { ms: 1, s: 1000, m: 60000 }

/** Two spaces per level, so the printed form indents the way it nests. */
const INDENT = "  "

/**
 * The machine name for a label: a lane id is `[A-Za-z][A-Za-z0-9_-]*` and never carries `#`, so an
 * event id stays splittable, and two lanes labelled the same way get ids of their own.
 */
function laneId(label: string, taken: ReadonlySet<string>): string {
  const cleaned = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const base = cleaned === "" ? "lane" : /^[a-z]/.test(cleaned) ? cleaned : `lane-${cleaned}`
  if (!taken.has(base)) return base
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

/**
 * Scan one lane's marble string into the notifications it produced, and the milliseconds each of its
 * columns costs. Every element consumed is one column, and a notification sits on the column it was
 * written on — except inside a group, which holds everything on the column it opens.
 */
export function scanMarbles(
  laneId: string,
  text: string,
  legend: Readonly<Record<string, string>>,
  line: number,
  diagnostics: MarbleParseDiagnostic[],
): MarbleScan {
  const notifications: MarbleNotification[] = []
  const advances: number[] = []
  let column = 0
  let group: number | null = null
  const at = (kind: MarbleNotification["kind"], value?: string) => {
    const id = marbleEventId(laneId, notifications.length)
    const tick = group ?? column
    notifications.push(value === undefined ? { id, kind, tick } : { id, kind, tick, value })
  }
  const advance = (by: number) => {
    // A group holds notifications, not time: nothing written inside it moves the clock.
    advances[column] = group === null ? by : 0
  }
  let index = 0
  while (index < text.length) {
    const character = text[index] as string
    if (character === " " || character === "\t") {
      index += 1
      continue
    }
    if (character === "-") {
      if (group !== null) diagnostics.push({ line, message: "a group holds notifications, not time: `-` inside `( )`" })
      advance(1)
      column += 1
      index += 1
      continue
    }
    // A digit only starts a time jump when it does not continue a word, so `a5ms` stays three
    // value symbols and `a 5ms` is a jump — RxJS's rule, relaxed to also accept `-5ms`.
    if (
      character >= "0" &&
      character <= "9" &&
      (index === 0 || text[index - 1] === " " || text[index - 1] === "\t" || text[index - 1] === "-")
    ) {
      const match = TIME_TOKEN.exec(text.slice(index))
      if (match) {
        if (group !== null)
          diagnostics.push({ line, message: `a time jump cannot sit inside a group: \`${match[0]}\`` })
        advance(Math.round(Number(match[1]) * (MS_PER_UNIT[match[2].toLowerCase()] ?? 1)))
        column += 1
        index += match[0].length
        continue
      }
    }
    switch (character) {
      case "(":
        if (group !== null) diagnostics.push({ line, message: "a group was opened inside another group" })
        // A nested `(` is a diagnostic; the group already open keeps the column it opened on.
        group ??= column
        advance(0)
        break
      case ")":
        if (group === null) diagnostics.push({ line, message: "`)` closed a group that was never opened" })
        group = null
        advance(1)
        break
      case "|":
        at("complete")
        advance(1)
        break
      case "#":
        at("error")
        advance(1)
        break
      case "^":
        at("subscribe")
        advance(1)
        break
      case "!":
        // The unsubscribe marker closes a lane without spending a millisecond, matching RxJS.
        at("unsubscribe")
        advance(0)
        break
      default:
        // An undeclared symbol is its own value, which is RxJS's rule too: a diagram reads
        // without a legend, and @legend exists to spell a value out or to make one longer.
        at("next", legend[character] ?? character)
        advance(1)
        break
    }
    index += 1
    column += 1
  }
  if (group !== null) diagnostics.push({ line, message: "`(` was never closed" })
  return { notifications, advances }
}

function parseLegend(
  rest: string,
  line: number,
  legend: Record<string, string>,
  diagnostics: MarbleParseDiagnostic[],
): void {
  for (const entry of rest.split(/[\s,]+/).filter(Boolean)) {
    const split = entry.indexOf("=")
    if (split < 1) {
      diagnostics.push({ line, message: `@legend takes sym=value pairs; \`${entry}\` has no value` })
      continue
    }
    const symbol = entry.slice(0, split)
    if (symbol.length !== 1 || RESERVED.has(symbol)) {
      diagnostics.push({ line, message: `@legend symbol \`${symbol}\` must be one unreserved character` })
      continue
    }
    legend[symbol] = entry.slice(split + 1)
  }
}

/**
 * Read the notation.
 *
 * ```
 * @title switchMap drops the inner request when a new one arrives
 * @legend a=alpha b=beta
 *
 * outer : -a---b------|
 *   inner : ---x---y----|
 * ```
 *
 * One lane per line, `label : marbles`. Leading spaces make a lane a child of the nearest earlier
 * lane with less indentation. Lines starting with `#` are comments.
 *
 * Every element of a lane is one column, and the document records the virtual milliseconds each
 * column sits at: a dash costs one, an `Nms` token costs what it says, and a group costs one for
 * all of it. The clock belongs to the document, so a jump written on one lane moves every lane.
 */
export function parseMarbles(source: string): MarbleParse {
  const diagnostics: MarbleParseDiagnostic[] = []
  const legend: Record<string, string> = {}
  const lanes: MarbleLane[] = []
  const taken = new Set<string>()
  // One advance per column: the largest jump any lane wrote to leave it.
  const advances: number[] = []
  // (indent, id) of every lane so far, so a child can find the nearest shallower one.
  const spine: Array<{ indent: number; id: string }> = []
  let title: string | undefined

  source.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1
    const trimmed = raw.trim()
    if (trimmed === "" || trimmed.startsWith("#")) return
    if (trimmed.startsWith("@")) {
      const space = trimmed.search(/\s/)
      const name = (space === -1 ? trimmed.slice(1) : trimmed.slice(1, space)).toLowerCase()
      const rest = space === -1 ? "" : trimmed.slice(space + 1).trim()
      if (name === "title") title = rest
      else if (name === "legend") parseLegend(rest, line, legend, diagnostics)
      else diagnostics.push({ line, message: `unknown directive @${name}; the notation has @title and @legend` })
      return
    }
    const colon = trimmed.indexOf(":")
    if (colon <= 0) {
      diagnostics.push({ line, message: "a lane line is `label : marbles`" })
      return
    }
    const label = trimmed.slice(0, colon).trim()
    const indent = raw.length - raw.trimStart().length
    const id = laneId(label, taken)
    taken.add(id)
    while (true) {
      const top = spine[spine.length - 1]
      if (top === undefined || top.indent < indent) break
      spine.pop()
    }
    const parent = spine[spine.length - 1]?.id ?? null
    spine.push({ indent, id })
    const scan = scanMarbles(id, trimmed.slice(colon + 1), legend, line, diagnostics)
    scan.advances.forEach((advance, column) => {
      advances[column] = Math.max(advances[column] ?? 0, advance)
    })
    lanes.push({ id, label, parent, born: null, notifications: scan.notifications })
  })

  // The columns are the clock every lane shares: leaving a column costs the longest jump written on
  // it, and a lane is free to write nothing longer than a dash. A document holds at least one.
  const columns: number[] = []
  let time = 0
  for (let column = 0; column < Math.max(1, advances.length); column += 1) {
    columns.push(time)
    time += advances[column] ?? 0
  }

  const doc: MarbleDoc = normalizeMarbleDoc({
    version: MARBLES_VERSION,
    ...(title === undefined ? {} : { title }),
    columns,
    lanes,
  })
  return { doc, diagnostics }
}

/** `parseMarbles` for a source that is supposed to be valid: throws the diagnostics instead. */
export function readMarbles(source: string): MarbleDoc {
  const { doc, diagnostics } = parseMarbles(source)
  if (diagnostics.length > 0) {
    throw new Error(`marbles: ${diagnostics.map(it => `line ${it.line}: ${it.message}`).join("; ")}`)
  }
  return doc
}

/** What it costs to leave a column in a document: the gap between it and the column after it. */
function columnAdvance(doc: MarbleDoc, column: number): number {
  const from = doc.columns[column] ?? doc.columns[doc.columns.length - 1] ?? 0
  return Math.max(0, (doc.columns[column + 1] ?? from) - from)
}

/** One column in the notation: a dash for a millisecond, a jump token for anything else. A jump is
 * spaced away from its neighbours, because a digit touching a value symbol is a value. */
function columnToken(advance: number): string {
  return advance === 1 ? "-" : ` ${advance}ms `
}

/** The one character the notation writes for a notification. */
function notationFor(notification: MarbleNotification, symbolFor: (value: string) => string): string {
  switch (notification.kind) {
    case "next":
      return symbolFor(notification.value ?? "")
    case "error":
      return "#"
    case "complete":
      return "|"
    case "subscribe":
      return "^"
    // `truncate` is a window closing rather than a cancellation, and a closing window is all the
    // notation can say about one; the runner is the producer that knows the difference.
    case "unsubscribe":
    case "truncate":
      return "!"
  }
}

function marbleBody(
  doc: MarbleDoc,
  notifications: readonly MarbleNotification[],
  symbolFor: (value: string) => string,
): string {
  let out = ""
  let column = 0
  let index = 0
  while (index < notifications.length) {
    const notification = notifications[index] as MarbleNotification
    // Every column before this one is spent on its own: one dash, or one jump when it costs more.
    while (column < notification.tick) {
      out += columnToken(columnAdvance(doc, column))
      column += 1
    }
    // Notifications on one column are one group; the group spends the column and nothing else.
    let end = index
    while (notifications[end + 1]?.tick === notification.tick) end += 1
    const run = notifications.slice(index, end + 1)
    const body = run.map(it => notationFor(it, symbolFor)).join("")
    out += run.length > 1 ? `(${body})` : body
    // A group holds its elements on the column it opens, so it is `(`, its elements, and `)` wide.
    column = notification.tick + (run.length > 1 ? run.length + 2 : 1)
    index = end + 1
  }
  return out
}

/** The notation for a document: the inverse of `parseMarbles` for anything the notation can hold. */
export function printMarbles(doc: MarbleDoc, lanes: readonly MarbleLane[] = doc.lanes): string {
  const legend: Record<string, string> = {}
  const used = new Set<string>()
  const symbolFor = (value: string): string => {
    const literal = value.length === 1 && !RESERVED.has(value) && !(value >= "0" && value <= "9")
    if (literal) {
      used.add(value)
      return value
    }
    const existing = Object.keys(legend).find(symbol => legend[symbol] === value)
    if (existing !== undefined) return existing
    const symbol = [...SYMBOL_POOL].find(candidate => !used.has(candidate) && !RESERVED.has(candidate))
    if (symbol === undefined) throw new Error("marbles: ran out of legend symbols; use shorter values")
    used.add(symbol)
    legend[symbol] = value
    return symbol
  }

  const bodies = lanes.map(lane => marbleBody(doc, lane.notifications, symbolFor))
  const entries = Object.entries(legend)
  const head: string[] = []
  if (doc.title !== undefined) head.push(`@title ${doc.title}`)
  if (entries.length > 0) head.push(`@legend ${entries.map(([symbol, value]) => `${symbol}=${value}`).join(" ")}`)
  const width = lanes.reduce((max, lane) => Math.max(max, lane.label.length), 0)
  const body = lanes.map(
    (lane, index) => `${INDENT.repeat(laneDepth(lane, lanes))}${lane.label.padEnd(width)} : ${bodies[index]}`,
  )
  return [...(head.length > 0 ? [...head, ""] : []), ...body].join("\n")
}
