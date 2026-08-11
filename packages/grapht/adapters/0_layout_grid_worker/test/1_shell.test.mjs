import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "node:child_process"
const root = new URL("..", import.meta.url)
const command = new URL("bin/layout-grid-worker.mjs", root)
test("JSONL shell emits samples and a terminal result with geometry", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "grapht-worker-"))
  const input = JSON.stringify({ protocol: "grapht-bench/0", runId: "test-worker", fixture: "tiny", operation: "layout", input: JSON.stringify({ nodeIds: ["a", "b"], edges: [[0, 1]] }), outputDirectory, parameters: { spacing: 10, margin: 2 } }) + "\n"
  const child = spawn(process.execPath, [command.pathname], { stdio: ["pipe", "pipe", "pipe"] })
  child.stdin.end(input)
  let stdout = ""; let stderr = ""
  child.stdout.on("data", (chunk) => { stdout += chunk })
  child.stderr.on("data", (chunk) => { stderr += chunk })
  const code = await new Promise((resolve) => child.on("close", resolve))
  assert.equal(code, 0, stderr)
  const records = stdout.trim().split("\n").map((line) => JSON.parse(line))
  assert.equal(records.filter((record) => record.type === "sample").length, 6)
  const result = records.at(-1)
  assert.equal(result.type, "result")
  assert.equal(result.runId, "test-worker")
  assert.equal(result.counters.nodes, 2)
  assert.deepEqual(JSON.parse(await readFile(join(outputDirectory, "geometry.manifest.json"), "utf8")).nodeCount, 2)
  await rm(outputDirectory, { recursive: true, force: true })
})
