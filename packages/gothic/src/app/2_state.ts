import { type AnySpec, createSections, type SectionState } from "@hafley66/report-shell"
import { loc, writeSearch } from "./1_router.js"

export type { SectionState }

export const STORAGE = "gothic"

// the kit owns section state; gothic hands it the hash-aware router. No view transition on knob commits: while a
// same-document transition runs, chromium hit-tests nothing but <html> (pointer-events on ::view-transition changes
// nothing), so the second click of a double-click on shuffle was lost. Route changes keep theirs (1_router navigate).
export const sections = createSections({
  search: () => loc.$().search,
  write: writeSearch,
  prefix: STORAGE,
})
export const { sectionState, setActivePage, syncFromUrl, commit } = sections

// the page-global namespace: ?page.z, ?page.draw; every route keeps it
export const PAGE_SPEC = {
  z: { kind: "range", min: 0, max: 1, step: 0.05, default: 0, label: "zDepth" },
  draw: { kind: "bool", default: true, label: "draw-in" },
} as const satisfies AnySpec

export const pageState = (): SectionState<typeof PAGE_SPEC> => sectionState("*", "page", PAGE_SPEC)
export const zDepth = (): number => pageState().values.$().z
export const drawIn = (): boolean => pageState().values.$().draw
