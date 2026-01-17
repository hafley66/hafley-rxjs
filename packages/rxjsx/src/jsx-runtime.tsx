import {
  combinePartialArray,
  combinePartialRecord,
  type DelegatedObservable,
  debug$,
  deferFrom,
  type HtmlEventIndex$,
  TAG,
} from "@hafley/rxjs-ext"
import { isObservable, merge, Observable, of, Subscription } from "rxjs"
import { filter, map, scan } from "rxjs/operators"
import { fragment, h, VNode } from "snabbdom"
import {
  addDataAttributes,
  castRXJSX_Obs,
  createChildrenObservable,
  snabPatch as patch,
  primitiveToVNode,
  processProps,
  RxJSXObservable,
} from "./util.dual.ts"

// ID generators for tracking nodes
export let ROOT_ID = 0
export let NODE_ID = 0

const log = debug$[import.meta.url]

export function jsx(
  tag: string | ((props: any) => Observable<VNode>),
  propsWithChildren: JSX.IntrinsicElements[keyof JSX.IntrinsicElements] | null,
  key?: string,
): Observable<VNode> {
  const nodeId = NODE_ID++
  const { children: _children, debug: _debug, "data-root-id": _rootId, ...props } = propsWithChildren || {}
  const debug = !!_debug
  const rootId = `${_rootId}`
  // Process children
  const children: RxJSXNode[] = (
    _children === false || _children == null ? [] : Array.isArray(_children) ? _children : [_children]
  ).flat()

  debug && console.log({ children })
  // Process props
  const [attrObservables, isObservableProps] = processProps(props, tag as string)

  const isObservableChildren = children.some(i => isObservable(i) && !castRXJSX_Obs(i).IS_PURE)

  const hasProps = !!Object.keys(attrObservables).length
  const hasChildren = !!children.length

  const ME: RxJSXObservable<VNode> = deferFrom(() => {
    // Handle functional components
    if (typeof tag === "function") {
      debug && console.log("Calling child tag...", tag.name, rootId)
      return tag({
        ...propsWithChildren,
        "data-root-id": ME.rootId,
      })
    }

    try {
      const children$ = createChildrenObservable(children, ME.rootId, ME.key, debug)

      const attrs$ = Object.keys(attrObservables).length
        ? combinePartialRecord(attrObservables)
        : of({} as Record<string, any>)

      if (debug) {
        console.log(tag, {
          hasProps,
          hasChildren,
          propsWithChildren,
        })
      }

      // Combine props and children updates
      return merge(
        attrs$.pipe(map(attrs => ["props", attrs] as const)),
        children$.pipe(
          debug ? TAG(log, `<${ME.key}>/CHILDREN`) : i => i,
          map(children => ["children", children] as const),
        ),
      ).pipe(
        scan(
          (state, event) => ({
            props: event[0] === "props" ? event[1] : state.props,
            children: event[0] === "children" ? event[1] : state.children,
            propCount: state.propCount + Number(event[0] === "props"),
            childrenCount: state.childrenCount + Number(event[0] === "children"),
          }),
          {
            props: {},
            children: [] as VNode[],
            propCount: 0,
            childrenCount: 0,
          },
        ),
        // Only emit when we have the required data
        filter(state => !!(hasChildren ? state.childrenCount : hasProps ? state.propCount : true)),
        map(state => {
          // Add data attributes to props
          const snabbdomProps = addDataAttributes({ ...state.props }, nodeId, ME.rootId, ME.key, ME.parentKey)
          Object.assign(snabbdomProps.attrs, state.props)
          snabbdomProps.data ||= {}
          delete snabbdomProps.style
          debug && console.log("State.children", state.children.length)
          // Create Snabbdom VNode
          snabbdomProps.data.className = props.className
          debug && console.log({ snabbdomProps, state })
          snabbdomProps.key = ME.key
          snabbdomProps.style = state.props.style
          ;(snabbdomProps.data ||= {}).key = ME.key
          snabbdomProps.on = Object.fromEntries(
            Object.entries(props)
              .filter(i => i[0].match(/on[A-Z]/))
              .map(i => [i[0].slice(2).toLowerCase(), i[1]]),
          )
          delete snabbdomProps.attrs.style
          return h(tag as string, snabbdomProps, state.children)
        }),
      )
    } catch (error) {
      console.error(error)
      return of(h("div", { attrs: { class: "error" } }, "Error rendering component"))
    }
  })

  // Set up rootId and key
  ME.rootId = rootId || ROOT_ID++
  ME.key = key

  // Pure optimization only works for string tags (not function components)
  if (!isObservableChildren && !isObservableProps && typeof tag === "string") {
    ME.IS_PURE = true
    ME.pure = () => {
      const snabbdomProps = addDataAttributes({ ...props }, nodeId, ME.rootId, ME.key, ME.parentKey)
      Object.assign(snabbdomProps.attrs, props)
      delete snabbdomProps.style
      // Create Snabbdom VNode
      snabbdomProps.key = ME.key
      snabbdomProps.style = props.style
      delete snabbdomProps.attrs.style
      ;(snabbdomProps.data ||= {}).key = ME.key
      ;(snabbdomProps.props ||= {}).className = props.className

      snabbdomProps.on = Object.fromEntries(
        Object.entries(props)
          .filter(i => i[0].match(/on[A-Z]/))
          .map(i => [i[0].slice(2).toLowerCase(), i[1]]),
      )
      snabbdomProps.attrs["data-IS_PURE"] = "1"
      debug && console.log("tag", tag, children)
      return h(
        tag as string,
        snabbdomProps,
        children.map(i => (isObservable(i) ? i.pure() : i)).filter(i => i !== false && i != null),
      )
    }
    ME.pureProps = propsWithChildren
    ME.pureKey = key
    ME.pureTag = tag
  }

  return ME
}

export const Fragment = (props: { children: RxJSXNode }): Observable<VNode> => {
  const children = Array.isArray(props.children) ? props.children : [props.children]

  return combinePartialArray(
    children.map(child =>
      isObservable(child)
        ? child
        : of(typeof child === "string" || typeof child === "number" ? primitiveToVNode(child) : (child as VNode)),
    ),
  ).pipe(map(nodes => fragment(nodes.filter(n => n != null))))
}

// Helper function to render a VNode to a DOM element
export function renderToDOM(vnode$: Observable<VNode>, container: Element): Subscription {
  let currentVNode: VNode | undefined

  return vnode$.subscribe(newVNode => {
    if (!currentVNode) {
      // First render
      patch(container, newVNode)
    } else {
      // Update existing DOM
      patch(currentVNode, newVNode)
    }
    currentVNode = newVNode
  })
}

export const jsxs = jsx
export default jsx

export type Prims_ = null | number | string | boolean | VNode
export type ObsPrims_ = Observable<null | number | string | boolean | VNode>

// Type definitions
export type Prims =
  | null
  | number
  | string
  | boolean
  | VNode
  | (
      | null
      | number
      | string
      | boolean
      | VNode
      | Observable<
          | (null | number | string | boolean | VNode)[]
          | null
          | number
          | string
          | boolean
          | VNode
          | Observable<(null | number | string | boolean | VNode)[] | null | number | string | boolean | VNode>
        >
    )[]
  | Observable<
      | (null | number | string | boolean | VNode)[]
      | null
      | number
      | string
      | boolean
      | VNode
      | Observable<(null | number | string | boolean | VNode)[] | null | number | string | boolean | VNode>
      | Observable<(null | number | string | boolean | VNode)[] | null | number | string | boolean | VNode>[]
    >
export type Node$ = (Prims | Prims[])[] | Prims | Prims[]
export type RxJSXNode = Node$

export namespace RxJSX {
  export type Node = RxJSXNode
  export type FC<T extends Record<string, any>> = (
    props: T & {
      id?: string
      style?: CSSProperties | Observable<CSSProperties>
      className?: string | Observable<string | string[]> | string[]
      children?: RxJSXNode
      key?: string
    },
  ) => JSX.Element
}

export type RxJSXComponent = string | ((props: any) => JSX.Element)

// CSS Properties type (subset of standard CSS)
export type CSSProperties = {
  [key: string]: string | number | undefined
}

export namespace JSX {
  export type Element = Observable<VNode>
  export type CSSProps = CSSProperties

  interface ElementAttributesProperty {
    key?: string
  }
  type Lol = {
    [K in keyof HtmlEventIndex$ as `on${Capitalize<K>}`]?: HtmlEventIndex$[K] extends DelegatedObservable<infer U>
      ? (event: U) => void
      : never
  }
  export interface IntrinsicElements {
    [key: string]: {
      key?: string | number
      id?: string
      style?: string | CSSProps | Observable<CSSProps>
      className?: string | string[] | Observable<string | string[]>
      children?: RxJSXNode | Observable<VNode> | JSX.Element
    } & Lol & {
        [prop: string]: string | number | boolean | Observable<string | number | boolean> | undefined | {}
      }
  }
}
