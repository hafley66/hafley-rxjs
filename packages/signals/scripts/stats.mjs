// Every number the site prints about itself. Signals measures nothing the kit does not already
// measure, so this is assembly and nothing else.
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { BUNDLE_METHOD, SITE_METHOD, createMeasure, reportStats } from "@hafley66/docs-kit/scripts/stats"

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = join(PKG, "site", "stats.json")
const REPO = "hafley66/hafley-rxjs"

const argv = process.argv.slice(2)
const bundlesOnly = argv.includes("--bundles")
const numberArg = (name) => {
  const found = argv.find((it) => it.startsWith(`--${name}=`))
  if (found === undefined) return null
  const value = Number(found.slice(name.length + 3))
  return Number.isFinite(value) ? value : null
}

const measure = createMeasure({
  pkg: PKG,
  repo: REPO,
  // The build writes these two, so measuring before writing them would report a clean checkout dirty.
  generated: ["packages/signals/site/stats.json", "packages/signals/docs/reference-api.md"],
})

const TREEMAP = {
  method: "rollup-plugin-visualizer is not wired into this package's vite config, so no treemap is produced",
  envFlag: "SIGNALS_TREEMAP=1",
  command: "not available",
}

function fullRun() {
  const startedAt = Date.now()
  const typecheck = measure.timed("npx", ["tsc", "--noEmit"])
  const libraryBuild = measure.timed("npx", ["vite", "build"])
  const tests = measure.testsGroup()
  const bundles = measure.siteBundles()

  return {
    schema: 1,
    generatedBy: "packages/signals/scripts/stats.mjs",
    commit: measure.commitGroup(),
    machine: measure.machineGroup(),
    package: measure.packageVersion(),
    bundle: {
      method: BUNDLE_METHOD,
      library: measure.libraryBundle(),
      siteMethod: SITE_METHOD,
      site: bundles.site,
      demo: bundles.demo,
      videos: bundles.videos,
      treemap: measure.treemapGroup(TREEMAP),
    },
    sizeLimit: measure.sizeLimitGroup(),
    source: measure.sourceGroup(),
    tests,
    timing: {
      method:
        "Date.now() around each execFileSync call in scripts/stats.mjs; the site build time is handed over by scripts/ship.mjs",
      typecheckMs: typecheck.ok ? typecheck.ms : null,
      typecheckReason: typecheck.ok ? null : "npx tsc --noEmit exited non-zero",
      libraryBuildMs: libraryBuild.ok ? libraryBuild.ms : null,
      libraryBuildReason: libraryBuild.ok ? null : "npx vite build exited non-zero",
      unitTestsMs: tests.unit.durationMs,
      browserTestsMs: tests.browser.durationMs,
      siteBuildMs: null,
      demoBuildMs: null,
      statsMs: Date.now() - startedAt,
    },
    demoMemory: measure.demoMemoryGroup(join("scripts", "examples.mjs")),
  }
}

// The site imports stats.json, so its own bundle size is only knowable after it is built.
// `ship.mjs` builds, calls `--bundles`, and builds again, which is why `SITE_METHOD` names the pass.
function bundlesRun() {
  if (!existsSync(OUT)) {
    throw new Error("scripts/stats.mjs --bundles needs an existing site/stats.json; run it without the flag first")
  }
  const previous = JSON.parse(readFileSync(OUT, "utf8"))
  const bundles = measure.siteBundles()
  return {
    ...previous,
    bundle: { ...previous.bundle, siteMethod: SITE_METHOD, site: bundles.site, demo: bundles.demo, videos: bundles.videos },
    timing: { ...previous.timing, siteBuildMs: numberArg("site-build-ms") ?? previous.timing.siteBuildMs },
  }
}

const stats = bundlesOnly ? bundlesRun() : fullRun()
writeFileSync(OUT, `${JSON.stringify(stats, null, 2)}\n`)
reportStats(stats, OUT, PKG, { bundlesOnly })
