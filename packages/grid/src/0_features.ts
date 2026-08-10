import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFacetedRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  globalFilteringFeature,
  rowAggregationFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowPinningFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/react-table"

// Every v9 feature module + the row models that need them. Core row model is
// built in. manualSorting stays true (rows memo pre-sorts via lodash).
export const gridFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  rowAggregationFeature,
  rowExpandingFeature,
  rowSelectionFeature,
  rowPinningFeature,
  columnGroupingFeature,
  columnFilteringFeature,
  columnFacetingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  groupedRowModel: createGroupedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
})

export type GridFeatures = typeof gridFeatures
