import { Signal } from "@hafley66/signals"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { SLICE_DEFAULTS, type SliceController } from "../../src/kit/slice/index.js"
import { useSlice } from "../../src/kit/slice/3_react.js"

export function mount(host: Element, reducedMotion: boolean) {
  const state = Signal({ params: { ...SLICE_DEFAULTS, run: false }, revision: 0, observe: true })
  const model = { state, animation: null as SliceController | null, unsubscribe() { root.unmount() } }
  function Drawing() {
    const version = state.revision.$()
    const animation = useSlice(state.params, version, { loop: false, reducedMotion })
    model.animation = animation
    const frame = state.observe.$() ? animation.frame.$() : null
    return <svg ref={animation.ref} data-time={frame?.time ?? "unobserved"} viewBox="0 0 200 100" style={{ fill: "none", stroke: "black" }}>
      <path data-source="" d={version ? "M10 50H190" : "M10 50Q50 0 100 50T190 50"} />
    </svg>
  }
  const root = createRoot(host)
  root.render(<StrictMode><Drawing /></StrictMode>)
  return model
}
