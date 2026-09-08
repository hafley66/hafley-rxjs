import { spawnSync } from "node:child_process"
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const ROOT = resolve(import.meta.dirname, "..")

// A real package copy. All scaffold/build writes land in tmp; dependencies stay in the workspace.
export function scaffoldFixture() {
  const temp = mkdtempSync(join(tmpdir(), "gothic-scaffold-test-"))
  const cwd = join(temp, "gothic")
  mkdirSync(cwd)
  for (const file of ["src", "scripts", "index.html", "package.json", "tsconfig.json", "vite.config.ts"]) {
    cpSync(join(ROOT, file), join(cwd, file), { recursive: true })
  }
  symlinkSync(join(ROOT, "node_modules"), join(cwd, "node_modules"), "dir")
  symlinkSync(resolve(ROOT, "../report-shell"), join(temp, "report-shell"), "dir")
  const command = (bin: string, args: string[]) => {
    const result = spawnSync(bin, args, { cwd, encoding: "utf8", timeout: 60_000, env: { ...process.env, LC_ALL: "C" } })
    if (result.error) throw result.error
    return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() }
  }
  return {
    cwd,
    command,
    run: (...args: string[]) => command("/bin/bash", ["scripts/0_scaffold.sh", ...args]),
    read: (file: string) => readFileSync(join(cwd, file), "utf8"),
    algo: (id: string) => {
      const file = readdirSync(join(cwd, "src/algos")).find(f => f.endsWith(`_${id}.ts`))
      if (!file) throw new Error(`missing Algo: ${id}`)
      return file.slice(0, -3)
    },
    sources: () => Object.fromEntries(
      readdirSync(join(cwd, "src"), { recursive: true, withFileTypes: true })
        .filter(f => f.isFile())
        .map(f => join(f.parentPath, f.name))
        .sort()
        .map(f => [f.slice(cwd.length + 1), readFileSync(f, "utf8")]),
    ),
    unsubscribe: () => rmSync(temp, { recursive: true, force: true }),
  }
}
