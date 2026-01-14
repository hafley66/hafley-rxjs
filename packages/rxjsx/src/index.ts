// Main JSX runtime
export {
  jsx,
  jsxs,
  Fragment,
  renderToDOM,
  ROOT_ID,
  NODE_ID,
} from "./jsx-runtime.tsx"

export type {
  Prims,
  Prims_,
  ObsPrims_,
  Node$,
  RxJSXNode,
  RxJSX,
  RxJSXComponent,
  JSX,
} from "./jsx-runtime.tsx"

// Utilities
export {
  snabPatch,
  isEmpty,
  processStyle,
  normalizeValue,
  resolveObservable,
  primitiveToVNode,
  processStyleProp,
  processClassNameProp,
  createChildrenObservable,
  processProps,
  addDataAttributes,
  processFragments,
  isRXJSX_Obs,
  castRXJSX_Obs,
} from "./util.dual.ts"

export type { RxJSXObservable } from "./util.dual.ts"

// SSR
export { initSnabdomToHtml } from "./toHTML.ts"

// Re-export snabbdom VNode for convenience
export type { VNode } from "snabbdom"
