import { type AnySpec, createSections, type SectionState } from "@hafley66/report-shell"
import { loc, writeSearch } from "./1_router.js"
import { transition } from "./3_view.js"

export type { SectionState }

export const STORAGE = "gothic"

// the kit owns section state; gothic hands it the hash-aware router and the view-transition wrapper
export const sections = createSections({
  search: () => loc.$().search,
  write: writeSearch,
  transition,
  prefix: STORAGE,
})
export const { sectionState, setActivePage, syncFromUrl, commit } = sections

// the page-global namespace: ?page.z, ?page.draw; every route keeps it
export const PAGE_SPEC = {
  z: { kind: "range", min: 0, max: 1, step: 0.05, default: 0, label: "zDepth", static: true },
  draw: { kind: "bool", default: true, label: "draw-in", static: true },
} as const satisfies AnySpec

export const pageState = (): SectionState<typeof PAGE_SPEC> => sectionState("*", "page", PAGE_SPEC)
export const zDepth = (): number => pageState().values.$().z
export const drawIn = (): boolean => pageState().values.$().draw
