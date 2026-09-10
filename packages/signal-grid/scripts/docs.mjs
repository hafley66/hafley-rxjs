// Fails when a document says something the repository does not, answering from the file system, the
// TypeScript program, the test files, and `site/stats.json`. Documented in `docs/8_receipts.md`.

// `--fix` repoints a stale `path:line` whose symbol it can find elsewhere in the same file.
// `--render` expands `{{stats.*}}`, `{{bench.*}}`, and `{{parity.*}}` into `docs/dist/`.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { API } from "typescript/unstable/sync"

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const WORKSPACE = resolve(PKG, "../..")
const SRC = join(PKG, "src")
const DIST = join(PKG, "docs", "dist")

const argv = process.argv.slice(2)
const fixing = argv.includes("--fix")
const rendering = argv.includes("--render")
// Named files replace the sweep, which is how a check is demonstrated on one file without touching
// the tree the sweep reads.
const named = argv.filter((it) => !it.startsWith("--")).map((it) => resolve(process.cwd(), it))

// Written by `scripts/parity.mjs`, so linting its prose would lint the generator's own output.
const GENERATED = new Set(["docs/1_parity.md"])

const EXTENSIONS = ["ts", "tsx", "mts", "mjs", "js", "css", "json", "md", "html", "yml", "yaml"]
const EXTENSION_GROUP = EXTENSIONS.join("|")

// --- what gets read ---------------------------------------------------------

const listing = (dir, suffix) =>
  existsSync(join(PKG, dir))
    ? readdirSync(join(PKG, dir))
        .filter((it) => it.endsWith(suffix))
        .map((it) => `${dir}/${it}`)
        .sort()
    : []

const documents = () => {
  if (named.length > 0) return named
  const found = ["README.md", "PITCH.md", ...listing("docs", ".md"), ...listing("site", ".ts"), ...listing("demo", ".ts")]
  return found.filter((it) => !GENERATED.has(it) && existsSync(join(PKG, it)))
}

/** Documents are named relative to the package, except a named one from outside it. */
const absoluteOf = (file) => (file.startsWith("/") ? file : join(PKG, file))

const textCache = new Map()
const textOf = (path) => {
  const found = textCache.get(path)
  if (found !== undefined) return found
  const text = readFileSync(path, "utf8")
  textCache.set(path, text)
  return text
}

const linesOf = (path) => textOf(path).split("\n")

// --- the file index ---------------------------------------------------------

// A citation writes `src/8_grid.ts` from the package and `packages/signals/src/2_Signal.ts` from the
// workspace, and a bare `stats.json` from neither, so all three shapes get an answer.
const INDEXED = ["src", "site", "demo", "bench", "docs", "scripts", "tests", "fixtures", "examples", "."]

const byBaseName = new Map()
for (const dir of INDEXED) {
  const absolute = join(PKG, dir)
  if (!existsSync(absolute)) continue
  for (const entry of readdirSync(absolute)) {
    const path = join(absolute, entry)
    if (!statSync(path).isFile()) continue
    if (!byBaseName.has(entry)) byBaseName.set(entry, path)
  }
}

// `@hafley66/signal-grid/theme.css` is a package specifier and `.d.ts` is an extension being named,
// so neither is a claim that a file exists here.
const namesNoFile = (cited) =>
  cited.startsWith("@") || cited.startsWith("http") || basename(cited).startsWith(".")

/** Absolute path a citation names, or `undefined`. Package, then workspace, then a bare name. */
const locate = (cited) => {
  if (namesNoFile(cited)) return undefined
  // A `.js` specifier is how TypeScript spells an import of the `.ts` beside it, which `index.ts` does.
  const shapes = [cited, cited.replace(/\.js$/, ".ts"), cited.replace(/\.jsx$/, ".tsx")]
  for (const shape of shapes) {
    for (const root of [PKG, WORKSPACE]) {
      const candidate = resolve(root, shape)
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
    }
    const bare = shape.replace(/^\.\//, "")
    if (!bare.includes("/")) {
      const found = byBaseName.get(bare)
      if (found !== undefined) return found
    }
  }
  return undefined
}

// --- blocks that name someone else's repository -----------------------------

const EXTERNAL_URL = /https?:\/\//

/** One flag per line: whether the block it sits in carries an external url. A block is a run of
 * non-blank lines, which is what separates one list, table, or paragraph from the next. */
const externalBlocks = (lines) => {
  const flagged = new Array(lines.length).fill(false)
  let from = 0
  const close = (to) => {
    let found = false
    for (let index = from; index < to; index++) if (EXTERNAL_URL.test(lines[index])) found = true
    if (found) for (let index = from; index < to; index++) flagged[index] = true
  }
  for (let index = 0; index < lines.length; index++) {
    if (lines[index].trim() !== "") continue
    close(index)
    from = index + 1
  }
  close(lines.length)
  return flagged
}

// A bare file name in a block that links out names a file in that repository, which this one has no
// answer for. A path carrying a directory is still a claim about this tree and stays checked.
const namesAnotherRepository = (cited, external) => external && !cited.includes("/")

// --- exported symbols -------------------------------------------------------

const api = new API({ cwd: PKG })
const snapshot = api.updateSnapshot({ openProjects: [join(PKG, "tsconfig.json")] })
const project = snapshot.getProjects().find((it) => it.configFileName === join(PKG, "tsconfig.json"))
if (project === undefined) {
  api.close()
  throw new Error(`no project loaded for ${join(PKG, "tsconfig.json")}`)
}

// `getExportsOfModule` needs the module's own symbol, which is what the checker answers for the
// source file node. A file outside the program (a test, a demo) has none and yields an empty list.
const exportCache = new Map()
const exportsOf = (absolute) => {
  const found = exportCache.get(absolute)
  if (found !== undefined) return found
  let names = []
  const file = project.program.getSourceFile(absolute)
  if (file !== undefined) {
    const moduleSymbol = project.checker.getSymbolAtLocation(file)
    if (moduleSymbol !== undefined) names = project.checker.getExportsOfModule(moduleSymbol).map((it) => it.name)
  }
  exportCache.set(absolute, names)
  return names
}

const tokenCache = new Map()
const tokensOf = (absolute) => {
  const found = tokenCache.get(absolute)
  if (found !== undefined) return found
  const tokens = new Set(textOf(absolute).match(/[A-Za-z_$][\w$]*/g) ?? [])
  tokenCache.set(absolute, tokens)
  return tokens
}

// --- declared test names ----------------------------------------------------

const TEST_DIRECTORIES = ["src", "tests", "bench", "demo", "site"]
const DECLARATION = /\b(?:it|test|describe|bench)(?:\.\w+)*\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g

const testNames = new Set()
const testFileCount = () => {
  let count = 0
  for (const dir of TEST_DIRECTORIES) {
    const absolute = join(PKG, dir)
    if (!existsSync(absolute)) continue
    for (const entry of readdirSync(absolute)) {
      if (!entry.includes(".test.") && !entry.includes(".bench.")) continue
      count++
      for (const match of textOf(join(absolute, entry)).matchAll(DECLARATION)) testNames.add(match[2])
    }
  }
  return count
}
const TEST_FILES = testFileCount()

// --- transclusion data ------------------------------------------------------

const readJson = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined)

// One benchmark name is a sentence, so it is keyed by a slug of itself and reachable as
// `{{bench.read_view_flat_no_write_1k_rows.median}}`.
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")

const benchData = () => {
  const raw = readJson(join(PKG, "bench", "results.json"))
  if (raw === undefined) return undefined
  const keyed = {}
  for (const file of raw.files ?? []) {
    for (const group of file.groups ?? []) {
      for (const benchmark of group.benchmarks ?? []) {
        keyed[slug(benchmark.name)] = {
          median: benchmark.p50 ?? benchmark.mean ?? null,
          mean: benchmark.mean ?? null,
          hz: benchmark.hz ?? null,
          min: benchmark.min ?? null,
          max: benchmark.max ?? null,
          rank: benchmark.rank ?? null,
        }
      }
    }
  }
  return keyed
}

const SOURCES = {
  stats: readJson(join(PKG, "site", "stats.json")),
  bench: benchData(),
  parity: readJson(join(PKG, "site", "parity.json")),
}

// An object answer is not printable, so a group that carries its own headline number under `tests`,
// `count`, `total`, or `value` collapses to it. That is what makes `{{stats.tests.unit}}` a number.
const HEADLINE = ["tests", "count", "total", "value"]

const resolveKey = (key) => {
  let cursor = SOURCES
  for (const segment of key.split(".")) {
    if (cursor === null || typeof cursor !== "object") return undefined
    if (!(segment in cursor)) return undefined
    cursor = cursor[segment]
  }
  if (cursor !== null && typeof cursor === "object" && !Array.isArray(cursor)) {
    const headline = HEADLINE.find((it) => typeof cursor[it] === "number")
    return headline === undefined ? undefined : cursor[headline]
  }
  return Array.isArray(cursor) ? cursor.length : cursor
}

// --- line surgery -----------------------------------------------------------

const CITATION = new RegExp(`^(.+?\\.(?:${EXTENSION_GROUP})):(\\d+)$`)
const PATH_LIKE = new RegExp(`^[\\w./@-]+\\.(?:${EXTENSION_GROUP})$`)
const IDENTIFIER = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/

const spansOf = (line) =>
  [...line.matchAll(/`([^`\n]+)`/g)].map((match) => ({
    text: match[1],
    start: match.index,
    end: match.index + match[0].length,
  }))

const classify = (span) => {
  const citation = CITATION.exec(span.text)
  if (citation !== null) return { ...span, kind: "citation", path: citation[1], line: Number(citation[2]) }
  if (PATH_LIKE.test(span.text)) return { ...span, kind: "path", path: span.text }
  if (IDENTIFIER.test(span.text)) return { ...span, kind: "identifier" }
  return { ...span, kind: "prose" }
}

// A markdown table row is many sentences on one physical line, so `|` ends a clause as firmly as a
// full stop does. Without that, a citation borrows the symbol named in the cell beside it.
const CLAUSE_BREAK = /\||;\s|,\s|(?:[.!?])\s/g

const clauseOf = (line, at) => {
  let start = 0
  let end = line.length
  for (const match of line.matchAll(CLAUSE_BREAK)) {
    const from = match.index
    const to = from + match[0].length
    if (to <= at) start = to
    else if (from >= at && end === line.length) end = from
  }
  return { start, end }
}

const wordIn = (haystack, word) => new RegExp(`(?<![\\w$])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w$])`).test(haystack)

// --- violations -------------------------------------------------------------

const violations = []
const repairs = []

const report = (kind, file, line, message) => {
  violations.push({ kind, file, line, message })
}

const nearestIdentifier = (spans, citation, line) => {
  const bounds = clauseOf(line, citation.start)
  const candidates = spans.filter(
    (it) => it.kind === "identifier" && it.start >= bounds.start && it.end <= bounds.end,
  )
  if (candidates.length === 0) return undefined
  const distance = (span) => (span.end <= citation.start ? citation.start - span.end : span.start - citation.end)
  return candidates.reduce((best, it) => (distance(it) < distance(best) ? it : best))
}

// A name on forty lines cannot be repointed to one of them, and `it` on a line of a test file is not
// a claim about that line at all. Both cases are silence rather than a guess.
const AMBIGUOUS = 6
const NOT_A_CLAIM = new Set(["it", "test", "describe", "expect", "beforeEach", "afterEach", "$"])

/** The line a symbol sits on, preferring its declaration, or `0` when absent or too common. */
const locateSymbol = (absolute, symbol) => {
  if (symbol.length < 3 || NOT_A_CLAIM.has(symbol)) return 0
  const lines = linesOf(absolute)
  const hits = []
  let declaration = 0
  for (let index = 0; index < lines.length; index++) {
    const text = lines[index]
    if (!wordIn(text, symbol)) continue
    hits.push(index + 1)
    if (declaration === 0 && /\b(?:export|function|class|interface|type|const|let|var|enum)\b/.test(text)) {
      declaration = index + 1
    }
  }
  if (hits.length === 0 || hits.length > AMBIGUOUS) return 0
  return declaration === 0 ? hits[0] : declaration
}

const checkCitations = (file, lineNumber, line, spans, external) => {
  for (const span of spans) {
    if (span.kind !== "citation") continue
    const absolute = locate(span.path)
    if (absolute === undefined) {
      if (namesNoFile(span.path) || namesAnotherRepository(span.path, external)) continue
      report("missing-file", file, lineNumber, `names ${span.path} which does not exist`)
      continue
    }
    const symbol = nearestIdentifier(spans, span, line)
    if (symbol === undefined) {
      repairs.push({ file, line: lineNumber, text: span.text, reason: "no symbol named beside it" })
      continue
    }
    const target = linesOf(absolute)[span.line - 1]
    const name = symbol.text.includes(".") ? symbol.text.split(".").at(-1) : symbol.text
    if (target !== undefined && (wordIn(target, name) || wordIn(target, symbol.text))) continue
    // A symbol the file never mentions was never a claim about that file, so the pairing is prose.
    if (!tokensOf(absolute).has(name)) continue
    const actual = locateSymbol(absolute, name)
    if (actual === 0 || actual === span.line) continue
    report(
      "stale-citation",
      file,
      lineNumber,
      `cites ${span.path}:${span.line} but "${name}" is at :${actual}`,
      )
    repairs.push({ file, line: lineNumber, text: span.text, replacement: `${span.path}:${actual}` })
  }
}

const checkPaths = (file, lineNumber, spans, external) => {
  for (const span of spans) {
    if (span.kind !== "path") continue
    if (namesNoFile(span.path)) continue
    if (namesAnotherRepository(span.path, external)) continue
    if (locate(span.path) !== undefined) continue
    report("missing-file", file, lineNumber, `names ${span.path} which does not exist`)
  }
}

const suggestions = (names, wanted) => {
  const stem = wanted.slice(0, 3)
  const near = names.filter((it) => it.startsWith(stem) || wanted.startsWith(it.slice(0, 3)))
  const shown = near.length > 0 ? near : names
  return shown.slice(0, 6).join(", ")
}

// Scoped to the clause rather than the physical line: a competitor table names MUI's API in one cell
// and this package's file in the next, and those two are not a claim about each other.
const checkExports = (file, lineNumber, line, spans) => {
  const cited = spans.filter((it) => (it.kind === "citation" || it.kind === "path") && it.path.startsWith("src/"))
  if (cited.length === 0) return
  for (const span of spans) {
    if (span.kind !== "identifier") continue
    const bounds = clauseOf(line, span.start)
    const inClause = cited.filter((it) => it.start >= bounds.start && it.end <= bounds.end)
    const targets = inClause
      .map((it) => ({ path: it.path, absolute: locate(it.path) }))
      .filter((it) => it.absolute !== undefined)
    if (targets.length === 0) continue
    const head = span.text.split(".")[0]
    const tail = span.text.split(".").at(-1)
    const owned = targets.some((target) => {
      const names = exportsOf(target.absolute)
      const tokens = tokensOf(target.absolute)
      return names.includes(head) || names.includes(tail) || tokens.has(head) || tokens.has(tail)
    })
    if (owned) continue
    const target = targets[0]
    const names = exportsOf(target.absolute)
    if (names.length === 0) continue
    report(
      "unknown-symbol",
      file,
      lineNumber,
      `names ${span.text}, not exported from ${target.path} (exports: ${suggestions(names, head)})`,
    )
  }
}

// --- hard-coded numbers -----------------------------------------------------

// Plurals only. "Route 1. Every feature" is an ordinal beside a singular noun, not a count of one,
// and no document transcludes a number it would print as `1`.
const UNITS = new Map([
  ["tests", "{{stats.tests.unit}}"],
  ["epics", "{{stats.epics.count}}"],
  ["features", "{{parity.features}}"],
  ["lines", "{{stats.source.sourceLines}}"],
  ["kb", "{{stats.bundle.library.totalBytes}}"],
  ["gzip", "{{stats.bundle.library.totalGzipBytes}}"],
  ["gzipped", "{{stats.bundle.library.totalGzipBytes}}"],
])

const FILES_AFTER = new Set(["test", "tests", "unit", "source", "src"])
const NUMBER = /^[+-]?[\d,]*\d(?:\.\d+)?$/
const ORDINAL = /^\d+\.$/
const MARKER = new Set(["//", "*", "-", ">", "|", "#", "##", "###"])
const REACH = 3

const inPlaceholder = (line, at) => {
  const opened = line.lastIndexOf("{{", at)
  return opened !== -1 && line.indexOf("}}", opened) >= at
}

/** The unit a token names, honouring `test files` as one unit, or `undefined`. */
const unitAt = (tokens, at) => {
  const word = tokens[at].text.toLowerCase().replace(/[^a-z]/g, "")
  const before = at === 0 ? "" : tokens[at - 1].text.toLowerCase().replace(/[^a-z]/g, "")
  if (word === "files") return FILES_AFTER.has(before) ? "{{stats.source.testFiles}}" : undefined
  return UNITS.get(word)
}

const checkNumbers = (file, lineNumber, line) => {
  const tokens = []
  for (const match of line.matchAll(/\S+/g)) tokens.push({ text: match[0], at: match.index })
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    // "358." ends a sentence and is still a hard-coded count, so the trailing stop comes off first.
    if (!NUMBER.test(token.text.replace(/[.,;:)\]]+$/, ""))) continue
    if (inPlaceholder(line, token.at)) continue
    // "3. Tests" opens a list item, and its 3 counts nothing. Position is what separates it from a
    // sentence-final count, since both spell themselves the same way.
    if (ORDINAL.test(token.text) && tokens.slice(0, index).every((it) => MARKER.has(it.text))) continue
    for (const direction of [1, -1]) {
      for (let step = 1; step <= REACH; step++) {
        const cursor = index + step * direction
        if (cursor < 0 || cursor >= tokens.length) break
        // A table cell wall ends the reach: a number in one column never counts the noun in the next.
        if (tokens[cursor].text.includes("|")) break
        if (tokens[cursor].text.includes("`")) continue
        const unit = unitAt(tokens, cursor)
        if (unit === undefined) continue
        const from = Math.min(index, cursor)
        const quoted = tokens.slice(from, Math.max(index, cursor) + 1).map((it) => it.text).join(" ")
        report("hard-coded", file, lineNumber, `hard-codes "${quoted}"; use ${unit}`)
        return
      }
    }
  }
}

// --- placeholders and quoted test names -------------------------------------

const PLACEHOLDER = /\{\{([A-Za-z][\w.]*)\}\}/g
const FENCE = /^\s*```/

const checkPlaceholders = (file, lineNumber, line) => {
  for (const match of line.matchAll(PLACEHOLDER)) {
    if (resolveKey(match[1]) !== undefined) continue
    report("unknown-key", file, lineNumber, `references {{${match[1]}}}, no such key`)
  }
}

const QUOTED = /"([^"\n]{8,})"/g
const TEST_CONTEXT = /\.test\.ts|\btests?\b|\bspec\b/
const SENTENCE_LIKE = /^[A-Za-z(][^`|]*[^\s,:;=({[]$/

// A test name is a sentence a person wrote, so a fragment of TypeScript that happens to sit between
// quotes is not one. In a `.ts` file only a comment can be quoting a test.
const quotingATest = (file, line) => {
  if (!TEST_CONTEXT.test(line)) return false
  if (file.endsWith(".md")) return true
  const trimmed = line.trim()
  return trimmed.startsWith("//") || trimmed.startsWith("*")
}

const checkTestNames = (file, lineNumber, line, fenced) => {
  // Inside a fence a quoted string is code, unless the same line names the test file it came from,
  // which is how a doc sample cites the test it copied.
  if (fenced && !/\.test\.ts/.test(line)) return
  if (!quotingATest(file, line)) return
  for (const match of line.matchAll(QUOTED)) {
    const quoted = match[1]
    if (quoted.split(" ").length < 3) continue
    if (!SENTENCE_LIKE.test(quoted)) continue
    if (testNames.has(quoted)) continue
    report("unknown-test", file, lineNumber, `quotes "${quoted}"; no test has that name`)
  }
}

// --- the pass ---------------------------------------------------------------

for (const file of documents()) {
  const absolute = absoluteOf(file)
  const lines = linesOf(absolute)
  const external = externalBlocks(lines)
  let fenced = false
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (FENCE.test(line)) {
      fenced = !fenced
      continue
    }
    const lineNumber = index + 1
    const spans = spansOf(line).map(classify)
    checkCitations(file, lineNumber, line, spans, external[index])
    checkPaths(file, lineNumber, spans, external[index])
    checkExports(file, lineNumber, line, spans)
    checkTestNames(file, lineNumber, line, fenced)
    // A fence shows syntax rather than asserting a value, so a placeholder and a digit inside one
    // are samples. Every other check still reads it.
    if (fenced) continue
    checkPlaceholders(file, lineNumber, line)
    checkNumbers(file, lineNumber, line)
  }
}

// --- fix --------------------------------------------------------------------

const applyFixes = () => {
  const fixable = repairs.filter((it) => it.replacement !== undefined)
  const byFile = new Map()
  for (const repair of fixable) {
    if (!byFile.has(repair.file)) byFile.set(repair.file, [])
    byFile.get(repair.file).push(repair)
  }
  let written = 0
  for (const [file, list] of byFile) {
    const absolute = absoluteOf(file)
    const lines = linesOf(absolute)
    for (const repair of list) {
      const index = repair.line - 1
      if (lines[index] === undefined) continue
      lines[index] = lines[index].split(`\`${repair.text}\``).join(`\`${repair.replacement}\``)
      written++
    }
    writeFileSync(absolute, lines.join("\n"))
    textCache.delete(absolute)
  }
  return written
}

// --- render -----------------------------------------------------------------

// Line by line rather than over the whole text, because a fence showing the placeholder syntax has
// to survive the pass that expands every other one.
const expand = (text, file) => {
  let unresolved = 0
  let fenced = false
  const rendered = text.split("\n").map((line) => {
    if (FENCE.test(line)) {
      fenced = !fenced
      return line
    }
    if (fenced) return line
    return line.replace(PLACEHOLDER, (whole, key) => {
      const value = resolveKey(key)
      if (value === undefined) {
        unresolved++
        return whole
      }
      return typeof value === "number" ? value.toLocaleString("en-US") : String(value)
    })
  })
  if (unresolved > 0) process.stderr.write(`docs: ${file} left ${unresolved} placeholder(s) unresolved\n`)
  return rendered.join("\n")
}

const renderAll = () => {
  mkdirSync(DIST, { recursive: true })
  const sources = [...documents().filter((it) => it.endsWith(".md")), ...GENERATED]
  for (const file of sources) {
    const absolute = absoluteOf(file)
    if (!existsSync(absolute)) continue
    writeFileSync(join(DIST, basename(file)), expand(readFileSync(absolute, "utf8"), file))
  }
  return sources.length
}

// --- output -----------------------------------------------------------------

const ORDER = ["stale-citation", "missing-file", "unknown-symbol", "hard-coded", "unknown-key", "unknown-test"]

violations.sort((left, right) => {
  const byKind = ORDER.indexOf(left.kind) - ORDER.indexOf(right.kind)
  return byKind !== 0 ? byKind : left.file.localeCompare(right.file) || left.line - right.line
})

for (const violation of violations) {
  process.stdout.write(`${violation.file}:${violation.line} ${violation.message}\n`)
}

if (fixing) {
  const written = applyFixes()
  process.stdout.write(`docs: repointed ${written} citation(s)\n`)
  const unfixable = repairs.filter((it) => it.replacement === undefined)
  for (const repair of unfixable) {
    process.stdout.write(`docs: left \`${repair.text}\` at ${repair.file}:${repair.line} alone, ${repair.reason}\n`)
  }
}

if (rendering) {
  const count = renderAll()
  process.stdout.write(`docs: rendered ${count} document(s) into ${relative(PKG, DIST)}\n`)
}

const counts = new Map()
for (const violation of violations) counts.set(violation.kind, (counts.get(violation.kind) ?? 0) + 1)
const summary = ORDER.filter((it) => counts.has(it)).map((it) => `${it} ${counts.get(it)}`).join(", ")

process.stdout.write(
  `docs: ${documents().length} documents, ${TEST_FILES} test files, ${testNames.size} declared test names\n`,
)
process.stdout.write(`docs: ${violations.length} violation(s)${summary === "" ? "" : `: ${summary}`}\n`)

api.close()
// `--render` is a build step, so it prints the drift and still writes. Only the bare lint gates.
if (violations.length > 0 && !fixing && !rendering) process.exitCode = 1
