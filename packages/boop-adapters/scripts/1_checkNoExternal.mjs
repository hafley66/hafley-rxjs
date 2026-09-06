#!/usr/bin/env node
// Fails if the built report references any external src="http…"/href="http…" resource: the
// report must be one self-contained file, openable via file://.
import { readFileSync } from "node:fs"

const path = process.argv[2]
if (!path) {
  console.error("usage: 1_checkNoExternal.mjs <html-file>")
  process.exit(1)
}
const html = readFileSync(path, "utf8")
const matches = html.match(/(?:src|href)="http[^"]*"/g) ?? []
if (matches.length) {
  console.error(`${path} references external resources:\n${matches.join("\n")}`)
  process.exit(1)
}
console.log(`${path}: 0 external references`)
