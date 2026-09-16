import { randomUUID } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { rolldown } from "rolldown"

/** Build a paired unpacked extension. All application configuration is supplied by the caller. */
export async function buildExtension({ outDir, token, url, matches, name = "bewpp", version = "0.1.0" }) {
  const endpoint = new URL(url)
  if (endpoint.protocol !== "ws:" || !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname))
    throw new Error("bewpp requires a loopback WebSocket URL.")
  if (!outDir || !token || !matches?.length) throw new Error("outDir, token, and site matches are required.")
  mkdirSync(outDir, { recursive: true })
  const define = {
    "process.env.NODE_ENV": '"production"',
    __BEWPP_BUILD__: JSON.stringify(randomUUID()),
    __BEWPP_TOKEN__: JSON.stringify(token),
    __BEWPP_URL__: JSON.stringify(url),
    __BEWPP_MATCHES__: JSON.stringify(matches),
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
        permissions: ["scripting", "alarms"],
        host_permissions: [...new Set([...matches, `http://${endpoint.hostname}/*`])],
        background: { service_worker: "worker.js", type: "module" },
        content_scripts: [
          { matches, js: ["page-hooks.js"], run_at: "document_start", world: "MAIN" },
          { matches, js: ["content.js"], run_at: "document_idle", world: "ISOLATED" },
        ],
      },
      null,
      2,
    )}\n`,
  )
  return outDir
}
