import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

const size = Number(process.argv[2])
const output = resolve(process.argv[3] ?? new URL("../.cache/render-fixtures", import.meta.url).pathname, `grid-${size}.json`)
if (!Number.isSafeInteger(size) || size < 1) throw new Error(`invalid node count: ${process.argv[2]}`)

const columns = Math.ceil(Math.sqrt(size))
const nodes = Array.from({ length: size }, (_, index) => ({
  id: `n${Math.floor(index / columns)}_${index % columns}`,
  x: (index % columns) * 10,
  y: Math.floor(index / columns) * 10,
}))
const edges = []
for (let index = 0; index < size; index++) {
  const column = index % columns
  if (column + 1 < columns && index + 1 < size) edges.push([index, index + 1])
  if (index + columns < size) edges.push([index, index + columns])
}
const fixture = {
  protocol: "grapht-render-fixture/0",
  id: `grid-${size}`,
  nodeCount: size,
  edgeCount: edges.length,
  nodes,
  edges,
}
await mkdir(dirname(output), { recursive: true })
await writeFile(output, JSON.stringify(fixture), "utf8")
process.stdout.write(`${output}\n`)
