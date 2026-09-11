// @comment-ok: the line-resolution rule has to match scripts/docs.mjs exactly or every generated citation becomes a lint violation
// The API reference, read out of the TypeScript program rather than typed by hand. The barrel names
// what is public; each module answers for the exports it declares; the checker answers for the
// signature. Nothing here reads a doc comment for a fact the compiler already knows.
//
// Output lands in a normal source document, so `scripts/docs.mjs` lints it like any other page. A
// signature sits inside a fence, where the lint's backtick spans find nothing to check; the only
// backticked spans on a prose line are the symbol's own name and the citation beside it.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { API } from "typescript/unstable/sync"

// TypeScript's own SymbolFlags, named here so this file needs no compiler enum at runtime.
const FLAG = { Variable: 3, Function: 16, Class: 32, Interface: 64, Enum: 384, TypeAlias: 524288, Alias: 2097152 }

const kindOf = (flags) => {
  if ((flags & FLAG.Function) !== 0) return "function"
  if ((flags & FLAG.Class) !== 0) return "class"
  if ((flags & FLAG.Interface) !== 0) return "interface"
  if ((flags & FLAG.TypeAlias) !== 0) return "type"
  if ((flags & FLAG.Enum) !== 0) return "enum"
  if ((flags & FLAG.Variable) !== 0) return "const"
  if ((flags & FLAG.Alias) !== 0) return "re-export"
  return "export"
}

const isType = (flags) => (flags & (FLAG.Interface | FLAG.TypeAlias | FLAG.Enum)) !== 0

const wordIn = (haystack, word) =>
  new RegExp(`(?<![\\w$])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w$])`).test(haystack)

const DECLARES = /\b(?:export|function|class|interface|type|const|let|var|enum)\b/

/** The 1-based line a symbol is declared on, preferring its declaration, or `0` when it is absent.
 * The same rule `scripts/docs.mjs` uses, so a generated citation and the lint agree. */
function declarationLine(lines, name) {
  let first = 0
  for (let index = 0; index < lines.length; index++) {
    const text = lines[index]
    if (!wordIn(text, name)) continue
    if (first === 0) first = index + 1
    if (DECLARES.test(text)) return index + 1
  }
  return first
}

const OPENERS = { "{": "}", "(": ")", "[": "]" }

/** The source text of one declaration, read from its first line until its brackets balance. */
function declarationText(lines, from) {
  const out = []
  let depth = 0
  for (let index = from - 1; index < lines.length; index++) {
    const line = lines[index] ?? ""
    out.push(line)
    for (const character of line) {
      if (OPENERS[character] !== undefined) depth++
      else if (character === "}" || character === ")" || character === "]") depth--
    }
    if (depth <= 0 && out.length > 0) break
  }
  return out.join("\n").replace(/\s+$/, "")
}

/** Every consecutive `export function name` line above the body, so an overload set stays whole. */
function overloadText(lines, from, name) {
  const signatures = []
  for (let index = from - 1; index < lines.length; index++) {
    const line = lines[index] ?? ""
    if (!wordIn(line, name)) break
    if (!/^export\s+(?:declare\s+)?function\b/.test(line)) break
    signatures.push(line.replace(/\s*\{\s*$/, ""))
  }
  return signatures.length > 1 ? signatures.join("\n") : null
}

const CODE_FENCE = /```/g

/** A doc comment is prose from `src/`, and it can carry a fence that would close this page's own. */
const prose = (text) => text.replace(CODE_FENCE, "'''").trim()

const anchorOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

const escapeCell = (text) => text.replace(/\|/g, "\\|")

// Options: pkg, tsconfig, barrel (repo-relative, the module whose exports are public), modules
// (repo-relative, in page order), out (repo-relative), title, intro.
export function generateApi(options) {
  const PKG = options.pkg
  const tsconfig = options.tsconfig ?? join(PKG, "tsconfig.json")
  const barrel = options.barrel ?? "src/index.ts"

  const api = new API({ cwd: PKG })
  const snapshot = api.updateSnapshot({ openProjects: [tsconfig] })
  const project = snapshot.getProjects().find((it) => it.configFileName === tsconfig)
  if (project === undefined) {
    api.close()
    throw new Error(`no project loaded for ${tsconfig}`)
  }
  const checker = project.checker

  const exportsOf = (relativePath) => {
    const file = project.program.getSourceFile(join(PKG, relativePath))
    if (file === undefined) return null
    const symbol = checker.getSymbolAtLocation(file)
    return symbol === undefined ? null : checker.getExportsOfModule(symbol)
  }

  const barrelExports = exportsOf(barrel)
  if (barrelExports === null) {
    api.close()
    throw new Error(`${barrel} is not in the program, so nothing could be called public`)
  }
  const publicNames = new Set(barrelExports.map((it) => it.name))

  const modules = options.modules ?? defaultModules(PKG)
  const sections = []
  let documented = 0
  let skipped = 0

  for (const relativePath of modules) {
    if (relativePath === barrel) continue
    const found = exportsOf(relativePath)
    if (found === null) continue
    const lines = readFileSync(join(PKG, relativePath), "utf8").split("\n")
    const entries = []
    for (const symbol of found) {
      if (!publicNames.has(symbol.name)) {
        skipped++
        continue
      }
      const line = declarationLine(lines, symbol.name)
      const type = isType(symbol.flags)
        ? declarationText(lines, line)
        : signatureOf(checker, symbol)
      entries.push({
        name: symbol.name,
        kind: kindOf(symbol.flags),
        line,
        doc: prose(String(checker.getDocumentationCommentOfSymbol(symbol) ?? "")),
        text: overloadText(lines, line, symbol.name) ?? type,
      })
      documented++
    }
    if (entries.length === 0) continue
    entries.sort((left, right) => left.line - right.line)
    sections.push({ module: relativePath, headline: headlineOf(lines), entries })
  }

  api.close()

  const out = join(PKG, options.out)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, render(options, sections))
  return { file: relative(PKG, out), modules: sections.length, exports: documented, private: skipped }
}

function signatureOf(checker, symbol) {
  try {
    return checker.typeToString(checker.getTypeOfSymbol(symbol))
  } catch {
    return "unknown"
  }
}

/** The module's own first prose line, when its header is a comment rather than an import. */
function headlineOf(lines) {
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === "") continue
    if (!trimmed.startsWith("//")) return null
    const text = trimmed.replace(/^\/\/\s?/, "")
    if (text.startsWith("@")) continue
    return text
  }
  return null
}

function defaultModules(pkg) {
  const dir = join(pkg, "src")
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((it) => it.endsWith(".ts"))
    .filter((it) => !it.includes(".test.") && !it.includes(".bench.") && !it.includes(".memory."))
    .sort((left, right) => numberOf(left) - numberOf(right) || left.localeCompare(right))
    .map((it) => `src/${it}`)
}

const numberOf = (name) => {
  const digits = /^(\d+)_/.exec(name)
  return digits === null ? Number.MAX_SAFE_INTEGER : Number(digits[1])
}

function render(options, sections) {
  const out = [`# ${options.title}`, ""]
  if (options.intro !== undefined) out.push(options.intro, "")
  out.push(
    "Read out of the TypeScript program by `packages/docs-kit/scripts/api.mjs`: the barrel names what is public, each module answers for what it declares, and the checker answers for every signature. Editing this file by hand is editing the thing that overwrites it.",
    "",
  )

  out.push("## Modules", "")
  out.push("| module | exports | what it is |", "| --- | --- | --- |")
  for (const section of sections) {
    out.push(
      `| [${section.module}](#${anchorOf(section.module)}) | ${section.entries.length} | ${escapeCell(section.headline ?? "")} |`,
    )
  }
  out.push("")

  for (const section of sections) {
    out.push(`## ${section.module}`, "")
    if (section.headline !== null) out.push(section.headline, "")
    out.push("| export | kind |", "| --- | --- |")
    for (const entry of section.entries) {
      out.push(`| [\`${entry.name}\`](#${anchorOf(entry.name)}) | ${entry.kind} |`)
    }
    out.push("")
    for (const entry of section.entries) {
      out.push(`### \`${entry.name}\``, "")
      if (entry.line > 0) out.push(`\`${entry.name}\` is declared at \`${section.module}:${entry.line}\`.`, "")
      if (entry.doc !== "") out.push(entry.doc, "")
      out.push("```ts", entry.text, "```", "")
    }
  }
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n")}\n`
}
