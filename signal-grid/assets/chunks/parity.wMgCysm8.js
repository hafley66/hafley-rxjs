import{i as e,n as t,r as n}from"./theme.CBoO64oP.js";var r=`{
  "row.sort": {
    "status": "yes",
    "tier": "mit",
    "api": "sortModel, onSortModelChange, initialState.sorting.sortModel, GridColDef.sortComparator, GridColDef.sortingOrder, apiRef.current.sortColumn()",
    "url": "https://mui.com/x/react-data-grid/sorting/",
    "note": "On by default. sortingOrder defaults to ['asc', 'desc', null]; getSortComparator() gives a direction-aware comparator for asymmetric orders."
  },
  "row.sort.multi": {
    "status": "yes",
    "tier": "pro",
    "api": "multipleColumnsSortingMode, apiRef.current.sortColumn(field, direction, allowMultipleSorting)",
    "url": "https://mui.com/x/react-data-grid/sorting/#multi-sorting",
    "note": "The #multi-sorting heading carries the Pro badge. Default requires Ctrl or Shift; multipleColumnsSortingMode=\\"always\\" drops the modifier."
  },
  "row.filter": {
    "status": "yes",
    "tier": "mit",
    "api": "filterModel.items ({ field, operator, value, id }), onFilterModelChange, GridColDef.filterOperators, GridFilterOperator.getApplyFilterFn(), ignoreDiacritics",
    "url": "https://mui.com/x/react-data-grid/filtering/",
    "note": "One item is MIT. Operator sets come from the column type through getGridStringOperators, getGridNumericOperators, getGridDateOperators, getGridBooleanOperators, getGridSingleSelectOperators."
  },
  "row.filter.quick": {
    "status": "yes",
    "tier": "mit",
    "api": "filterModel.quickFilterValues, quickFilterLogicOperator, quickFilterExcludeHiddenColumns, GridColDef.getApplyQuickFilterFn(), apiRef.current.setQuickFilterValues()",
    "url": "https://mui.com/x/react-data-grid/filtering/quick-filter/",
    "note": "The box holds a term array, not a string; quickFilterParser and quickFilterFormatter own the split and the join. Hidden columns are excluded by default."
  },
  "row.filter.logic": {
    "status": "yes",
    "tier": "pro",
    "api": "filterModel.logicOperator (GridLogicOperator.And | GridLogicOperator.Or), apiRef.current.setFilterLogicOperator(), disableMultipleColumnsFiltering",
    "url": "https://mui.com/x/react-data-grid/filtering/multi-filters/",
    "note": "logicOperator carries the Pro badge on the filtering page and defaults to And when omitted."
  },
  "row.filter.facet": {
    "status": "no",
    "tier": null,
    "api": null,
    "url": "https://mui.com/x/react-data-grid/filtering/",
    "note": "No API returns a column's distinct values or its range. The singleSelect filter input lists valueOptions, which the consumer declares on the column rather than the grid deriving it from the rows."
  },
  "row.group": {
    "status": "yes",
    "tier": "premium",
    "api": "rowGroupingModel, onRowGroupingModelChange, rowGroupingColumnMode, groupingColDef, GridColDef.groupingValueGetter(), useKeepGroupedColumnsHidden()",
    "url": "https://mui.com/x/react-data-grid/row-grouping/",
    "note": "Premium. rowGroupingColumnMode picks one shared grouping column or one per criterion; rows whose grouping key is null are left ungrouped."
  },
  "row.tree": {
    "status": "yes",
    "tier": "pro",
    "api": "treeData, getTreeDataPath, GRID_TREE_DATA_GROUPING_FIELD, disableChildrenFiltering, disableChildrenSorting",
    "url": "https://mui.com/x/react-data-grid/tree-data/",
    "note": "A path array per row over a flat row list, not nested source data. Missing intermediate levels are synthesised. Filtering and sorting descend every level unless the disableChildren* props are set."
  },
  "row.expand": {
    "status": "yes",
    "tier": "pro",
    "api": "defaultGroupingExpansionDepth, isGroupExpandedByDefault(), apiRef.current.setRowChildrenExpansion(), rowExpansionChange event",
    "url": "https://mui.com/x/react-data-grid/tree-data/#group-expansion-with-tree-data",
    "note": "Expansion exists only where tree data, row grouping, or a detail panel does, so it inherits their tier. defaultGroupingExpansionDepth of -1 opens the whole tree."
  },
  "row.detail": {
    "status": "yes",
    "tier": "pro",
    "api": "getDetailPanelContent, getDetailPanelHeight, detailPanelExpandedRowIds, onDetailPanelExpandedRowIds, apiRef.current.toggleDetailPanel()",
    "url": "https://mui.com/x/react-data-grid/master-detail/",
    "note": "One panel per row, default height 500px. getDetailPanelHeight returns a number or \\"auto\\"; returning null from getDetailPanelContent removes the toggle for that row."
  },
  "row.select": {
    "status": "yes",
    "tier": "pro",
    "api": "rowSelectionModel ({ type: 'include' | 'exclude', ids: Set<GridRowId> }), onRowSelectionModelChange, checkboxSelection, isRowSelectable, rowSelectionPropagation, keepNonExistentRowsSelected",
    "url": "https://mui.com/x/react-data-grid/row-selection/",
    "note": "Single selection and checkboxSelection are MIT; the #multiple-row-selection heading carries the Pro badge. The exclude model makes select-all O(1) in the deselected count rather than in the row count."
  },
  "row.pin": {
    "status": "yes",
    "tier": "pro",
    "api": "pinnedRows ({ top, bottom }), pinnedRowsSectionSeparator",
    "url": "https://mui.com/x/react-data-grid/row-pinning/",
    "note": "Pinned rows are passed as row objects rather than ids, so they sit outside sorting, filtering, and pagination entirely, and do not participate in selection, grouping, tree data, reordering, or detail panels."
  },
  "row.order": {
    "status": "yes",
    "tier": "pro",
    "api": "rowReordering, onRowOrderChange, isRowReorderable, isValidRowReorder, GRID_REORDER_COL_DEF, __reorder__ field, rowDragStart/rowDragOver/rowDragEnd events",
    "url": "https://mui.com/x/react-data-grid/row-ordering/",
    "note": "Reordering is disabled while a sort is applied. Under tree data or row grouping a drop can reparent a row, which routes through processRowUpdate()."
  },
  "row.height": {
    "status": "yes",
    "tier": "mit",
    "api": "rowHeight (default 52), getRowHeight (may return \\"auto\\"), getEstimatedRowHeight, getRowSpacing, rowSpacingType, virtualizeColumnsWithAutoRowHeight",
    "url": "https://mui.com/x/react-data-grid/row-height/",
    "note": "\\"auto\\" measures content lazily as rows render, and turns column virtualization off unless virtualizeColumnsWithAutoRowHeight is set, because an unrendered column would change the measurement."
  },
  "row.aggregate": {
    "status": "yes",
    "tier": "premium",
    "api": "aggregationModel, aggregationFunctions, GRID_AGGREGATION_FUNCTIONS, GridAggregationFunction ({ apply, columnTypes, label, getCellValue, valueFormatter }), getAggregationPosition, aggregationRowsScope",
    "url": "https://mui.com/x/react-data-grid/aggregation/",
    "note": "Six built-ins (sum, avg, min, max, size, size(true|false)), each restricted to declared columnTypes. getAggregationPosition returns \\"footer\\", \\"inline\\", or null per group node, so a total can be a new row or a value inside the group header."
  },
  "col.visible": {
    "status": "yes",
    "tier": "mit",
    "api": "columnVisibilityModel, onColumnVisibilityModelChange, GridColDef.hideable, disableColumnSelector, slotProps.columnsManagement.getTogglableColumns",
    "url": "https://mui.com/x/react-data-grid/column-visibility/",
    "note": "A false entry hides the field; an absent entry is visible."
  },
  "col.order": {
    "status": "yes",
    "tier": "pro",
    "api": "disableColumnReorder, GridColDef.disableReorder, columnHeaderDragStart/DragEnter/DragOver/DragEnd events",
    "url": "https://mui.com/x/react-data-grid/column-ordering/",
    "note": "The whole page carries the Pro badge; there is no columnOrderModel prop, so order is expressed by the order of the columns array plus the drag events."
  },
  "col.pin": {
    "status": "yes",
    "tier": "pro",
    "api": "pinnedColumns ({ left, right }), onPinnedColumnsChange, GridColDef.pinnable, pinnedColumnsSectionSeparator, apiRef.current.pinColumn()/unpinColumn()",
    "url": "https://mui.com/x/react-data-grid/column-pinning/",
    "note": "Sides are named left and right, so the model already assumes a writing direction."
  },
  "col.resize": {
    "status": "yes",
    "tier": "mit",
    "api": "GridColDef.resizable, disableColumnResize, onColumnResize, onColumnWidthChange",
    "url": "https://mui.com/x/react-data-grid/column-dimensions/#resizing",
    "note": "No plan badge on the page or the #resizing heading. onColumnResize fires during the drag, onColumnWidthChange only after it settles."
  },
  "col.size": {
    "status": "yes",
    "tier": "mit",
    "api": "GridColDef.width (default 100), GridColDef.minWidth (default 50), GridColDef.maxWidth, GridColDef.flex",
    "url": "https://mui.com/x/react-data-grid/column-dimensions/#fluid-width",
    "note": "flex divides the leftover width proportionally and is overridden when width is also set on the same column."
  },
  "col.autosize": {
    "status": "yes",
    "tier": "mit",
    "api": "autosizeOptions ({ columns, includeHeaders, includeOutliers, outliersFactor, expand, disableColumnVirtualization }), autosizeOnMount, disableAutosize, apiRef.current.autosizeColumns()",
    "url": "https://mui.com/x/react-data-grid/column-dimensions/#autosizing",
    "note": "MIT: neither the page nor the #autosizing heading carries a badge; only the includeHeaderFilters sub-option is Pro. autosizeOptions applies to the separator double-click and autosizeOnMount, not to the api method, which takes its own options."
  },
  "col.group": {
    "status": "yes",
    "tier": "mit",
    "api": "columnGroupingModel ({ groupId, children, headerName, description, renderHeaderGroup, freeReordering }), columnGroupHeaderHeight",
    "url": "https://mui.com/x/react-data-grid/column-groups/",
    "note": "Nestable, and a column may belong to only one group. Collapsible groups are a renderHeaderGroup recipe rather than a prop; managing group visibility and reordering a whole group are marked not yet shipped."
  },
  "col.type": {
    "status": "yes",
    "tier": "mit",
    "api": "GridColDef.type ('string' | 'longText' | 'number' | 'date' | 'dateTime' | 'boolean' | 'singleSelect' | 'multiSelect' | 'actions'), valueOptions, GridColTypeDef",
    "url": "https://mui.com/x/react-data-grid/custom-columns/",
    "note": "The type supplies the comparator, the operator set, the editor, and the formatter together. Default is 'string'; an unknown type falls back to 'string'; 'multiSelect' is Pro."
  },
  "col.formula": {
    "status": "yes",
    "tier": "premium",
    "api": "GridColDef.allowFormulas, featureDependencies={{ formula: formulaFeature }}, disableFormulas, formulaA1Notation, GRID_FORMULA_FUNCTIONS, FormulaBar",
    "url": "https://mui.com/x/react-data-grid/formulas/",
    "note": "A cell value beginning with = is parsed and evaluated at runtime, with A1 references, relative and absolute ($) offsetting under fill, and reference highlighting. Not a closure over the row: the source string is what processRowUpdate and undo see."
  },
  "col.pivot": {
    "status": "yes",
    "tier": "premium",
    "api": "pivotModel ({ rows, columns, values }), pivotActive, pivotPanelOpen, getPivotDerivedColumns, pivotingColDef(), GridColDef.pivotable",
    "url": "https://mui.com/x/react-data-grid/pivoting/",
    "note": "Pivot mode overrides rows, columns, rowGroupingModel, aggregationModel, columnVisibilityModel, columnGroupingModel, and headerFilters. Date columns gain generated year and quarter derived columns."
  },
  "cell.select": {
    "status": "yes",
    "tier": "premium",
    "api": "cellSelection, cellSelectionModel (Record<GridRowId, Record<field, boolean>>), onCellSelectionModelChange, apiRef.current.selectCellRange(), apiRef.current.getSelectedCellsAsArray()",
    "url": "https://mui.com/x/react-data-grid/cell-selection/",
    "note": "The model enumerates cells rather than storing rectangles. Range edges are exposed as the CSS classes MuiDataGrid-cell--rangeTop/rangeBottom/rangeLeft/rangeRight."
  },
  "cell.focus": {
    "status": "yes",
    "tier": "mit",
    "api": "gridFocusCellSelector, tabNavigation ('none' | 'content' | 'header' | 'all'), documented arrow, Home, End, and Page key map",
    "url": "https://mui.com/x/react-data-grid/accessibility/#keyboard-navigation",
    "note": "Cell by cell arrow navigation with one roving tab stop. tabNavigation defaults to \\"none\\", which keeps Tab moving past the grid instead of through it."
  },
  "cell.edit": {
    "status": "yes",
    "tier": "mit",
    "api": "GridColDef.editable, editMode ('cell' | 'row'), processRowUpdate, preProcessEditCellProps, valueParser, valueSetter, cellModesModel, rowModesModel, apiRef.current.startCellEditMode()",
    "url": "https://mui.com/x/react-data-grid/editing/",
    "note": "Two-phase commit: preProcessEditCellProps validates per field, may be async, and blocks the save by setting props.error; processRowUpdate then persists and may reject."
  },
  "cell.span": {
    "status": "yes",
    "tier": "mit",
    "api": "GridColDef.colSpan (number or (params) => number), rowSpanning prop, GridColDef.rowSpanValueGetter",
    "url": "https://mui.com/x/react-data-grid/column-spanning/",
    "note": "Two separate MIT features. colSpan is declared per cell; rowSpanning auto-merges consecutive equal values down a column, and rowSpanValueGetter decides what counts as equal. Row spanning does not work with variable or dynamic row height."
  },
  "cell.clipboard": {
    "status": "yes",
    "tier": "premium",
    "api": "onClipboardCopy, clipboardCopyCellDelimiter, disableClipboardPaste, GridColDef.pastedValueParser, splitClipboardPastedText, cellSelectionFillHandle, onBeforeClipboardPasteStart",
    "url": "https://mui.com/x/react-data-grid/clipboard/",
    "note": "Copy is MIT; the #clipboard-paste heading carries the Premium badge, so the pair is Premium. Paste routes through processRowUpdate, the same path as editing. Ctrl+D and Ctrl+R fill down and right."
  },
  "page.paginate": {
    "status": "yes",
    "tier": "mit",
    "api": "paginationModel ({ page, pageSize }, default { page: 0, pageSize: 100 }), pageSizeOptions, autoPageSize, paginationMode, rowCount, paginationMeta.hasNextPage, estimatedRowCount",
    "url": "https://mui.com/x/react-data-grid/pagination/",
    "note": "MIT caps a page at 100 rows and always paginates; Pro and Premium default to off and need the pagination prop. autoPageSize derives pageSize from the container height. paginationMeta.hasNextPage covers cursor paging where the total is unknown."
  },
  "page.infinite": {
    "status": "yes",
    "tier": "pro",
    "api": "lazyLoading, lazyLoadingRequestThrottleMs (default 500), scrollEndThreshold, GridGetRowsResponse.rowCount, apiRef.current.setRowCount()",
    "url": "https://mui.com/x/react-data-grid/server-side-data/lazy-loading/#infinite-loading",
    "note": "Two modes chosen by whether the total is known: viewport loading fills skeleton rows to the known count and fetches the pages a scroll uncovers; infinite loading appends at the bottom until a response returns nothing."
  },
  "page.server": {
    "status": "yes",
    "tier": "mit",
    "api": "dataSource ({ getRows, updateRow, getGroupKey, getChildrenCount, getAggregatedValue }), dataSourceCache, GridDataSourceCacheDefault, dataSourceRevalidateMs, dataSourceKeepPreviousData, onDataSourceError, apiRef.current.dataSource.fetchRows()",
    "url": "https://mui.com/x/react-data-grid/server-side-data/",
    "note": "The dataSource page carries no plan badge; supplying it flips sortingMode, filterMode, and paginationMode to server at once. Caching, revalidation, keep-previous-data, and error routing come with the layer; the lazy loading, tree data, row grouping, and aggregation extensions of it are Pro or Premium."
  },
  "view.virtualize.row": {
    "status": "yes",
    "tier": "pro",
    "api": "rowBufferPx, disableVirtualization, experimentalFeatures.virtualizerLayoutMode",
    "url": "https://mui.com/x/react-data-grid/virtualization/",
    "note": "The #row-virtualization heading carries the Pro badge. Off under autoHeight. Layout mode is uncontrolled (native scroll container) by default, controlled (absolute positions) behind the experimental flag."
  },
  "view.virtualize.col": {
    "status": "yes",
    "tier": "mit",
    "api": "columnBufferPx (default 150), apiRef.current.unstable_setColumnVirtualization()",
    "url": "https://mui.com/x/react-data-grid/virtualization/#column-virtualization",
    "note": "No badge on this heading, so the column axis is MIT while the row axis is Pro. A rowHeader column stays mounted through it so a screen reader keeps the row label."
  },
  "view.scroll": {
    "status": "yes",
    "tier": "mit",
    "api": "apiRef.current.scrollToIndexes(), apiRef.current.scroll(), apiRef.current.getScrollPosition(), initialState.scroll ({ top, left })",
    "url": "https://mui.com/x/react-data-grid/scrolling/",
    "note": "scrollToIndexes returns whether the grid had to move. Scroll restoration is a pixel offset in initialState, so it survives a remount but not a change of row count."
  },
  "view.density": {
    "status": "yes",
    "tier": "mit",
    "api": "density ('standard' | 'compact' | 'comfortable'), initialState.density, onDensityChange, densityChange event",
    "url": "https://mui.com/x/react-data-grid/accessibility/#density",
    "note": "Density is also derived from rowHeight and columnHeaderHeight when those are set, and reaches getRowHeight as params.densityFactor."
  },
  "view.list": {
    "status": "yes",
    "tier": "pro",
    "api": "listView, listViewColumn (GridListViewColDef with a required renderCell())",
    "url": "https://mui.com/x/react-data-grid/list-view/",
    "note": "One cell per row for narrow viewports. The column axis is not collapsed automatically: listViewColumn.renderCell must be supplied, and the page lists per-feature compatibility."
  },
  "view.slots": {
    "status": "yes",
    "tier": "mit",
    "api": "slots, slotProps, useGridApiContext(), useGridSelector(), showToolbar, hideFooter",
    "url": "https://mui.com/x/react-data-grid/components/#component-slots",
    "note": "Covers cell, row, toolbar, footer, pagination, column menu, panels, overlays, and icons. Overlays are a named set: loadingOverlay, noRowsOverlay, noResultsOverlay, noColumnsOverlay, emptyPivotOverlay."
  },
  "view.a11y": {
    "status": "yes",
    "tier": "mit",
    "api": "GridColDef.rowHeader, tabNavigation, aria-sort on sorted headers, documented keyboard map",
    "url": "https://mui.com/x/react-data-grid/accessibility/",
    "note": "Grid roles, a rowheader role opt-in per column, and a published key map covering navigation, selection, sorting, and grouping."
  },
  "view.i18n": {
    "status": "yes",
    "tier": "mit",
    "api": "localeText, @mui/x-data-grid/locales bundles, localeText.paginationDisplayedRows",
    "url": "https://mui.com/x/react-data-grid/localization/",
    "note": "Every string is a key in localeText. Right to left is handled by wrapping the grid in a dir=\\"rtl\\" provider rather than by a grid prop."
  },
  "view.theme": {
    "status": "partial",
    "tier": "mit",
    "api": "sx, GridColDef.cellClassName, GridColDef.headerClassName, getRowClassName, getCellClassName, theme.palette.DataGrid.bg/headerBg/pinnedBg",
    "url": "https://mui.com/x/react-data-grid/style/",
    "note": "Styling goes through sx, class name overrides, and Material UI theme palette keys. The only CSS custom properties documented anywhere in the docs are --DataGrid-overlayHeight and --DataGrid-cellOffsetMultiplier, so there is no custom-property surface for dimensions and colour."
  },
  "data.state": {
    "status": "yes",
    "tier": "mit",
    "api": "initialState, apiRef.current.exportState(), apiRef.current.restoreState(), useGridSelector(), the published selector catalog",
    "url": "https://mui.com/x/react-data-grid/state/",
    "note": "No plan badge on the page. exportState and initialState share one shape, and restoreState accepts a partial. The value is an object, not a string, so encoding it for a url is the consumer's job."
  },
  "data.export": {
    "status": "yes",
    "tier": "mit",
    "api": "csvOptions, printOptions, excelOptions, GridColDef.disableExport, getRowsToExport(), apiRef.current.exportDataAsCsv()/exportDataAsPrint()/exportDataAsExcel()",
    "url": "https://mui.com/x/react-data-grid/export/",
    "note": "CSV and print are MIT; the #excel-export heading carries the Premium badge and can run in a web worker. escapeFormulas defaults to true on both CSV and Excel."
  },
  "data.undo": {
    "status": "yes",
    "tier": "premium",
    "api": "historyStackSize (default 30), historyEventHandlers, historyValidationEvents, createCellEditHistoryHandler()",
    "url": "https://mui.com/x/react-data-grid/undo-redo/",
    "note": "A stack of handlers keyed to mutation events (rowEditStop, cellEditStop, clipboardPasteEnd), revalidated when paginationModelChange, columnsChange, sortedRowsSet, filteredRowsSet, or rowsSet fires."
  },
  "data.charts": {
    "status": "yes",
    "tier": "premium",
    "api": "chartsIntegration, GridChartsIntegrationContextProvider, GridChartsRendererProxy, GridChartsPanel, apiRef.current.updateChartValuesData()",
    "url": "https://mui.com/x/react-data-grid/charts-integration/",
    "note": "The current grouped, aggregated, or pivoted view is pushed to a chart renderer continuously; several proxies with distinct ids drive several charts from one grid."
  },
  "data.ai": {
    "status": "yes",
    "tier": "premium",
    "api": "aiAssistant, onPrompt (returns Promise<PromptResponse>), unstable_gridDefaultPromptResolver(), GridAiAssistantPanel, GridColDef.examples, allowAiAssistantDataSampling, additionalContext",
    "url": "https://mui.com/x/react-data-grid/ai-assistant/",
    "note": "A prompt returns a PromptResponse that drives sort, filter, grouping, and pivot state. Column examples and sampled cell values are sent as context to raise accuracy."
  }
}
`,i=`{
  "row.sort": {
    "status": "yes",
    "api": "rowSortingFeature, TableState.sorting: SortingState, column.toggleSorting(), createSortedRowModel",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/rowSortingFeature",
    "note": "SortingState is Array<{ id, desc }>. Per column: enableSorting, sortFn, sortDescFirst, sortUndefined, invertSorting."
  },
  "row.sort.multi": {
    "status": "yes",
    "api": "enableMultiSort, maxMultiSortColCount, isMultiSortEvent, enableMultiRemove, column.getSortIndex()",
    "url": "https://tanstack.com/table/latest/docs/reference/index/type-aliases/SortingState",
    "note": "Multi-sort is the same SortingState array with more than one entry; the modifier-key policy is a replaceable predicate rather than a fixed rule."
  },
  "row.filter": {
    "status": "yes",
    "api": "columnFilteringFeature, TableState.columnFilters: ColumnFiltersState, column.setFilterValue(), createFilteredRowModel",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/columnFilteringFeature",
    "note": "22 built-in filterFn_* predicates. filterFromLeafRows and maxLeafRowFilterDepth pick the tree filter mode."
  },
  "row.filter.quick": {
    "status": "yes",
    "api": "globalFilteringFeature, TableState.globalFilter, table.setGlobalFilter(), globalFilterFn, getColumnCanGlobalFilter",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/globalFilteringFeature",
    "note": "globalFilter is typed any, not a term list, so whitespace splitting is the consumer's job."
  },
  "row.filter.logic": {
    "status": "partial",
    "api": "ColumnFiltersState = Array<{ id, value }>",
    "url": "https://tanstack.com/table/latest/docs/reference/index/type-aliases/ColumnFiltersState",
    "note": "Items combine with an implicit conjunction. No logicOperator field anywhere in the installed .d.ts, so or is only reachable by writing one filterFn that ors internally."
  },
  "row.filter.facet": {
    "status": "yes",
    "api": "columnFacetingFeature, column.getFacetedUniqueValues(): Map<any, number>, column.getFacetedMinMaxValues(): [number, number], createFacetedRowModel",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/columnFacetingFeature",
    "note": "Facets come from a separate row model that applies every filter except the column's own, plus global variants on the table."
  },
  "row.group": {
    "status": "yes",
    "api": "columnGroupingFeature, TableState.grouping: GroupingState, column.toggleGrouping(), createGroupedRowModel, groupedColumnMode",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/columnGroupingFeature",
    "note": "groupedColumnMode is false | 'reorder' | 'remove', which decides what a grouped column does to the column axis. getGroupingValue supplies a group key that differs from the cell value."
  },
  "row.tree": {
    "status": "yes",
    "api": "TableOptions.getSubRows(originalRow, index), row.subRows, row.depth, row.getParentRows(), table.getMaxSubRowDepth()",
    "url": "https://tanstack.com/table/latest/docs/guide/rows",
    "note": "Tree data is a core rows option, not a directory under dist/features, so a feature-directory listing misses it. Source shape is nested, not a path array."
  },
  "row.expand": {
    "status": "yes",
    "api": "rowExpandingFeature, TableState.expanded: ExpandedState, row.toggleExpanded(), createExpandedRowModel, paginateExpandedRows",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/rowExpandingFeature",
    "note": "ExpandedState is true | Record<string, boolean>, so expand-all is one literal rather than a filled map. paginateExpandedRows decides whether children count against the page."
  },
  "row.detail": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/rowExpandingFeature",
    "note": "No detail-panel symbol exists in the installed dist. getRowCanExpand lets a consumer render a panel for a childless row, but the expanded row model still only emits subRows, so the panel is not a row the kernel knows about. scripts/parity.mjs currently maps row-expanding to row.detail, which overstates this."
  },
  "row.select": {
    "status": "yes",
    "api": "rowSelectionFeature, TableState.rowSelection: RowSelectionState, row.toggleSelected(value, { selectChildren, deselectParents }), enableRowRangeSelection, enableSubRowSelection",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/rowSelectionFeature",
    "note": "RowSelectionState is Record<string, true>, an include set only. Parent and child propagation is per call through ToggleSelectedOptions rather than a table-level policy."
  },
  "row.pin": {
    "status": "yes",
    "api": "rowPinningFeature, TableState.rowPinning: RowPinningState, row.pin(position, includeLeafRows, includeParentRows), keepPinnedRows, table.getTopRows()/getCenterRows()/getBottomRows()",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/rowPinningFeature",
    "note": "RowPinningState is { top: string[], bottom: string[] }, an ordered list per side, so pinned order is user-owned. keepPinnedRows keeps a pinned row visible after it leaves the filtered set."
  },
  "row.order": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/guide/rows",
    "note": "No drag or reorder symbol in the installed dist. row.getDisplayIndex() and table.getRowsInDisplayOrder() read the pipeline's order; there is no user-owned row ranking to write back to."
  },
  "row.height": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/guide/features",
    "note": "table-core emits no markup and holds no pixel state. Row height belongs to @tanstack/react-virtual, a separate package."
  },
  "row.aggregate": {
    "status": "yes",
    "api": "rowAggregationFeature, aggregationFns, columnDef.aggregationFn, column.getAggregationValue(), constructAggregationFn({ aggregate, merge })",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/rowAggregationFeature",
    "note": "11 built-ins (count, extent, first, last, max, mean, median, min, sum, unique, uniqueCount). A definition may carry merge so a deep tree folds subtree results instead of rescanning leaves, and a column may declare an array of aggregations at once."
  },
  "col.visible": {
    "status": "yes",
    "api": "columnVisibilityFeature, TableState.columnVisibility: ColumnVisibilityState, column.toggleVisibility(), table.getVisibleLeafColumns()",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/columnVisibilityFeature",
    "note": "Record<string, boolean>; an absent key means visible."
  },
  "col.order": {
    "status": "yes",
    "api": "columnOrderingFeature, TableState.columnOrder: ColumnOrderState, table.setColumnOrder(), table.getColumnIndexes()",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/columnOrderingFeature",
    "note": "ColumnOrderState is a plain id array. getColumnIndexes answers per pinned section (all, start, center, end), so an index is meaningful inside its run."
  },
  "col.pin": {
    "status": "yes",
    "api": "columnPinningFeature, TableState.columnPinning: ColumnPinningState, column.pin('start' | 'end' | false), table.getStartVisibleLeafColumns()",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/columnPinningFeature",
    "note": "Sides are start and end rather than left and right, so the model is direction-neutral before layout."
  },
  "col.resize": {
    "status": "yes",
    "api": "columnResizingFeature, TableState.columnResizing: columnResizingState, header.getResizeHandler(), columnResizeMode: 'onChange' | 'onEnd', columnResizeDirection: 'ltr' | 'rtl'",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/columnResizingFeature",
    "note": "The in-flight gesture is its own state (columnSizingStart, deltaOffset, deltaPercentage, isResizingColumn, startOffset, startSize) held apart from the resolved size in columnSizingFeature."
  },
  "col.size": {
    "status": "partial",
    "api": "columnSizingFeature, columnDef.size/minSize/maxSize, column.getSize(), table.getColumnOffsets(), table.getTotalSize()",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/columnSizingFeature",
    "note": "Absolute pixel sizes with clamping. No flex and no leftover-space distribution, so nothing fills the space right of the last column."
  },
  "col.autosize": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/guide/features",
    "note": "Fitting a column to rendered content needs measurement, and table-core never touches the DOM."
  },
  "col.group": {
    "status": "yes",
    "api": "createColumnHelper().group(), GroupColumnDef, buildHeaderGroups(), table.getHeaderGroups(), header.colSpan, header.depth, header.isPlaceholder",
    "url": "https://tanstack.com/table/latest/docs/guide/header-groups",
    "note": "Header groups live in coreHeadersFeature, not dist/features, so a feature-directory listing misses them. Nesting comes from a columns array on a column def, and buildHeaderGroups turns that into one header row per depth."
  },
  "col.type": {
    "status": "partial",
    "api": "filterFn: 'auto' | FilterFnOption, sortFn: 'auto' | SortFnOption, column.getAutoFilterFn(), column.getAutoSortFn(), ColumnMeta",
    "url": "https://tanstack.com/table/latest/docs/reference/index/type-aliases/FilterFnOption",
    "note": "'auto' picks a predicate and a comparator by looking at a sample value, so behaviour follows from the value rather than from a declared type. There is no editor, no formatter, and no operator list; ColumnMeta is an empty interface for the consumer to augment."
  },
  "col.formula": {
    "status": "yes",
    "api": "AccessorFn, createColumnHelper().accessor(row => ...), row.getValue(columnId), TransformDataValueFn",
    "url": "https://tanstack.com/table/latest/docs/reference/index/type-aliases/AccessorFn",
    "note": "A derived column is an accessor function over the row, evaluated once per row and cached in row._valuesCache. It is a closure, not a user-editable expression, so there is no parser, no cell references, and no dependency graph."
  },
  "col.pivot": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/guide/features",
    "note": "No pivot symbol in the installed dist. Grouping plus aggregation covers one axis; nothing turns distinct row values into columns."
  },
  "cell.select": {
    "status": "yes",
    "api": "cellSelectionFeature, TableState.cellSelection: CellSelectionState, table.selectCellRange(range, { mode, additive }), table.getCellSelectionBounds(), table.getSelectedCellRangesData()",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/cellSelectionFeature",
    "note": "CellSelectionState is an array of rectangles, each carrying operation 'include' or 'exclude', so a hole in a selection is one more rectangle rather than an enumerated cell set. Rectangles expand to enclose merged cells through getCellSelectionMergeBounds."
  },
  "cell.focus": {
    "status": "yes",
    "api": "table.getFocusedCell(), table.setFocusedCell(rowId, columnId), table.moveCellSelection(direction), table.extendCellSelection(direction), cell.getIsFocused(), cell.getTabIndex()",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/cellSelectionFeature",
    "note": "Focus ships inside cellSelectionFeature rather than as its own feature, so a directory listing files it under cell selection. cell.getTabIndex() gives the roving tabindex; the key handler itself is the consumer's."
  },
  "cell.edit": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/guide/table-and-column-meta",
    "note": "No editing feature. The documented pattern is an updateData function hung on TableMeta, which the consumer declares and calls."
  },
  "cell.span": {
    "status": "yes",
    "api": "cellSpanningFeature, columnDef.spanColumns, columnDef.spanRows, cell.getColSpan(), cell.getRowSpan(), cell.getIsCovered(), table.getCellSpanIndex()",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/cellSpanningFeature",
    "note": "spanRows is a predicate over (row, previousRow, anchorRow, value, anchorValue), so a run collapses by comparison rather than by a declared count. The span index is Int32Array per column."
  },
  "cell.clipboard": {
    "status": "partial",
    "api": "table.getSelectedCellRangesData(): Array<Array<Array<unknown>>>",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/cellSelectionFeature",
    "note": "The selection hands back a row-major value grid per region. Its own doc comment states that serializing to clipboard text is left to userland, and there is no paste path at all."
  },
  "page.paginate": {
    "status": "yes",
    "api": "rowPaginationFeature, TableState.pagination: PaginationState, createPaginatedRowModel, table.setPageIndex(), table.getPageCount()",
    "url": "https://tanstack.com/table/latest/docs/reference/index/variables/rowPaginationFeature",
    "note": "PaginationState is { pageIndex, pageSize }. firstPage, lastPage, nextPage, previousPage, and getCanNextPage ship as table methods."
  },
  "page.infinite": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/reference/index/interfaces/PaginationState",
    "note": "Pagination is one page at a time. There is no accumulate mode and no scroll-driven page advance, because table-core does not know where the viewport is."
  },
  "page.server": {
    "status": "yes",
    "api": "manualFiltering, manualSorting, manualGrouping, manualExpanding, manualPagination, manualAggregation, pageCount, rowCount",
    "url": "https://tanstack.com/table/latest/docs/guide/client-side-vs-server-side",
    "note": "Each stage is skipped independently, so a table can sort on the server and group on the client. There is no query descriptor type; the consumer reads table.getState() and builds the request."
  },
  "view.virtualize.row": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/guide/features",
    "note": "No viewport, no measurement, no window. Row virtualization is @tanstack/react-virtual, a package table-core does not depend on."
  },
  "view.virtualize.col": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/guide/features",
    "note": "Same as the row axis. table.getColumnOffsets() gives cumulative starts and afters a consumer's own virtualizer can use, which is the closest symbol."
  },
  "view.scroll": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/guide/features",
    "note": "Scroll position is not state table-core holds or can write."
  },
  "view.density": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/guide/features",
    "note": "No pixel or spacing state of any kind."
  },
  "view.list": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/guide/features",
    "note": "There is no layout to collapse. A consumer can read one cell per row from row.getVisibleCells() and lay it out however it likes."
  },
  "view.slots": {
    "status": "partial",
    "api": "flexRender(), ColumnDefTemplate, columnDef.cell, columnDef.header, columnDef.footer, columnDef.aggregatedCell",
    "url": "https://tanstack.com/table/latest/docs/reference/index/type-aliases/ColumnDefTemplate",
    "note": "Four replaceable render points on a column def, resolved through flexRender. There is no chrome to replace because table-core renders no chrome, so there is no toolbar, panel, overlay, or checkbox slot."
  },
  "view.a11y": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/reference/static-functions/index",
    "note": "No roles and no aria attributes are emitted, because nothing is emitted. cell_getTabIndex is the only accessibility-adjacent symbol in the whole surface, and it comes from cell selection."
  },
  "view.i18n": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/guide/features",
    "note": "No user-visible strings ship, so there is nothing to translate."
  },
  "view.theme": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/guide/features",
    "note": "No stylesheet and no class names."
  },
  "data.state": {
    "status": "partial",
    "api": "TableState, TableOptions.initialState, TableOptions.state, getInitialTableState(), table.reset(), cloneState(), table.atoms",
    "url": "https://tanstack.com/table/latest/docs/reference/index/type-aliases/TableState",
    "note": "TableState is one plain object built from the registered features, so JSON round-tripping works by construction. There is no encode or decode to a string, no url adapter, and no partial restore method."
  },
  "data.export": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/guide/features",
    "note": "No file writer. table.getSelectedCellRangesData() and the row models are what a consumer serializes from."
  },
  "data.undo": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/reference/index/type-aliases/TableState",
    "note": "No history. State is a single current value behind atoms; table.reset() returns to initialState and keeps no stack."
  },
  "data.charts": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/guide/features",
    "note": "No chart integration. The grouped and aggregated row models are the data a consumer would hand to one."
  },
  "data.ai": {
    "status": "no",
    "api": null,
    "url": "https://tanstack.com/table/latest/docs/guide/features",
    "note": "No prompt surface in the library. The docs ship an Agent Skills page, which is instructions for coding agents writing TanStack Table code, not an assistant that drives a running table."
  }
}
`,a=JSON.parse(r),o=JSON.parse(i),s=[`The matrix`,`Cut on purpose`,`Not decided yet`];function c(e){let t=e.cloneNode(!0);for(let e of t.querySelectorAll(`.header-anchor`))e.remove();return(t.textContent??``).trim()}var l=e=>e.trim().toLowerCase(),u=e=>[...e.querySelectorAll(`th, td`)];function d(e){let t={};return e.forEach((e,n)=>{t[l(e.textContent??``)]=n}),t}var f=(e,t)=>t===void 0?void 0:e[t],p=e=>(e?.textContent??``).replace(/\s+/g,` `).trim();function m(e){if(e===void 0)return{id:``,label:``};let t=(e.querySelector(`code`)?.textContent??p(e)).trim(),n=e.cloneNode(!0);return n.querySelector(`code`)?.remove(),{id:t,label:p(n)}}var h=e=>p(e?.querySelector(`a`)??e),g=e=>e?.querySelector(`a`)?.getAttribute(`href`)??``;function _(e){let t=a[e],n=o[e],r=[];return n?.api&&r.push(`TanStack: ${n.api}`),n?.note&&r.push(n.note),t?.api&&r.push(`MUI: ${t.api}`),t?.note&&r.push(t.note),r.join(`
`)}function v(e){let t=[],n=[],r=null,i=``,l=``;for(let v of e.querySelectorAll(`h2, h3, table`)){if(!(v instanceof HTMLElement))continue;if(v.tagName===`H2`){i=c(v),l=``,i===`The matrix`&&(r=v);continue}let e=s.includes(i);if(v.tagName===`H3`){l=c(v),e&&n.push(v);continue}if(!e)continue;let y=v.querySelector(`thead tr`);if(y===null)continue;let b=d(u(y));if(b.feature===void 0)continue;n.push(v);let x=i===`The matrix`?l===``?`Matrix`:l:i;for(let e of v.querySelectorAll(`tbody tr`)){let n=u(e),{id:r,label:s}=m(f(n,b.feature));if(r===``)continue;let c=f(n,b[`mui x`]);t.push({key:`${x}|${r}`,id:r,section:x,feature:s,why:p(f(n,b[`why it matters`]))||p(f(n,b.reason)),tanstack:h(f(n,b[`tanstack v9`]))||(o[r]?.status??``),mui:h(c)||(a[r]?.status??``),grid:i===`The matrix`?h(f(n,b[`signal-grid`])):i===`Cut on purpose`?`cut on purpose`:`not decided`,where:p(f(n,b.where)),muiUrl:a[r]?.url??g(c),detail:_(r)})}}return{rows:t,replaced:n,anchor:r}}var y=(e,t,n)=>{let r=document.createElement(e);return r.className=t,n!==void 0&&(r.textContent=n),r},b=e=>e.startsWith(`yes`)?`yes`:e.startsWith(`partial`)?`partial`:e.startsWith(`declared`)?`declared`:`no`;function x(e){let t=y(`span`,`pill`,e);return t.dataset.tone=b(e),t}var S=[{id:`id`,header:`Feature`,type:`string`,width:190,resizable:!0},{id:`feature`,header:`What it does`,type:`string`,width:300,resizable:!0},{id:`section`,header:`Axis`,type:`string`,width:150,resizable:!0},{id:`tanstack`,header:`TanStack v9`,type:`string`,width:120,resizable:!0},{id:`mui`,header:`MUI X`,type:`string`,width:140,resizable:!0},{id:`grid`,header:`signal-grid`,type:`string`,width:150,resizable:!0},{id:`why`,header:`Why it matters`,type:`string`,width:420,resizable:!0},{id:`where`,header:`Where`,type:`string`,width:240,resizable:!0}];function C(e){let t=String(e.value??``);if(e.col===`id`||e.col===`where`)return t===``?``:y(`code`,e.col===`id`?`parity-id`:`parity-where`,t);if(e.col===`tanstack`||e.col===`grid`)return t===``?``:x(t);if(e.col===`mui`){if(t===``)return``;let n=e.data.muiUrl;if(n===``)return x(t);let r=document.createElement(`a`);return r.href=n,r.target=`_blank`,r.rel=`noreferrer noopener`,r.className=`parity-cite`,r.title=n,r.append(x(t)),r}let n=y(`span`,`parity-text`,t);return(e.col===`feature`||e.col===`why`)&&(n.title=e.data.detail===``?t:`${t}\n\n${e.data.detail}`),n}var w=[{value:`any`,label:`anyone`},{value:`tanstack`,label:`TanStack v9`},{value:`mui`,label:`MUI X`},{value:`grid`,label:`signal-grid`}];function T(e,t,n){let r=y(`label`,`filter`);r.append(y(`span`,`filter-label`,e));let i=document.createElement(`select`);for(let e of t){let t=document.createElement(`option`);t.value=e,t.textContent=e,i.append(t)}return i.addEventListener(`change`,()=>n(i.value)),r.append(i),r}function E(r){let{rows:i,replaced:a,anchor:o}=v(r);if(i.length===0||o===null)return null;for(let e of a)e.hidden=!0;let s=y(`div`,`parity`);o.insertAdjacentElement(`afterend`,s);let c=e(`all`),l=e(`all`),u=e(`any`),d=e(``),f=[`all`,...new Set(i.map(e=>e.section))],p=[`all`,...new Set(i.map(e=>e.grid).filter(e=>e!==``))],m=(e,t)=>t===`tanstack`?e.tanstack.startsWith(`yes`):t===`mui`?e.mui.startsWith(`yes`):t!==`grid`||e.grid.startsWith(`yes`),h=e(()=>{let e=c.$(),t=l.$(),n=u.$(),r=d.$().trim().toLowerCase();return i.filter(i=>e!==`all`&&i.section!==e||t!==`all`&&i.grid!==t||!m(i,n)?!1:r===``||`${i.id} ${i.feature} ${i.why} ${i.where} ${i.detail}`.toLowerCase().includes(r))}),g=y(`div`,`parity-bar`);g.append(T(`Axis`,f,e=>c.$(e)),T(`signal-grid`,p,e=>l.$(e)));let _=y(`label`,`filter`);_.append(y(`span`,`filter-label`,`Supported by`));let b=document.createElement(`select`);for(let e of w){let t=document.createElement(`option`);t.value=e.value,t.textContent=e.label,b.append(t)}b.addEventListener(`change`,()=>u.$(b.value)),_.append(b),g.append(_);let x=y(`label`,`filter filter-text`);x.append(y(`span`,`filter-label`,`Find`));let E=document.createElement(`input`);E.type=`search`,E.placeholder=`feature, api, note`,E.addEventListener(`input`,()=>d.$(E.value)),x.append(E),g.append(x);let D=y(`p`,`parity-count`),O=y(`div`,`parity-grid`);O.tabIndex=0,s.append(g,D,O);let k=O.getBoundingClientRect(),A=e({top:0,left:0,width:Math.round(k.width),height:Math.round(k.height)}),j=n({id:`parity`,rows:h,columns:S,rowId:e=>e.key,state:e({virtualize:{vertical:!0,horizontal:!1}}),viewport:A,overscan:6,slots:{cell:C}}),M=t(j,O),N=j.bind(O),P=O.querySelector(`.sg-scroll`),F=new ResizeObserver(e=>{let t=e[0]?.contentRect;t!==void 0&&(A.$({...A.$(),width:t.width,height:t.height}),j.dispatch({phase:`intent`,type:`viewport.resize`,width:t.width,height:t.height}))}),I=()=>{P instanceof HTMLElement&&(A.$({...A.$(),top:P.scrollTop,left:P.scrollLeft}),j.dispatch({phase:`intent`,type:`viewport.scroll`,top:P.scrollTop,left:P.scrollLeft}))};P instanceof HTMLElement&&(F.observe(P),P.addEventListener(`scroll`,I,{passive:!0}));let L=e=>{e.key.startsWith(`Arrow`)&&e.preventDefault()};O.addEventListener(`keydown`,L);let R=h.$.subscribe(e=>{D.textContent=`${e.length} of ${i.length} features. Click a header to sort, shift-click to add a second key.`});return{teardown:()=>{R.unsubscribe(),F.disconnect(),P instanceof HTMLElement&&P.removeEventListener(`scroll`,I),O.removeEventListener(`keydown`,L),N(),M.stop(),s.remove();for(let e of a)e.hidden=!1}}}export{E as mountParity};