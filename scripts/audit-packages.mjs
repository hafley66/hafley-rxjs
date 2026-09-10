#!/usr/bin/env node
// Workspace package audit. Reads every workspace package.json plus its src/ tree
// and prints markdown tables. Read-only: it never writes a file.
// Usage: node scripts/audit-packages.mjs [--json]

import { readFileSync, existsSync, globSync, readdirSync, statSync } from "node:fs"
import { join, dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { builtinModules } from "node:module"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const BUILTIN = new Set([...builtinModules, ...builtinModules.map(m => `node:${m}`)])

// Runtime singletons: a library that ships one of these as a hard dependency
// forces a second copy into the consumer's graph. They belong in peerDependencies.
const SINGLETONS = new Set(["react", "react-dom", "rxjs", "vite", "vitest", "pixi.js", "playwright", "mermaid"])

const SCRIPT_VERBS = ["build", "test", "typecheck", "receipts", "lint"]
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const SKIP_DIR = new Set(["node_modules", "dist", "target", ".git", "coverage", "out"])

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function workspaceGlobs() {
  const yaml = readFileSync(join(ROOT, "pnpm-workspace.yaml"), "utf8")
  const globs = []
  for (const line of yaml.split("\n")) {
    const m = line.match(/^\s*-\s*["']?([^"'\s]+)["']?\s*$/)
    if (m && m[1].includes("packages/")) globs.push(m[1])
    if (/^[a-zA-Z]/.test(line) && !line.startsWith("packages:") && globs.length) break
  }
  return globs
}

function packageDirs() {
  const dirs = new Set()
  for (const g of workspaceGlobs()) {
    for (const p of globSync(`${g}/package.json`, { cwd: ROOT })) dirs.add(dirname(p))
  }
  return [...dirs].sort()
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIR.has(entry.name)) continue
      walk(join(dir, entry.name), out)
    } else if (SOURCE_EXT.test(entry.name)) {
      out.push(join(dir, entry.name))
    }
  }
  return out
}

const SPEC_RE = /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*|^\s*import\s+)["']([^"'\n]+)["']/gm
const PKG_NAME_RE = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/

function specifierToPackage(spec) {
  if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("~")) return null
  if (BUILTIN.has(spec) || spec.startsWith("node:")) return null
  const parts = spec.split("/")
  const name = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]
  if (/^\d+$/.test(name)) return null
  return PKG_NAME_RE.test(name) ? name : null
}

// Comments quote import statements often enough to poison the scan.
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)\/\/[^\n]*/g, "$1")
}

function importedPackages(dir) {
  const found = new Map() // package -> first file that imports it
  for (const file of walk(dir)) {
    const text = stripComments(readFileSync(file, "utf8"))
    for (const m of text.matchAll(SPEC_RE)) {
      const pkg = specifierToPackage(m[1])
      if (pkg && !found.has(pkg)) found.set(pkg, relative(ROOT, file))
    }
  }
  return found
}

function exportTargets(exportsField) {
  const targets = []
  const visit = value => {
    if (typeof value === "string") targets.push(value)
    else if (value && typeof value === "object") for (const v of Object.values(value)) visit(v)
  }
  visit(exportsField)
  return targets
}

function audit() {
  const dirs = packageDirs()
  const manifests = new Map()
  for (const dir of dirs) manifests.set(dir, readJson(join(ROOT, dir, "package.json")))
  const nameToVersion = new Map()
  for (const pkg of manifests.values()) nameToVersion.set(pkg.name, pkg.version)

  const rows = []
  for (const dir of dirs) {
    const pkg = manifests.get(dir)
    const abs = join(ROOT, dir)
    const scripts = pkg.scripts ?? {}
    const deps = pkg.dependencies ?? {}
    const devDeps = pkg.devDependencies ?? {}
    const peerDeps = pkg.peerDependencies ?? {}
    const allDeclared = new Set([...Object.keys(deps), ...Object.keys(devDeps), ...Object.keys(peerDeps)])

    const entryProblems = []
    const targets = new Set()
    if (pkg.main) targets.add(pkg.main)
    if (pkg.types) targets.add(pkg.types)
    if (pkg.module) targets.add(pkg.module)
    for (const t of exportTargets(pkg.exports)) targets.add(t)
    for (const t of targets) {
      if (!t.startsWith(".")) continue
      if (!existsSync(join(abs, t))) entryProblems.push(`${t} missing on disk`)
    }
    const dot = pkg.exports?.["."]
    if (dot && typeof dot === "object") {
      if (pkg.types && dot.types && dot.types !== pkg.types) entryProblems.push(`types ${pkg.types} != exports["."].types ${dot.types}`)
      if (pkg.main && dot.import && dot.import !== pkg.main) entryProblems.push(`main ${pkg.main} != exports["."].import ${dot.import}`)
    }
    if (pkg.main && !pkg.exports) entryProblems.push("main without exports")
    if (!pkg.private) {
      const files = pkg.files
      if (!files) entryProblems.push("no files field")
      else {
        for (const t of targets) {
          if (!t.startsWith("./")) continue
          const top = t.slice(2).split("/")[0]
          if (!files.some(f => f === top || f.startsWith(`${top}/`) || f === t.slice(2))) {
            entryProblems.push(`${t} not covered by files`)
          }
        }
      }
    }

    const workspaceDeps = []
    for (const [field, block] of [["dependencies", deps], ["devDependencies", devDeps], ["peerDependencies", peerDeps]]) {
      for (const [name, range] of Object.entries(block)) {
        if (!nameToVersion.has(name)) continue
        workspaceDeps.push({ name, range, field, workspaceProtocol: range.startsWith("workspace:") })
      }
    }

    const imported = importedPackages(join(abs, "src"))
    const undeclared = []
    for (const [name, file] of imported) {
      if (name === pkg.name) continue
      if (allDeclared.has(name)) continue
      // a bare type-only specifier such as "mdast" resolves through its @types package
      if (allDeclared.has(`@types/${name.replace("@", "").replace("/", "__")}`)) continue
      undeclared.push({ name, file })
    }
    const importedAnywhere = importedPackages(abs)
    const unusedRuntime = Object.keys(deps).filter(name => !importedAnywhere.has(name))

    const depPeerProblems = []
    for (const name of Object.keys(peerDeps)) {
      if (deps[name]) depPeerProblems.push(`${name} in both peerDependencies and dependencies`)
      if (peerDeps[name].startsWith("workspace:")) depPeerProblems.push(`${name} peer range is ${peerDeps[name]}; a peer range must be a semver range`)
      if (!devDeps[name] && !deps[name]) depPeerProblems.push(`${name} peer is not installed as a devDependency`)
    }
    for (const name of Object.keys(deps)) {
      if (SINGLETONS.has(name) && !pkg.private) depPeerProblems.push(`${name} is a runtime singleton held as a dependency`)
    }

    rows.push({
      dir,
      name: pkg.name,
      version: pkg.version ?? "-",
      private: Boolean(pkg.private),
      published: !pkg.private,
      scripts: Object.fromEntries(SCRIPT_VERBS.map(v => [v, Boolean(scripts[v])])),
      entryProblems,
      workspaceDeps,
      undeclared,
      unusedRuntime,
      changelog: existsSync(join(abs, "CHANGELOG.md")),
      depPeerProblems,
    })
  }
  return rows
}

const rows = audit()

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(rows, null, 2))
  process.exit(0)
}

const yn = b => (b ? "yes" : "no")
const line = cells => `| ${cells.join(" | ")} |`

console.log(`# Package audit\n`)
console.log(`${rows.length} workspace packages, ${rows.filter(r => r.published).length} published, ${rows.filter(r => r.private).length} private.\n`)

console.log(`## Identity and scripts\n`)
console.log(line(["package", "version", "publish", "build", "test", "typecheck", "receipts", "lint"]))
console.log(line(["---", "---", "---", "---", "---", "---", "---", "---"]))
for (const r of rows) {
  console.log(line([r.name, r.version, r.published ? "published" : "private", yn(r.scripts.build), yn(r.scripts.test), yn(r.scripts.typecheck), yn(r.scripts.receipts), yn(r.scripts.lint)]))
}

console.log(`\n## Entry points: main, types, exports, files\n`)
console.log(line(["package", "finding"]))
console.log(line(["---", "---"]))
let entryCount = 0
for (const r of rows) for (const p of r.entryProblems) { console.log(line([r.name, p])); entryCount++ }
if (entryCount === 0) console.log(line(["-", "none"]))

console.log(`\n## Workspace dependencies not using the workspace protocol\n`)
console.log(line(["package", "field", "dependency", "declared range"]))
console.log(line(["---", "---", "---", "---"]))
let rangeCount = 0
for (const r of rows) for (const d of r.workspaceDeps) if (!d.workspaceProtocol) { console.log(line([r.name, d.field, d.name, d.range])); rangeCount++ }
if (rangeCount === 0) console.log(line(["-", "-", "-", "none"]))

console.log(`\n## Imported in src/ but declared nowhere\n`)
console.log(line(["package", "specifier", "first import site"]))
console.log(line(["---", "---", "---"]))
let undeclaredCount = 0
for (const r of rows) for (const u of r.undeclared) { console.log(line([r.name, u.name, u.file])); undeclaredCount++ }
if (undeclaredCount === 0) console.log(line(["-", "-", "none"]))

console.log(`\n## Runtime dependency declared but never imported\n`)
console.log(line(["package", "dependency"]))
console.log(line(["---", "---"]))
let unusedCount = 0
for (const r of rows) for (const u of r.unusedRuntime) { console.log(line([r.name, u])); unusedCount++ }
if (unusedCount === 0) console.log(line(["-", "none"]))

console.log(`\n## Published packages with no CHANGELOG.md\n`)
console.log(line(["package", "version"]))
console.log(line(["---", "---"]))
let clCount = 0
for (const r of rows) if (r.published && !r.changelog) { console.log(line([r.name, r.version])); clCount++ }
if (clCount === 0) console.log(line(["-", "none"]))

console.log(`\n## peerDependencies and dependencies\n`)
console.log(line(["package", "finding"]))
console.log(line(["---", "---"]))
let peerCount = 0
for (const r of rows) for (const p of r.depPeerProblems) { console.log(line([r.name, p])); peerCount++ }
if (peerCount === 0) console.log(line(["-", "none"]))

console.log(`\n## Totals\n`)
console.log(line(["check", "count"]))
console.log(line(["---", "---"]))
console.log(line(["packages", String(rows.length)]))
console.log(line(["missing build", String(rows.filter(r => !r.scripts.build).length)]))
console.log(line(["missing test", String(rows.filter(r => !r.scripts.test).length)]))
console.log(line(["missing typecheck", String(rows.filter(r => !r.scripts.typecheck).length)]))
console.log(line(["missing receipts", String(rows.filter(r => !r.scripts.receipts).length)]))
console.log(line(["entry point findings", String(entryCount)]))
console.log(line(["non workspace-protocol ranges", String(rangeCount)]))
console.log(line(["undeclared imports", String(undeclaredCount)]))
console.log(line(["unused runtime dependencies", String(unusedCount)]))
console.log(line(["published without CHANGELOG", String(clCount)]))
console.log(line(["peer/dependency findings", String(peerCount)]))
