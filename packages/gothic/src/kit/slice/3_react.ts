import type { Signal } from "@hafley66/signals"
import { useCallback, useMemo } from "react"
import type { SliceParams } from "./0_spec.js"
import { attachSlice, type SliceAttachOptions } from "./2_attach.js"

// JSX reads animation.frame; the ref writes the committed node. No component-owned connections.
export function useSlice(params: Signal<SliceParams>, revision?: unknown, options: SliceAttachOptions = {}) {
  const animation = useMemo(() => attachSlice(null, { ...options, params }), [params])
  const ref = useCallback((node: Element | null) => { animation.runtime.target.$(node) }, [animation, revision])
  return { ...animation, ref }
}
