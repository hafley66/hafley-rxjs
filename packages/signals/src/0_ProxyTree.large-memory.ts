import lodash from "lodash"
import { performance } from "node:perf_hooks"
import { createProxyTree, type ProxyTreeType } from "./0_ProxyTree.js"
import { createProxyTreeThin } from "./0_ProxyTreeThin.js"

interface LeafType extends ProxyTreeType {
  readonly type: object
}

interface ExtensionType extends ProxyTreeType {
  readonly type: object
}

type Row = {
  id: number
  value: number
  nested: {
    enabled: boolean
    label: string
  }
}

type Fixture = Record<string, Row[]>

const { get, transform } = lodash
const mode = process.argv[2]
const arrayCount = Number(process.argv[3] ?? 100)
const rowsPerArray = Number(process.argv[4] ?? 200)
const rowCount = arrayCount * rowsPerArray
const singletonLeaf = Object.freeze({})
const singletonExtension = Object.freeze({})

if (!global.gc) throw new Error("run with node --expose-gc")

const fixture: Fixture = {}
for (let arrayIndex = 0; arrayIndex < arrayCount; arrayIndex++) {
  fixture[`group_${arrayIndex}`] = Array.from({ length: rowsPerArray }, (_, rowIndex) => ({
    id: arrayIndex * rowsPerArray + rowIndex,
    value: rowIndex,
    nested: {
      enabled: rowIndex % 2 === 0,
      label: `row_${rowIndex}`,
    },
  }))
}

if (mode === "fat" || mode === "thin") {
  const factory = mode === "thin" ? createProxyTreeThin : createProxyTree
  const warm = factory<Array<unknown>, LeafType, ExtensionType>({
    createLeaf: () => singletonLeaf,
    createExtension: () => singletonExtension,
  })
  void warm[0]
} else if (mode === "lodash-get") {
  void get(fixture, ["group_0", 0, "id"])
} else if (mode === "lodash-transform") {
  void transform(
    { value: 1 },
    (result: Record<string, number>, value, key) => { result[key] = value },
    {},
  )
}

;(globalThis as typeof globalThis & { __proxyFixture?: Fixture }).__proxyFixture = fixture
for (let index = 0; index < 4; index++) global.gc()
const before = process.memoryUsage().heapUsed
const started = performance.now()
let retained: unknown
let visited = 0

if (mode === "fat" || mode === "thin") {
  const factory = mode === "thin" ? createProxyTreeThin : createProxyTree
  const tree = factory<Fixture, LeafType, ExtensionType>({
    createLeaf: () => singletonLeaf,
    createExtension: () => singletonExtension,
  })
  const leaves: object[] = []

  for (let arrayIndex = 0; arrayIndex < arrayCount; arrayIndex++) {
    const rows = tree[`group_${arrayIndex}`]
    for (let rowIndex = 0; rowIndex < rowsPerArray; rowIndex++) {
      const row = rows[rowIndex]
      leaves.push(row.id, row.value, row.nested.enabled, row.nested.label)
      visited += 4
    }
  }
  retained = { tree, leaves }
} else if (mode === "lodash-get") {
  let checksum = 0
  for (let arrayIndex = 0; arrayIndex < arrayCount; arrayIndex++) {
    for (let rowIndex = 0; rowIndex < rowsPerArray; rowIndex++) {
      checksum += get(fixture, [`group_${arrayIndex}`, rowIndex, "id"]) as number
      checksum += get(fixture, [`group_${arrayIndex}`, rowIndex, "value"]) as number
      checksum += Number(get(fixture, [`group_${arrayIndex}`, rowIndex, "nested", "enabled"]))
      checksum += (get(fixture, [`group_${arrayIndex}`, rowIndex, "nested", "label"]) as string).length
      visited += 4
    }
  }
  retained = checksum
} else if (mode === "lodash-transform") {
  const recursiveTransform = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return transform(
        value,
        (result: unknown[], item, index) => {
          result[index] = recursiveTransform(item)
          visited++
        },
        [],
      )
    }
    if (value && typeof value === "object") {
      return transform(
        value as Record<string, unknown>,
        (result: Record<string, unknown>, item, key) => {
          result[key] = recursiveTransform(item)
          visited++
        },
        {},
      )
    }
    return value
  }
  retained = recursiveTransform(fixture)
} else {
  throw new Error(`unknown mode: ${mode}`)
}

const elapsedMs = performance.now() - started
;(globalThis as typeof globalThis & { __proxyRetained?: unknown }).__proxyRetained = retained
for (let index = 0; index < 4; index++) global.gc()
const bytes = process.memoryUsage().heapUsed - before

console.log(JSON.stringify({
  mode,
  arrayCount,
  rowsPerArray,
  rowCount,
  visited,
  bytes,
  bytesPerRow: bytes / rowCount,
  elapsedMs,
}))

void retained
void fixture
