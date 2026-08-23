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

function controlledWeakRuntime() {
  const references: Array<{ clear(): void }> = []
  const registrations: Array<{ heldValue: object; cleanup(value: object): void }> = []
  const runtime: ProxyTreeWeakRuntime = {
    reference<T extends object>(value: T): ProxyTreeWeakReference<T> {
      let current: T | undefined = value
      const reference = {
        deref: () => current,
        clear: () => { current = undefined },
      }
      references.push(reference)
      return reference
    },
    finalizer<HeldValue extends object, Token extends object>(
      cleanup: (heldValue: HeldValue) => void,
    ): ProxyTreeFinalizer<HeldValue, Token> {
      return {
        register(_target, heldValue) {
          registrations.push({
            heldValue,
            cleanup: cleanup as (value: object) => void,
          })
        },
        unregister: () => false,
      }
    },
  }
  return {
    runtime,
    clear(index: number) { references[index].clear() },
    finalize(index: number) {
      const registration = registrations[index]
      registration.cleanup(registration.heldValue)
    },
  }
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

  it("does not let a delayed finalizer delete a replacement numeric child", () => {
    const weak = controlledWeakRuntime()
    const tree = createProxyTreeThin<Array<string>, LeafType, ExtensionType>({
      createLeaf: ({ path }) => ({ path }),
      createExtension: ({ path }) => ({ $field: { path } }),
      weakRuntime: weak.runtime,
    })

    void tree[4]
    weak.clear(0)
    const replacement = tree[4]
    weak.finalize(0)

    expect(tree[4]).toBe(replacement)
  })
})
