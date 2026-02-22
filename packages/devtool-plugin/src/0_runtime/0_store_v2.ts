import { isFunction, isObject, omit, set, values } from "lodash"
import type { Observable } from "rxjs"
import { DietBehaviorSubject, DietSubject } from "~/lib/2_diet_rxjs"
import { getObsId } from "./0_store"

type Life<T> = T & {
  left: number
  right: number
}

type Exists<T> = T & {
  left: number
}

type JesusChristSheWasHotAsFuck = {
  fun: Exists<{
    id: string
    name: string
    path: string
    // fn_source: string
    ref: WeakRef<Function>
  }>
  call: Life<{
    id: string
    index: number
    fun_id: string
    parent_call_id?: string
  }>
  arg: {
    id: string
    call_id: string
    fun_id?: string
    obs_id?: string
    value?: any
  }
  obs: Exists<{
    id: string
    name: string
    ref: WeakRef<Observable<any>>
  }>
  // sub: Life<{
  //   id: string
  //   index: number
  //   obs_id: string
  //   ref: WeakRef<Subscription>
  // }>
}

type Events =
  | ({
      type: "fun"
    } & JesusChristSheWasHotAsFuck["fun"])
  | {
      type: "call"
      id: string
      index: number
      fun_id: string
    }
  | {
      type: "callcall"
      id: string
    }
  | ({
      type: "arg"
    } & Arg)
  | ({
      type: "obs"
    } & JesusChristSheWasHotAsFuck["obs"])

type Arg = JesusChristSheWasHotAsFuck["arg"]

type Store = {
  obs: Record<string, JesusChristSheWasHotAsFuck["obs"]>
  fun: Record<string, JesusChristSheWasHotAsFuck["fun"]>
  call: Record<string, JesusChristSheWasHotAsFuck["call"]>
  arg: Record<string, JesusChristSheWasHotAsFuck["arg"]>
}

export class Tracer {
  meth = new DietSubject<Events>()
  state$ = new DietBehaviorSubject<Store>({
    arg: {},
    fun: {},
    obs: {},
    call: {},
  })

  callStack: string[] = []

  next = (it: Events) => {
    this.meth.next(it)
    const S = this.state$.value
    switch (it.type) {
      case "fun": {
        S.fun[it.id] = omit(it, "type")
        break
      }
      case "call": {
        const parent = this.callStack.at(-1)
        S.call[it.id] = {
          ...omit(it, "type"),
          left: this.now(),
          right: 0,
          ...(parent ? { parent_call_id: parent } : {}),
        }
        this.callStack.push(it.id)
        break
      }
      case "arg": {
        S.arg[it.id] = omit(it, "type")
        break
      }
      case "callcall": {
        S.call[it.id]!.right = this.now()
        this.callStack.pop()
        break
      }
      case "obs": {
        S.obs[it.id] = omit(it, "type")
        const instance = S.obs[it.id]!
        const currCallId = this.callStack.at(-1)
        if (currCallId && !instance.name) {
          instance.name = currCallId
        }
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
    const path = `${parent ? `${parent}/` : ""}${literallyAnything.name}`
    this.next({
      id: path,
      type: "fun",
      name: literallyAnything.name,
      path,
      left: this.now(),
      ref: new WeakRef(literallyAnything),
      // fn_source: literallyAnything.toString(),
    })

    const that = this

    const out = new Proxy(literallyAnything, {
      construct(target, args) {
        const callId = `${path}#${callIndex}`
        const index = callIndex++
        try {
          const toReturn = that.iso_funk(
            args,
            callId,
            path,
            index,
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
        const index = callIndex++
        const callId = `${path}#${index}`
        try {
          return that.iso_funk(args, callId, path, index, (...modArgs: any[]) =>
            Reflect.apply(target, thisArg, modArgs),
          )
        } catch (e) {
          throw e
        }
      },
    })

    Tracer.setPath(out, path)
    return out
  }

  iso_funk = (args: any[], id: string, fun_id: string, index: number, yields: Function) => {
    const modArgs = this.argsDo(args, id)
    this.next({
      type: "call",
      id,
      index,
      fun_id,
    })
    const toReturn = yields(...modArgs)
    this.next({
      type: "callcall",
      id,
    })
    const getReturn = { return: toReturn }
    this.argRipper(toReturn, id, `return`, getReturn)
    return getReturn.return
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
      this.next({ type: "arg", id, call_id, fun_id: (deco as any)["@@path"] })
      return
    }

    if (getObsId(value)) {
      const observable_id = getObsId(value)
      if (observable_id) {
        this.next({
          type: "arg",
          id,
          call_id,
          obs_id: getObsId(value),
        })
      }
      return
    }

    if (Array.isArray(value)) {
      set(next, path, [])
      for (let i = 0; i < value.length; i++) {
        this.argRipper(value[i], call_id, `${path}.${i}`, next)
      }
      return
    }

    if (isObject(value)) {
      set(next, path, value)
      for (const [key, val] of Object.entries(value)) {
        this.argRipper(val, call_id, `${path}.${key}`, next)
      }
      return
    }

    set(next, path, value)
    this.next({
      type: "arg",
      id,
      call_id,
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
    root_obs: () => {
      return values(this._.obs).filter(it => it)
    },
    pipes: () => {
      return values(this._.call).filter(it => it)
    },
  }
}
