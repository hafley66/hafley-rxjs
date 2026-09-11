#!/usr/bin/env node
// The lint lives in `@hafley66/docs-kit`. This names what is grid-specific: the documents it
// sweeps, the counted nouns, and the three data files it transcludes. See `docs/8_receipts.md`.
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { CORE_UNITS, runDocs } from "@hafley66/docs-kit/scripts/docs"

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const WORKSPACE = resolve(PKG, "../..")

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

runDocs({
  pkg: PKG,
  workspace: WORKSPACE,
  dist: join(PKG, "docs", "dist"),
  files: ["README.md", "PITCH.md"],
  roots: [
    { dir: "docs", suffix: ".md" },
    { dir: "site", suffix: ".ts" },
    { dir: "demo", suffix: ".ts" },
  ],
  // Written by `scripts/parity.mjs`, so linting its prose would lint the generator's own output.
  generated: ["docs/1_parity.md"],
  units: new Map([...CORE_UNITS, ["epics", "{{stats.epics.count}}"], ["features", "{{parity.features}}"]]),
  data: {
    stats: readJson(join(PKG, "site", "stats.json")),
    bench: benchData(),
    parity: readJson(join(PKG, "site", "parity.json")),
  },
})
