#!/usr/bin/env node
// Assemble the whole gh-pages tree: the shell at the root, one subdirectory per package in
// pages/manifest.ts. Building is the default and it never touches the remote. `--publish` pushes,
// and refuses unless PAGES_PUBLISH=1 is also set.
//
//   node scripts/pages.mjs                      build and verify into out/pages
//   PAGES_PUBLISH=1 node scripts/pages.mjs --publish
import { execFileSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { REPO_BASE, SITES } from "../pages/manifest.ts"

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const OUT = join(ROOT, "out", "pages")
const SHELL_DIST = join(ROOT, "pages", "dist")
const REWRITABLE = new Set([".html", ".js", ".css"])

const publish = process.argv.includes("--publish")
const failures = []

const run = (command, args, options = {}) =>
  execFileSync(command, args, { cwd: ROOT, stdio: "inherit", ...options, env: { ...process.env, ...(options.env ?? {}) } })

const walk = (dir) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))

const measure = (dir) => {
  if (!existsSync(dir)) return { files: 0, bytes: 0 }
  const files = walk(dir)
  return { files: files.length, bytes: files.reduce((sum, file) => sum + statSync(file).size, 0) }
}

const kb = (bytes) => (bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} kB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`)

/**
 * A site whose vite `base` is "/" emits `/assets/...`, which 404s once the site lives in a
 * subdirectory. Each build gets PAGES_BASE in its environment so a config can honour it; this
 * retargets whatever came out ignoring it, and reports the count so the shim stays visible.
 */
function retargetRootAbsoluteAssets(dir, prefix) {
  let touched = 0
  for (const file of walk(dir)) {
    const dot = file.lastIndexOf(".")
    if (!REWRITABLE.has(file.slice(dot))) continue
    const before = readFileSync(file, "utf8")
    const after = before.replaceAll('"/assets/', `"${prefix}assets/`).replaceAll("'/assets/", `'${prefix}assets/`).replaceAll("(/assets/", `(${prefix}assets/`)
    if (after === before) continue
    writeFileSync(file, after)
    touched++
  }
  return touched
}

/**
 * Every root-absolute URL a site's own files still point at from outside its subdirectory. On Pages
 * those resolve against the origin, not the site, so each one is a 404 waiting for a visitor. This
 * only reports: the file that emitted the URL belongs to that package's lane, not to this script.
 */
function auditRootAbsolute(dir, prefix) {
  const strays = new Set()
  for (const file of walk(dir)) {
    const dot = file.lastIndexOf(".")
    if (!REWRITABLE.has(file.slice(dot))) continue
    for (const match of readFileSync(file, "utf8").matchAll(/(?:src|href)=["'](\/[^"']*)["']/g)) {
      const url = match[1]
      if (url.startsWith(prefix) || url.startsWith("//")) continue
      strays.add(url)
    }
  }
  return [...strays]
}

// ---- build ---------------------------------------------------------------------------------
console.log("")
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

console.log("  shell    vite build pages/vite.config.ts")
run("npx", ["vite", "build", "-c", "pages/vite.config.ts"])
console.log("  strip    vite build pages/vite.config.ts --mode strip")
run("npx", ["vite", "build", "-c", "pages/vite.config.ts", "--mode", "strip"])

const rows = []
for (const site of SITES) {
  const prefix = `${REPO_BASE}${site.slug}/`
  console.log(`\n  ${site.slug}  ${site.build}`)
  run("sh", ["-c", site.build], { env: { PAGES_BASE: prefix } })
  const source = join(ROOT, site.dist)
  if (!existsSync(source)) {
    failures.push(`${site.slug}: build produced no ${site.dist}`)
    continue
  }
  const target = join(OUT, site.slug)
  cpSync(source, target, { recursive: true })
  const retargeted = retargetRootAbsoluteAssets(target, prefix)
  const strays = auditRootAbsolute(target, prefix)
  rows.push({ slug: site.slug, ...measure(target), retargeted, strays })
}

// The shell lands last so nothing a package build wrote can shadow the root document.
cpSync(SHELL_DIST, OUT, { recursive: true })
writeFileSync(join(OUT, ".nojekyll"), "")
rows.unshift({ slug: "(shell)", ...measure(SHELL_DIST), retargeted: 0, strays: [] })

// ---- guards --------------------------------------------------------------------------------
for (const site of SITES) {
  const dir = join(OUT, site.slug)
  const size = measure(dir)
  if (size.files === 0) failures.push(`${site.slug}: out/pages/${site.slug}/ is empty`)
}

const rootIndex = join(OUT, "index.html")
if (!existsSync(rootIndex)) {
  failures.push("out/pages/index.html is missing")
} else {
  const html = readFileSync(rootIndex, "utf8")
  if (!html.includes("data-hub-cards")) failures.push("out/pages/index.html is not the shell (no data-hub-cards host)")
  if (/<title>gothic/i.test(html)) failures.push("out/pages/index.html is gothic, not the shell")
}
if (!existsSync(join(OUT, "gothic", "index.html"))) failures.push("out/pages/gothic/index.html is missing")

// strip.js is what makes the tab row the zeroth tab rather than a hub-only widget, and package
// sites load it with a bare <script src>. It has to exist, stay import-free, and stay small.
const STRIP_LIMIT = 4096
const strip = join(OUT, "strip.js")
if (!existsSync(strip)) {
  failures.push("out/pages/strip.js is missing")
} else {
  const size = statSync(strip).size
  if (size > STRIP_LIMIT) failures.push(`out/pages/strip.js is ${size} bytes, over the ${STRIP_LIMIT} byte budget`)
  if (/\bimport\s*[("]/.test(readFileSync(strip, "utf8"))) failures.push("out/pages/strip.js carries an import a package site would have to resolve")
}

// ---- report --------------------------------------------------------------------------------
const total = measure(OUT)
console.log("")
console.log("  slug           files      bytes   note")
console.log("  ------------  ------  ---------  --------------------")
for (const row of rows) {
  const parts = []
  if (row.retargeted > 0) parts.push(`${row.retargeted} file(s) retargeted off /assets/`)
  if (row.strays.length > 0) parts.push(`${row.strays.length} root-absolute url(s)`)
  console.log(`  ${row.slug.padEnd(12)}  ${String(row.files).padStart(6)}  ${kb(row.bytes).padStart(9)}  ${parts.join(", ")}`)
}
console.log("  ------------  ------  ---------")
console.log(`  ${"out/pages".padEnd(12)}  ${String(total.files).padStart(6)}  ${kb(total.bytes).padStart(9)}`)
console.log("")

if (failures.length > 0) {
  for (const failure of failures) console.error(`  FAIL  ${failure}`)
  console.error("")
  process.exit(1)
}
console.log(`  ok  ${SITES.length} sites, shell at the root, .nojekyll written`)
for (const row of rows) {
  for (const stray of row.strays) console.log(`  warn  ${row.slug} points at ${stray}, which resolves off the site root on Pages`)
}

// ---- publish -------------------------------------------------------------------------------
if (!publish) {
  console.log("  next  PAGES_PUBLISH=1 node scripts/pages.mjs --publish")
  console.log("")
  process.exit(0)
}
if (process.env.PAGES_PUBLISH !== "1") {
  console.error("\n  refusing: --publish also needs PAGES_PUBLISH=1 in the environment\n")
  process.exit(1)
}

const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim()
const remote = execFileSync("git", ["remote", "get-url", "origin"], { cwd: ROOT, encoding: "utf8" }).trim()
const staging = mkdtempSync(join(tmpdir(), "hafley-pages-"))
try {
  const site = join(staging, "site")
  execFileSync("git", ["init", "--quiet", "--initial-branch=gh-pages", site], { stdio: "inherit" })
  execFileSync("git", ["-C", site, "remote", "add", "origin", remote], { stdio: "inherit" })
  try {
    execFileSync("git", ["-C", site, "fetch", "--quiet", "--depth=1", "origin", "gh-pages"], { stdio: "inherit" })
    execFileSync("git", ["-C", site, "checkout", "--quiet", "-B", "gh-pages", "FETCH_HEAD"], { stdio: "inherit" })
    for (const entry of readdirSync(site)) {
      if (entry === ".git") continue
      rmSync(join(site, entry), { recursive: true, force: true })
    }
  } catch {
    console.log("  note  no gh-pages on the remote yet, publishing the first commit")
  }
  cpSync(OUT, site, { recursive: true })
  execFileSync("git", ["-C", site, "add", "--all"], { stdio: "inherit" })
  const message = `pages: publish the shell and ${SITES.length} package sites from ${revision}\n`
  execFileSync("git", ["-C", site, "commit", "--quiet", "-m", message], { stdio: "inherit" })
  execFileSync("git", ["-C", site, "push", "origin", "HEAD:refs/heads/gh-pages"], { stdio: "inherit" })
  console.log(`\n  published  https://hafley66.github.io${REPO_BASE}\n`)
} finally {
  rmSync(staging, { recursive: true, force: true })
}
