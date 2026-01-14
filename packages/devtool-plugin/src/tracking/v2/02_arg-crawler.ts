import { set } from "lodash"
import { isObservable } from "rxjs"
import { _observableEvents$, state$, type State } from "./00.types"
import { createId, now, observableIdMap } from "./01_helpers"

const MAX_DEPTH = 10

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object"
}

function isFunction(value: unknown): value is Function {
  return typeof value === "function"
}

type ArgEntity = State["store"]["arg"][string]

export function findArgs(value: unknown, path = "$args", depth = 0, rootVal: any): ArgEntity[] {
  if (depth > MAX_DEPTH) return []

  const args: ArgEntity[] = []

  // Function - create arg entity with is_function: true
  if (isFunction(value)) {
    const arg_id = createId()
    const fn_ref = new WeakRef(value)
    args.push({
      id: arg_id,
      created_at: now(),
      path,
      is_function: true,
      owner_id: "", // Set by caller
      fn_source: value.toString(),
      fn_ref,
    })
    set(rootVal, path, (...callArgs: any[]) => {
      const id = createId()
      _observableEvents$.next({
        type: "arg-call",
        id,
        arg_id,
        args: callArgs,
      })
      // Look up fn_ref from state$ at call time so HMR can swap it
      const fn = state$.value.store.arg[arg_id]?.fn_ref?.deref()
      const out = fn ? fn(...callArgs) : undefined
      _observableEvents$.next({
        type: "arg-call-return",
        id,
        observable_id: observableIdMap.get(out) ?? "UNKNOWN",
      })
      return out
    })
    return args
  }

  // Observable - create arg entity with observable_id
  if (isObservable(value)) {
    const observable_id = observableIdMap.get(value)
    if (observable_id) {
      args.push({
        id: createId(),
        created_at: now(),
        path,
        observable_id,
        is_function: false,
        owner_id: "", // Set by caller
      })
    }
    return args
  }

  // Array
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      args.push(...findArgs(value[i], `${path}.${i}`, depth + 1, rootVal))
    }
    return args
  }

  // Object
  if (isObject(value)) {
    for (const [key, val] of Object.entries(value)) {
      args.push(...findArgs(val, `${path}.${key}`, depth + 1, rootVal))
    }
    return args
  }

  // Primitive (number, string, boolean, null, undefined)
  if (value !== undefined) {
    args.push({
      id: createId(),
      created_at: now(),
      path,
      is_function: false,
      owner_id: "", // Set by caller
      value,
    })
  }

  return args
}

export function crawlArgs(rawArgs: any[], ownerId: string): ArgEntity[] {
  const args: ArgEntity[] = []
  for (let i = 0; i < rawArgs.length; i++) {
    const foundArgs = findArgs(rawArgs[i], `$args.${i}`, 0, { $args: rawArgs })
    for (const arg of foundArgs) {
      arg.owner_id = ownerId
    }
    args.push(...foundArgs)
  }
  return args
}
