// pkg:global-setup: the serve slot. Runs in the vitest controller; provides baseURL to workers.
import { spawn, type ChildProcess } from "node:child_process"
import { existsSync, readdirSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { of } from "rxjs"
import { KEY, type ServeOptions } from "./0_options.js"
import { acquire, resource$, type Handle } from "./5_streams.js"

interface ServeState { baseURL: string | undefined }

async function ready(url: string, timeoutMs: number, child?: ChildProcess): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let exited: string | undefined
  child?.once("exit", code => { exited = `command exited with ${code} before ${url} answered` })
  while (Date.now() < deadline) {
    if (exited) throw new Error(exited)
    try { const r = await fetch(url); if (r.status < 400) return } catch {}
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error(`serve: ${url} did not answer within ${timeoutMs}ms`)
}

function newest(dir: string): number {
  let t = 0
  const walk = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = resolve(d, e.name); if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== "dist") walk(p) } else t = Math.max(t, statSync(p).mtimeMs) } }
  if (existsSync(dir)) walk(dir)
  return t
}

function serve$(s: ServeOptions | null) {
  if (!s) return of<{ value: ServeState; close: () => Promise<void> }>({ value: { baseURL: undefined }, close: async () => {} })
  if (s.kind === "url") return of({ value: { baseURL: s.url }, close: async () => {} })
  if (s.kind === "command") return resource$<ServeState & { child: ChildProcess }>(
    async () => {
      const child = spawn(s.command, { shell: true, detached: true, stdio: "inherit", cwd: s.cwd, env: { ...process.env, ...s.env } })
      await ready(s.url, s.readyTimeoutMs ?? 30_000, child)
      return { baseURL: s.url, child }
    },
    async ({ child }) => {
      if (child.exitCode !== null) return
      const exit = new Promise<void>(r => child.once("exit", () => r()))
      try { process.kill(-child.pid!, "SIGTERM") } catch { child.kill("SIGTERM") }
      await Promise.race([exit, new Promise(r => setTimeout(r, 5000).unref())])
      if (child.exitCode === null) { try { process.kill(-child.pid!, "SIGKILL") } catch {} }
    },
  )
  return resource$<ServeState & { preview?: import("vite").PreviewServer }>(
    async () => {
      const vite = await import("vite")
      const root = s.build.root ?? process.cwd()
      const outDir = resolve(root, s.build.build?.outDir ?? "dist")
      const skip = s.reuseExisting && existsSync(outDir) && newest(outDir) >= newest(resolve(root, "src"))
      if (!skip) await vite.build({ ...s.build, mode: s.mode ?? s.build.mode, logLevel: s.build.logLevel ?? "warn" })
      if (s.serve === "file") return { baseURL: pathToFileURL(resolve(outDir, s.entry ?? "index.html")).href }
      const preview = await vite.preview({ ...s.build, preview: { ...(s.build.preview ?? {}), port: s.build.preview?.port ?? 0, strictPort: false } })
      return { baseURL: preview.resolvedUrls!.local[0], preview }
    },
    async ({ preview }) => { await preview?.close() },
  )
}

export default async function globalSetup(ctx: { provide: (k: any, v: any) => void }): Promise<() => Promise<void>> {
  const raw = process.env.VITEST_PLAYWRIGHT_SERVE
  const s: ServeOptions | null = raw ? JSON.parse(raw) : null
  const h: Handle<ServeState> = await acquire(serve$(s) as any)
  try { ctx.provide(KEY.baseURL, h.value.baseURL) } catch (e) { await h.release(); throw e }
  return () => h.release()
}
