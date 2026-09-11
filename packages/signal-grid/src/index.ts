// The package barrel. `export *` per module rather than a hand-listed set, because an export added
// to a module is meant to reach consumers without a second edit here.
//
// No collision to resolve: the only repeated name across these modules is `grid`, and 3_paths keeps
// its copy module-local (the `slash` template) while 8_grid exports the constructor.
// `features.ts` stays out: the feature ledger is documentation for this repo, not package API.
export * from "./0_types.js"
export * from "./0_log.js"
export * from "./1_axis.js"
export * from "./2_operators.js"
export * from "./3_paths.js"
export * from "./4_slice.js"
export * from "./5_columns.js"
export * from "./6_gestures.js"
export * from "./7_epics.js"
export * from "./8_grid.js"
export * from "./9_css.js"
export * from "./10_render.js"
export * from "./11_detail.js"
export * from "./12_transpose.js"
export * from "./13_composite.js"
export * from "./14_measure.js"
export * from "./15_selection.js"
export * from "./16_menu.js"
export * from "./17_in_view.js"
export * from "./18_bands.js"
