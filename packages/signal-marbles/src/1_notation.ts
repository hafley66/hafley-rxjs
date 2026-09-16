// The notation an author (or a model) writes, and the inverse that prints it back.
//
// It is RxJS's own conventional marble syntax with two deliberate changes: `(ab)` covers one frame
// rather than one frame per character inside it, because in a drawing the parens are a shape and
// not a clock, and indentation carries the derivation instead of a separate declaration.
import {
  laneDepth,
  MARBLES_VERSION,
  type MarbleDoc,
  type MarbleLane,
  type MarbleNotification,
  normalizeMarbleDoc,
} from "./0_types.js"

export type MarbleDiagnostic = { line: number; message: string }
export type MarbleParse = { doc: MarbleDoc; diagnostics: MarbleDiagnostic[] }

/** Everything the scanner reads as structure, so nothing in here can be a value symbol. */
const RESERVED = new Set(["-", "(", ")", "|", "#", "^", "!", ":", "@"])

/** The pool symbols are drawn from when a value cannot print as itself. Digits are left out: a
 * digit at a token boundary starts a time jump, so a digit symbol would need quoting to be read. */
const SYMBOL_POOL = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

const TIME_TOKEN = /^(\d+(?:\.\d+)?)(ms|s|m)(?![a-z0-9])/i
const MS_PER_UNIT: Record<string, number> = { ms: 1, s: 1000, m: 60000 }

/** Two spaces per level, so the printed form indents the way it nests. */
const INDENT = "  "

/** Gaps of up to this many frames print as `-`; longer jumps print as one `Nms` token. */
const MAX_DASHES = 4

function laneId(label: string, taken: ReadonlySet<string>): string {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "lane"
  if (!taken.has(base)) return base
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

/** Scan one lane's marble string into notifications. Shared by `parseMarbles` and the tests. */
export function scanMarbles(
  text: string,
  legend: Readonly<Record<string, string>>,
  line: number,
  diagnostics: MarbleDiagnostic[],
): MarbleNotification[] {
  const notifications: MarbleNotification[] = []
  let frame = 0
  let group: number | null = null
  const at = (kind: MarbleNotification["kind"], value?: string) => {
    notifications.push(value === undefined ? { kind, frame: group ?? frame } : { kind, frame: group ?? frame, value })
  }
  const advance = (by: number) => {
    if (group === null) frame += by
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
        index += match[0].length
        continue
      }
    }
    switch (character) {
      case "(":
        if (group !== null) diagnostics.push({ line, message: "a group was opened inside another group" })
        group = frame
        index += 1
        continue
      case ")":
        if (group === null) diagnostics.push({ line, message: "`)` closed a group that was never opened" })
        group = null
        advance(1)
        index += 1
        continue
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
        // The unsubscribe marker closes a lane without spending a frame, matching RxJS.
        at("unsubscribe")
        break
      default: {
        // An undeclared symbol is its own value, which is RxJS's rule too: a diagram reads
        // without a legend, and @legend exists to spell a value out or to make one longer.
        at("next", legend[character] ?? character)
        advance(1)
        break
      }
    }
    index += 1
  }
  if (group !== null) diagnostics.push({ line, message: "`(` was never closed" })
  return notifications
}

function parseLegend(
  rest: string,
  line: number,
  legend: Record<string, string>,
  diagnostics: MarbleDiagnostic[],
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
 */
export function parseMarbles(source: string): MarbleParse {
  const diagnostics: MarbleDiagnostic[] = []
  const legend: Record<string, string> = {}
  const lanes: MarbleLane[] = []
  const taken = new Set<string>()
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
    lanes.push({ id, label, parent, notifications: scanMarbles(trimmed.slice(colon + 1), legend, line, diagnostics) })
  })

  const doc: MarbleDoc = normalizeMarbleDoc({
    version: MARBLES_VERSION,
    ...(title === undefined ? {} : { title }),
    frames: 1,
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

function marbleBody(notifications: readonly MarbleNotification[], symbolFor: (value: string) => string): string {
  let out = ""
  let frame = 0
  let index = 0
  while (index < notifications.length) {
    const notification = notifications[index] as MarbleNotification
    const gap = notification.frame - frame
    // A jump is spaced away from its neighbours: a digit touching a value symbol is a value.
    if (gap > 0) out += gap <= MAX_DASHES ? "-".repeat(gap) : ` ${gap}ms `
    frame = notification.frame
    if (notification.kind === "next") {
      // Consecutive values on one frame are one group; the group spends the frame and nothing else.
      let end = index
      while (true) {
        const next = notifications[end + 1]
        if (next === undefined || next.kind !== "next" || next.frame !== frame) break
        end += 1
      }
      const run = notifications.slice(index, end + 1)
      const body = run.map(it => symbolFor(it.value ?? "")).join("")
      out += run.length > 1 ? `(${body})` : body
      index = end + 1
      frame += 1
      continue
    }
    switch (notification.kind) {
      case "error":
        out += "#"
        frame += 1
        break
      case "complete":
        out += "|"
        frame += 1
        break
      case "subscribe":
        out += "^"
        frame += 1
        break
      case "unsubscribe":
        out += "!"
        break
    }
    index += 1
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

  const bodies = lanes.map(lane => marbleBody(lane.notifications, symbolFor))
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
