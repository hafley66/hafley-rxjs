import { describe, expect, it } from "vitest"
import {
  type ProxyTreeFinalizer,
  type ProxyTreeType,
  type ProxyTreeWeakReference,
  type ProxyTreeWeakRuntime,
} from "./0_ProxyTree.js"
import { createProxyTreeThin } from "./0_ProxyTreeThin.js"

interface LeafType extends ProxyTreeType {
  readonly type: { path: readonly string[] }
}

interface ExtensionType extends ProxyTreeType {
  readonly type: { $field: { path: readonly string[] } }
}

describe("createProxyTreeThin", () => {
  it("shares behavior while preserving node identity and paths", () => {
    const tree = createProxyTreeThin<
      { users: Array<{ name: string }> },
      LeafType,
      ExtensionType
    >({
      createLeaf: ({ path }) => ({ path }),
      createExtension: ({ path }) => ({ $field: { path } }),
    })

    expect({
      same: tree.users[3].name === tree.users[3].name,
      leafPath: tree.users[3].name.$.path,
      extensionPath: tree.users[3].name.$field.path,
    }).toMatchInlineSnapshot(`
      {
        "extensionPath": [
          "users",
          "3",
          "name",
        ],
        "leafPath": [
          "users",
          "3",
          "name",
        ],
        "same": true,
      }
    `)
  })

  it("reconstructs a numeric subtree after its weak reference clears", () => {
    let clear: (() => void) | undefined
    const weakRuntime: ProxyTreeWeakRuntime = {
      reference<T extends object>(value: T): ProxyTreeWeakReference<T> {
        let current: T | undefined = value
        clear = () => { current = undefined }
        return { deref: () => current }
      },
      finalizer<HeldValue extends object, Token extends object>(): ProxyTreeFinalizer<
        HeldValue,
        Token
      > {
        return { register() {}, unregister: () => true }
      },
    }
    const tree = createProxyTreeThin<Array<{ name: string }>, LeafType, ExtensionType>({
      createLeaf: ({ path }) => ({ path }),
      createExtension: ({ path }) => ({ $field: { path } }),
      weakRuntime,
    })

    const first = tree[8]
    const firstName = first.name
    clear!()
    const second = tree[8]

    expect({ node: second !== first, subtree: second.name !== firstName }).toMatchInlineSnapshot(`
      {
        "node": true,
        "subtree": true,
      }
    `)
  })

  it("preserves a sparse child when its index later enters the dense window", () => {
    const tree = createProxyTreeThin<Array<string>, LeafType, ExtensionType>({
      createLeaf: ({ path }) => ({ path }),
      createExtension: ({ path }) => ({ $field: { path } }),
    })

    const sparse = tree[100]
    for (let index = 0; index < 100; index++) void tree[index]

    expect(tree[100]).toBe(sparse)
  })
})
