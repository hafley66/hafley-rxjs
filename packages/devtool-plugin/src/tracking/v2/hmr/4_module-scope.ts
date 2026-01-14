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

import type { Subscription } from "rxjs"
import { isEnabled$ } from "../00.types"
import { emit } from "../01.patch-observable"
import { __$ as baseTrack } from "./0_runtime"

export interface ModuleScope {
  // Track observable/pipe creation - same as __$
  <T>(key: string, factory: () => T): T
  <T>(key: string, factory: ($: ModuleScope) => T): T

  // Track subscription creation
  sub(key: string, factory: () => Subscription): Subscription

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
  isEnabled$.next(true)

  // Emit module start event - accumulator handles everything
  emit({ type: "hmr-module-call", id: module_id, url })

  // Create callable function that wraps baseTrack with key prefixing
  const createScope = (parentKey: string): ModuleScope => {
    const scope = (<T>(key: string, factory: (($: ModuleScope) => T) | (() => T)): T => {
      const fullKey = parentKey ? `${parentKey}:${key}` : key

      // Call baseTrack which handles the actual tracking logic
      return baseTrack(fullKey, $ => {
        // Check if factory wants a child scope
        if (factory.length > 0) {
          // Factory takes a scope param - create child scope
          const childScope = createScope(fullKey)
          return (factory as ($: ModuleScope) => T)(childScope)
        }
        return (factory as () => T)()
      })
    }) as ModuleScope

    // Add .sub() method for subscription tracking
    scope.sub = (key: string, factory: () => Subscription): Subscription => {
      const fullKey = parentKey ? `${parentKey}:${key}` : key
      // Just call factory - subscribe-call event will be emitted by patched Observable
      // The accumulator will stamp module_id from stack
      return factory()
    }

    // Add .end() method - only valid on root scope
    scope.end = () => {
      emit({ type: "hmr-module-call-return", id: module_id })
    }

    // Add readonly property
    Object.defineProperty(scope, "module_id", { value: module_id, writable: false })

    return scope
  }

  return createScope("")
}

// Re-export for convenience
export { __$ } from "./0_runtime"
