#!/usr/bin/env node
// The lint lives in `@hafley66/docs-kit`. This names what is grapht-specific: the documents it
// sweeps and where the rendered site pages land.
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { runDocs } from "@hafley66/docs-kit/scripts/docs"

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const WORKSPACE = resolve(PKG, "../..")

runDocs({
  pkg: PKG,
  workspace: WORKSPACE,
  dist: join(PKG, "docs", "dist"),
  files: ["README.md"],
  roots: [
    { dir: "docs", suffix: ".md" },
    { dir: "site", suffix: ".ts" },
  ],
  indexed: ["src", "site", "docs", "scripts", "."],
  testDirectories: ["tests"],
})
