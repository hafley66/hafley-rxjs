// Covers what TanStack v9 and MUI X both ship, omissions included: a gap with no id is a gap
// nobody can see. `scripts/parity.mjs` parses `FeatureId` here, so a rename fails the parity run.

/** Dotted, axis first. The prefix is the axis the feature is keyed by, never the UI it renders as. */
export type FeatureId =
  // row axis
  | "row.sort"
  | "row.sort.multi"
  | "row.filter"
  | "row.filter.quick"
  | "row.filter.logic"
  | "row.filter.facet"
  | "row.group"
  | "row.tree"
  | "row.expand"
  | "row.detail"
  | "row.select"
  | "row.pin"
  | "row.order"
  | "row.height"
  | "row.aggregate"
  // column axis
  | "col.visible"
  | "col.order"
  | "col.pin"
  | "col.resize"
  | "col.size"
  | "col.autosize"
  | "col.group"
  | "col.type"
  | "col.formula"
  | "col.pivot"
  // the cross of the two axes
  | "cell.select"
  | "cell.focus"
  | "cell.edit"
  | "cell.span"
  | "cell.clipboard"
  // retention: which rows are candidates at all
  | "page.paginate"
  | "page.infinite"
  | "page.server"
  // presentation of the resolved relation
  | "view.virtualize.row"
  | "view.virtualize.col"
  | "view.scroll"
  | "view.density"
  | "view.list"
  | "view.slots"
  | "view.a11y"
  | "view.i18n"
  | "view.theme"
  // the relation as a whole, in and out
  | "data.state"
  | "data.export"
  | "data.undo"
  | "data.charts"
  | "data.ai"

export interface FeatureMeta {
  readonly id: FeatureId
  readonly title: string
  readonly axis: "row" | "col" | "cell" | "page" | "view" | "data"
  /** The failure rather than the capability, so a reviewer can price the gap. */
  readonly why: string
}

// Total over `FeatureId`, so a new union member is a compile error rather than a blank matrix cell.
export const FEATURES: Readonly<Record<FeatureId, FeatureMeta>> = {
  "row.sort": {
    id: "row.sort",
    title: "Order rows by one column",
    axis: "row",
    why: "Rows arrive in whatever order the source produced and the reader cannot rank anything.",
  },
  "row.sort.multi": {
    id: "row.sort.multi",
    title: "Order rows by several columns in priority order",
    axis: "row",
    why: "Ties in the first column fall back to source order instead of the second key.",
  },
  "row.filter": {
    id: "row.filter",
    title: "Drop rows that fail a per-column predicate",
    axis: "row",
    why: "Finding the rows that matter means scrolling past every row that does not.",
  },
  "row.filter.quick": {
    id: "row.filter.quick",
    title: "One search box matched against every filterable column",
    axis: "row",
    why: "Searching requires knowing which column holds the term before typing it.",
  },
  "row.filter.logic": {
    id: "row.filter.logic",
    title: "Combine several filter items with and or or",
    axis: "row",
    why: "Two conditions at once means filtering twice and comparing the results by eye.",
  },
  "row.filter.facet": {
    id: "row.filter.facet",
    title: "Offer a column's distinct values and range as filter choices",
    axis: "row",
    why: "The user guesses which values exist, and a typo reads as an empty result.",
  },
  "row.group": {
    id: "row.group",
    title: "Fold rows into levels keyed by column values",
    axis: "row",
    why: "Comparing categories means sorting by the category and counting runs by hand.",
  },
  "row.tree": {
    id: "row.tree",
    title: "Render parent and child rows from nested source data",
    axis: "row",
    why: "Hierarchical data flattens to a list and the containment is lost.",
  },
  "row.expand": {
    id: "row.expand",
    title: "Open and close a parent row's children",
    axis: "row",
    why: "Every descendant renders at once, so a deep tree floods the viewport on first paint.",
  },
  "row.detail": {
    id: "row.detail",
    title: "Open an arbitrary panel under a row",
    axis: "row",
    why: "Detail needs a second screen, and the surrounding list context is gone while reading it.",
  },
  "row.select": {
    id: "row.select",
    title: "Mark rows, one or many, with checkbox and keyboard rules",
    axis: "row",
    why: "Acting on a set of rows degrades into acting on one row at a time.",
  },
  "row.pin": {
    id: "row.pin",
    title: "Keep chosen rows visible while the rest scroll",
    axis: "row",
    why: "The row being compared against scrolls away exactly when it is needed.",
  },
  "row.order": {
    id: "row.order",
    title: "Move a row to another position by dragging",
    axis: "row",
    why: "Order is whatever the source decided, and a user-owned ranking has to live elsewhere.",
  },
  "row.height": {
    id: "row.height",
    title: "Give rows individual heights, measured or declared",
    axis: "row",
    why: "Wrapped or multi-line content is clipped to a single uniform line.",
  },
  "row.aggregate": {
    id: "row.aggregate",
    title: "Summarise a column over a group or the whole relation",
    axis: "row",
    why: "Totals are computed outside the grid and drift from the rows actually shown.",
  },
  "col.visible": {
    id: "col.visible",
    title: "Hide a column without dropping it from the schema",
    axis: "col",
    why: "A wide schema forces sideways scrolling past columns nobody reads.",
  },
  "col.order": {
    id: "col.order",
    title: "Move a column to another position",
    axis: "col",
    why: "Two columns the user wants to compare stay far apart on screen.",
  },
  "col.pin": {
    id: "col.pin",
    title: "Keep chosen columns visible while the rest scroll sideways",
    axis: "col",
    why: "The identifying column scrolls out and the remaining cells lose their label.",
  },
  "col.resize": {
    id: "col.resize",
    title: "Drag a column edge to change its width",
    axis: "col",
    why: "A truncated value can only be read by widening the whole window.",
  },
  "col.size": {
    id: "col.size",
    title: "Resolve declared width, min, max, and flex into pixels",
    axis: "col",
    why: "Columns either overflow the viewport or leave dead space to the right of the last one.",
  },
  "col.autosize": {
    id: "col.autosize",
    title: "Fit a column to its widest rendered content",
    axis: "col",
    why: "Reaching a readable width costs one manual drag per column, on every visit.",
  },
  "col.group": {
    id: "col.group",
    title: "Nest columns under shared header groups",
    axis: "col",
    why: "Related columns read as an undifferentiated run of headers.",
  },
  "col.type": {
    id: "col.type",
    title: "Attach a value type so editor, filter, and comparator follow from it",
    axis: "col",
    why: "Every column restates the same comparator and operator wiring by hand.",
  },
  "col.formula": {
    id: "col.formula",
    title: "Derive a column's value from other fields of the row",
    axis: "col",
    why: "A computed column has to be materialised into the source data before it can be shown.",
  },
  "col.pivot": {
    id: "col.pivot",
    title: "Turn a column's distinct values into columns",
    axis: "col",
    why: "Cross-tabulation has to happen upstream, so the shape cannot be changed while reading.",
  },
  "cell.select": {
    id: "cell.select",
    title: "Select a rectangular range of cells",
    axis: "cell",
    why: "Copying a block of numbers means selecting whole rows and trimming them afterwards.",
  },
  "cell.focus": {
    id: "cell.focus",
    title: "Move a focus ring cell by cell with the keyboard",
    axis: "cell",
    why: "The grid cannot be driven without a mouse.",
  },
  "cell.edit": {
    id: "cell.edit",
    title: "Change a value in place",
    axis: "cell",
    why: "Correcting one field means leaving the grid for a separate form.",
  },
  "cell.span": {
    id: "cell.span",
    title: "Let one cell cover its neighbours across rows or columns",
    axis: "cell",
    why: "A value repeated down a run restates itself on every row and hides the run's boundary.",
  },
  "cell.clipboard": {
    id: "cell.clipboard",
    title: "Copy and paste a range as tab separated text",
    axis: "cell",
    why: "Moving a selection to or from a spreadsheet is retyping.",
  },
  "page.paginate": {
    id: "page.paginate",
    title: "Show one page of rows at a time",
    axis: "page",
    why: "The whole relation renders on first paint, so the first paint is the whole table.",
  },
  "page.infinite": {
    id: "page.infinite",
    title: "Accumulate pages as the user scrolls toward the end",
    axis: "page",
    why: "Reaching row nine hundred costs nine deliberate clicks and loses scroll position each time.",
  },
  "page.server": {
    id: "page.server",
    title: "Push sort, group, and page upstream and render the answer",
    axis: "page",
    why: "The entire relation has to fit in the browser before anything can be shown.",
  },
  "view.virtualize.row": {
    id: "view.virtualize.row",
    title: "Render only the rows inside the viewport",
    axis: "view",
    why: "Ten thousand rows means ten thousand DOM subtrees and a frozen tab.",
  },
  "view.virtualize.col": {
    id: "view.virtualize.col",
    title: "Render only the columns inside the viewport",
    axis: "view",
    why: "A hundred-column schema pays for every column on every rendered row.",
  },
  "view.scroll": {
    id: "view.scroll",
    title: "Treat scroll position as state the kernel can read and write",
    axis: "view",
    why: "Nothing can be scrolled into view on demand, so a found row may be off screen.",
  },
  "view.density": {
    id: "view.density",
    title: "Switch row height between preset scales",
    axis: "view",
    why: "Dense review and comfortable reading need two differently configured grids.",
  },
  "view.list": {
    id: "view.list",
    title: "Collapse the column axis to one cell per row for narrow screens",
    axis: "view",
    why: "A small viewport gets a table that can only be read by scrolling sideways.",
  },
  "view.slots": {
    id: "view.slots",
    title: "Replace any rendered part without forking the grid",
    axis: "view",
    why: "Custom rendering means patching the library or wrapping every cell from outside.",
  },
  "view.a11y": {
    id: "view.a11y",
    title: "Carry grid roles and aria state on every rendered part",
    axis: "view",
    why: "A screen reader announces a pile of divs with no row, column, or selection state.",
  },
  "view.i18n": {
    id: "view.i18n",
    title: "Serve every visible string from a replaceable table",
    axis: "view",
    why: "The grid speaks English inside an application that does not.",
  },
  "view.theme": {
    id: "view.theme",
    title: "Drive every dimension and colour from CSS custom properties",
    axis: "view",
    why: "Restyling means overriding generated class names and racing the library's own cascade.",
  },
  "data.state": {
    id: "data.state",
    title: "Round-trip the whole grid state through a string",
    axis: "data",
    why: "A shared link loses the sort, the filters, the page, and the expansion.",
  },
  "data.export": {
    id: "data.export",
    title: "Write the visible axes out as a file",
    axis: "data",
    why: "Getting the current view to a colleague is a screenshot.",
  },
  "data.undo": {
    id: "data.undo",
    title: "Step back through changes the user made",
    axis: "data",
    why: "A mistaken edit or a lost filter set is permanent.",
  },
  "data.charts": {
    id: "data.charts",
    title: "Hand the current view to a chart",
    axis: "data",
    why: "Seeing the shape of the filtered rows means exporting them into a second tool.",
  },
  "data.ai": {
    id: "data.ai",
    title: "Answer a natural language question by driving the grid's own state",
    axis: "data",
    why: "Expressing an ask means first learning the filter panel's grammar.",
  },
}

// Written out rather than derived from `FEATURES`, because a derived list agrees by construction
// and `features.test.ts` would then be asserting nothing.
export const FEATURE_IDS: readonly FeatureId[] = [
  "row.sort",
  "row.sort.multi",
  "row.filter",
  "row.filter.quick",
  "row.filter.logic",
  "row.filter.facet",
  "row.group",
  "row.tree",
  "row.expand",
  "row.detail",
  "row.select",
  "row.pin",
  "row.order",
  "row.height",
  "row.aggregate",
  "col.visible",
  "col.order",
  "col.pin",
  "col.resize",
  "col.size",
  "col.autosize",
  "col.group",
  "col.type",
  "col.formula",
  "col.pivot",
  "cell.select",
  "cell.focus",
  "cell.edit",
  "cell.span",
  "cell.clipboard",
  "page.paginate",
  "page.infinite",
  "page.server",
  "view.virtualize.row",
  "view.virtualize.col",
  "view.scroll",
  "view.density",
  "view.list",
  "view.slots",
  "view.a11y",
  "view.i18n",
  "view.theme",
  "data.state",
  "data.export",
  "data.undo",
  "data.charts",
  "data.ai",
]

/** The legal `axis` values, as data, so a test can check membership without restating the union. */
export const FEATURE_AXES = ["row", "col", "cell", "page", "view", "data"] as const
