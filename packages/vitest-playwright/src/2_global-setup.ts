// pkg:global-setup: the serve slot. Runs in the vitest controller; provides baseURL to workers.
import { type ChildProcess, spawn } from "node:child_process"
import { existsSync, readdirSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { type Observable, of } from "rxjs"
import { KEY, type ServeOptions } from "./0_options.js"
import { acquire, type Resource, resource$ } from "./5_streams.js"

type ServeState = { baseURL: string | undefined }
// vitest: the globalSetup argument (TestProject). Declared locally for the same reason as 1_plugin's TestBlock.
type Provider = { provide: (key: typeof KEY.baseURL, value: string | undefined) => void }
const idle = (baseURL: string | undefined): Observable<Resource<ServeState>> =>
  of({ value: { baseURL }, close: async () => {} })

async function ready(url: string, timeoutMs: number, child?: ChildProcess): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let exited: string | undefined
  child?.once("exit", code => {
    exited = `command exited with ${code} before ${url} answered`
  })
  while (Date.now() < deadline) {
    if (exited) throw new Error(exited)
    try {
      const r = await fetch(url)
      if (r.status < 400) return
    } catch {}
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error(`serve: ${url} did not answer within ${timeoutMs}ms`)
}

function newest(dir: string): number {
  let t = 0
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = resolve(d, e.name)
      if (e.isDirectory()) {
        if (e.name !== "node_modules" && e.name !== "dist") walk(p)
      } else t = Math.max(t, statSync(p).mtimeMs)
    }
  }
  if (existsSync(dir)) walk(dir)
  return t
}

function serve$(s: ServeOptions | null): Observable<Resource<ServeState>> {
  if (!s) return idle(undefined)
  if (s.kind === "url") return idle(s.url)
  if (s.kind === "command")
    return resource$<ServeState & { child: ChildProcess }>(
      async () => {
        const child = spawn(s.command, {
          shell: true,
          detached: true,
          stdio: "inherit",
          cwd: s.cwd,
          env: { ...process.env, ...s.env },
        })
        await ready(s.url, s.readyTimeoutMs ?? 30_000, child)
        return { baseURL: s.url, child }
      },
      async ({ child }) => {
        if (child.exitCode !== null) return
        const exit = new Promise<void>(r => child.once("exit", () => r()))
        const group = child.pid ? -child.pid : undefined
        try {
          if (group) process.kill(group, "SIGTERM")
          else child.kill("SIGTERM")
        } catch {
          child.kill("SIGTERM")
        }
        await Promise.race([exit, new Promise(r => setTimeout(r, 5000).unref())])
        if (child.exitCode === null && group) {
          try {
            process.kill(group, "SIGKILL")
          } catch {}
        }
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
      const preview = await vite.preview({
        ...s.build,
        preview: { ...(s.build.preview ?? {}), port: s.build.preview?.port ?? 0, strictPort: false },
      })
      const baseURL = preview.resolvedUrls?.local[0]
      if (!baseURL) throw new Error("vitest-playwright: vite preview resolved no local URL")
      return { baseURL, preview }
    },
    async ({ preview }) => {
      await preview?.close()
    },
  )
}

export default async function globalSetup(ctx: Provider): Promise<() => Promise<void>> {
  const raw = process.env.VITEST_PLAYWRIGHT_SERVE
  const s: ServeOptions | null = raw ? JSON.parse(raw) : null
  const h = await acquire(serve$(s))
  try {
    ctx.provide(KEY.baseURL, h.value.baseURL)
  } catch (e) {
    await h.release()
    throw e
  }
  return () => h.release()
}
