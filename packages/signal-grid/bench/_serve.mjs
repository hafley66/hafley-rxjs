// The static server and the CDP metric read, shared by `bench/scroll.mjs` (one engine, every
// factor) and `bench/versus.mjs` (every engine, a few factors).
import { createReadStream, existsSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, normalize } from "node:path"

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".map": "application/json",
}

/** Serves `dist` on a loopback port the caller never has to choose. */
export async function serveDist(dist) {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0])).replace(/^(\.\.[/\\])+/, "")
    const file = join(dist, path === "/" ? "index.html" : path)
    if (!file.startsWith(dist) || !existsSync(file)) {
      res.writeHead(404).end("not found")
      return
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" })
    createReadStream(file).pipe(res)
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() }
}

export const METRICS = [
  "JSHeapUsedSize",
  "Nodes",
  "LayoutCount",
  "RecalcStyleCount",
  "LayoutDuration",
  "RecalcStyleDuration",
  "ScriptDuration",
  "TaskDuration",
]

/** Browser-side cost no page can time itself: layout, style recalc and the retained heap. A forced
 * collection precedes the read, so a heap delta is what survived rather than what churned. */
export async function metricsOf(cdp) {
  await cdp.send("HeapProfiler.collectGarbage")
  const { metrics } = await cdp.send("Performance.getMetrics")
  const out = {}
  for (const it of metrics) if (METRICS.includes(it.name)) out[it.name] = it.value
  return out
}
