import {
  isProxyTreeNumericKey,
  type ProxyTree,
  type ProxyTreeApply,
  type ProxyTreeFinalizer,
  type ProxyTreeNodeContext,
  type ProxyTreeType,
  type ProxyTreeWeakReference,
  type ProxyTreeWeakRuntime,
} from "./0_ProxyTree.js"

const ROOT = Symbol("ProxyTreeThin.root")
const PARENT = Symbol("ProxyTreeThin.parent")
const KEY = Symbol("ProxyTreeThin.key")
const DENSE_CHILDREN = Symbol("ProxyTreeThin.denseChildren")
const SPARSE_CHILDREN = Symbol("ProxyTreeThin.sparseChildren")

const MAX_DENSE_GAP = 64

type RootRecord = {
  createNode(parent?: NodeTarget, key?: string): object
  finalizer: ProxyTreeFinalizer<NumericReference, object>
  weakRuntime: ProxyTreeWeakRuntime
  root?: object
}

type NodeTarget = Record<PropertyKey, unknown> & {
  [ROOT]?: RootRecord
  [PARENT]?: NodeTarget
  [KEY]?: string
  [DENSE_CHILDREN]?: Array<NumericReference | undefined>
  [SPARSE_CHILDREN]?: Map<string, NumericReference>
}

type NumericReference = ProxyTreeWeakReference<object> & {
  cache: Array<NumericReference | undefined> | Map<string, NumericReference>
  key: number | string
}

const nodeHandler: ProxyHandler<NodeTarget> = {
  get(target, key, receiver) {
    if (Reflect.has(target, key)) return Reflect.get(target, key, receiver)
    if (typeof key === "symbol") return undefined

    if (isProxyTreeNumericKey(key)) {
      const root = rootOf(target)
      const index = Number(key)
      const dense = target[DENSE_CHILDREN]
      const sparse = target[SPARSE_CHILDREN]
      const cached = dense?.[index] ?? sparse?.get(key)
      const child = cached?.deref()
      if (child) return child

      const useDense = index <= (dense?.length ?? 0) + MAX_DENSE_GAP
      const cache = useDense
        ? target[DENSE_CHILDREN] ??= []
        : target[SPARSE_CHILDREN] ??= new Map()

      const created = root.createNode(target, key)
      const cacheKey = Array.isArray(cache) ? index : key
      const reference = Object.assign(root.weakRuntime.reference(created), {
        cache,
        key: cacheKey,
      })
      if (Array.isArray(cache)) cache[index] = reference
      else cache.set(key, reference)
      root.finalizer.register(created, reference, created)
      return created
    }

    const created = rootOf(target).createNode(target, key)
    target[key] = created
    return created
  },
}

function rootOf(node: NodeTarget): RootRecord {
  let current = node
  while (current[PARENT]) current = current[PARENT]
  return current[ROOT]!
}

function materializePath(node: NodeTarget): string[] {
  const path = new Array<string>(node[PARENT] ? pathDepth(node) : 0)
  let current: NodeTarget | undefined = node
  for (let index = path.length - 1; index >= 0; index--) {
    path[index] = current![KEY]!
    current = current![PARENT]
  }
  return path
}

function pathDepth(node: NodeTarget): number {
  let depth = 0
  for (let current = node[PARENT]; current; current = current[PARENT]) depth++
  return depth
}

const nativeWeakRuntime: ProxyTreeWeakRuntime = {
  reference: <T extends object>(value: T) => new WeakRef(value),
  finalizer: <HeldValue extends object, Token extends object>(
    cleanup: (heldValue: HeldValue) => void,
  ) => new FinalizationRegistry(cleanup),
}

export function createProxyTreeThin<
  T,
  Leaf extends ProxyTreeType,
  Extension extends ProxyTreeType,
>(options: {
  createLeaf(
    context: ProxyTreeNodeContext<T, Leaf, Extension>,
  ): ProxyTreeApply<Leaf, unknown>
  createExtension(
    context: ProxyTreeNodeContext<T, Leaf, Extension>,
  ): ProxyTreeApply<Extension, unknown>
  weakRuntime?: ProxyTreeWeakRuntime
}): ProxyTree<T, Leaf, Extension> {
  const weakRuntime = options.weakRuntime ?? nativeWeakRuntime
  const rootRecord = { weakRuntime } as RootRecord

  rootRecord.finalizer = weakRuntime.finalizer<NumericReference, object>(
    (reference) => {
      if (Array.isArray(reference.cache)) {
        const index = reference.key as number
        if (reference.cache[index] === reference) reference.cache[index] = undefined
        if (index === reference.cache.length - 1) {
          while (reference.cache.length && !reference.cache.at(-1)) reference.cache.length--
        }
      } else if (reference.cache.get(reference.key as string) === reference) {
        reference.cache.delete(reference.key as string)
      }
    },
  )

  rootRecord.createNode = (parent, key) => {
    const target = (parent
      ? { [PARENT]: parent, [KEY]: key }
      : { [ROOT]: rootRecord }) as NodeTarget
    const proxy = new Proxy(target, nodeHandler)
    if (!parent) rootRecord.root = proxy

    const context = {
      root: rootRecord.root as ProxyTree<T, Leaf, Extension>,
      node: proxy as unknown as ProxyTree<unknown, Leaf, Extension>,
      path: materializePath(target),
    }
    target.$ = options.createLeaf(context)
    Object.assign(target, options.createExtension(context))
    return proxy
  }

  return rootRecord.createNode() as ProxyTree<T, Leaf, Extension>
}
