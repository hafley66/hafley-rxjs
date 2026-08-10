/**
 * Module Scope for HMR
 *
 * Vite plugin wraps each module with:
 *   const __$ = _rxjs_debugger_module_start(import.meta.url)
 *   // ... module code using __$("key", fn), __$.sub("key", fn) ...
 *   __$.end()
 *
 * The __$ instance carries module context via closure.
 * Keys are concatenated with ":" for nested scopes.
 */
// noRxjs()
import type { Subscription } from "rxjs"
import { decorateCreate, main } from "../0_runtime/0_store"
import { __$ as baseTrack } from "./0_runtime"

export const ___rxjs_hmr_key___ = Symbol("___rxjs_hmr_key___")
export interface ModuleScope {
  // Track observable/pipe creation - same as __$
  <T>(key: string, factory: () => T): T
  <T>(key: string, factory: ($: ModuleScope) => T): T

  // Track subscription creation
  sub(key: string, factory: () => Subscription): Subscription

  fn<T>(key: string, it: T): T

  // Signal module evaluation complete - triggers dangling cleanup
  end(): void

  // Internal
  readonly module_id: string
}

/**
 * Entry point for Vite plugin. Called at top of each transformed module.
 * Returns a scoped __$ that carries module context.
 */
export function _rxjs_debugger_module_start(url: string): ModuleScope {
  const module_id = url

  // Enable tracking when a module starts
  const prev = main.state$.value.isEnabled
  main.emit({ type: "enable" })
  // Emit module start event - accumulator handles everything
  main.emit({ type: "hmr-module-call", id: module_id, url })
  // Create callable function that wraps baseTrack with key prefixing
  const createScope = (parentKey: string): ModuleScope => {
    const scope = (<T>(key: string, factory: (($: ModuleScope) => T) | (() => T)): T => {
      const fullKey = parentKey ? `${parentKey}:${key}` : key

      // Call baseTrack which handles the actual tracking logic
      return baseTrack(fullKey, () => {
        // Check if factory wants a child scope
        if (factory.length > 0) {
          // Factory takes a scope param - create child scope
          const childScope = createScope(fullKey)
          const val = (factory as ($: ModuleScope) => T)(childScope)
          if (val && typeof val === "object") {
            ;(val as Record<PropertyKey, unknown>)[___rxjs_hmr_key___] = fullKey
          }
          return val
        }
        const val = (factory as () => T)()
        if (val && typeof val === "object") {
          ;(val as Record<PropertyKey, unknown>)[___rxjs_hmr_key___] = fullKey
        }
        return val
      })
    }) as ModuleScope

    // Add .sub() method for subscription tracking
    scope.sub = (_key: string, factory: () => Subscription): Subscription => {
      // Just call factory - subscribe-call event will be emitted by patched Observable
      // The accumulator will stamp module_id from stack
      return factory()
    }

    // Add .end() method - only valid on root scope
    scope.end = () => {
      main.emit({ type: "hmr-module-call-return", id: module_id })
      main.emit({ type: prev ? "enable" : "disable" })
    }

    scope.fn = <T>(key: string, it: T) => {
      if (typeof it === "function") {
        return decorateCreate(it, key)
      }
      return it
    }

    // Add readonly property
    Object.defineProperty(scope, "module_id", { value: module_id, writable: false })

    return scope
  }

  return createScope("")
}

// Re-export for convenience
export { __$ } from "./0_runtime"
