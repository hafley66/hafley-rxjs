import { dirname } from "node:path"
import { spawnSync } from "node:child_process"

const packageJson = process.env.npm_package_json
if (!packageJson) throw new Error("npm_package_json is required")
const cwd = dirname(packageJson)

function run(command, args) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run("pnpm", ["run", "build"])
run("pnpm", ["--workspace-root", "exec", "publint", cwd])
