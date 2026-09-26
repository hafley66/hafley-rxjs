import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { runInNewContext } from "node:vm"
import { rolldown } from "rolldown"

/**
 * Playwright's selector engine, taken from the pinned playwright-core rather than sent by a caller.
 * The package bundles it as a string literal inside coreBundle.js and exports no path to it.
 */
function playwrightEngineSource() {
  const bundle = readFileSync(
    join(dirname(createRequire(import.meta.url).resolve("playwright-core/package.json")), "lib/coreBundle.js"),
    "utf8",
  )
  const at = bundle.indexOf('"packages/playwright-core/src/generated/injectedScriptSource.ts"() {')
  const assignment = at < 0 ? null : /source\d+ = '/.exec(bundle.slice(at))
  if (!assignment) throw new Error("playwright-core no longer bundles injectedScriptSource; re-derive the extraction.")
  const start = at + assignment.index + assignment[0].length - 1
  let end = start + 1
  while (bundle[end] !== "'") end += bundle[end] === "\\" ? 2 : 1
  const source = runInNewContext(bundle.slice(start, end + 1))
  if (!source.includes("InjectedScript")) throw new Error("Extracted engine source does not define InjectedScript.")
  return source
}

/** Build a paired unpacked extension. All application configuration is supplied by the caller. */
export async function buildExtension({ outDir, token, url, matches, excludeMatches = [], name = "bewpp", version = "0.1.0" }) {
  const endpoint = new URL(url)
  if (endpoint.protocol !== "ws:" || !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname))
    throw new Error("bewpp requires a loopback WebSocket URL.")
  if (!outDir || !token || !matches?.length) throw new Error("outDir, token, and site matches are required.")
  mkdirSync(outDir, { recursive: true })
  // Loaded via executeScript({files}) because a Trusted-Types page gates `new Function`.
  // modern-screenshot only reads innerHTML; html-to-image writes it at clone-node.js:195.
  const shot = await rolldown({
    input: createRequire(import.meta.url).resolve("modern-screenshot"),
    platform: "browser",
    transform: { target: "chrome120" },
  })
  const shotOutput = await shot.generate({ format: "iife", name: "__bewppShotLib", codeSplitting: false })
  await shot.close()
  writeFileSync(
    join(outDir, "screenshot.js"),
    `${shotOutput.output[0].code}\nglobalThis.__bewppShot = __bewppShotLib.default ?? __bewppShotLib;\n`,
  )
  // The bundle's esbuild __export stores each export as an arrow that returns it.
  writeFileSync(
    join(outDir, "engine.js"),
    `(() => {\nconst module = { exports: {} };\n${playwrightEngineSource()}\n;globalThis.__bewppEngineClass = module.exports.InjectedScript();\n})();\n`,
  )
  const define = {
    "process.env.NODE_ENV": '"production"',
    __BEWPP_BUILD__: JSON.stringify(randomUUID()),
    __BEWPP_TOKEN__: JSON.stringify(token),
    __BEWPP_URL__: JSON.stringify(url),
    __BEWPP_MATCHES__: JSON.stringify(matches),
    __BEWPP_EXCLUDES__: JSON.stringify(excludeMatches),
  }
  for (const [entry, file, format] of [
    ["2_content.ts", "content.js", "iife"],
    ["2_page_hooks.ts", "page-hooks.js", "iife"],
    ["2_worker.ts", "worker.js", "esm"],
  ]) {
    const bundle = await rolldown({
      input: fileURLToPath(new URL(`./extension/${entry}`, import.meta.url)),
      platform: "browser",
      transform: { target: "chrome120", define },
    })
    try {
      await bundle.write({ file: join(outDir, file), format, codeSplitting: false })
    } finally {
      await bundle.close()
    }
  }
  writeFileSync(
    join(outDir, "manifest.json"),
    `${JSON.stringify(
      {
        manifest_version: 3,
        name,
        version,
        minimum_chrome_version: "120",
        description: "Browser controls over a local extension worker and content-script message bridge.",
        permissions: ["scripting", "alarms", "webNavigation"],
        host_permissions: [...new Set([...matches, `http://${endpoint.hostname}/*`])],
        background: { service_worker: "worker.js", type: "module" },
        content_scripts: [
          { matches, exclude_matches: excludeMatches, js: ["page-hooks.js"], run_at: "document_start", world: "MAIN" },
          { matches, exclude_matches: excludeMatches, js: ["engine.js", "content.js"], run_at: "document_idle", world: "ISOLATED" },
        ],
      },
      null,
      2,
    )}\n`,
  )
  return outDir
}
