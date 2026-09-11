// The registry. Adding an example is one import and one array entry.
//
// The theme is imported once here rather than in each example, because every example renders the
// same parts and a per-file import would make each displayed source carry a line about styling that
// has nothing to do with the feature it demonstrates.
import "../src/theme.css"
import type { FeatureId } from "../src/features.js"
import type { Example } from "./0_types.js"
import { flatList } from "./1_flat_list.js"
import { multiSort } from "./2_multi_sort.js"
import { treeExpand } from "./3_tree_expand.js"
import { rowPinning } from "./4_row_pinning.js"
import { columnPinning } from "./5_column_pinning.js"
import { columnReorder } from "./6_column_reorder.js"
import { columnVisibility } from "./7_column_visibility.js"
import { columnResize } from "./8_column_resize.js"
import { pagination } from "./9_pagination.js"
import { infiniteScroll } from "./10_infinite_scroll.js"
import { virtualization } from "./11_virtualization.js"
import { rowSelection } from "./12_row_selection.js"
import { radioSelect } from "./13_radio_select.js"
import { detailNestedGrid } from "./14_detail_nested_grid.js"
import { serverMode } from "./15_server_mode.js"
import { observableRows } from "./16_observable_rows.js"
import { cellSlots } from "./17_cell_slots.js"
import { signalSlot } from "./18_signal_slot.js"
import { theming } from "./19_theming.js"
import { rowGrouping } from "./20_row_grouping.js"
import { rowReorder } from "./21_row_reorder.js"
import { rowHeight } from "./22_row_height.js"
import { density } from "./23_density.js"
import { scrollPosition } from "./24_scroll_position.js"
import { tallRelation } from "./25_tall_relation.js"
import { deepTree } from "./26_deep_tree.js"
import { sortChurn } from "./27_sort_churn.js"
import { wideSchema } from "./28_wide_schema.js"
import { headerGroups } from "./29_header_groups.js"

export type { Example, ExampleCheck } from "./0_types.js"
export { VIDEOS, videoById, type Recording } from "./videos.js"

export const EXAMPLES: readonly Example[] = [
  flatList,
  multiSort,
  treeExpand,
  rowGrouping,
  rowPinning,
  rowHeight,
  rowReorder,
  columnPinning,
  headerGroups,
  columnReorder,
  columnVisibility,
  columnResize,
  pagination,
  infiniteScroll,
  virtualization,
  rowSelection,
  radioSelect,
  detailNestedGrid,
  serverMode,
  observableRows,
  cellSlots,
  signalSlot,
  theming,
  density,
  scrollPosition,
  tallRelation,
  deepTree,
  sortChurn,
  wideSchema,
]

export const byId = (id: string): Example | undefined =>
  EXAMPLES.find((example) => example.id === id)

export const byFeature = (feature: FeatureId): readonly Example[] =>
  EXAMPLES.filter((example) => example.feature === feature)
