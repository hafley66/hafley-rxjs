import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const prepack = "pnpm --workspace-root exec node scripts/0_prepack.mjs"

async function manifests(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const output = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const file = join(directory, entry.name, "package.json")
    try {
      output.push({ file, value: JSON.parse(await readFile(file, "utf8")) })
    } catch (error) {
      if (error?.code !== "ENOENT") throw error
    }
  }
  return output
}

const packages = [
  ...await manifests(resolve(root, "packages")),
  ...await manifests(resolve(root, "packages/grapht/adapters")),
].filter(({ value }) => value.private !== true)

const invalid = packages.flatMap(({ file, value }) => {
  const errors = []
  if (value.scripts?.prepack !== prepack) errors.push(`${file}: prepack must use the common release gate`)
  if (!value.scripts?.build) errors.push(`${file}: public package requires scripts.build`)
  if (!Array.isArray(value.files) || value.files.length === 0) errors.push(`${file}: public package requires an explicit files allowlist`)
  if (!value.version) errors.push(`${file}: public package requires a version`)
  return errors
})
if (invalid.length) {
  console.error(invalid.join("\n"))
  process.exit(1)
}

if (process.argv.includes("--structure-only")) {
  console.log(`${packages.length} public package manifests use the common release gate`)
  process.exit(0)
}

const destination = await mkdtemp(join(tmpdir(), "hafley-release-check-"))
try {
  for (const { value } of packages) {
    const packed = spawnSync("pnpm", ["--filter", value.name, "pack", "--pack-destination", destination], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    })
    if (packed.status !== 0) process.exit(packed.status ?? 1)
    const tarball = packed.stdout.trim().split("\n").at(-1)
    if (!tarball) throw new Error(`${value.name}: pack produced no tarball`)
    const attw = spawnSync("pnpm", ["exec", "attw", "--profile", "esm-only", tarball], { cwd: root, stdio: "inherit" })
    if (attw.status !== 0) process.exit(attw.status ?? 1)
    console.log(`${value.name}: ${basename(tarball)}`)
  }
} finally {
  await rm(destination, { recursive: true, force: true })
}
