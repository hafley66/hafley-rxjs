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

/** An import or a re-export names a symbol it does not declare, and neither does a comment. */
const BORROWS = /\bfrom\s*["']|^\s*(?:\/\/|\/?\*)/

/** The 1-based line a symbol is declared on, preferring its declaration, or `0` when it is absent.
 * The same rule `scripts/docs.mjs` uses, so a generated citation and the lint agree. */
function declarationLine(lines, name) {
  let first = 0
  for (let index = 0; index < lines.length; index++) {
    const text = lines[index]
    if (!wordIn(text, name) || BORROWS.test(text)) continue
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

/** The first `export function name` line in a module, or `0`. */
function functionLine(lines, name) {
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? ""
    if (/^export\s+(?:declare\s+)?function\b/.test(line) && wordIn(line, name)) return index + 1
  }
  return 0
}

/** Every consecutive `export function name` line above the body, so an overload set stays whole.
 * The implementation signature ends with an open paren and is the one a caller never sees. */
function overloadText(lines, from, name) {
  const signatures = []
  for (let index = from - 1; index < lines.length; index++) {
    const line = lines[index] ?? ""
    if (!wordIn(line, name)) break
    if (!/^export\s+(?:declare\s+)?function\b/.test(line)) break
    signatures.push(line.replace(/\s*\{\s*$/, ""))
  }
  while (signatures.length > 1 && /\($/.test(signatures.at(-1))) signatures.pop()
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
  // A package with several entry points has several barrels. A name is public when any of them
  // exports it, and every barrel stays out of the page's own module list.
  const barrels = options.barrels ?? [options.barrel ?? "src/index.ts"]

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

  const publicNames = new Set()
  for (const entry of barrels) {
    const found = exportsOf(entry)
    if (found === null) {
      api.close()
      throw new Error(`${entry} is not in the program, so nothing could be called public`)
    }
    for (const symbol of found) publicNames.add(symbol.name)
  }

  const modules = options.modules ?? defaultModules(PKG)
  const sections = []
  let documented = 0
  let skipped = 0

  for (const relativePath of modules) {
    const found = exportsOf(relativePath)
    if (found === null) continue
    const lines = readFileSync(join(PKG, relativePath), "utf8").split("\n")
    const entries = []
    for (const symbol of found) {
      if (!publicNames.has(symbol.name)) {
        skipped++
        continue
      }
      // A `export * from` re-export answers with the original symbol, flags and all, so a barrel
      // would claim every name under it. The module that declares one is the one whose text has it.
      const line = declarationLine(lines, symbol.name)
      if (line === 0) {
        skipped++
        continue
      }
      entries.push({
        name: symbol.name,
        kind: kindOf(symbol.flags),
        line,
        doc: prose(String(checker.getDocumentationCommentOfSymbol(symbol) ?? "")),
        text: textOf(checker, symbol, lines, line),
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

/** What goes in the fence. A value renders as `name: <what the checker resolved>`, which is a
 * declaration a reader can paste. A type renders as its own source, because a declared type's
 * string is just its name, and a name that is both gets the type and the call signatures. */
function textOf(checker, symbol, lines, line) {
  const overloads = overloadText(lines, line, symbol.name)
  if (overloads !== null) return overloads
  if (!isType(symbol.flags)) return `${symbol.name}: ${signatureOf(checker, symbol)}`
  const declared = declarationText(lines, line)
  const call = functionLine(lines, symbol.name)
  if (call === 0) return declared
  return `${declared}\n\n${overloadText(lines, call, symbol.name) ?? lines[call - 1].replace(/\s*\{\s*$/, "")}`
}

function signatureOf(checker, symbol) {
  try {
    return checker.typeToString(checker.getTypeOfSymbol(symbol))
  } catch {
    return "unknown"
  }
}

/** The module's own first sentence, when its header is a comment rather than an import. A `@`
 * directive and the lines it wraps onto are scanner input rather than prose, so both are skipped. */
function headlineOf(lines) {
  const prose = []
  let inDirective = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === "") break
    if (!trimmed.startsWith("//")) break
    const text = trimmed.replace(/^\/\/\s?/, "")
    if (text.startsWith("@")) {
      inDirective = true
      continue
    }
    if (inDirective && /^[a-z]/.test(text)) continue
    inDirective = false
    if (text === "") break
    prose.push(text)
    if (/[.!?]$/.test(text)) break
  }
  if (prose.length === 0) return null
  const joined = prose.join(" ")
  const stop = /[.!?](\s|$)/.exec(joined)
  return stop === null ? joined : joined.slice(0, stop.index + 1)
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
  // Two names in one module can slug the same way: `Signal` and `Signal$` both lose the `$`.
  // VitePress refuses a duplicate heading id, so the second one takes a suffix.
  const taken = new Map()
  const unique = (candidate) => {
    const count = (taken.get(candidate) ?? 0) + 1
    taken.set(candidate, count)
    return count === 1 ? candidate : `${candidate}-${count}`
  }
  for (const section of sections) {
    for (const entry of section.entries) entry.anchor = unique(anchorOf(`${section.module}-${entry.name}`))
  }

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
      out.push(`| [\`${entry.name}\`](#${entry.anchor}) | ${entry.kind} |`)
    }
    out.push("")
    for (const entry of section.entries) {
      out.push(`### \`${entry.name}\` {#${entry.anchor}}`, "")
      if (entry.line > 0) out.push(`\`${entry.name}\` is declared at \`${section.module}:${entry.line}\`.`, "")
      if (entry.doc !== "") out.push(entry.doc, "")
      out.push("```ts", entry.text, "```", "")
    }
  }
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n")}\n`
}
