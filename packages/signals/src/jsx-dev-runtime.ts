import type { ElementType } from "react"
import { jsxDEV as reactJsxDEV, Fragment } from "react/jsx-dev-runtime"
import { track } from "./4_jsxAuto.js"

// Dev JSX runtime: same auto-track wrap, preserves source maps via passthrough.
export const jsxDEV: typeof reactJsxDEV = ((type: unknown, ...rest: unknown[]) =>
  (reactJsxDEV as (...a: unknown[]) => unknown)(track(type) as ElementType, ...rest)) as typeof reactJsxDEV
export { Fragment }
