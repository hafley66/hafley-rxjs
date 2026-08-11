import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "node:child_process"
const command = new URL("../bin/layout-grid-wasm.mjs", import.meta.url)
test("Rust/Wasm worker emits deterministic geometry", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "grapht-wasm-"))
  const request = { protocol: "grapht-bench/0", runId: "test-wasm", fixture: "tiny", operation: "layout", input: JSON.stringify({ nodeIds: ["a", "b", "c"], edges: [[0, 1], [0, 2]] }), outputDirectory, parameters: { spacing: 10, margin: 5 } }
  const child = spawn(process.execPath, [command.pathname], { stdio: ["pipe", "pipe", "pipe"] }); child.stdin.end(`${JSON.stringify(request)}\n`); let stdout = ""; let stderr = ""; child.stdout.on("data", (chunk) => { stdout += chunk }); child.stderr.on("data", (chunk) => { stderr += chunk }); const code = await new Promise((resolve) => child.on("close", resolve)); assert.equal(code, 0, stderr)
  const records = stdout.trim().split("\n").map((line) => JSON.parse(line)); assert.equal(records.filter((record) => record.type === "sample").length, 6); assert.equal(records.at(-1).type, "result"); assert.equal(records.at(-1).counters.nodes, 3); assert.equal(JSON.parse(await readFile(join(outputDirectory, "geometry.manifest.json"), "utf8")).nodeCount, 3); await rm(outputDirectory, { recursive: true, force: true })
})
