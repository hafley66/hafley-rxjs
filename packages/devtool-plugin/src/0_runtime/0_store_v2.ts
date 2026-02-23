import { isFunction, isObject, isPlainObject, omit, set, values } from "lodash"
import { DietBehaviorSubject, DietSubject } from "~/lib/2_diet_rxjs"

type Fun = {
  id: string
  name: string
  ref?: WeakRef<Function>
  call_ids: string[]
}

type Call = {
  id: string
  fun_id: string
  parent_call_id?: string
  arg_ids: string[]
  return_id?: string
  left: number
  right: number
}

type Arg = {
  id: string
  value?: any
  ref?: WeakRef<object>
  fun_id?: string
}

type Store = {
  fun: Record<string, Fun>
  call: Record<string, Call>
  arg: Record<string, Arg>
}

type Events =
  | {
      type: "fun"
      id: string
      name: string
      ref?: WeakRef<Function>
    }
  | {
      type: "call"
      id: string
      fun_id: string
    }
  | {
      type: "callcall"
      id: string
      return_id?: string
    }
  | {
      type: "arg"
      id: string
      value?: any
      ref_arg_id?: string
      ref?: WeakRef<object>
      fun_id?: string
    }

export class Tracer {
  meth = new DietSubject<Events>()
  state$ = new DietBehaviorSubject<Store>({
    arg: {},
    fun: {},
    call: {},
  })

  callStack: string[] = []

  next = (it: Events) => {
    this.meth.next(it)
    const S = this.state$.value
    switch (it.type) {
      case "fun": {
        S.fun[it.id] = {
          id: it.id,
          name: it.name,
          ref: it.ref,
          call_ids: [],
        }
        break
      }
      case "call": {
        const parent = this.callStack.at(-1)
        S.call[it.id] = {
          id: it.id,
          fun_id: it.fun_id,
          parent_call_id: parent,
          arg_ids: [],
          left: this.now(),
          right: 0,
        }
        this.callStack.push(it.id)
        break
      }
      case "arg": {
        S.arg[it.id] = omit(it, "type")
        const call_id = arg_get_call_id(it.id)
        const C = S.call[call_id]
        if (C) {
          if (!it.id.endsWith("/$")) {
            C.arg_ids.push(it.id)
          } else {
            C.return_id = it.id
          }
        }
        break
      }
      case "callcall": {
        if (S.call[it.id]) {
          S.call[it.id]!.right = this.now()
          S.call[it.id]!.return_id = it.return_id
        }
        this.callStack.pop()
        break
      }
    }
    return
  }
  date = 0
  now = () => this.date++

  decoratoPatronus = <T extends Function | { new (): any }>(literallyAnything: T, parent: string = "") => {
    let callIndex = 0
    const alreadyDecorated = Tracer.getPath(literallyAnything)
    if (alreadyDecorated) return literallyAnything
    const fun_path = `${parent ? `${parent}/` : ""}${literallyAnything.name}`
    this.next({
      id: fun_path,
      type: "fun",
      name: literallyAnything.name,
      ref: new WeakRef(literallyAnything),
    })

    const that = this

    const out = new Proxy(literallyAnything, {
      construct(target, args) {
        const callId = `${fun_path}/constructor/${callIndex}`
        callIndex++
        try {
          const toReturn = that.iso_funk(
            args,
            callId,
            fun_path,
            (...modArgs: any[]) => new (target as { new (...args: any[]): any })(...modArgs),
          )
          return new Proxy(toReturn, {
            get(target, p, receiver) {
              const val = Reflect.get(target, p, receiver)
              if (typeof val === "function") {
                if (val.wrapped) return val
                const wrapped = that.decoratoPatronus(val, `${callId}`)
                wrapped.wrapped = true
                Reflect.set(target, p, wrapped)
                return wrapped
              }
              return val
            },
          })
        } catch (e) {
          throw e
        }
      },
      apply(target, thisArg, args) {
        const callId = `${fun_path}/${callIndex}`
        callIndex++
        try {
          return that.iso_funk(args, callId, fun_path, (...modArgs: any[]) => Reflect.apply(target, thisArg, modArgs))
        } catch (e) {
          throw e
        }
      },
    })

    Tracer.setPath(out, fun_path)
    return out
  }

  iso_funk = (args: any[], id: string, fun_id: string, yields: Function) => {
    const modArgs = this.argsDo(args, id)
    this.next({
      type: "call",
      id,
      fun_id,
    })
    const toReturn = yields(...modArgs)
    this.next({
      type: "callcall",
      id,
    })
    const getReturn = { $: toReturn }
    this.argRipper(toReturn, id, `$`, getReturn)
    return getReturn.$
  }

  argsDo = (rawArgs: any[], parentPath: string): any[] => {
    const acc: any = []
    for (let i = 0; i < rawArgs.length; i++) {
      this.argRipper(rawArgs[i], `${parentPath}`, `${i}`, acc)
    }
    return acc
  }

  argRipper(value: unknown, call_id: string, path: string, next: any): void {
    const id = `${call_id}/${path}`
    if (isFunction(value)) {
      const deco = this.decoratoPatronus(value, id)
      set(next, path, deco)
      this.next({ type: "arg", id, fun_id: Tracer.getPath(deco) })
      return
    }

    if (Array.isArray(value)) {
      set(next, path, [])
      for (let i = 0; i < value.length; i++) {
        this.argRipper(value[i], call_id, `${path}.${i}`, next)
      }
      return
    }

    if (isPlainObject(value)) {
      set(next, path, value)
      for (const [key, val] of Object.entries(value as {})) {
        this.argRipper(val, call_id, `${path}.${key}`, next)
      }
      return
    }

    if (isObject(value)) {
      set(next, path, value)
      this.next({
        type: "arg",
        id,
        ref: new WeakRef(value),
        ...(Tracer.getPath(value) ? { ref_arg_id: Tracer.getPath(value) } : {}),
      })
      return
    }

    set(next, path, value)
    this.next({
      type: "arg",
      id,
      value,
    })
  }

  static setPath(any: any, path: string) {
    any["@@path"] = path
  }

  static getPath(any: any): string | undefined {
    return any["@@path"]
  }

  get _() {
    return this.state$.value
  }

  read = {
    root_calls: () => {
      return values(this._.call).filter(it => !it.parent_call_id)
    },
    calls_by_fun: (fun_id: string) => {
      return values(this._.call).filter(it => it.fun_id === fun_id)
    },
    children_of_call: (call_id: string) => {
      return values(this._.call).filter(it => it.parent_call_id === call_id)
    },
  }
}

export const arg_get_call_id = (arg_id: string) => {
  return arg_id.slice(0, arg_id.lastIndexOf("/"))
}

export const arg_is_return = (arg_id: string) => {
  return arg_id.endsWith("/$")
}
