import { dirname, join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"

// `pnpm --workspace-root` breaks under changeset publish: the outer pnpm exports
// its config into the env and the nested pnpm rejects the flag. Resolve on disk.
function workspaceRoot(from) {
  let dir = from
  for (; ; dir = dirname(dir)) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir
    if (dirname(dir) === dir) throw new Error("pnpm-workspace.yaml not found above " + from)
  }
}

// argv[2] = package dir for manual runs; else the lifecycle env decides. The
// spawns drop npm_package_*/INIT_CWD: a stale shell env would retarget them.
const arg = process.argv[2]
const packageJson = arg ? join(resolve(arg), "package.json") : process.env.npm_package_json
if (!packageJson) throw new Error("pass a package dir or run from a lifecycle hook")
const cwd = dirname(packageJson)

const cleanEnv = { ...process.env }
for (const key of Object.keys(cleanEnv)) {
  if (/^npm_package_/.test(key) || key === "INIT_CWD") delete cleanEnv[key]
}

function run(command, args, dir = cwd) {
  const result = spawnSync(command, args, { cwd: dir, env: cleanEnv, stdio: "inherit", shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run("pnpm", ["run", "build"])
run("pnpm", ["exec", "publint", cwd], workspaceRoot(cwd))
