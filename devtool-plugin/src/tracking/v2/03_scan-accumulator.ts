import { Subject, type Observable } from "rxjs"
import { shareReplay } from "rxjs/operators"
import { observableEventsEnabled$, type State, state$ } from "./00.types"
import { now, observableIdMap, createId } from "./01_helpers"
import { crawlArgs } from "./02_arg-crawler"

// Structural serialization for HMR change detection
function isObservable(val: any): val is Observable<any> {
  return val && typeof val === "object" && typeof val.subscribe === "function"
}

function serializeValue(val: any): string {
  if (typeof val === "function") return "fn"
  if (isObservable(val)) {
    const id = observableIdMap.get(val)
    return id ? `$ref[${id}]` : "$ref[?]"
  }
  if (Array.isArray(val)) return `[${val.map(serializeValue).join(",")}]`
  if (val && typeof val === "object") {
    const entries = Object.entries(val)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${serializeValue(v)}`)
    return `{${entries.join(",")}}`
  }
  if (typeof val === "string") return `"${val}"`
  if (val === null) return "null"
  if (val === undefined) return "undefined"
  return String(val)
}

function serializeArgs(args: any[]): string {
  return args.map(serializeValue).join(",")
}

export const state$$ = observableEventsEnabled$.pipe(
  state$.scanEager((state, event) => {
    switch (event.type) {
      case "constructor-call-return": {
        state.store.observable[event.id] = {
          id: event.id,
          created_at: now(),
          created_at_end: now(),
          name: `new ${event.observable.constructor.name}`,
          obs_ref: new WeakRef(event.observable),
        }
        observableIdMap.set(event.observable, event.id)
        break
      }

      case "factory-call-return": {
        const obsId = observableIdMap.get(event.observable) ?? "unknown"
        if (state.store.observable[obsId]) {
          // Serialize args into name for structural hash
          const argsStr = serializeArgs(event.args)
          state.store.observable[obsId].name = `${event.name}(${argsStr})`
        }
        const args = crawlArgs(event.args, obsId)
        for (const arg of args) {
          state.store.arg[arg.id] = arg
          arg.observable_id = obsId
        }
        break
      }

      case "pipe-get": {
        state.stack.pipe.push({
          id: event.id,
          created_at: now(),
          parent_observable_id: event.observable_id,
          observable_id: "", // Will be set on pipe-call-return
        })
        state.store.pipe[event.id] = state.stack.pipe[state.stack.pipe.length - 1]!

        break
      }

      case "pipe-call": {
        const pipeEntity = state.stack.pipe[state.stack.pipe.length - 1]
        if (pipeEntity) {
        }
        break
      }

      case "pipe-call-return": {
        const entity = state.stack.pipe.pop()
        if (!entity) break
        entity.created_at_end = now()
        entity.observable_id = event.observable_id
        break
      }

      case "subscribe-call": {
        /**
         * ┌─────────────────────────────────────────────────────────────────────┐
         * │ INTERNAL PLUMBING DETECTION                                         │
         * ├─────────────────────────────────────────────────────────────────────┤
         * │ When a tracked wrapper subscribes to its own inner observable,      │
         * │ that's internal plumbing - not a user subscription.                 │
         * │                                                                     │
         * │   hmr_track[key] {                                                  │
         * │     stable_observable_id: "3"  ← wrapper                            │
         * │     mutable_observable_id: "2" ← inner                              │
         * │   }                                                                 │
         * │                                                                     │
         * │   subscription from "3" → "2" = internal (skip tracking)            │
         * │   subscription from user → "3" = external (track it)                │
         * │                                                                     │
         * │ The relationship is encoded in the data model - we just query it.   │
         * └─────────────────────────────────────────────────────────────────────┘
         */
        const parentSub = state.stack.subscription.at(-1)
        if (parentSub) {
          const isInternalPlumbing = Object.values(state.store.hmr_track).some(
            t => t.stable_observable_id === parentSub.observable_id
              && t.mutable_observable_id === event.observable_id,
          )
          if (isInternalPlumbing) break // Skip tracking wrapper→inner subscription
        }

        const currentModule = state.stack.hmr_module.at(-1)
        state.store.subscription[event.id] = {
          id: event.id,
          created_at: now(),
          observable_id: event.observable_id,
          parent_subscription_id: parentSub?.id,
          is_sync: false, // Will be updated if complete/error fires before subscribe-call-return
          module_id: currentModule?.id,
        }
        state.stack.subscription.push(state.store.subscription[event.id]!)
        break
      }

      case "subscribe-call-return": {
        // If subscription wasn't tracked (internal plumbing), skip
        if (!state.store.subscription[event.id]) break

        const subEntity = state.stack.subscription.pop()
        if (subEntity) {
          subEntity.created_at_end = now()
          subEntity.sub_ref = new WeakRef(event.subscription)
          // TODO: Check is_sync flag (did complete/error fire before this?)
        }
        break
      }

      case "unsubscribe-call": {
        const subEntity = state.store.subscription[event.id]
        if (subEntity) {
          subEntity.unsubscribed_at = now()
        }
        break
      }

      case "unsubscribe-call-return": {
        const entity = state.store.subscription[event.id]
        if (entity) {
          entity.unsubscribed_at_end = now()
        }
        break
      }

      case "send-call": {
        // Find origin track for this observable - skip if none (internal subscription)
        // Check mutable_observable_id (inner) and stable_observable_id (wrapper)
        const originTrack = Object.values(state.store.hmr_track).find(
          t => t.mutable_observable_id === event.observable_id || t.stable_observable_id === event.observable_id,
        )
        if (!originTrack) break

        // Push origin track context so inner observables get proper context
        state.stack.hmr_track.push(originTrack)

        // Keep actual observable_id - don't overwrite to track.id
        state.store.send[event.id] = {
          created_at: now(),
          id: event.id,
          observable_id: event.observable_id,
          subscription_id: event.subscription_id,
          type: event.kind,
          ...(event.kind === "next" ? { value: event.value } : event.kind === "error" ? { error: event.error } : {}),
        }
        state.stack.send.push(state.store.send[event.id]!)
        break
      }

      case "send-call-return": {
        // Only process if send-call recorded this (had origin track)
        const sendEntity = state.store.send[event.id]
        if (!sendEntity) break

        state.stack.send.pop()
        sendEntity.created_at_end = now()
        state.stack.hmr_track.pop()
        // Pop parent subscription if we pushed one during arg-call
        if ((sendEntity as any)._pushedParentSub) {
          state.stack.subscription.pop()
          delete (sendEntity as any)._pushedParentSub
        }
        break
      }

      case "operator-fun-call": {
        const argsStr = serializeArgs(event.args)
        state.store.operator_fun[event.id] = {
          created_at: now(),
          id: event.id,
          name: `${event.name}(${argsStr})`,
        }
        state.stack.operator_fun.push(state.store.operator_fun[event.id]!)
        // Crawl args to find and wrap functions (delay, project, etc.)
        const args = crawlArgs(event.args, event.id)
        for (const arg of args) {
          state.store.arg[arg.id] = arg
        }
        // Don't capture operator_fun into track - only observables matter
        break
      }
      case "operator-fun-call-return": {
        const val = state.stack.operator_fun.pop()
        if (!val) break
        val.created_at_end = now()
        break
      }
      case "operator-call": {
        state.store.operator[event.id] = {
          created_at: now(),
          id: event.id,
          operator_fun_id: event.operator_fun_id,
          source_observable_id: event.source_observable_id,
          target_observable_id: "",
          pipe_id: state.stack.pipe[state.stack.pipe.length - 1]?.id ?? "UNKNOWN",
          index: event.index,
        }
        state.stack.operator.push(state.store.operator[event.id]!)
        break
      }
      case "operator-call-return": {
        const val = state.stack.operator.pop()
        if (!val) break
        val.created_at_end = now()
        val.target_observable_id = event.target_observable_id
        // Chain observable names: target.name = source.name + "." + opFun.name
        const sourceObs = state.store.observable[val.source_observable_id]
        const targetObs = state.store.observable[val.target_observable_id]
        const opFun = state.store.operator_fun[val.operator_fun_id]
        if (targetObs && opFun) {
          targetObs.name = `${sourceObs?.name ?? "?"}.${opFun.name}`
        }
        break
      }

      case "arg-call": {
        // Get the current subscription from the send stack
        const currentSendSub = state.stack.send[state.stack.send.length - 1]?.subscription_id
        const currentSub = currentSendSub ? state.store.subscription[currentSendSub] : undefined

        // For higher-order operators, push the parent subscription onto the stack
        // so inner observables get the correct parent (stays until send-call-return)
        if (currentSub?.parent_subscription_id) {
          const parentSub = state.store.subscription[currentSub.parent_subscription_id]
          if (parentSub) {
            state.stack.subscription.push(parentSub)
            // Track on the send so we know to pop in send-call-return
            const currentSend = state.stack.send[state.stack.send.length - 1]
            if (currentSend) {
              ;(currentSend as any)._pushedParentSub = true
            }
          }
        }

        const entity = {
          arg_id: event.arg_id,
          created_at: now(),
          id: event.id,
          input_values: event.args,
          subscription_id: state.stack.subscription[state.stack.subscription.length - 1]?.id ?? "unknown",
        }
        state.stack.arg_call.push(entity)
        break
      }
      case "arg-call-return": {
        const val = state.stack.arg_call.pop()
        if (!val) break

        // Only store if it returned an observable
        if (event.observable_id && event.observable_id !== "UNKNOWN") {
          val.created_at_end = now()
          val.observable_id = event.observable_id
          state.store.arg_call[val.id] = val
        }
        break
      }
      case "track-call": {
        const parent = state.stack.hmr_track.at(-1)
        const currentModule = state.stack.hmr_module.at(-1)
        // Runtime provides surrogate id, key is the location string
        const entity = {
          id: event.id,
          key: event.key,
          created_at: now(),
          mutable_observable_id: "",
          parent_track_id: parent?.id,
          index: 0, // TODO: track per-parent index
          version: 0,
          prev_observable_ids: [] as string[],
          module_id: currentModule?.id,
        }
        state.stack.hmr_track.push(entity)
        break
      }
      case "track-call-return": {
        const entity = state.stack.hmr_track.pop()
        if (!entity) break
        // IDs come from event (runtime knows them), not inferred from stack
        if (!event.mutable_observable_id) break
        entity.mutable_observable_id = event.mutable_observable_id
        entity.stable_observable_id = event.stable_observable_id
        entity.created_at_end = now()

        const currentModule = state.stack.hmr_module.at(-1)
        // Lookup by id - O(1). Runtime reuses existing track's id on HMR re-execution.
        const existing = state.store.hmr_track[entity.id]
        if (existing && existing.mutable_observable_id !== event.mutable_observable_id) {
          // HMR re-execution detected - compare structural hashes
          const oldObs = state.store.observable[existing.mutable_observable_id]
          const newObs = state.store.observable[event.mutable_observable_id]
          const structureChanged = oldObs?.name !== newObs?.name

          // Update in place
          existing.prev_observable_ids.push(existing.mutable_observable_id)
          existing.mutable_observable_id = event.mutable_observable_id
          existing.stable_observable_id = event.stable_observable_id
          existing.version += 1
          existing.module_version = currentModule?.version
          // Store whether this was a structural change (for future optimization)
          // structureChanged: true = need full swap, false = fn-only hot swap
          ;(existing as any).last_change_structural = structureChanged
        } else if (existing) {
          // Same mutable_observable_id, just mark as touched this module version
          existing.module_version = currentModule?.version
          // Update stable_observable_id if changed
          if (event.stable_observable_id) {
            existing.stable_observable_id = event.stable_observable_id
          }
        } else {
          // First time - store by surrogate id
          entity.module_version = currentModule?.version
          state.store.hmr_track[entity.id] = entity
        }
        break
      }

      case "hmr-module-call": {
        const existing = state.store.hmr_module[event.id]
        if (existing) {
          // HMR reload - bump version, snapshot current keys
          const currentKeys = Object.values(state.store.hmr_track)
            .filter(t => t.module_id === event.id)
            .map(t => t.key)
          existing.prev_keys = currentKeys
          existing.version += 1
        } else {
          // First load
          state.store.hmr_module[event.id] = {
            id: event.id,
            created_at: now(),
            url: event.url,
            version: 1,
            prev_keys: [],
          }
        }
        state.stack.hmr_module.push(state.store.hmr_module[event.id]!)
        break
      }

      case "hmr-module-call-return": {
        const module = state.stack.hmr_module.pop()
        if (!module) break
        module.created_at_end = now()

        // Diff: which keys from prev_keys weren't touched this module version?
        const currentKeys = new Set(
          Object.values(state.store.hmr_track)
            .filter(t => t.module_id === module.id && t.module_version === module.version)
            .map(t => t.key),
        )
        const orphanedKeys = module.prev_keys.filter(k => !currentKeys.has(k))

        // Clean up orphaned tracks: collect stable IDs, complete wrapper, delete from store
        const orphanedStableIds = new Set<string>()
        for (const key of orphanedKeys) {
          // Find track by key (store is keyed by surrogate id)
          const track = Object.values(state.store.hmr_track).find(t => t.key === key)
          if (track) {
            if (track.stable_observable_id) {
              orphanedStableIds.add(track.stable_observable_id)
            }
            // Complete the wrapper to trigger teardown (unsubscribes state$$ watcher)
            // Use observable table (obs_ref is single source of truth for WeakRefs)
            const stableId = track.stable_observable_id
            const wrapper = stableId ? state.store.observable[stableId]?.obs_ref?.deref() : undefined
            if (wrapper instanceof Subject) {
              wrapper.complete()
            }
            // Remove from store by id
            delete state.store.hmr_track[track.id]
          }
        }

        // Unsubscribe any subscription to an orphaned stable observable
        for (const sub of Object.values(state.store.subscription)) {
          if (orphanedStableIds.has(sub.observable_id) && !sub.unsubscribed_at) {
            sub.sub_ref?.deref()?.unsubscribe()
            sub.unsubscribed_at = now()
            sub.unsubscribed_at_end = now()
          }
        }

        // Clear prev_keys since we've processed the diff
        module.prev_keys = []
        break
      }
    }
    return state
  }),
  shareReplay(1), // Multicast + replay last state to new subscribers
)
// Make it hot
state$$.subscribe()
