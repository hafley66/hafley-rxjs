import { readFile } from "node:fs/promises"

if (typeof global.gc !== "function") throw new Error("run with --expose-gc")
const bytes = await readFile(process.argv[2])
for (let index = 0; index < 4; index++) global.gc()
const before = process.memoryUsage().heapUsed
const fixture = JSON.parse(bytes.toString("utf8"))
for (let index = 0; index < 4; index++) global.gc()
const after = process.memoryUsage().heapUsed
const checksum = fixture.nodes.reduce((sum, node) => sum + node.x + node.y, 0)
process.stdout.write(`${JSON.stringify({
  nodeCount: fixture.nodeCount,
  edgeCount: fixture.edgeCount,
  jsonBytes: bytes.byteLength,
  jsParsedHeapDeltaBytes: after - before,
  coordinateChecksum: checksum,
})}\n`)
