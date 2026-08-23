export type ProxyTreeDepth = [never, 0, 1, 2, 3, 4, 5, 6]

export interface ProxyTreeType {
  readonly value: unknown
  readonly type: unknown
}

export type ProxyTreeApply<Type extends ProxyTreeType, Value> = (
  Type & { readonly value: Value }
)["type"]

type IsNullish<T> = null extends T ? true : undefined extends T ? true : false

type NestedValue<T, Key> = IsNullish<T> extends true
  ? Key extends keyof NonNullable<T>
    ? NonNullable<T>[Key] | undefined
    : never
  : Key extends keyof T
    ? T[Key]
    : never

type IsRecursive<T> = NonNullable<T> extends Record<string, unknown>
  ? NonNullable<T> extends never
    ? 0
    : 1
  : NonNullable<T> extends unknown[]
    ? 1
    : 0

export type ProxyTree<
  T,
  Leaf extends ProxyTreeType,
  Extension extends ProxyTreeType,
  Depth extends number = 5,
> = {
  $: ProxyTreeApply<Leaf, T>
} & ProxyTreeApply<Extension, T> & (Depth extends never
  ? unknown
  : IsRecursive<NonNullable<T>> extends 1
    ? {
        [Key in keyof NonNullable<T>]-?: ProxyTree<
          NestedValue<T, Key>,
          Leaf,
          Extension,
          ProxyTreeDepth[Depth]
        >
      } & (NonNullable<T> extends unknown[]
        ? Record<
            number,
            ProxyTree<NestedValue<T, number>, Leaf, Extension, ProxyTreeDepth[Depth]>
          >
        : unknown)
    : unknown)

export type ProxyTreeNodeContext<
  T,
  Leaf extends ProxyTreeType,
  Extension extends ProxyTreeType,
> = {
  root: ProxyTree<T, Leaf, Extension>
  node: ProxyTree<unknown, Leaf, Extension>
  path: readonly string[]
}

export type ProxyTreeWeakReference<T extends object> = {
  deref(): T | undefined
}

export type ProxyTreeFinalizer<HeldValue extends object, Token extends object> = {
  register(target: object, heldValue: HeldValue, unregisterToken: Token): void
  unregister(unregisterToken: Token): boolean
}

export type ProxyTreeWeakRuntime = {
  reference<T extends object>(value: T): ProxyTreeWeakReference<T>
  finalizer<HeldValue extends object, Token extends object>(
    cleanup: (heldValue: HeldValue) => void,
  ): ProxyTreeFinalizer<HeldValue, Token>
}

const nativeWeakRuntime: ProxyTreeWeakRuntime = {
  reference: <T extends object>(value: T) => new WeakRef(value),
  finalizer: <HeldValue extends object, Token extends object>(
    cleanup: (heldValue: HeldValue) => void,
  ) => new FinalizationRegistry(cleanup),
}

export function isProxyTreeNumericKey(key: PropertyKey): key is string {
  if (typeof key !== "string") return false
  const number = Number(key)
  return Number.isSafeInteger(number) && number >= 0 && String(number) === key
}

export function createProxyTree<
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
  type Node = ProxyTree<unknown, Leaf, Extension>
  type WeakEntry = { reference: ProxyTreeWeakReference<Node>; token: object }
  type FinalizerHeldValue = {
    cache: Map<string, WeakEntry>
    key: string
    token: object
  }

  const weakRuntime = options.weakRuntime ?? nativeWeakRuntime
  const finalizer = weakRuntime.finalizer<FinalizerHeldValue, object>(({ cache, key, token }) => {
    if (cache.get(key)?.token === token) cache.delete(key)
  })

  let root: ProxyTree<T, Leaf, Extension>

  const createNode = (path: string[]): Node => {
    const target: Record<PropertyKey, unknown> = {}
    const numericChildren = new Map<string, WeakEntry>()
    const strongChildren = new Map<PropertyKey, Node>()
    const proxy = new Proxy(target, {
      get(nodeTarget, key, receiver) {
        if (Reflect.has(nodeTarget, key)) return Reflect.get(nodeTarget, key, receiver)
        if (typeof key === "symbol") return undefined

        if (isProxyTreeNumericKey(key)) {
          const cached = numericChildren.get(key)
          const child = cached?.reference.deref()
          if (child) return child

          if (cached) finalizer.unregister(cached.token)
          const created = createNode([...path, key])
          const token = {}
          numericChildren.set(key, {
            reference: weakRuntime.reference(created),
            token,
          })
          finalizer.register(created, { cache: numericChildren, key, token }, token)
          return created
        }

        const cached = strongChildren.get(key)
        if (cached) return cached
        const created = createNode([...path, key])
        strongChildren.set(key, created)
        return created
      },
    }) as Node

    if (path.length === 0) root = proxy as ProxyTree<T, Leaf, Extension>
    const context = { root, node: proxy, path }
    target.$ = options.createLeaf(context)
    Object.assign(target, options.createExtension(context))
    return proxy
  }

  return createNode([]) as ProxyTree<T, Leaf, Extension>
}
