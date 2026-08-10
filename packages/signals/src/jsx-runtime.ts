import type { ElementType, Key } from "react"
import { jsx as reactJsx, jsxs as reactJsxs, Fragment } from "react/jsx-runtime"
import { track } from "./4_jsxAuto.js"

// Production JSX runtime: every function-component type routes through SignalReact.
export const jsx: typeof reactJsx = ((type: unknown, ...rest: unknown[]) =>
  reactJsx(track(type) as ElementType, ...(rest as [unknown, Key?]))) as typeof reactJsx
export const jsxs: typeof reactJsxs = ((type: unknown, ...rest: unknown[]) =>
  reactJsxs(track(type) as ElementType, ...(rest as [unknown, Key?]))) as typeof reactJsxs
export { Fragment }
