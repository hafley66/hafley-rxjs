// Generates docs/1_parity.md from three sources: the `FeatureId` union, the `@feature` tags in the
// implementation, and two competitor listings. Run it with `pnpm parity`; never hand-edit the output.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { API } from "typescript/unstable/sync"
import * as ast from "typescript/unstable/ast"

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SRC = join(PKG, "src")
const OUT = join(PKG, "docs", "1_parity.md")
const DATA = join(PKG, "site", "parity.json")

// A hand-written list is how 5_columns.ts, then 12_transpose.ts through 16_menu.ts, went uncounted.
// Every module the program compiles under src/ is a surface; the only way out is to say so in it.
const OPT_OUT = /^\/\/ @no-features:\s*(.+)$/

// `index.ts` re-exports and `features.ts` is the ledger's own vocabulary, so neither ships behaviour
// a feature id could name. `src/test/` is a fixture kit, and a test never carries a claim.
const NEVER_TAGGED = new Set(["index.ts", "features.ts"])

// `@feature` is a behaviour claim: a user can run it. `@feature-declared` is the type that names the
// shape and does nothing yet. Splitting them is what stops a field on an interface from rendering as
// "yes" in the same column as a shipped operator.
const BEHAVIOUR_TAG = "feature"
const DECLARED_TAG = "feature-declared"

// A declaration carries code when it is a function or a class, or when its body holds a function or
// a call. A type alias, an interface, and a bare property signature never do, which is exactly the
// case this split exists to catch.
const carriesCode = (node) => {
  if (
    node.kind === ast.SyntaxKind.FunctionDeclaration ||
    node.kind === ast.SyntaxKind.MethodDeclaration ||
    node.kind === ast.SyntaxKind.ClassDeclaration
  ) {
    return true
  }
  let found = false
  walk(node, (inner) => {
    if (
      inner.kind === ast.SyntaxKind.ArrowFunction ||
      inner.kind === ast.SyntaxKind.FunctionExpression ||
      inner.kind === ast.SyntaxKind.CallExpression
    ) {
      found = true
    }
  })
  return found
}

const TANSTACK_FEATURES = resolve(
  PKG,
  "../../node_modules/.pnpm/@tanstack+table-core@9.1.0/node_modules/@tanstack/table-core/dist/features",
)

// TanStack names its directories after the axis it stores state on, which is not always the axis the
// feature is keyed by: `column-grouping` groups rows, `column-faceting` describes row values.
const TANSTACK_ALIAS = {
  "cell-selection": ["cell.select"],
  "cell-spanning": ["cell.span"],
  "column-faceting": ["row.filter.facet"],
  "column-filtering": ["row.filter"],
  "column-grouping": ["row.group"],
  "column-ordering": ["col.order"],
  "column-pinning": ["col.pin"],
  "column-resizing": ["col.resize"],
  "column-sizing": ["col.size"],
  "column-visibility": ["col.visible"],
  "global-filtering": ["row.filter.quick"],
  "row-aggregation": ["row.aggregate"],
  "row-expanding": ["row.expand", "row.tree", "row.detail"],
  "row-pagination": ["page.paginate"],
  "row-pinning": ["row.pin"],
  "row-selection": ["row.select"],
  "row-sorting": ["row.sort", "row.sort.multi"],
}

// Cut on purpose, with the reason a reviewer would ask for. Anything here must stay untagged, which
// the script checks, so a later change of mind cannot leave the doc claiming both.
const DECIDED_OUT = {
  "row.filter": "The operators exist in 2_operators.ts; the view chain never applies them, so a filter model would be state nothing reads.",
  "row.filter.quick": "Same cut as row.filter: no filter stage in the chain.",
  "row.filter.logic": "Same cut as row.filter: no filter stage in the chain.",
  "row.filter.facet": "Faceting is a query over the unfiltered relation, which belongs upstream of a kernel that never runs the filter.",
  "row.aggregate": "Aggregation is arithmetic over a group, not a relational operator, and it drags a function registry in with it.",
  "cell.edit": "Editing is a form lifecycle. The kernel carries `editing: CellId` and emits commit and cancel effects; the consumer owns the rest.",
  "col.type": "A type system implies editors, formatters, and operator sets. The kernel takes a comparator and a value reader instead.",
  "col.pivot": "Pivoting is grouping on both axes plus an aggregate over the cross, and the aggregate half is cut.",
}

const fail = (message) => {
  process.stderr.write(`parity: ${message}\n`)
  process.exitCode = 1
}

// --- Source analysis --------------------------------------------------------

const api = new API({ cwd: PKG })
const snapshot = api.updateSnapshot({ openProjects: [join(PKG, "tsconfig.json")] })
const project = snapshot.getProjects().find((p) => p.configFileName === join(PKG, "tsconfig.json"))
if (project === undefined) {
  api.close()
  throw new Error(`no project loaded for ${join(PKG, "tsconfig.json")}`)
}

const sourceOf = (name) => {
  const file = project.program.getSourceFile(join(SRC, name))
  if (file === undefined) throw new Error(`${name} is not in the program`)
  return file
}

const lineOf = (file, position) => file.getLineAndCharacterOfPosition(position).line + 1

const walk = (node, visit) => {
  visit(node)
  node.forEachChild((child) => {
    walk(child, visit)
  })
}

/** Reads the union members. AST rather than regex, so a reformat of the union cannot break parsing. */
const readFeatureIds = () => {
  const file = sourceOf("features.ts")
  const ids = []
  walk(file, (node) => {
    if (node.kind !== ast.SyntaxKind.TypeAliasDeclaration) return
    if (node.name?.text !== "FeatureId") return
    walk(node, (inner) => {
      if (inner.kind === ast.SyntaxKind.StringLiteral) ids.push(inner.text)
    })
  })
  if (ids.length === 0) throw new Error("FeatureId has no string literal members")
  return ids
}

const nameOf = (node) => {
  if (node.name !== undefined && typeof node.name.text === "string") return node.name.text
  let found
  node.forEachChild((child) => {
    if (found === undefined) {
      if (child.name !== undefined && typeof child.name.text === "string") found = child.name.text
      else if (child.kind === ast.SyntaxKind.VariableDeclarationList) found = nameOf(child)
    }
  })
  return found ?? ast.formatSyntaxKind(node.kind)
}

// The reference search needs the identifier itself, not its text, and a `VariableStatement` hides
// one two levels down. Returns `undefined` for a declaration with no name to point the search at.
const nameNodeOf = (node) => {
  if (node.name !== undefined && node.name.kind === ast.SyntaxKind.Identifier) return node.name
  let found
  node.forEachChild((child) => {
    if (found !== undefined) return
    if (child.name !== undefined && child.name.kind === ast.SyntaxKind.Identifier) found = child.name
    else if (child.kind === ast.SyntaxKind.VariableDeclarationList) found = nameNodeOf(child)
  })
  return found
}

// A modifier and a declaration list share their statement's full start, so both would answer with
// the statement's own tag. Only these kinds are a claim; everything else is a fragment of one.
const CLAIMABLE = new Set([
  ast.SyntaxKind.VariableStatement,
  ast.SyntaxKind.FunctionDeclaration,
  ast.SyntaxKind.TypeAliasDeclaration,
  ast.SyntaxKind.InterfaceDeclaration,
  ast.SyntaxKind.ClassDeclaration,
  ast.SyntaxKind.EnumDeclaration,
  ast.SyntaxKind.PropertySignature,
  ast.SyntaxKind.PropertyDeclaration,
  ast.SyntaxKind.MethodSignature,
  ast.SyntaxKind.MethodDeclaration,
])

// `getJSDocTags` also answers with tags inherited from ancestors, and an own tag is the one that
// starts inside the node's own leading trivia, so the position test is what stops double counting.
const claimsIn = (name) => {
  const file = sourceOf(name)
  const found = []
  walk(file, (node) => {
    if (!CLAIMABLE.has(node.kind)) return
    const start = node.getFullStart()
    for (const tag of ast.getJSDocTags(node)) {
      const tagName = tag.tagName.text
      if (tagName !== BEHAVIOUR_TAG && tagName !== DECLARED_TAG) continue
      if (tag.pos < start) continue
      const id = (ast.getTextOfJSDocComment(tag.comment) ?? "").trim()
      found.push({
        id,
        kind: tagName === BEHAVIOUR_TAG ? "behaviour" : "declared",
        code: carriesCode(node),
        nameNode: nameNodeOf(node),
        file: name,
        line: lineOf(file, node.getStart(file)),
        tagLine: lineOf(file, tag.pos),
        declaration: nameOf(node),
      })
    }
  })
  return found
}

const FEATURE_IDS = readFeatureIds()
const known = new Set(FEATURE_IDS)

// --- Which files are tagging surfaces ---------------------------------------

const SRC_PREFIX = `${SRC}/`.toLowerCase()

/** Modules the program compiled under `src/`, as `1_axis.ts`-style names, in sorted order. */
const programModules = () =>
  project.program
    .getSourceFileNames()
    .filter((path) => path.toLowerCase().startsWith(SRC_PREFIX))
    .map((path) => path.slice(SRC_PREFIX.length))
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .filter((name) => !name.startsWith("test/") && !NEVER_TAGGED.has(name))
    .sort()

/** The `// @no-features:` reason, read from the leading comment block only, or `undefined`. */
const optOutReason = (name) => {
  const text = readFileSync(join(SRC, name), "utf8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (trimmed === "") continue
    if (!trimmed.startsWith("//")) return undefined
    const match = OPT_OUT.exec(trimmed)
    if (match !== null) return match[1].trim()
  }
  return undefined
}

const modules = programModules()
const claims = modules.flatMap(claimsIn)
const optedOut = new Map()
const untagged = []

for (const name of modules) {
  const reason = optOutReason(name)
  if (reason !== undefined) {
    optedOut.set(name, reason)
    if (claims.some((claim) => claim.file === name)) {
      fail(`src/${name} carries a feature tag and also opts out with @no-features`)
    }
    continue
  }
  if (claims.some((claim) => claim.file === name)) continue
  untagged.push(name)
  fail(`src/${name} is in the program and carries no feature tag and no @no-features reason`)
}

for (const claim of claims) {
  if (!known.has(claim.id)) {
    fail(`unknown feature id "${claim.id}" at src/${claim.file}:${claim.tagLine}`)
  }
  // The whole point of the split: a behaviour claim has to sit on something that runs.
  if (claim.kind === "behaviour" && !claim.code) {
    fail(
      `"${claim.id}" claims behaviour at src/${claim.file}:${claim.tagLine} but ` +
        `"${claim.declaration}" is a declaration with no code in it. Move the @feature tag to the ` +
        `function or signal that reads it, or change this tag to @feature-declared.`,
    )
  }
}

// --- Last caller ------------------------------------------------------------

// Warned rather than failed: `tsconfig.json` excludes the tests and `demo/`, `site/`, `bench/`, and
// `tests/` are separate projects, so an export called only from there is correct code, invisible here.
const lastCallerStarted = Date.now()
const orphans = []
for (const claim of claims) {
  if (claim.nameNode === undefined) continue
  const file = sourceOf(claim.file)
  const entries = project.checker.getReferencedSymbolsForNode(
    claim.nameNode,
    claim.nameNode.getStart(file),
  )
  // The declaration's own name is in the answer, so one reference means nothing reads it. A
  // module-local helper counts its callers inside its own file, which is why the file is not filtered.
  const uses = entries
    .flatMap((entry) => entry.references)
    .map((reference) => String(reference.path).toLowerCase())
    .filter((path) => path.startsWith(SRC_PREFIX) && !path.endsWith(".test.ts"))
  if (uses.length <= 1) {
    orphans.push(claim)
    process.stderr.write(
      `parity: warning: "${claim.id}" is tagged on "${claim.declaration}" at ` +
        `src/${claim.file}:${claim.line} and nothing under src/ reads it\n`,
    )
  }
}
const lastCallerMs = Date.now() - lastCallerStarted

const byId = new Map(FEATURE_IDS.map((id) => [id, []]))
const declaredById = new Map(FEATURE_IDS.map((id) => [id, []]))
for (const claim of claims) {
  const bucket = claim.kind === "behaviour" ? byId : declaredById
  bucket.get(claim.id)?.push(claim)
}

// Three files for one id means the id names something coarser than one implementation decision.
// Counted per file rather than per site, because one feature legitimately needs a column, a gesture,
// and an epic, and those are three edits serving one decision.
for (const [id, sites] of byId) {
  const files = new Set(sites.map((s) => s.file))
  if (files.size < 3) continue
  const where = sites.map((s) => `src/${s.file}:${s.tagLine}`).join(", ")
  fail(`"${id}" is claimed in ${files.size} files, so the vocabulary is too coarse: ${where}`)
}

for (const [id, reason] of Object.entries(DECIDED_OUT)) {
  if (!known.has(id)) fail(`DECIDED_OUT names "${id}", which is not a FeatureId`)
  if (reason.length === 0) fail(`DECIDED_OUT entry "${id}" has no reason`)
  const sites = byId.get(id) ?? []
  if (sites.length > 0) {
    fail(`"${id}" is cut by decision but claimed at src/${sites[0].file}:${sites[0].tagLine}`)
  }
}

// --- TanStack ---------------------------------------------------------------

const tanstackDirs = readdirSync(TANSTACK_FEATURES)
  .filter((entry) => statSync(join(TANSTACK_FEATURES, entry)).isDirectory())
  .sort()

const tanstack = new Map(FEATURE_IDS.map((id) => [id, []]))
const unmapped = []
for (const dir of tanstackDirs) {
  const ids = TANSTACK_ALIAS[dir]
  if (ids === undefined) {
    unmapped.push(dir)
    continue
  }
  for (const id of ids) {
    if (!known.has(id)) fail(`TANSTACK_ALIAS maps "${dir}" to unknown id "${id}"`)
    tanstack.get(id)?.push(dir)
  }
}

// --- MUI X ------------------------------------------------------------------

const mui = JSON.parse(readFileSync(join(PKG, "docs", "parity.mui.json"), "utf8"))
for (const id of FEATURE_IDS) {
  const entry = mui[id]
  if (entry === undefined) {
    fail(`docs/parity.mui.json has no entry for "${id}"`)
    continue
  }
  if (!["yes", "no", "partial"].includes(entry.status)) {
    fail(`"${id}" has status "${entry.status}"`)
  }
  if (entry.status !== "no" && !String(entry.url ?? "").startsWith("https://mui.com/")) {
    fail(`"${id}" claims MUI support with no mui.com citation`)
  }
}
for (const id of Object.keys(mui)) {
  if (!known.has(id)) fail(`docs/parity.mui.json has a stale entry "${id}"`)
}

// --- The document -----------------------------------------------------------

// Read off the same AST as the union, so a `FEATURES` entry the compiler accepts is an entry the
// document can render. `noSubstitutionTemplate` and computed keys are not used here and not handled.
const readFeatures = () => {
  const file = sourceOf("features.ts")
  const meta = new Map()
  walk(file, (node) => {
    if (node.kind !== ast.SyntaxKind.VariableDeclaration) return
    if (node.name?.text !== "FEATURES") return
    const literal = node.initializer
    if (literal === undefined) return
    literal.forEachChild((entry) => {
      if (entry.kind !== ast.SyntaxKind.PropertyAssignment) return
      const id = entry.name?.text
      const fields = {}
      entry.initializer?.forEachChild((field) => {
        if (field.kind !== ast.SyntaxKind.PropertyAssignment) return
        if (field.initializer?.kind === ast.SyntaxKind.StringLiteral) {
          fields[field.name?.text] = field.initializer.text
        }
      })
      if (id !== undefined) meta.set(id, fields)
    })
  })
  return meta
}

const FEATURES = readFeatures()

for (const id of FEATURE_IDS) {
  if (!FEATURES.has(id)) fail(`FEATURES has no entry for "${id}"`)
}

const AXIS_TITLE = {
  row: "Row axis",
  col: "Column axis",
  cell: "Cell, the cross of the two axes",
  page: "Retention",
  view: "Presentation",
  data: "The relation as a whole",
}

const muiCell = (entry) => {
  if (entry.status === "no") return "no"
  const tier = entry.tier === null ? "" : ` (${entry.tier})`
  return `[${entry.status}${tier}](${entry.url})`
}

const whereCell = (sites) =>
  sites.map((s) => `\`src/${s.file}:${s.line}\``).join("<br>")

const oursCell = (id, sites) => {
  if (sites.length > 0) return "yes"
  if ((declaredById.get(id) ?? []).length > 0) return "declared only"
  return id in DECIDED_OUT ? "no, by decision" : "no"
}

const claimed = FEATURE_IDS.filter((id) => (byId.get(id) ?? []).length > 0)
const declaredOnly = FEATURE_IDS.filter(
  (id) => (byId.get(id) ?? []).length === 0 && (declaredById.get(id) ?? []).length > 0,
)
const tanstackYes = FEATURE_IDS.filter((id) => (tanstack.get(id) ?? []).length > 0)
const muiYes = FEATURE_IDS.filter((id) => mui[id]?.status === "yes")
const muiPartial = FEATURE_IDS.filter((id) => mui[id]?.status === "partial")
const undecided = FEATURE_IDS.filter(
  (id) =>
    (byId.get(id) ?? []).length === 0 &&
    (declaredById.get(id) ?? []).length === 0 &&
    !(id in DECIDED_OUT) &&
    ((tanstack.get(id) ?? []).length > 0 || mui[id]?.status !== "no"),
)

const lines = []
const say = (text = "") => lines.push(text)

say("# signal-grid: three-way feature parity")
say()
say("Generated. Every column below is derived, not asserted by hand.")
say()
say("## Contents")
say()
say("1. [Counts](#counts)")
say("2. [How each column is produced](#how-each-column-is-produced)")
say("3. [The matrix](#the-matrix)")
say("4. [Cut on purpose](#cut-on-purpose)")
say("5. [Not decided yet](#not-decided-yet)")
say("6. [Regenerating](#regenerating)")
say()
say("## Counts")
say()
say(
  `${FEATURE_IDS.length} features tracked. TanStack Table v9 covers ${tanstackYes.length}, ` +
    `MUI X Data Grid covers ${muiYes.length} in full and ${muiPartial.length} in part, ` +
    `signal-grid implements ${claimed.length} and declares a further ${declaredOnly.length} as ` +
    `types nothing runs yet.`,
)
say()
say("| column | source |")
say("| --- | --- |")
say("| TanStack v9 | directory listing of `@tanstack/table-core/dist/features`, mapped through an alias table in the script |")
say("| MUI X | `docs/parity.mui.json`, one citation URL per row, MUI X is not installed here |")
say("| signal-grid | `@feature` JSDoc tags, each of which must sit on a declaration containing a function or a call, read by the TypeScript compiler API |")
say("| signal-grid, declared only | `@feature-declared` tags: the type exists and nothing runs it |")
say("| where | the declaration carrying the tag |")
say()
say("## How each column is produced")
say()
say(
  `TanStack's ${tanstackDirs.length} feature directories map onto ${tanstackYes.length} feature ids. ` +
    (unmapped.length === 0
      ? "Every directory is mapped."
      : `Unmapped: ${unmapped.map((d) => `\`${d}\``).join(", ")}.`),
)
say()
say("## The matrix")

for (const axis of ["row", "col", "cell", "page", "view", "data"]) {
  const ids = FEATURE_IDS.filter((id) => FEATURES.get(id)?.axis === axis)
  if (ids.length === 0) continue
  say()
  say(`### ${AXIS_TITLE[axis]}`)
  say()
  say("| feature | why it matters | TanStack v9 | MUI X | signal-grid | where |")
  say("| --- | --- | --- | --- | --- | --- |")
  for (const id of ids) {
    const meta = FEATURES.get(id)
    const sites = byId.get(id) ?? []
    const shown = sites.length > 0 ? sites : (declaredById.get(id) ?? [])
    const ts = (tanstack.get(id) ?? []).length > 0 ? "yes" : "no"
    say(
      `| \`${id}\`<br>${meta.title} | ${meta.why} | ${ts} | ${muiCell(mui[id])} | ` +
        `${oursCell(id, sites)} | ${whereCell(shown)} |`,
    )
  }
}

say()
say("## Cut on purpose")
say()
say("Each of these has a `FeatureId` so the gap is visible, and the parity run fails if one of them is ever tagged as implemented.")
say()
say("| feature | reason |")
say("| --- | --- |")
for (const [id, reason] of Object.entries(DECIDED_OUT)) {
  say(`| \`${id}\` | ${reason} |`)
}

say()
say("## Not decided yet")
say()
say("A competitor ships it, this package neither implements it nor rules it out.")
say()
say("| feature | TanStack v9 | MUI X |")
say("| --- | --- | --- |")
for (const id of undecided) {
  const ts = (tanstack.get(id) ?? []).length > 0 ? "yes" : "no"
  say(`| \`${id}\` | ${ts} | ${muiCell(mui[id])} |`)
}

say()
say("## Regenerating")
say()
say(
  `Written by \`${relative(PKG, fileURLToPath(import.meta.url))}\` (\`pnpm parity\`). ` +
    "Edits made here are overwritten on the next run; change `src/features.ts`, a `@feature` tag, or `docs/parity.mui.json` instead.",
)
say()

writeFileSync(OUT, lines.join("\n"))

// `stats.mjs` takes `features` from this and `docs.mjs` resolves `{{parity.*}}` against it, so a
// number in a document cannot disagree with the matrix. Written even when the run fails.
writeFileSync(
  DATA,
  `${JSON.stringify(
    {
      schema: 1,
      generatedBy: "packages/signal-grid/scripts/parity.mjs",
      features: FEATURE_IDS.length,
      implemented: claimed.length,
      declaredOnly: declaredOnly.length,
      tags: claims.length,
      modules: modules.length,
      untagged,
      optedOut: Object.fromEntries(optedOut),
      unread: orphans.map((claim) => ({
        id: claim.id,
        declaration: claim.declaration,
        file: `src/${claim.file}`,
        line: claim.line,
      })),
      decidedOut: Object.keys(DECIDED_OUT).length,
      undecided: undecided.length,
      tanstack: tanstackYes.length,
      mui: { yes: muiYes.length, partial: muiPartial.length },
      ok: process.exitCode === undefined || process.exitCode === 0,
    },
    null,
    2,
  )}\n`,
)
api.close()

process.stdout.write(
  `parity: ${FEATURE_IDS.length} features, ${claims.length} tags over ${modules.length} modules, ` +
    `tanstack ${tanstackYes.length}, mui ${muiYes.length} yes and ${muiPartial.length} partial, ` +
    `signal-grid ${claimed.length} implemented and ${declaredOnly.length} declared only\n`,
)
process.stdout.write(
  `parity: last-caller warnings ${orphans.length} of ${claims.length} in ${lastCallerMs} ms\n`,
)
process.stdout.write(`parity: wrote ${relative(PKG, OUT)} and ${relative(PKG, DATA)}\n`)
