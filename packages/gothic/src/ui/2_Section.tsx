import {
  type AnySpec,
  Section as KitSection,
  PlainSection,
  type SectionCtx,
  type SectionDef,
  type ValuesOf,
} from "@hafley66/report-shell"
import type { ReactNode } from "react"
import type { Signal } from "@hafley66/signals"
import { pageState, sections, sectionState } from "../app/2_state.js"
import { SLICE_SPEC, SLICE_PRESETS, type SliceParams } from "../kit/slice/0_spec.js"
import { SliceStage } from "./1c_SliceStage.js"
import { PropertySettings } from "./1d_PropertySettings.js"
import { propertyMotion } from "../kit/4_propertyMotion.js"
import { SectionVariation } from "./1e_VariationControls.js"

export type { SectionCtx, SectionDef }
export { PlainSection }

// the kit Section bound to gothic's section factory (hash router + "gothic." storage prefix)
export function Section<S extends AnySpec>(props: {
  page: string
  def: SectionDef<S>
  extra?: ReactNode
  slice?: boolean
  children: (v: ValuesOf<S>, ctx: SectionCtx<AnySpec>) => ReactNode
}): ReactNode {
  const { slice, children, ...rest } = props
  return <KitSection sections={sections} {...rest} front={state => <SectionVariation state={state} />} fieldSettings={(name, field, state) => <PropertySettings state={state} field={field} name={name} />}>{(_v, ctx) => {
    const v = propertyMotion(props.page).values(ctx.state).$()
    const body = children(v as ValuesOf<S>, ctx)
    if (!slice || !propertyMotion("*").values(pageState()).draw.$()) return body
    const timing = sectionState(props.page, "timing", SLICE_SPEC, SLICE_PRESETS)
    return <SliceStage params={timing.values as unknown as Signal<SliceParams>} input={propertyMotion(props.page).values(timing) as unknown as Signal<SliceParams>} motion={propertyMotion(props.page).strokes(timing)} revision={JSON.stringify(v)} label={props.def.id}>{body}</SliceStage>
  }}</KitSection>
}
