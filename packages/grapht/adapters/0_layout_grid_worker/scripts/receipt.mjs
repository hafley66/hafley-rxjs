import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { spawn } from "node:child_process"
const root = dirname(new URL(import.meta.url).pathname)
const outputDirectory = await mkdtemp(join(tmpdir(), "grapht-worker-receipt-"))
const request = { protocol: "grapht-bench/0", runId: "receipt-worker", fixture: "grid-1k", operation: "layout", outputDirectory, parameters: {} }
const child = spawn(process.execPath, [join(root, "..", "bin", "layout-grid-worker.mjs")], { cwd: join(root, ".."), stdio: ["pipe", "pipe", "pipe"] })
child.stdin.end(`${JSON.stringify(request)}\n`)
let stdout = ""; let stderr = ""
child.stdout.on("data", (chunk) => { stdout += chunk })
child.stderr.on("data", (chunk) => { stderr += chunk })
const code = await new Promise((resolve) => child.on("close", resolve))
const records = stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line))
const result = records.at(-1)
const receipt = { adapter: "layout-grid-worker", command: "JSONL stdin -> worker_threads -> geometry manifest", exitCode: code, sampleCount: records.filter((record) => record.type === "sample").length, result, stderr: stderr.trim(), manifest: result?.artifact ? JSON.parse(await readFile(join(outputDirectory, result.artifact), "utf8")) : null }
await writeFile(join(root, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`)
await rm(outputDirectory, { recursive: true, force: true })
process.stdout.write(`${JSON.stringify(receipt)}\n`)
if (code !== 0 || result?.type !== "result") process.exit(1)
