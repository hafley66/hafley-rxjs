# signal-grid: three-way feature parity

Generated. Every column below is derived, not asserted by hand.

## Contents

1. [Counts](#counts)
2. [How each column is produced](#how-each-column-is-produced)
3. [The matrix](#the-matrix)
4. [Cut on purpose](#cut-on-purpose)
5. [Not decided yet](#not-decided-yet)
6. [Regenerating](#regenerating)

## Counts

47 features tracked. TanStack Table v9 covers 20, MUI X Data Grid covers 45 in full and 1 in part, signal-grid implements 23 and declares a further 9 as types nothing runs yet.

| column | source |
| --- | --- |
| TanStack v9 | directory listing of `@tanstack/table-core/dist/features`, mapped through an alias table in the script |
| MUI X | `docs/parity.mui.json`, one citation URL per row, MUI X is not installed here |
| signal-grid | `@feature` JSDoc tags, each of which must sit on a declaration containing a function or a call, read by the TypeScript compiler API |
| signal-grid, declared only | `@feature-declared` tags: the type exists and nothing runs it |
| where | the declaration carrying the tag |

## How each column is produced

TanStack's 17 feature directories map onto 20 feature ids. Every directory is mapped.

## The matrix

### Row axis

| feature | why it matters | TanStack v9 | MUI X | signal-grid | where |
| --- | --- | --- | --- | --- | --- |
| `row.sort`<br>Order rows by one column | Rows arrive in whatever order the source produced and the reader cannot rank anything. | yes | [yes (mit)](https://mui.com/x/react-data-grid/sorting/) | yes | `src/1_axis.ts:245` |
| `row.sort.multi`<br>Order rows by several columns in priority order | Ties in the first column fall back to source order instead of the second key. | yes | [yes (pro)](https://mui.com/x/react-data-grid/sorting/#multi-sorting) | yes | `src/2_operators.ts:405` |
| `row.filter`<br>Drop rows that fail a per-column predicate | Finding the rows that matter means scrolling past every row that does not. | yes | [yes (mit)](https://mui.com/x/react-data-grid/filtering/) | no, by decision |  |
| `row.filter.quick`<br>One search box matched against every filterable column | Searching requires knowing which column holds the term before typing it. | yes | [yes (mit)](https://mui.com/x/react-data-grid/filtering/quick-filter/) | no, by decision |  |
| `row.filter.logic`<br>Combine several filter items with and or or | Two conditions at once means filtering twice and comparing the results by eye. | no | [yes (pro)](https://mui.com/x/react-data-grid/filtering/multi-filters/) | no, by decision |  |
| `row.filter.facet`<br>Offer a column's distinct values and range as filter choices | The user guesses which values exist, and a typo reads as an empty result. | yes | no | no, by decision |  |
| `row.group`<br>Fold rows into levels keyed by column values | Comparing categories means sorting by the category and counting runs by hand. | yes | [yes (premium)](https://mui.com/x/react-data-grid/row-grouping/) | yes | `src/1_axis.ts:284` |
| `row.tree`<br>Render parent and child rows from nested source data | Hierarchical data flattens to a list and the containment is lost. | yes | [yes (pro)](https://mui.com/x/react-data-grid/tree-data/) | yes | `src/1_axis.ts:90` |
| `row.expand`<br>Open and close a parent row's children | Every descendant renders at once, so a deep tree floods the viewport on first paint. | yes | [yes (pro)](https://mui.com/x/react-data-grid/tree-data/#group-expansion-with-tree-data) | yes | `src/1_axis.ts:361`<br>`src/5_columns.ts:216` |
| `row.detail`<br>Open an arbitrary panel under a row | Detail needs a second screen, and the surrounding list context is gone while reading it. | yes | [yes (pro)](https://mui.com/x/react-data-grid/master-detail/) | yes | `src/11_detail.ts:89`<br>`src/11_detail.ts:169`<br>`src/5_columns.ts:246` |
| `row.select`<br>Mark rows, one or many, with checkbox and keyboard rules | Acting on a set of rows degrades into acting on one row at a time. | yes | [yes (pro)](https://mui.com/x/react-data-grid/row-selection/) | yes | `src/5_columns.ts:178`<br>`src/5_columns.ts:199`<br>`src/7_epics.ts:176` |
| `row.pin`<br>Keep chosen rows visible while the rest scroll | The row being compared against scrolls away exactly when it is needed. | yes | [yes (pro)](https://mui.com/x/react-data-grid/row-pinning/) | yes | `src/4_slice.ts:23` |
| `row.order`<br>Move a row to another position by dragging | Order is whatever the source decided, and a user-owned ranking has to live elsewhere. | no | [yes (pro)](https://mui.com/x/react-data-grid/row-ordering/) | yes | `src/5_columns.ts:232` |
| `row.height`<br>Give rows individual heights, measured or declared | Wrapped or multi-line content is clipped to a single uniform line. | no | [yes (mit)](https://mui.com/x/react-data-grid/row-height/) | yes | `src/4_slice.ts:95` |
| `row.aggregate`<br>Summarise a column over a group or the whole relation | Totals are computed outside the grid and drift from the rows actually shown. | yes | [yes (premium)](https://mui.com/x/react-data-grid/aggregation/) | no, by decision |  |

### Column axis

| feature | why it matters | TanStack v9 | MUI X | signal-grid | where |
| --- | --- | --- | --- | --- | --- |
| `col.visible`<br>Hide a column without dropping it from the schema | A wide schema forces sideways scrolling past columns nobody reads. | yes | [yes (mit)](https://mui.com/x/react-data-grid/column-visibility/) | yes | `src/8_grid.ts:490` |
| `col.order`<br>Move a column to another position | Two columns the user wants to compare stay far apart on screen. | yes | [yes (pro)](https://mui.com/x/react-data-grid/column-ordering/) | declared only | `src/0_types.ts:383` |
| `col.pin`<br>Keep chosen columns visible while the rest scroll sideways | The identifying column scrolls out and the remaining cells lose their label. | yes | [yes (pro)](https://mui.com/x/react-data-grid/column-pinning/) | yes | `src/4_slice.ts:23` |
| `col.resize`<br>Drag a column edge to change its width | A truncated value can only be read by widening the whole window. | yes | [yes (mit)](https://mui.com/x/react-data-grid/column-dimensions/#resizing) | declared only | `src/0_types.ts:386` |
| `col.size`<br>Resolve declared width, min, max, and flex into pixels | Columns either overflow the viewport or leave dead space to the right of the last one. | yes | [yes (mit)](https://mui.com/x/react-data-grid/column-dimensions/#fluid-width) | yes | `src/4_slice.ts:267` |
| `col.autosize`<br>Fit a column to its widest rendered content | Reaching a readable width costs one manual drag per column, on every visit. | no | [yes (mit)](https://mui.com/x/react-data-grid/column-dimensions/#autosizing) | declared only | `src/14_measure.ts:13` |
| `col.group`<br>Nest columns under shared header groups | Related columns read as an undifferentiated run of headers. | no | [yes (mit)](https://mui.com/x/react-data-grid/column-groups/) | declared only | `src/0_types.ts:241` |
| `col.type`<br>Attach a value type so editor, filter, and comparator follow from it | Every column restates the same comparator and operator wiring by hand. | no | [yes (mit)](https://mui.com/x/react-data-grid/custom-columns/) | no, by decision |  |
| `col.formula`<br>Derive a column's value from other fields of the row | A computed column has to be materialised into the source data before it can be shown. | no | [yes (premium)](https://mui.com/x/react-data-grid/formulas/) | declared only | `src/0_types.ts:226` |
| `col.pivot`<br>Turn a column's distinct values into columns | Cross-tabulation has to happen upstream, so the shape cannot be changed while reading. | no | [yes (premium)](https://mui.com/x/react-data-grid/pivoting/) | no, by decision |  |

### Cell, the cross of the two axes

| feature | why it matters | TanStack v9 | MUI X | signal-grid | where |
| --- | --- | --- | --- | --- | --- |
| `cell.select`<br>Select a rectangular range of cells | Copying a block of numbers means selecting whole rows and trimming them afterwards. | yes | [yes (premium)](https://mui.com/x/react-data-grid/cell-selection/) | yes | `src/15_selection.ts:51`<br>`src/7_epics.ts:539` |
| `cell.focus`<br>Move a focus ring cell by cell with the keyboard | The grid cannot be driven without a mouse. | no | [yes (mit)](https://mui.com/x/react-data-grid/accessibility/#keyboard-navigation) | declared only | `src/0_types.ts:393` |
| `cell.edit`<br>Change a value in place | Correcting one field means leaving the grid for a separate form. | no | [yes (mit)](https://mui.com/x/react-data-grid/editing/) | no, by decision |  |
| `cell.span`<br>Let one cell cover its neighbours across rows or columns | A value repeated down a run restates itself on every row and hides the run's boundary. | yes | [yes (mit)](https://mui.com/x/react-data-grid/column-spanning/) | yes | `src/8_grid.ts:630` |
| `cell.clipboard`<br>Copy and paste a range as tab separated text | Moving a selection to or from a spreadsheet is retyping. | no | [yes (premium)](https://mui.com/x/react-data-grid/clipboard/) | no |  |

### Retention

| feature | why it matters | TanStack v9 | MUI X | signal-grid | where |
| --- | --- | --- | --- | --- | --- |
| `page.paginate`<br>Show one page of rows at a time | The whole relation renders on first paint, so the first paint is the whole table. | yes | [yes (mit)](https://mui.com/x/react-data-grid/pagination/) | yes | `src/4_slice.ts:46` |
| `page.infinite`<br>Accumulate pages as the user scrolls toward the end | Reaching row nine hundred costs nine deliberate clicks and loses scroll position each time. | no | [yes (pro)](https://mui.com/x/react-data-grid/server-side-data/lazy-loading/#infinite-loading) | yes | `src/8_grid.ts:228` |
| `page.server`<br>Push sort, group, and page upstream and render the answer | The entire relation has to fit in the browser before anything can be shown. | no | [yes (mit)](https://mui.com/x/react-data-grid/server-side-data/) | declared only | `src/0_types.ts:422` |

### Presentation

| feature | why it matters | TanStack v9 | MUI X | signal-grid | where |
| --- | --- | --- | --- | --- | --- |
| `view.virtualize.row`<br>Render only the rows inside the viewport | Ten thousand rows means ten thousand DOM subtrees and a frozen tab. | no | [yes (pro)](https://mui.com/x/react-data-grid/virtualization/) | yes | `src/4_slice.ts:146` |
| `view.virtualize.col`<br>Render only the columns inside the viewport | A hundred-column schema pays for every column on every rendered row. | no | [yes (mit)](https://mui.com/x/react-data-grid/virtualization/#column-virtualization) | yes | `src/4_slice.ts:245`<br>`src/8_grid.ts:602` |
| `view.scroll`<br>Treat scroll position as state the kernel can read and write | Nothing can be scrolled into view on demand, so a found row may be off screen. | no | [yes (mit)](https://mui.com/x/react-data-grid/scrolling/) | yes | `src/3_paths.ts:247` |
| `view.density`<br>Switch row height between preset scales | Dense review and comfortable reading need two differently configured grids. | no | [yes (mit)](https://mui.com/x/react-data-grid/accessibility/#density) | declared only | `src/8_grid.ts:117` |
| `view.list`<br>Collapse the column axis to one cell per row for narrow screens | A small viewport gets a table that can only be read by scrolling sideways. | no | [yes (pro)](https://mui.com/x/react-data-grid/list-view/) | yes | `src/8_grid.ts:569` |
| `view.slots`<br>Replace any rendered part without forking the grid | Custom rendering means patching the library or wrapping every cell from outside. | no | [yes (mit)](https://mui.com/x/react-data-grid/components/#component-slots) | yes | `src/13_composite.ts:56` |
| `view.a11y`<br>Carry grid roles and aria state on every rendered part | A screen reader announces a pile of divs with no row, column, or selection state. | no | [yes (mit)](https://mui.com/x/react-data-grid/accessibility/) | no |  |
| `view.i18n`<br>Serve every visible string from a replaceable table | The grid speaks English inside an application that does not. | no | [yes (mit)](https://mui.com/x/react-data-grid/localization/) | no |  |
| `view.theme`<br>Drive every dimension and colour from CSS custom properties | Restyling means overriding generated class names and racing the library's own cascade. | no | [partial (mit)](https://mui.com/x/react-data-grid/style/) | yes | `src/3_paths.ts:400` |

### The relation as a whole

| feature | why it matters | TanStack v9 | MUI X | signal-grid | where |
| --- | --- | --- | --- | --- | --- |
| `data.state`<br>Round-trip the whole grid state through a string | A shared link loses the sort, the filters, the page, and the expansion. | no | [yes (mit)](https://mui.com/x/react-data-grid/state/) | declared only | `src/8_grid.ts:140` |
| `data.export`<br>Write the visible axes out as a file | Getting the current view to a colleague is a screenshot. | no | [yes (mit)](https://mui.com/x/react-data-grid/export/) | no |  |
| `data.undo`<br>Step back through changes the user made | A mistaken edit or a lost filter set is permanent. | no | [yes (premium)](https://mui.com/x/react-data-grid/undo-redo/) | no |  |
| `data.charts`<br>Hand the current view to a chart | Seeing the shape of the filtered rows means exporting them into a second tool. | no | [yes (premium)](https://mui.com/x/react-data-grid/charts-integration/) | no |  |
| `data.ai`<br>Answer a natural language question by driving the grid's own state | Expressing an ask means first learning the filter panel's grammar. | no | [yes (premium)](https://mui.com/x/react-data-grid/ai-assistant/) | no |  |

## Cut on purpose

Each of these has a `FeatureId` so the gap is visible, and the parity run fails if one of them is ever tagged as implemented.

| feature | reason |
| --- | --- |
| `row.filter` | The operators exist in 2_operators.ts; the view chain never applies them, so a filter model would be state nothing reads. |
| `row.filter.quick` | Same cut as row.filter: no filter stage in the chain. |
| `row.filter.logic` | Same cut as row.filter: no filter stage in the chain. |
| `row.filter.facet` | Faceting is a query over the unfiltered relation, which belongs upstream of a kernel that never runs the filter. |
| `row.aggregate` | Aggregation is arithmetic over a group, not a relational operator, and it drags a function registry in with it. |
| `cell.edit` | Editing is a form lifecycle. The kernel carries `editing: CellId` and emits commit and cancel effects; the consumer owns the rest. |
| `col.type` | A type system implies editors, formatters, and operator sets. The kernel takes a comparator and a value reader instead. |
| `col.pivot` | Pivoting is grouping on both axes plus an aggregate over the cross, and the aggregate half is cut. |

## Not decided yet

A competitor ships it, this package neither implements it nor rules it out.

| feature | TanStack v9 | MUI X |
| --- | --- | --- |
| `cell.clipboard` | no | [yes (premium)](https://mui.com/x/react-data-grid/clipboard/) |
| `view.a11y` | no | [yes (mit)](https://mui.com/x/react-data-grid/accessibility/) |
| `view.i18n` | no | [yes (mit)](https://mui.com/x/react-data-grid/localization/) |
| `data.export` | no | [yes (mit)](https://mui.com/x/react-data-grid/export/) |
| `data.undo` | no | [yes (premium)](https://mui.com/x/react-data-grid/undo-redo/) |
| `data.charts` | no | [yes (premium)](https://mui.com/x/react-data-grid/charts-integration/) |
| `data.ai` | no | [yes (premium)](https://mui.com/x/react-data-grid/ai-assistant/) |

## Regenerating

Written by `scripts/parity.mjs` (`pnpm parity`). Edits made here are overwritten on the next run; change `src/features.ts`, a `@feature` tag, or `docs/parity.mui.json` instead.
