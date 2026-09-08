import type { Signal } from "@hafley66/signals"
import type { ReactNode } from "react"
import type { SliceController, SliceParams } from "../kit/slice/index.js"
import { useSlice } from "../kit/slice/3_react.js"
import { AnimationControls } from "./1b_AnimationControls.js"

function Transport({ animation, label }: { animation: SliceController; label: string }) {
  const frame = animation.frame.$()
  return <AnimationControls label={label} time={frame.time} duration={frame.timeline.T || 1} running={frame.active}
    onSeek={animation.seek} onReplay={animation.replay} onToggle={() => {
      animation.runtime.enabled.$(true)
      animation.params.run.$(!frame.active)
    }} />
}

// The source can contain any SVG geometry. Only the ref and geometry revision reach Slice.
export function SliceStage({ params, revision, label, children }: {
  params: Signal<SliceParams>; revision: unknown; label: string; children: ReactNode
}) {
  const animation = useSlice(params, revision)
  return <div data-slice-stage={label}>
    <Transport animation={animation} label={label} />
    <div ref={animation.ref}>{children}</div>
  </div>
}
