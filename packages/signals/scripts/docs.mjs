#!/usr/bin/env node
// The lint lives in `@hafley66/docs-kit`. This names what is signals-specific: the documents it
// sweeps and the one data file it transcludes numbers from.
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { runDocs } from "@hafley66/docs-kit/scripts/docs"

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const WORKSPACE = resolve(PKG, "../..")

const readJson = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined)

runDocs({
  pkg: PKG,
  workspace: WORKSPACE,
  dist: join(PKG, "docs", "dist"),
  files: ["README.md", "GUIDE.md"],
  roots: [
    { dir: "docs", suffix: ".md" },
    { dir: "site", suffix: ".ts" },
    { dir: "examples", suffix: ".ts" },
  ],
  indexed: ["src", "site", "docs", "scripts", "examples", "."],
  testDirectories: ["src"],
  data: { stats: readJson(join(PKG, "site", "stats.json")) },
})
