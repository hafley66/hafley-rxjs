import {
  Observable,
  isObservable,
  of,
  combineLatest,
  filter,
  throttleTime,
  animationFrameScheduler,
} from "rxjs"
import { map, switchMap } from "rxjs/operators"
import {
  combinePartialArray,
  combinePartialRecord,
  deferFrom,
  TAG,
  debug$,
} from "@hafley/rxjs-ext"
import type { RxJSXNode } from "./jsx-runtime.tsx"

// Import Snabbdom modules
import { init, VNode } from "snabbdom"
import { propsModule } from "snabbdom"
import { styleModule } from "snabbdom"
import { classModule, eventListenersModule } from "snabbdom"
import { attributesModule } from "snabbdom"

const lol = debug$[import.meta.url ?? ""]
// Initialize Snabbdom with modules
export const snabPatch = init(
  [
    propsModule,
    styleModule,
    classModule,
    attributesModule,
    eventListenersModule,
    {
      pre() {},
      // create(e, v) {
      //   console.log(
      //     "CREATE",
      //     e.key,
      //     v.key,
      //     v.elm?.outerHTML,
      //   )
      // },
      // update(o, n) {
      //   console.log(
      //     "UPDATE",
      //     n.key,
      //     deepObjectDiff(o, n),
      //     _.cloneDeep(o),
      //     _.cloneDeep(n),
      //   )
      // },
      // destroy(vnode) {
      //   console.log(
      //     "DESTROY",
      //     vnode.key,
      //     vnode.elm.outerHTML,
      //     vnode,
      //   )
      // },
    },
  ],
  undefined,
  {
    experimental: {
      fragments: true,
    },
  },
)

// Utility functions
export const isEmpty = (value: any): boolean => {
  return (
    value == null ||
    (typeof value === "object" &&
      Object.keys(value).length === 0) ||
    (typeof value === "string" && value.trim().length === 0)
  )
}

// Process style objects for Snabbdom
export function processStyle(
  style: string | Record<string, string>,
): Record<string, string> {
  if (typeof style === "string") {
    const result: Record<string, string> = {}
    style.split(";").forEach(rule => {
      const [key, value] = rule.split(":")
      if (key && value) {
        const camelKey = key
          .trim()
          .replace(/-([a-z])/g, (_, char) =>
            char.toUpperCase(),
          )
        result[camelKey] = value.trim()
      }
    })
    return result
  }
  return style as Record<string, string>
}

// Helper to convert values to appropriate format
export function normalizeValue(
  value: any,
  meta?: string,
  tag?: string,
): any {
  if (value === null || value === undefined) return ""
  if (value === 0) return "0"

  if (meta === "disabled" && tag === "button") {
    return value ? true : undefined
  }

  if (meta === "popover") {
    return value ? "" : undefined
  }

  return value
}

// Resolve observable or static value
export function resolveObservable(
  value: any,
  meta?: string,
  tag?: string,
): Observable<any> {
  if (isObservable(value)) {
    return value.pipe(
      map(v => {
        if (v === null || v === undefined) return ""
        if (v === 0) return "0"

        if (Array.isArray(v)) {
          return combineLatest(
            v.map(i => (isObservable(i) ? i : of(i))),
          ).pipe(
            map(partial =>
              partial.map(i => (i === 0 ? "0" : i)),
            ),
          )
        }

        return normalizeValue(v, meta, tag)
      }),
    )
  }

  return of(normalizeValue(value, meta, tag))
}

// Convert primitive values to text nodes
export function primitiveToVNode(
  child:
    | string
    | number
    | boolean
    | null
    | undefined
    | VNode,
): VNode | null {
  if (child == null || child === false) return null
  if (typeof child === "boolean") return ""
  if (
    typeof child === "string" ||
    typeof child === "number"
  ) {
    return child
  }
  if ("sel" in child && "key" in child) return child
  return null
}

// Process style prop
export function processStyleProp(
  value: any,
): [Observable<Record<string, string>>, boolean] {
  if (isObservable(value)) {
    return [
      value.pipe(
        map(v =>
          typeof v === "string"
            ? processStyle(v)
            : typeof v === "object" && !isEmpty(v)
              ? v
              : {},
        ),
      ),
      true,
    ] as const
  }

  if (
    typeof value === "object" &&
    !Array.isArray(value) &&
    !isEmpty(value)
  ) {
    let has = false
    const out = combinePartialRecord(
      Object.fromEntries(
        Object.entries(value).map(([k, v]) =>
          isObservable(v)
            ? ((has = true), [k, v])
            : ([k, of(v)] as const),
        ),
      ),
    )

    return [out, has] as const
  }

  return [of(processStyle(value as string)), false]
}

// Process className prop
export function processClassNameProp(
  value: any,
): Observable<string> {
  // console.log({ value })
  return isObservable(value)
    ? value.pipe(
        map(v => (Array.isArray(v) ? v.join(" ") : v)),
      )
    : of(Array.isArray(value) ? value.join(" ") : value)
}
const _log = debug$[import.meta.url]
// Create a children observable that handles path propagation
export function createChildrenObservable(
  children: RxJSXNode[],
  rootId: number | string | undefined,
  parentKey: string | number | undefined,
  debug?: boolean,
  recursionLevel = 0,
): Observable<VNode[]> {
  return deferFrom(() => {
    // console.log("Hmm", parentKey, children)
    const log = _log.extend(`<${parentKey}>`)
    log(`STARTING`)
    if (recursionLevel > 4) {
      return of([])
    }
    return combineLatest(
      children.map(function recurseChildren(child, index):
        | Observable<VNode | null>
        | Observable<(VNode | null)[]> {
        // Handle observable children
        if (isObservable(child)) {
          const C = castRXJSX_Obs(child)
          // Set up key hierarchy
          C.rootId = rootId
          C.parentKey = parentKey
          C.key = `${parentKey}/${C.key || index}`

          if (C?.IS_PURE && C.pure) {
            log(
              `${parentKey} to ${C.key} PURE %o`,
              C.pure(),
            )
            return of(C.pure() as VNode)
          }

          log(`${parentKey} to ${C.key} IMPURE %o`, C)
          return C.pipe(
            switchMap((value, swindex) => {
              // Handle nested observables
              if (isObservable(value)) {
                const CC = castRXJSX_Obs(value)
                // CC.key = `${parentKey}/${originalKey || index}/${CC.key ?? "$"}`
                log(
                  `${index}/${swindex} switchMap OBSERVABLE`,
                )
                return createChildrenObservable(
                  [CC],
                  rootId,
                  C.key,
                  debug,
                  recursionLevel + 1,
                )
              }

              // Handle arrays of observables as special case
              if (Array.isArray(value)) {
                if (!value.length) {
                  log(
                    `${index}/${swindex} switchMap EMPTY Array`,
                  )
                  return of(null)
                }

                if (
                  value.length &&
                  value.every(
                    i => isObservable(i) && isRXJSX_Obs(i),
                  )
                ) {
                  log(
                    `${index}/${swindex} switchMap PURE Array`,
                  )
                  return of(value.map(i => i.pure!()))
                }

                log(
                  `${index}/${swindex} switchMap ANY Array`,
                )
                return createChildrenObservable(
                  value,
                  rootId,
                  C.key,
                  debug,
                  recursionLevel + 1,
                )
              }
              log(`${index}/${swindex} switchMap PRIMITIVE`)
              return of(
                [primitiveToVNode(value)].filter(
                  i => i !== false && i != null,
                ),
              )
            }),
            map(i =>
              i === null
                ? i
                : Array.isArray(i)
                  ? i
                  : [i].filter(
                      i => i !== false && i != null,
                    ),
            ),
            filter(Boolean),
          )
        }

        if (Array.isArray(child)) {
          return createChildrenObservable(
            child,
            rootId,
            parentKey,
            debug,
            recursionLevel + 1,
          )
        }

        return of(
          [primitiveToVNode(child)].filter(
            i => i !== false && i != null,
          ),
        )
      }),
    )

    // // Emit initial children if no observables
    // if (!hasObservableChildren) {
    //   debug && console.log("SYNC EMIT")
    //   subscriber.next(latest.filter(Boolean))
    //   // subscriber.complete()
    // }

    // return combineLatest()
  }).pipe(
    filter(Boolean),
    map(i =>
      i.flat().filter(i => i != null && i !== false),
    ),
    throttleTime(16, animationFrameScheduler, {
      leading: true,
      trailing: true,
    }),
    debug ? TAG(`<${parentKey ?? ""}>`) : i => i,
  )
}

// Process props into observables
export function processProps(
  props: Record<string, any> | null | undefined,
  tag: string,
): [
  Record<string, Observable<any>>,
  isObservable: boolean,
] {
  const attrObservables: Record<
    string,
    Observable<any>
  > = {}
  if (!props) return [attrObservables, false]

  let isObservableProps = false
  for (const key in props) {
    const value = props[key]

    // Handle style prop
    if (key === "style") {
      let ans = processStyleProp(value)
      attrObservables[key] = ans[0]
      isObservableProps ||= ans[1]
    }
    // Handle className prop
    else if (key === "className") {
      attrObservables["class"] = processClassNameProp(value)
      isObservableProps ||= isObservable(value)
    }
    // Handle other props
    else {
      attrObservables[key] = isObservable(value)
        ? ((isObservableProps ||= true),
          resolveObservable(value, key, tag))
        : of(value)
    }
  }

  return [attrObservables, isObservableProps]
}

// Add data attributes to props
export function addDataAttributes(
  props: Record<string, any>,
  nodeId: number,
  rootId: number,
  key?: string,
  parentKey?: string,
): Record<string, any> {
  props.attrs = props.attrs || {}
  // props.attrs["data-root-id"] = rootId
  // props.attrs["data-myId"] = "" + nodeId

  // if (key) {
  props.attrs["data-myKey"] = key
  // }

  // if (parentKey) {
  props.attrs["data-parentKey"] = parentKey
  // }

  return props
}

// Process fragments
export function processFragments(
  vnode: VNode,
): VNode[] | VNode {
  if (vnode.sel === "fragment") {
    return vnode.children as VNode[]
  }

  // Process children recursively
  if (vnode.children && Array.isArray(vnode.children)) {
    const processedChildren: VNode[] = []
    for (const child of vnode.children) {
      const processed = processFragments(child)
      if (Array.isArray(processed)) {
        processedChildren.push(...processed)
      } else {
        processedChildren.push(processed)
      }
    }
    vnode.children = processedChildren
  }

  return vnode
}


// Type definition for diff entries
type DiffEntry = {
  path: string[]
  oldValue: any
  newValue: any
}

// function deepObjectDiff(base, object) {
//   const diff = {}
//   const diffEntries: DiffEntry[] = []

//   function compareValues(baseValue, objectValue, path) {
//     const key = path[path.length - 1]
//     const pathStr = path.join(".")
//     if (key.includes("elm")) debugger
//     if (!_.isEqual(baseValue, objectValue)) {
//       // Set the diff in object format
//       _.set(diff, pathStr, objectValue)

//       // Add to diff entries list
//       diffEntries.push({
//         type: "primitive",
//         path,
//         oldValue: baseValue,
//         newValue: objectValue,
//       })
//     }
//   }

//   function traverse(baseObj, targetObj, currentPath = []) {
//     // Handle arrays
//     if (
//       Array.isArray(baseObj) &&
//       Array.isArray(targetObj)
//     ) {
//       const maxLength = Math.max(
//         baseObj.length,
//         targetObj.length,
//       )

//       for (let i = 0; i < maxLength; i++) {
//         const newPath = [...currentPath, i.toString()]

//         if (i >= baseObj.length) {
//           // Added item
//           _.set(diff, newPath.join("."), targetObj[i])
//           diffEntries.push({
//             type: "array-add",
//             path: newPath,
//             oldValue: undefined,
//             newValue: targetObj[i],
//           })
//         } else if (i >= targetObj.length) {
//           // Removed item
//           _.set(diff, newPath.join("."), undefined)
//           diffEntries.push({
//             type: "array-remove",
//             path: newPath,
//             oldValue: baseObj[i],
//             newValue: undefined,
//           })
//         } else if (
//           _.isObject(baseObj[i]) &&
//           _.isObject(targetObj[i])
//         ) {
//           // Recurse for objects/arrays
//           traverse(baseObj[i], targetObj[i], newPath)
//         } else if (!_.isEqual(baseObj[i], targetObj[i])) {
//           // Different values
//           _.set(diff, newPath.join("."), targetObj[i])
//           diffEntries.push({
//             type: "array-wtf",
//             path: newPath,
//             oldValue: baseObj[i],
//             newValue: targetObj[i],
//           })
//         }
//       }
//       return
//     }

//     // Handle objects
//     if (
//       _.isObject(baseObj) &&
//       _.isObject(targetObj) &&
//       !Array.isArray(baseObj) &&
//       !Array.isArray(targetObj)
//     ) {
//       // Check for properties in targetObj
//       _.forOwn(targetObj, (value, key) => {
//         const newPath = [...currentPath, key]

//         if (!_.has(baseObj, key)) {
//           // Added property
//           _.set(diff, newPath.join("."), value)
//           diffEntries.push({
//             type: "object-add",
//             path: newPath,
//             oldValue: undefined,
//             newValue: value,
//           })
//         } else if (
//           _.isObject(value) &&
//           _.isObject(baseObj[key])
//         ) {
//           // Recurse for nested objects/arrays
//           traverse(baseObj[key], value, newPath)
//         } else if (!_.isEqual(baseObj[key], value)) {
//           // Different values
//           _.set(diff, newPath.join("."), value)
//           diffEntries.push({
//             type: "object-wtf",
//             path: newPath,
//             oldValue: baseObj[key],
//             newValue: value,
//           })
//         }
//       })

//       // Check for properties in baseObj that are not in targetObj
//       _.forOwn(baseObj, (value, key) => {
//         if (!_.has(targetObj, key)) {
//           const newPath = [...currentPath, key]
//           _.set(diff, newPath.join("."), undefined)
//           diffEntries.push({
//             type: "object-remove",
//             path: newPath,
//             oldValue: value,
//             newValue: undefined,
//           })
//         }
//       })

//       return
//     }

//     // Handle primitive values
//     compareValues(baseObj, targetObj, currentPath)
//   }

//   traverse(base, object)

//   return {
//     a: base,
//     b: object,
//     diff: {
//       ba: diff,
//       entries: diffEntries,
//     },
//   }
// }

export type RxJSXObservable<T> = Observable<T> & {
  pure?: () => VNode
  IS_PURE?: boolean
  key?: string | number
  rootId?: string | number
  parentKey?: string | number
  pureProps?: any
  pureKey?: string
  pureTag?: string | ((props: any) => Observable<VNode>)
}

export function isRXJSX_Obs<T>(
  it: Observable<T>,
): it is RxJSXObservable<T> {
  return isObservable(it) && "rootId" in it
}

export function castRXJSX_Obs<T>(
  it: Observable<T>,
): RxJSXObservable<T> {
  return it
}
