import { createProxyTree, type ProxyTreeType } from "./0_ProxyTree.js"
import { createProxyTreeThin } from "./0_ProxyTreeThin.js"

interface LeafType extends ProxyTreeType {
  readonly type: object
}

interface ExtensionType extends ProxyTreeType {
  readonly type: object
}

const count = Number(process.argv[3] ?? 200_000)
const implementation = process.argv[2]
const singletonLeaf = Object.freeze({})
const singletonExtension = Object.freeze({})
const retained = new Array<object>(count)

if (!global.gc) throw new Error("run with node --expose-gc")

for (let index = 0; index < 4; index++) global.gc()
const before = process.memoryUsage().heapUsed

const factory = implementation === "thin" ? createProxyTreeThin : createProxyTree
const tree = factory<Array<unknown>, LeafType, ExtensionType>({
  createLeaf: () => singletonLeaf,
  createExtension: () => singletonExtension,
})

for (let index = 0; index < count; index++) retained[index] = tree[index]
for (let index = 0; index < 4; index++) global.gc()

const bytes = process.memoryUsage().heapUsed - before
console.log(JSON.stringify({ implementation, count, bytes, bytesPerNode: bytes / count }))

void retained
void tree
