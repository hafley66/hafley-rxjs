import {
  type AnySpec,
  Section as KitSection,
  PlainSection,
  type SectionCtx,
  type SectionDef,
  type ValuesOf,
} from "@hafley66/report-shell"
import type { ReactNode } from "react"
import { sections } from "../app/2_state.js"

export type { SectionCtx, SectionDef }
export { PlainSection }

// the kit Section bound to gothic's section factory (hash router + view transitions + "gothic." storage prefix)
export function Section<S extends AnySpec>(props: {
  page: string
  def: SectionDef<S>
  extra?: ReactNode
  children: (v: ValuesOf<S>, ctx: SectionCtx<AnySpec>) => ReactNode
}): ReactNode {
  return <KitSection sections={sections} {...props} />
}
