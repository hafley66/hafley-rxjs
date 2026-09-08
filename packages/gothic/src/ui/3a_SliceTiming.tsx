import { SLICE_PRESETS, SLICE_SPEC } from "../kit/slice/0_spec.js"
import { Section } from "./2_Section.js"

export function SliceTiming({ page }: { page: string }) {
  return <Section page={page} def={{ id: "timing", title: "Slice timing", spec: SLICE_SPEC, presets: SLICE_PRESETS }}>
    {() => <p className="text-xs text-muted">Timing applies to every section below. Pin controls to keep them through shuffle. Use draw-in in the header to enable animation; each drawing has hold, scrub and restart.</p>}
  </Section>
}
