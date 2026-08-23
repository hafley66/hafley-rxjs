import { describe, expect, expectTypeOf, it } from "vitest"
import {
  createProxyTree,
  type ProxyTreeFinalizer,
  type ProxyTreeType,
  type ProxyTreeWeakReference,
  type ProxyTreeWeakRuntime,
} from "./0_ProxyTree.js"

interface LeafType extends ProxyTreeType {
  readonly type: { value: this["value"]; path: readonly string[] }
}

interface ExtensionType extends ProxyTreeType {
  readonly type: { $field: { value: this["value"]; path: readonly string[] } }
}

function controlledWeakRuntime() {
  const references: Array<{ clear(): void }> = []
  const registrations: Array<{
    heldValue: object
    token: object
    cleanup(heldValue: object): void
  }> = []

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
        register(_target, heldValue, token) {
          registrations.push({
            heldValue,
            token,
            cleanup: cleanup as (heldValue: object) => void,
          })
        },
        unregister(token) {
          const index = registrations.findIndex((entry) => entry.token === token)
          if (index < 0) return false
          registrations.splice(index, 1)
          return true
        },
      }
    },
  }

  return {
    runtime,
    collect(index: number) {
      references[index].clear()
      const registration = registrations[index]
      registration.cleanup(registration.heldValue)
    },
    finalize(index: number) {
      const registration = registrations[index]
      registration.cleanup(registration.heldValue)
    },
  }
}

describe("createProxyTree", () => {
  it("recursively applies leaf and extension types", () => {
    const tree = createProxyTree<
      { rows?: Array<{ name: string }> },
      LeafType,
      ExtensionType
    >({
      createLeaf: ({ path }) => ({ value: undefined, path }),
      createExtension: ({ path }) => ({ $field: { value: undefined, path } }),
    })

    expectTypeOf(tree.$.value).toEqualTypeOf<{ rows?: Array<{ name: string }> }>()
    expectTypeOf(tree.rows[0].name.$.value).toEqualTypeOf<string | undefined>()
    expectTypeOf(tree.rows[0].name.$field.value).toEqualTypeOf<string | undefined>()
  })

  it("creates each named child and extension once", () => {
    const created: string[] = []
    const tree = createProxyTree<{ user: { name: string } }, LeafType, ExtensionType>({
      createLeaf: ({ path }) => ({ value: undefined, path }),
      createExtension: ({ path }) => {
        created.push(path.join("/") || "root")
        return { $field: { value: undefined, path } }
      },
    })

    const first = tree.user.name
    const second = tree.user.name

    expect({ same: first === second, created }).toMatchInlineSnapshot(`
      {
        "created": [
          "root",
          "user",
          "user/name",
        ],
        "same": true,
      }
    `)
  })

  it("holds numeric children weakly and reconstructs collected nodes", () => {
    const weak = controlledWeakRuntime()
    const created: string[] = []
    const tree = createProxyTree<Array<{ name: string }>, LeafType, ExtensionType>({
      createLeaf: ({ path }) => ({ value: undefined, path }),
      createExtension: ({ path }) => {
        created.push(path.join("/") || "root")
        return { $field: { value: undefined, path } }
      },
      weakRuntime: weak.runtime,
    })

    const first = tree[12]
    const firstName = first.name
    expect(tree[12]).toBe(first)

    weak.collect(0)
    const second = tree[12]

    expect({
      childReconstructed: second.name !== firstName,
      reconstructed: second !== first,
      created,
    }).toMatchInlineSnapshot(`
      {
        "childReconstructed": true,
        "created": [
          "root",
          "12",
          "12/name",
          "12",
          "12/name",
        ],
        "reconstructed": true,
      }
    `)
  })

  it("does not let an old finalizer remove a replacement numeric child", () => {
    const weak = controlledWeakRuntime()
    const tree = createProxyTree<Array<string>, LeafType, ExtensionType>({
      createLeaf: ({ path }) => ({ value: undefined, path }),
      createExtension: ({ path }) => ({ $field: { value: undefined, path } }),
      weakRuntime: weak.runtime,
    })

    void tree[4]
    weak.collect(0)
    const replacement = tree[4]
    weak.finalize(0)

    expect(tree[4]).toBe(replacement)
  })
})
