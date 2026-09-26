# boop-xterm lift map

| Scope | Value |
| --- | --- |
| instant root | `/Users/chrishafley/projects/instant` |
| graph | TypeScript compiler API, tsconfig module resolution; 307 nodes, 17 direct xterm importers, 189 local closure files |
| extraction set | Table C identifies UI sources; Table A retains app dependencies reached through main.ts and terminal.ts |

## Table A. Import closure

| instant file | lines (`wc -l`) | xterm-direct? | instant-only imports | pure imports | test files |
| --- | ---: | :---: | --- | --- | --- |
| `src/00_terminalTurnRegions.ts` | 150 | no | — | — | `src/00_terminalTurnRegions.test.ts`, `src/0_terminalDiagrams.test.ts` |
| `src/00a_terminalIntersection.ts` | 150 | yes | `./0a_terminalHarnessBinding`, `./generated/native` | `@xterm/xterm`, `rxjs` | `src/0_terminalTurnVisibility.receipts.test.ts`, `src/0_terminalTurnVisibility.test.ts`, `src/0_tmuxStatusRow.test.ts`, `src/0_turnSpanBleed.test.ts` |
| `src/00b_terminalLineAnchors.ts` | 99 | yes | `./00a_terminalIntersection` | `@hafley66/signals`, `@xterm/xterm`, `rxjs` | `src/00b_terminalLineAnchors.test.ts`, `src/1a_terminalContextQueue.dom.test.ts`, `src/1c_terminalHoverCheck.test.ts`, `src/1d_terminalTurnMarks.test.ts`, `src/1e_terminalForkMarks.test.ts`, `src/1f_terminalForkRender.test.ts` |
| `src/0_MonacoCodeViewer.tsx` | 128 | no | `./generated/native` | `@hafley66/signals`, `@hafley66/signals/react`, `monaco-editor/editor`, `monaco-editor/features/find/register`, `monaco-editor/languages/definitions/register.all`, `react`, `rxjs` | — |
| `src/0_NavMenuView.tsx` | 374 | no | `./0_navMenu` | `@hafley66/signals/react`, `react`, `react-dom/client` | `src/0_NavMenuView.test.tsx`, `src/0_contextMenuGesture.test.ts` |
| `src/0_PanZoomViewport.tsx` | 117 | no | `./0_panZoomViewport.css`, `./1_LiveProbe` | `react` | `src/0_PanZoomViewport.test.ts` |
| `src/0_agentSquareVisual.ts` | 158 | no | — | `@hafley66/signals` | `src/1_agentSquaresModel.test.ts` |
| `src/0_agentSquaresSettings.ts` | 35 | no | `./0_persistedSetting` | — | — |
| `src/0_boopGraph.ts` | 311 | no | — | — | `src/0_boopGraph.test.ts` |
| `src/0_boopPanelState.ts` | 41 | no | — | `@hafley66/signals` | `src/0_boopPanelState.test.ts` |
| `src/0_boopPresentation.ts` | 176 | no | `./0_boopGraph` | `@hafley66/marbler` | `src/boopPanel.test.ts` |
| `src/0_boopSelection.ts` | 276 | no | `./core`, `./ipc/contract` | — | `src/0_boopSelection.test.ts` |
| `src/0_browserKeyNotice.ts` | 103 | no | `./keymap` | — | `src/0_browserKeyNotice.test.ts` |
| `src/0_clickLaunchers.ts` | 12 | no | — | — | `src/clickrules.launcher.test.ts` |
| `src/0_clickRouter.ts` | 111 | no | `./ipc/contract` | `rxjs` | `src/0_clickRouter.test.ts` |
| `src/0_d2Preview.ts` | 45 | no | — | — | `src/0_d2Preview.test.ts` |
| `src/0_diagramRenderCache.ts` | 45 | no | — | — | `src/0_diagramRenderCache.test.ts` |
| `src/0_dockRestore.ts` | 6 | no | `./0_ids`, `./state` | — | `src/0_dockRestore.test.ts` |
| `src/0_documentHref.ts` | 29 | no | — | — | `src/0_documentHref.test.ts` |
| `src/0_dropStash.ts` | 54 | no | `./generated/native` | — | `src/0_dropStash.test.ts` |
| `src/0_externalKinds.ts` | 38 | no | `./core` | — | `src/0_externalKinds.test.ts` |
| `src/0_externalShells.ts` | 70 | no | `./state` | — | — |
| `src/0_forkRenderSettings.ts` | 10 | no | `./0_persistedSetting` | — | — |
| `src/0_harnessDefinitions.ts` | 112 | no | `./harnessTypes` | — | `src/0_harnessDefinitions.test.ts` |
| `src/0_htmlFileUrl.ts` | 17 | no | — | — | `src/0_htmlFileUrl.test.ts` |
| `src/0_ids.ts` | 1 | no | — | — | — |
| `src/0_inspectorState.ts` | 110 | no | — | — | `src/0_inspectorState.test.ts` |
| `src/0_jumpLabel.ts` | 9 | no | — | — | `src/jumpPalette.test.ts` |
| `src/0_liveProbe.ts` | 88 | no | — | — | `src/0_liveProbe.test.ts` |
| `src/0_markdownTree.ts` | 25 | no | — | `@hafley66/md` | — |
| `src/0_navMenu.ts` | 565 | no | `./fuzzy` | `@hafley66/signals` | `src/0_NavMenuView.test.tsx`, `src/0_navMenu.test.ts`, `src/1g_forkPresetMenu.test.ts` |
| `src/0_navMenuStore.ts` | 16 | no | `./0_navMenu`, `./0_persistedSetting` | — | — |
| `src/0_openExternal.ts` | 26 | no | `./reactive/ports` | — | — |
| `src/0_overlaySettings.ts` | 18 | no | `./0_persistedSetting` | — | `src/0_overlaySettings.test.ts` |
| `src/0_overlaySize.ts` | 7 | no | — | — | `src/0_overlaySize.test.ts` |
| `src/0_paintSvg.ts` | 1 | no | `../0_paintSvg` | — | — |
| `src/0_panelVisibility.ts` | 19 | no | — | `rxjs` | `src/0_panelVisibility.test.ts` |
| `src/0_panicSettings.ts` | 23 | no | `./0_persistedSetting`, `./0_stfuButton` | — | `src/0_panicSettings.test.ts` |
| `src/0_persistedSetting.ts` | 56 | no | `./state` | `@hafley66/signals`, `rxjs` | — |
| `src/0_reopenOrder.ts` | 14 | no | — | — | `src/0_reopenOrder.test.ts` |
| `src/0_rustdoc.ts` | 37 | no | `./browser`, `./core`, `./generated/native` | — | — |
| `src/0_settings.ts` | 149 | no | `./0_persistedSetting`, `./0_terminalDiagrams`, `./harnessTypes`, `./state` | `@hafley66/md/plugins` | `src/panelZoom.test.ts`, `src/state.test.ts` |
| `src/0_stfuButton.ts` | 255 | no | `./generated/native` | `rxjs`, `rxjs/operators` | — |
| `src/0_svgSanitize.ts` | 38 | no | `./0_svgViewport` | `dompurify` | — |
| `src/0_svgViewport.ts` | 82 | no | — | `@hafley66/md` | `src/0_svgViewport.test.ts` |
| `src/0_termCell.ts` | 24 | no | — | — | `src/0_termCell.test.ts` |
| `src/0_terminalDiagrams.test.ts` | 1017 | yes | `./00_terminalTurnRegions`, `./0_terminalDiagrams`, `./0_terminalTurnVisibility` | `@xterm/xterm`, `rxjs`, `vitest` | `src/0_terminalDiagrams.test.ts` |
| `src/0_terminalDiagrams.ts` | 871 | yes | `./00_terminalTurnRegions`, `./0_liveProbe`, `./0_terminalTurnVisibility` | `@hafley66/md`, `@xterm/xterm`, `mermaid/dist/mermaid.min.js?url`, `react`, `react-dom/client`, `rxjs` | `src/0_terminalDiagrams.test.ts` |
| `src/0_terminalFonts.ts` | 22 | no | — | — | `src/0_terminalFonts.test.ts` |
| `src/0_terminalPinnedSelection.ts` | 274 | yes | — | `@xterm/xterm` | `src/0_pinnedWordSelect.test.ts`, `src/0_terminalPinnedSelection.test.ts` |
| `src/0_terminalRowGeometry.test.ts` | 126 | yes | `./0_terminalRowGeometry`, `./0_terminalTurnVisibility` | `@xterm/xterm`, `vitest` | `src/0_terminalRowGeometry.test.ts` |
| `src/0_terminalRowGeometry.ts` | 123 | yes | `./0_terminalTurnVisibility` | `@xterm/xterm` | `src/0_terminalRowGeometry.test.ts`, `src/1f_terminalForkRender.test.ts` |
| `src/0_terminalTurnVisibility.ts` | 452 | no | `./00_terminalTurnRegions`, `./00a_terminalIntersection`, `./0a_terminalTurnMatching` | `rxjs` | `src/0_terminalDiagrams.test.ts`, `src/0_terminalRowGeometry.test.ts`, `src/0_terminalTurnVisibility.receipts.test.ts`, `src/0_terminalTurnVisibility.test.ts`, `src/0_tmuxStatusRow.test.ts`, `src/0_turnDebugOverlay.test.ts`, `src/0_turnSpanBleed.test.ts`, `src/0_turnSpanShift.test.ts`, `src/0b_ompTurnBinding.test.ts`, `src/1b_terminalContextSync.test.ts`, `src/1d_terminalTurnMarks.test.ts`, `src/1e_terminalForkMarks.test.ts`, `src/1f_terminalForkRender.test.ts`, `src/favoriteBoopTurn.test.ts` |
| `src/0_terminalWheel.ts` | 95 | yes | — | `@xterm/xterm`, `rxjs` | `src/0_terminalWheel.test.ts` |
| `src/0_toolGaps.ts` | 62 | no | `./generated/native` | — | `src/0_toolGaps.test.ts` |
| `src/0_turnDebugOverlay.ts` | 269 | yes | `./00_terminalTurnRegions`, `./0_terminalRowGeometry`, `./0_terminalTurnVisibility`, `./1_turnPanel` | `@xterm/xterm`, `rxjs` | `src/0_turnDebugOverlay.test.ts`, `src/0_turnSpanShift.test.ts` |
| `src/0_turnDebugSettings.ts` | 8 | no | `./0_persistedSetting` | — | — |
| `src/0_visibleFileWatch.ts` | 31 | no | — | `rxjs` | `src/0_visibleFileWatch.test.ts` |
| `src/0a_terminalHarnessBinding.ts` | 25 | no | `./0_harnessDefinitions`, `./harnessTypes` | — | `src/0a_terminalHarnessBinding.test.ts` |
| `src/0a_terminalSessionCandidates.ts` | 16 | no | `./harnessTypes` | — | `src/0a_terminalSessionCandidates.test.ts` |
| `src/0a_terminalTurnMatching.ts` | 148 | no | `./00a_terminalIntersection`, `./0_terminalTurnVisibility` | — | `src/0_terminalTurnVisibility.test.ts` |
| `src/0b_ompTurnBinding.ts` | 26 | no | `./0_terminalTurnVisibility`, `./harnessTypes` | — | `src/0b_ompTurnBinding.test.ts` |
| `src/1_FileImageViewer.tsx` | 53 | no | `./0_PanZoomViewport`, `./0_openExternal`, `./1_LiveProbe`, `./1_PdfDocumentViewer`, `./1_SvgDocumentViewer`, `./core` | `react` | — |
| `src/1_LiveProbe.tsx` | 62 | no | `./0_liveProbe` | `react` | — |
| `src/1_PdfDocumentViewer.tsx` | 130 | no | `./0_openExternal`, `./1_LiveProbe`, `./core` | `pdfjs-dist/build/pdf.mjs`, `pdfjs-dist/build/pdf.worker.min.mjs?url`, `pdfjs-dist/types/src/pdf.d.ts`, `pdfjs-dist/web/pdf_viewer.css`, `pdfjs-dist/web/pdf_viewer.mjs`, `react` | — |
| `src/1_SvgDocumentViewer.tsx` | 247 | no | `./0_PanZoomViewport`, `./0_openExternal`, `./0_svgSanitize`, `./0_svgViewport`, `./1_LiveProbe`, `./core` | `react` | — |
| `src/1_agentSquares.ts` | 552 | no | `./0_agentSquareVisual`, `./0_agentSquaresSettings`, `./0_liveProbe`, `./1_agentSquaresFeed`, `./1_agentSquaresMarks`, `./1_agentSquaresModel`, `./1_turnPanel` | `rxjs` | `src/1_agentSquaresModel.test.ts` |
| `src/1_agentSquaresFeed.ts` | 133 | no | `./0_agentSquareVisual`, `./0_agentSquaresSettings`, `./generated/native`, `./reactive/nativeTransport` | `rxjs` | `src/1_agentSquaresFeed.test.ts`, `src/1_agentSquaresModel.test.ts` |
| `src/1_agentSquaresMarks.ts` | 30 | no | `./1_agentSquaresFeed`, `./favorites` | — | — |
| `src/1_agentSquaresModel.ts` | 196 | no | `./0_agentSquareVisual`, `./0_turnDebugOverlay`, `./1_agentSquaresFeed` | — | `src/1_agentSquaresModel.test.ts` |
| `src/1_boopSearch.tsx` | 257 | no | `./0_persistedSetting`, `./1_boopSearch.css`, `./1_boopSearchRows`, `./core`, `./generated/native`, `./harnessTypes`, `./reactdock`, `./treetable`, `./worktrees` | `@hafley66/signals`, `@hafley66/signals/react`, `@tanstack/react-table`, `react`, `rxjs`, `rxjs/operators` | — |
| `src/1_boopSearchRows.ts` | 113 | no | — | — | `src/1_boopSearchRows.test.ts` |
| `src/1_boopSelection.tsx` | 386 | no | `./0_boopSelection`, `./0_settings`, `./1_boopSelection.css`, `./pluginState`, `./terminal`, `./treetable` | `@hafley66/signals/react`, `react` | — |
| `src/1_fenceCommandConfig.ts` | 49 | no | `./0_settings`, `./reactdock`, `./state` | `@hafley66/md/plugins` | — |
| `src/1_fenceCommandHost.ts` | 21 | no | `./0_settings`, `./generated/native`, `./state` | `@hafley66/md/plugins`, `rxjs` | `src/1_fenceCommandHost.test.ts` |
| `src/1_terminalStructuredOverlay.ts` | 119 | yes | `./00_terminalTurnRegions`, `./0_terminalTurnVisibility` | `@xterm/xterm`, `rxjs` | `src/1_terminalStructuredOverlay.test.ts` |
| `src/1_turnPanel.ts` | 418 | no | `./0_settings`, `./0_terminalDiagrams`, `./0_terminalTurnVisibility`, `./1_agentSquaresMarks`, `./1_turnPanel.css`, `./core`, `./favorites`, `./generated/native` | `@hafley66/md`, `@streamdown/code`, `react`, `react-dom`, `react-dom/client`, `streamdown` | — |
| `src/1a2_terminalContextGutter.ts` | 227 | yes | `./00b_terminalLineAnchors`, `./0_terminalRowGeometry`, `./0_terminalTurnVisibility`, `./1a_terminalContextQueue` | `@xterm/xterm`, `rxjs` | `src/1a2_terminalContextGutter.test.ts`, `src/1f_terminalForkRender.test.ts` |
| `src/1a_terminalContextQueue.dom.test.ts` | 57 | yes | `./00b_terminalLineAnchors`, `./1a_terminalContextQueue` | `@xterm/xterm`, `rxjs`, `vitest` | `src/1a_terminalContextQueue.dom.test.ts` |
| `src/1a_terminalContextQueue.ts` | 333 | yes | `./00b_terminalLineAnchors`, `./0_terminalTurnVisibility`, `./0_turnDebugOverlay`, `./1a2_terminalContextGutter` | `@hafley66/signals`, `@xterm/xterm`, `rxjs` | `src/1a_terminalContextQueue.dom.test.ts`, `src/1a_terminalContextQueue.test.ts`, `src/1b_terminalContextSync.test.ts` |
| `src/1b_terminalContextSync.ts` | 273 | no | `./1a_terminalContextQueue`, `./generated/native` | `@hafley66/signals`, `rxjs` | `src/1b_terminalContextSync.test.ts`, `src/1d_terminalTurnMarks.test.ts`, `src/1e_terminalForkMarks.test.ts`, `src/1f_terminalForkRender.test.ts` |
| `src/1c_terminalHoverCheck.ts` | 127 | no | `./00b_terminalLineAnchors`, `./0_terminalRowGeometry`, `./1a2_terminalContextGutter`, `./1a_terminalContextQueue` | — | `src/1c_terminalHoverCheck.test.ts` |
| `src/1d_terminalTurnMarks.ts` | 166 | no | `./00b_terminalLineAnchors`, `./0_terminalRowGeometry`, `./0_terminalTurnVisibility`, `./1a2_terminalContextGutter`, `./1a_terminalContextQueue`, `./1b_terminalContextSync`, `./1e_terminalForkMarks` | `@hafley66/signals`, `rxjs` | `src/1d_terminalTurnMarks.test.ts`, `src/1e_terminalForkMarks.test.ts`, `src/1f_terminalForkRender.test.ts` |
| `src/1e_terminalForkMarks.ts` | 59 | no | `./1b_terminalContextSync`, `./1d_terminalTurnMarks` | — | `src/1e_terminalForkMarks.test.ts`, `src/1f_terminalForkRender.test.ts` |
| `src/1f_terminalForkRender.ts` | 299 | no | `./0_terminalRowGeometry`, `./1a2_terminalContextGutter`, `./1b_terminalContextSync`, `./1d_terminalTurnMarks`, `./1e_terminalForkMarks` | `@hafley66/signals`, `rxjs` | `src/1f_terminalForkRender.test.ts` |
| `src/1g_forkPresetMenu.ts` | 116 | no | `./0_forkRenderSettings`, `./0_navMenu`, `./0_navMenuStore`, `./1e_terminalForkMarks`, `./generated/native` | — | `src/1g_forkPresetMenu.test.ts` |
| `src/1h_forkPanel.ts` | 21 | no | `./core`, `./terminal` | — | — |
| `src/2_previewRenderer.ts` | 127 | no | `./0_MonacoCodeViewer`, `./0_d2Preview`, `./0_diagramRenderCache`, `./0_liveProbe`, `./0_settings`, `./1_FileImageViewer`, `./core`, `./generated/native`, `./preview` | `@hafley66/md`, `react`, `react-dom/client` | `src/2_previewRenderer.test.ts` |
| `src/activity.tsx` | 347 | no | `./0_settings`, `./capture`, `./core`, `./fuzzy`, `./generated/native`, `./plugin`, `./preview`, `./state`, `./tablepanels`, `./terminal`, `./useStore` | `react` | — |
| `src/boopPanel.tsx` | 405 | no | `./0_boopGraph`, `./0_boopPanelState`, `./0_boopPresentation`, `./0_settings`, `./1_boopPanel.css`, `./generated/native`, `./treetable` | `@hafley66/marbler`, `@hafley66/signals/react`, `@tanstack/react-table`, `react`, `rxjs` | `src/boopPanel.test.ts`, `src/boopWarm.test.tsx` |
| `src/browser.ts` | 88 | no | `./0_settings`, `./cdp`, `./chrome`, `./core`, `./generated/native`, `./reactdock`, `./tabs`, `./terminal` | — | — |
| `src/capture.ts` | 126 | no | `./0_settings`, `./core`, `./generated/native`, `./reactive/ports`, `./terminal` | — | — |
| `src/cdp.ts` | 856 | no | `./0_openExternal`, `./core`, `./fuzzy`, `./generated/native`, `./keymap`, `./nav`, `./reactive/nativeTransport` | `rxjs` | — |
| `src/chrome.ts` | 550 | no | `./0_agentSquaresSettings`, `./0_panicSettings`, `./0_settings`, `./0_turnDebugSettings`, `./capture`, `./core`, `./ctxmenu`, `./favorites`, `./generated/native`, `./plugin`, `./reactdock`, `./reactive/ports`, `./sprefa`, `./state`, `./tabs`, `./terminal` | — | — |
| `src/clickrules.ts` | 469 | no | `./0_clickLaunchers`, `./0_clickRouter`, `./0_settings`, `./1_fenceCommandConfig`, `./core`, `./ipc/contract`, `./preview`, `./reactdock`, `./refChoicesPanel`, `./refResolve`, `./state`, `./termTokens`, `./terminal` | `react`, `react-dom/client` | `src/clickrules.docref.test.ts`, `src/clickrules.launcher.test.ts` |
| `src/core.ts` | 373 | no | `./0_ids`, `./0_settings`, `./0_terminalFonts`, `./generated/native`, `./reactdock`, `./state` | — | `src/0_tabTitleFromTmux.test.ts`, `src/askTextSuggestions.test.ts`, `src/preview.test.ts` |
| `src/ctxmenu.ts` | 105 | no | `./0_NavMenuView`, `./0_navMenu` | — | `src/0_contextMenuGesture.test.ts` |
| `src/dirtyGuard.ts` | 59 | no | — | — | — |
| `src/dnd.ts` | 145 | no | `./0_dropStash`, `./capture`, `./core`, `./ipc/contract`, `./reactive/nativeTransport`, `./reactive/ports`, `./sprefa`, `./terminal` | — | `src/0_dropStash.test.ts` |
| `src/favorites.ts` | 553 | no | `./00a_terminalIntersection`, `./0_settings`, `./0_terminalTurnVisibility`, `./0a_terminalSessionCandidates`, `./core`, `./generated/native`, `./harness`, `./plugin`, `./preview`, `./reactdock`, `./state`, `./tablepanels`, `./terminal`, `./worktrees` | — | `src/0_boopCandidateWindow.test.ts`, `src/favoriteBoopTurn.test.ts`, `src/tagPrompt.test.ts` |
| `src/fsWatch.ts` | 31 | no | `./generated/native`, `./reactive/nativeTransport` | — | — |
| `src/fuzzy.ts` | 56 | no | — | — | `src/fuzzy.test.ts` |
| `src/generated/api.ts` | 185 | no | — | `@hafley66/signals` | `src/generated/api.test.ts`, `src/ghcacheSnapshot.test.ts` |
| `src/generated/native.ts` | 327 | no | `../reactive/0_requestTransport`, `../reactive/nativeTransport` | `@hafley66/signals`, `rxjs` | `src/preview.test.ts` |
| `src/ghcacheSnapshot.ts` | 74 | no | `./generated/api`, `./reactive/httpTransport`, `./state` | `@hafley66/signals`, `rxjs` | `src/ghcacheSnapshot.test.ts` |
| `src/graphics.ts` | 95 | no | — | — | — |
| `src/harness.ts` | 72 | no | `./0_harnessDefinitions`, `./generated/native`, `./harnessTypes`, `./state` | — | `src/0a_terminalHarnessBinding.test.ts`, `src/harness.test.ts` |
| `src/harnessTypes.ts` | 9 | no | — | — | — |
| `src/history.tsx` | 96 | no | `./browser`, `./core`, `./nav`, `./plugin` | `react` | — |
| `src/inlinePreview.ts` | 27 | no | `./core` | `shiki` | — |
| `src/ipc/client.ts` | 33 | no | — | — | `src/ipc/client.test.ts` |
| `src/ipc/contract.ts` | 43 | no | `../generated/native`, `./client` | — | — |
| `src/jumpPalette.ts` | 157 | no | `./0_jumpLabel`, `./clickrules`, `./core`, `./fuzzy`, `./generated/native`, `./preview`, `./terminal` | — | `src/jumpPalette.test.ts` |
| `src/keymap.ts` | 78 | no | — | `tinykeys` | `src/0_browserKeyNotice.test.ts` |
| `src/lib/json-rx/0_types.ts` | 98 | no | — | `rxjs` | `src/lib/json-rx/0_types.test.ts`, `src/lib/json-rx/2_machine.test.ts`, `src/lib/json-rx/3_instances.test.ts`, `src/lib/json-rx/7_effects.test.ts` |
| `src/lib/json-rx/10_codex_host.ts` | 167 | no | — | `@hafley66/json-rx`, `rxjs`, `zod` | `src/lib/json-rx/10_codex_host.test.ts` |
| `src/lib/json-rx/1_state.ts` | 72 | no | `./0_types` | — | `src/lib/json-rx/0_types.test.ts` |
| `src/lib/json-rx/2_machine.ts` | 39 | no | `./0_types`, `./1_state` | `rxjs` | `src/lib/json-rx/2_machine.test.ts`, `src/lib/json-rx/6_catalog.test.ts` |
| `src/main.ts` | 613 | yes | `./0_PanZoomViewport`, `./0_browserKeyNotice`, `./0_forkRenderSettings`, `./0_liveProbe`, `./0_panicSettings`, `./0_rustdoc`, `./0_settings`, `./0_sourceFonts.css`, `./0_stfuButton`, `./0_stfuButton.css`, `./0_terminalDiagrams`, `./0_toolGaps`, `./0_turnDebugSettings`, `./1_LiveProbe`, `./1_agentSquares.css`, `./1_fenceCommandHost`, `./activity`, `./browser`, `./capture`, `./cdp`, `./chrome`, `./clickrules`, `./core`, `./ctxmenu`, `./dnd`, `./favorites`, `./fsWatch`, `./generated/native`, `./graphics`, `./history`, `./jumpPalette`, `./keymap`, `./mdview`, `./mdview/ports`, `./nav`, `./overlay`, `./overlayGuard`, `./paintPanel`, `./palette`, `./panelZoom`, `./panels`, `./plugin`, `./pluginState`, `./plugins/files`, `./plugins/files/1_FileTree`, `./plugins/metrics`, `./preview`, `./rail`, `./reactdock`, `./reactive/nativeTransport`, `./reactive/ports`, `./reactive/runtime`, `./rules`, `./sprefa`, `./state`, `./tabs`, `./terminal`, `./useStore`, `./worktrees` | `@hafley66/md/style.css`, `@oddbird/css-anchor-positioning/fn`, `@xterm/xterm/css/xterm.css`, `rxjs`, `xp.css` | — |
| `src/mdview/index.ts` | 1 | no | — | `@hafley66/md` | — |
| `src/mdview/ports.ts` | 2 | no | — | `@hafley66/md` | — |
| `src/memeExport.ts` | 98 | no | `./generated/native` | — | `src/memeExport.test.ts` |
| `src/nav.ts` | 60 | no | — | — | — |
| `src/overlay.ts` | 97 | no | `./0_overlaySettings`, `./0_overlaySize`, `./0_settings`, `./core`, `./reactive/ports`, `./state` | `rxjs` | — |
| `src/overlayGuard.ts` | 12 | no | — | — | — |
| `src/paintBridge.ts` | 243 | no | `./0_paintSvg` | — | — |
| `src/paintMemeControls.tsx` | 58 | no | `./paintBridge`, `./pluginState`, `./treetable` | `react` | — |
| `src/paintPanel.tsx` | 219 | no | `./0_settings`, `./core`, `./dirtyGuard`, `./paintBridge`, `./paintMemeControls`, `./paintSessions`, `./plugin`, `./plugins/files`, `./reactdock` | `@hafley66/signals/react`, `dockview`, `react` | — |
| `src/paintSessions.ts` | 183 | no | `./core`, `./generated/native`, `./memeExport`, `./paintBridge`, `./pluginState` | `@hafley66/signals` | `src/paintSessions.test.ts` |
| `src/palette.ts` | 212 | no | `./fuzzy`, `./keymap` | — | — |
| `src/panelZoom.ts` | 98 | no | `./0_settings` | — | `src/panelZoom.test.ts` |
| `src/panels.ts` | 158 | no | `./0_panicSettings`, `./0_settings`, `./1_boopSearch`, `./1_boopSelection`, `./activity`, `./boopPanel`, `./browser`, `./cdp`, `./favorites`, `./plugin`, `./status`, `./tablepanels`, `./worktrees` | — | `src/boopBootNoPoll.test.ts` |
| `src/plugin.tsx` | 392 | no | `./ctxmenu`, `./keymap` | `dockview`, `react` | `src/plugin.test.ts` |
| `src/pluginState.ts` | 16 | no | `./0_settings` | — | `src/pluginState.test.ts` |
| `src/plugins/files/0_FileTreeModel.ts` | 25 | no | `../../state` | — | `src/plugins/files/1_FileTree.test.ts` |
| `src/plugins/files/0_types.ts` | 3 | no | — | — | — |
| `src/plugins/files/1_FileTree.tsx` | 156 | no | `../../0_markdownTree`, `../../generated/native`, `../../state`, `./0_FileTreeModel`, `./1_FileTree.css` | `@hafley66/grid`, `@hafley66/grid/react`, `@hafley66/md`, `@hafley66/signals`, `react`, `zod` | `src/plugins/files/1_FileTree.test.ts` |
| `src/plugins/files/2_FileExplorer.tsx` | 87 | no | `../../generated/native`, `../../preview`, `../../state`, `./1_FileTree`, `./2_FileExplorer.css` | `react` | — |
| `src/plugins/files/3_FilesPanel.tsx` | 29 | no | `../../0_settings`, `../../core`, `../../pluginState`, `../../useStore`, `./0_types`, `./2_FileExplorer` | `dockview` | — |
| `src/plugins/files/4_FileSearchTree.tsx` | 63 | no | `../../fuzzy`, `../../generated/native`, `../../state`, `../../treetable`, `./1_FileTree` | `react` | — |
| `src/plugins/files/index.ts` | 21 | no | `../../plugin`, `./2_FileExplorer`, `./3_FilesPanel`, `./4_FileSearchTree` | — | — |
| `src/plugins/metrics/0_types.ts` | 26 | no | `../../rulesModel` | — | `src/plugins/metrics/0c_streams.test.ts`, `src/plugins/metrics/2_runtime.test.ts` |
| `src/plugins/metrics/0a_chart.ts` | 42 | no | `./0_types` | `vega-embed` | `src/plugins/metrics/0a_chart.test.ts` |
| `src/plugins/metrics/0b_layout.tsx` | 84 | no | `../../pluginState`, `./0_types` | `react`, `react-resizable-panels` | — |
| `src/plugins/metrics/0c_streams.ts` | 40 | no | `../../rulesModel`, `./0_types` | — | `src/plugins/metrics/0c_streams.test.ts` |
| `src/plugins/metrics/1_dashboard.tsx` | 222 | no | `../../generated/native`, `../../lib/json-rx/0_types`, `../../pluginState`, `../../rulesModel`, `../../treetable`, `./0_types`, `./0a_chart`, `./0b_layout`, `./0c_streams`, `./2_runtime` | `react`, `vega-embed` | — |
| `src/plugins/metrics/1_v2_definitions.ts` | 156 | no | `../../lib/json-rx/10_codex_host`, `./0_claude-usage.rule.json` | `@hafley66/json-rx` | `src/lib/json-rx/10_codex_host.test.ts` |
| `src/plugins/metrics/2_runtime.ts` | 62 | no | `../../lib/json-rx/0_types`, `../../lib/json-rx/2_machine`, `./0_types` | `rxjs` | `src/plugins/metrics/2_runtime.test.ts` |
| `src/plugins/metrics/index.ts` | 27 | no | `../../plugin`, `./1_dashboard`, `./1_v2_definitions` | — | — |
| `src/preview.ts` | 350 | no | `./0_documentHref`, `./0_externalKinds`, `./0_htmlFileUrl`, `./0_openExternal`, `./0_rustdoc`, `./0_settings`, `./0_visibleFileWatch`, `./2_previewRenderer`, `./browser`, `./core`, `./fsWatch`, `./generated/native`, `./plugin`, `./pluginState`, `./reactdock` | `rxjs`, `shiki` | `src/preview.test.ts` |
| `src/promptQuote.ts` | 25 | no | — | — | `src/0_promptQuote.test.ts` |
| `src/rail.ts` | 284 | no | `./0_settings`, `./chrome`, `./ctxmenu`, `./plugin`, `./pluginState`, `./railOrder`, `./reactdock` | `react`, `react-dom/client` | — |
| `src/railOrder.ts` | 68 | no | — | — | `src/railOrder.test.ts` |
| `src/reactdock.tsx` | 849 | no | `./0_dockRestore`, `./0_panelVisibility`, `./0_reopenOrder`, `./0_settings`, `./ctxmenu`, `./dirtyGuard`, `./plugin`, `./sessionSidebar` | `dockview`, `dockview/dist/styles/dockview.css`, `react`, `react-dom/client` | — |
| `src/reactive/0_requestTransport.ts` | 17 | no | — | `@hafley66/signals` | `src/reactive/0_requestTransport.test.ts` |
| `src/reactive/eventBus.ts` | 30 | no | `./events` | `rxjs` | `src/reactive/statusPolling.test.ts` |
| `src/reactive/events.ts` | 7 | no | `./statusModel` | — | `src/reactive/statusPolling.test.ts` |
| `src/reactive/httpTransport.ts` | 31 | no | `./0_requestTransport`, `./ports` | `@hafley66/signals` | `src/ghcacheSnapshot.test.ts` |
| `src/reactive/nativeTransport.ts` | 131 | no | `./0_requestTransport`, `./wsTransport`, `@tauri-apps/api/core`, `@tauri-apps/api/event` | `@hafley66/signals`, `rxjs` | `src/reactive/nativeTransport.test.ts`, `src/reactive/ports.test.ts`, `src/reactive/wsTransport.test.ts` |
| `src/reactive/ports.ts` | 207 | no | `../generated/native`, `../plugin`, `./nativeTransport`, `@tauri-apps/api/dpi`, `@tauri-apps/api/event`, `@tauri-apps/api/path`, `@tauri-apps/api/webview`, `@tauri-apps/api/webviewWindow`, `@tauri-apps/api/window`, `@tauri-apps/plugin-opener` | — | `src/ghcacheSnapshot.test.ts`, `src/reactive/ports.test.ts` |
| `src/reactive/runtime.ts` | 26 | no | `../plugin`, `./eventBus`, `./events`, `./ports`, `./statusModel`, `./statusPolling` | `rxjs` | — |
| `src/reactive/statusDerivations.ts` | 19 | no | `../plugin`, `./statusModel` | — | `src/reactive/statusDerivations.test.ts` |
| `src/reactive/statusModel.ts` | 41 | no | `../plugin`, `./statusDerivations` | `@hafley66/signals`, `rxjs` | `src/reactive/statusDerivations.test.ts`, `src/reactive/statusStorage.test.ts` |
| `src/reactive/statusPolling.ts` | 48 | no | `../plugin`, `./eventBus`, `./statusModel` | `rxjs` | `src/reactive/statusPolling.test.ts` |
| `src/reactive/wsTransport.ts` | 140 | no | `./nativeTransport` | — | `src/reactive/wsTransport.test.ts` |
| `src/refChoicesPanel.tsx` | 220 | no | `./core`, `./generated/native`, `./state`, `./treetable` | `react` | — |
| `src/refResolve.ts` | 28 | no | `./ipc/contract` | — | — |
| `src/rules.tsx` | 461 | no | `./core`, `./generated/native`, `./plugin`, `./plugins/metrics/0_claude-usage.rule.json`, `./plugins/metrics/0a_chatgpt-usage.rule.json`, `./reactive/nativeTransport`, `./rulesModel`, `./state`, `./treetable` | `react` | — |
| `src/rulesModel.ts` | 152 | no | — | — | `src/rulesModel.test.ts` |
| `src/sessionSidebar.tsx` | 55 | no | `./plugins/files/2_FileExplorer` | `react` | — |
| `src/sprefa.ts` | 548 | no | `./0_settings`, `./core`, `./ctxmenu`, `./generated/native`, `./plugin`, `./preview`, `./sprefaPanel`, `./state` | `rxjs` | — |
| `src/sprefaPanel.tsx` | 54 | no | `./sprefa` | `react` | — |
| `src/state.ts` | 297 | no | `./harnessTypes`, `./store`, `./table` | `@hafley66/md/plugins` | `src/0_tabTitleFromTmux.test.ts`, `src/1_fenceCommandHost.test.ts`, `src/ghcacheSnapshot.test.ts`, `src/plugins/files/1_FileTree.test.ts`, `src/state.test.ts` |
| `src/status.tsx` | 165 | no | `./0_toolGaps`, `./ghcacheSnapshot`, `./plugin`, `./reactive/ports`, `./reactive/statusModel`, `./treetable` | `@hafley66/signals/react` | — |
| `src/store.ts` | 50 | no | — | `@hafley66/signals`, `rxjs` | `src/store.test.ts` |
| `src/table.ts` | 271 | no | — | `@tanstack/virtual-core` | — |
| `src/tablepanels.tsx` | 1150 | no | `./00a_terminalIntersection`, `./harnessTypes`, `./state`, `./treetable`, `./useStore` | `@tanstack/react-table`, `react` | `src/favFilterNote.test.ts` |
| `src/tabs.ts` | 203 | no | `./0_reopenOrder`, `./0_settings`, `./core`, `./generated/native`, `./reactdock`, `./state`, `./terminal`, `./worktrees` | — | `src/0_tabTitleFromTmux.test.ts` |
| `src/termBufferToken.test.ts` | 170 | yes | `./termBufferToken` | `@xterm/xterm`, `vitest` | `src/termBufferToken.test.ts` |
| `src/termBufferToken.ts` | 83 | yes | `./termTokens`, `./termWrapJoin` | `@xterm/xterm` | `src/termBufferToken.test.ts` |
| `src/termTokens.ts` | 188 | no | — | — | `src/termTokens.test.ts`, `src/termWrapJoin.test.ts` |
| `src/termWrapJoin.ts` | 172 | no | `./termTokens` | — | `src/termWrapJoin.test.ts` |
| `src/terminal.ts` | 1521 | yes | `./00a_terminalIntersection`, `./00b_terminalLineAnchors`, `./0_agentSquaresSettings`, `./0_boopSelection`, `./0_clickRouter`, `./0_externalShells`, `./0_forkRenderSettings`, `./0_inspectorState`, `./0_openExternal`, `./0_reopenOrder`, `./0_settings`, `./0_termCell`, `./0_terminalDiagrams`, `./0_terminalPinnedSelection`, `./0_terminalTurnVisibility`, `./0_terminalWheel`, `./0_turnDebugOverlay`, `./0_turnDebugSettings`, `./0a_terminalHarnessBinding`, `./0b_ompTurnBinding`, `./1_agentSquares`, `./1_terminalStructuredOverlay`, `./1a_terminalContextQueue`, `./1b_terminalContextSync`, `./1c_terminalHoverCheck`, `./1d_terminalTurnMarks`, `./1e_terminalForkMarks`, `./1f_terminalForkRender`, `./1g_forkPresetMenu`, `./1h_forkPanel`, `./browser`, `./clickrules`, `./core`, `./ctxmenu`, `./favorites`, `./generated/native`, `./graphics`, `./harness`, `./inlinePreview`, `./ipc/contract`, `./keymap`, `./overlay`, `./panelZoom`, `./preview`, `./promptQuote`, `./reactdock`, `./refResolve`, `./state`, `./tabs`, `./termBufferToken`, `./termWrapJoin`, `./worktrees` | `@xterm/addon-fit`, `@xterm/xterm` | `src/forkSelection.test.ts` |
| `src/treetable.tsx` | 529 | no | `./treetableEdit`, `./treetableRow`, `./treetableSize` | `@tanstack/react-table`, `@tanstack/react-virtual`, `react` | — |
| `src/treetableEdit.tsx` | 93 | no | — | `react` | — |
| `src/treetableRow.tsx` | 167 | no | `./treetable`, `./treetableEdit` | `@tanstack/react-table`, `react` | — |
| `src/treetableSize.ts` | 30 | no | — | `@tanstack/react-table` | `src/treetableSize.test.ts` |
| `src/useStore.ts` | 14 | no | `./state` | `react` | — |
| `src/worktrees.ts` | 1465 | no | `./0_settings`, `./core`, `./ctxmenu`, `./generated/api`, `./generated/native`, `./ghcacheSnapshot`, `./harness`, `./preview`, `./state`, `./table`, `./tablepanels`, `./terminal` | — | — |

### A2. E2E specs

| spec | surface |
| --- | --- |
| `e2e-real/0_selection-ask.spec.ts` | 0_selection ask.spec |
| `e2e-real/boop-lifecycle.spec.ts` | boop lifecycle.spec |
| `e2e-real/boop-network.spec.ts` | boop network.spec |
| `e2e-real/boop-selection.spec.ts` | boop selection.spec |
| `e2e-real/cmdclick-ladder.spec.ts` | cmdclick ladder.spec |
| `e2e-real/cmdclick-path-block.spec.ts` | cmdclick path block.spec |
| `e2e-real/cmdclick-surfaces.spec.ts` | cmdclick surfaces.spec |
| `e2e-real/cmdclick-tui-wrap.spec.ts` | cmdclick tui wrap.spec |
| `e2e-real/fork.spec.ts` | fork.spec |
| `e2e-real/strip-live.spec.ts` | strip live.spec |
| `e2e-real/term-cmd-hover.spec.ts` | term cmd hover.spec |
| `e2e-real/term-context-checkbox.spec.ts` | term context checkbox.spec |
| `e2e-real/term-context-hover.spec.ts` | term context hover.spec |
| `e2e-real/term-context-queue.spec.ts` | term context queue.spec |
| `e2e-real/term-diagram-flicker.spec.ts` | term diagram flicker.spec |
| `e2e-real/term-diagrams.spec.ts` | term diagrams.spec |
| `e2e-real/term-input.spec.ts` | term input.spec |
| `e2e-real/term-row-offset.spec.ts` | term row offset.spec |
| `e2e-real/term-selection-pin.spec.ts` | term selection pin.spec |
| `e2e-real/term-sidebar.spec.ts` | term sidebar.spec |
| `e2e-real/term-structured.spec.ts` | term structured.spec |
| `e2e-real/term-turn-attribution-real.spec.ts` | term turn attribution real.spec |
| `e2e-real/term-word-select.spec.ts` | term word select.spec |
| `e2e-real/term-wrap-hover.spec.ts` | term wrap hover.spec |
| `e2e-live/1_terminal-cast.live.ts` | 1_terminal cast.live |
| `e2e-live/2_agent-tui.live.ts` | 2_agent tui.live |
| `e2e-live/3_agent-strip.live.ts` | 3_agent strip.live |
| `e2e-live/boop-four-agent-shells.live.ts` | boop four agent shells.live |

## Table B. Instant-only seams and boop transport

| instant-only seam | files using it | what the seam carries (types/calls) | Rust endpoint | transport |
| --- | --- | --- | --- | --- |
| generated/native.ts → reactive/nativeTransport.ts | terminal.ts; favorites.ts; 1b_terminalContextSync.ts; 1_agentSquaresFeed.ts | invoke/commandEndpoint; command args/results | src-tauri/src/lib.rs:1008-1036; src-tauri/src/serve/rpc.rs:277-372 | Tauri invoke in app; JSON-RPC over loopback WebSocket in serve/browser (reactive/nativeTransport.ts:1-105) |
| favorites.ts turn cache | terminal.ts; 0_terminalTurnVisibility.ts | BoopTurn[]; boop_turns and boop_turns_recent | src-tauri/src/0_boop.rs:294,308 | native command |
| terminal.ts visibility binding | terminal.ts; 0_terminalTurnVisibility.ts | boop_sync_session; boop_locate_turns; pane lines and located spans | src-tauri/src/0_boop.rs:301,1063; hafley-rs/crates/boop-harness/src/harness/1_claude_summary.rs:28-29 | native command |
| 1b_terminalContextSync.ts | terminal.ts; 1a_terminalContextQueue.ts; 1d_terminalTurnMarks.ts; 1e_terminalForkMarks.ts | BoopTurnComment, targets, annotations and fork rows; list/upsert/delete/sent | src-tauri/src/0_boop.rs:564,744-803 | native command |
| 1_agentSquaresFeed.ts | 1_agentSquares.ts; terminal.ts | Strip, StripTurn, SquaresWatch; squares_watch/unwatch and squares-update | src-tauri/src/lib.rs:683-706; src-tauri/src/1_squares.rs:450-511 | native command plus Tauri/WebSocket event |
| terminal.ts mux callbacks | 00a_terminalIntersection.ts; 0_terminalWheel.ts; terminal.ts | pane capture, scroll, exit copy mode and PTY writes | src-tauri/src/0_tmux.rs:9,27; hafley-rs/crates/boop-mux/src/lib.rs:89,131,398 | native command to boop-mux Tmux |
| state.ts/core.ts/main.ts | terminal.ts; chrome.ts; main.ts | tab registry, active tab, settings, status and startup | app-owned | in-process signals and DOM |
| reactdock.tsx/preview.ts/ctxmenu.ts | terminal.ts; 1_turnPanel.ts; 1h_forkPanel.ts | dock panels, preview and context menus | app-owned | DOM chrome |
| 0_settings.ts/0_agentSquaresSettings.ts | terminal.ts; 1_agentSquares.ts; 1_agentSquaresFeed.ts | strip mode and toggles; diagrams and turn debug options | app-owned | signals/storage |
| 1f_terminalForkRender.ts command | terminal.ts; 1h_forkPanel.ts | boop beep fork comment-id --preset preset --interactive; lane name | src-tauri/src/0_boop.rs:634 (target mapping) | PTY shell command |
| 0_boopSelection.ts/harness.ts/worktrees.ts | terminal.ts; favorites.ts | session binding, harness identity, cwd and focus | src-tauri/src/0_boop.rs:294-308 (turn reads) | app state plus native command |

## Table C. Proposed `packages/boop-xterm` file map

| proposed boop-xterm file (dependency order) | source instant file(s) |
| --- | --- |
| `src/0_types.ts` | `src/00a_terminalIntersection.ts`, `src/0_terminalTurnVisibility.ts`, `src/1_agentSquaresFeed.ts`, `src/1a_terminalContextQueue.ts`, `src/1b_terminalContextSync.ts`, `src/1d_terminalTurnMarks.ts` |
| `src/0_termTokens.ts` | `src/termTokens.ts` |
| `src/0_termCell.ts` | `src/0_termCell.ts` |
| `src/0_termBufferToken.ts` | `src/termBufferToken.ts` |
| `src/0_termWrapJoin.ts` | `src/termWrapJoin.ts` |
| `src/0_turnRegions.ts` | `src/00_terminalTurnRegions.ts` |
| `src/0_turnMatching.ts` | `src/0a_terminalTurnMatching.ts`, `src/0b_ompTurnBinding.ts` |
| `src/0_rowGeometry.ts` | `src/0_terminalRowGeometry.ts` |
| `src/0_fontGeometry.ts` | `src/0_terminalFonts.ts` |
| `src/1_viewport.ts` | `src/00a_terminalIntersection.ts` |
| `src/1_lineAnchors.ts` | `src/00b_terminalLineAnchors.ts` |
| `src/1_turnVisibility.ts` | `src/0_terminalTurnVisibility.ts` |
| `src/1_wheel.ts` | `src/0_terminalWheel.ts` |
| `src/1_pinnedSelection.ts` | `src/0_terminalPinnedSelection.ts` |
| `src/2_diagrams.ts` | `src/0_diagramRenderCache.ts`, `src/0_terminalDiagrams.ts` |
| `src/2_structuredOverlay.ts` | `src/1_terminalStructuredOverlay.ts` |
| `src/2_turnDebugOverlay.ts` | `src/0_turnDebugOverlay.ts` |
| `src/2_contextGutter.ts` | `src/1a2_terminalContextGutter.ts` |
| `src/2_contextQueue.ts` | `src/1a_terminalContextQueue.ts` |
| `src/2_contextSync.ts` | `src/1b_terminalContextSync.ts` |
| `src/2_hoverCheck.ts` | `src/1c_terminalHoverCheck.ts` |
| `src/2_turnMarks.ts` | `src/1d_terminalTurnMarks.ts` |
| `src/2_forkMarks.ts` | `src/1e_terminalForkMarks.ts` |
| `src/2_forkRender.ts` | `src/1f_terminalForkRender.ts` |
| `src/2_agentSquaresModel.ts` | `src/0_agentSquareVisual.ts`, `src/1_agentSquaresMarks.ts`, `src/1_agentSquaresModel.ts` |
| `src/2_agentSquaresFeed.ts` | `src/1_agentSquaresFeed.ts` |
| `src/2_agentSquares.ts` | `src/1_agentSquares.ts` |
| `src/2_turnPanel.ts` | `src/1_turnPanel.ts` |
| `src/2_graphics.ts` | `src/graphics.ts` |
| `src/3_terminalView.ts` | `src/terminal.ts` |

## Table D. `.subscribe(` call sites in the closure

| file:line | receiver | mapped into package? |
| --- | --- | :---: |
| `src/00b_terminalLineAnchors.ts:41` | `activity.subscribe` | yes |
| `src/00b_terminalLineAnchors.ts:42` | `activity.pipe(debounceTime(80)).subscribe` | yes |
| `src/0_MonacoCodeViewer.tsx:124` | `editorLifetime(host.current, props).subscribe` | no |
| `src/0_stfuButton.ts:194` | `down$ .pipe( tap(event => { draggedThisGesture = false cap.setPointerCapture(event.pointerId) press(` | no |
| `src/0_stfuButton.ts:230` | `fromEvent<MouseEvent>(cap, "click") .pipe( filter(() => !draggedThisGesture), tap(() => { cap.disabl` | no |
| `src/0_stfuButton.ts:244` | `merge( fromEvent<PointerEvent>(cap, "pointerenter").pipe(map(() => true)), fromEvent<PointerEvent>(c` | no |
| `src/0_terminalDiagrams.ts:457` | `merge( projection.changes, projection.settled.pipe(tap(() => { const dark = darkBackground(this.host` | yes |
| `src/0_terminalDiagrams.ts:460` | `this.scrollEvents.pipe( debounceTime(80), ).subscribe` | yes |
| `src/0_terminalDiagrams.ts:468` | `this.recoveryEvents.pipe( debounceTime(80), ).subscribe` | yes |
| `src/0_terminalTurnVisibility.ts:322` | `changes.subscribe` | yes |
| `src/0_terminalTurnVisibility.ts:325` | `changes.pipe( filter((event) => event.kind === "write" \|\| event.kind === "scroll"), ).subscribe` | yes |
| `src/0_terminalTurnVisibility.ts:330` | `changes.pipe( filter((event) => event.kind !== "write"), ).subscribe` | yes |
| `src/0_terminalTurnVisibility.ts:334` | `changes.pipe( filter((event) => event.kind === "write"), debounceTime(120), ).subscribe` | yes |
| `src/0_terminalTurnVisibility.ts:343` | `turnActivityClock.pipe( filter(() => performance.now() - this.activityAt <= TURN_ACTIVITY_LEASE_MS),` | yes |
| `src/0_terminalWheel.ts:51` | `this.events.pipe( scan(reduceTerminalWheel, initialTerminalWheelState), ).subscribe` | yes |
| `src/0_turnDebugOverlay.ts:110` | `projection.changes.subscribe` | yes |
| `src/1_agentSquares.ts:162` | `squaresFeed(this.input.session).subscribe` | yes |
| `src/1_agentSquares.ts:495` | `visual.$.subscribe` | yes |
| `src/1_boopSearch.tsx:178` | `combineLatest([m.query.$, m.role.$]) .pipe( debounceTime(150), switchMap(([q, r]) => q.trim() ? from` | no |
| `src/1_boopSearch.tsx:197` | `start .pipe( switchMap(() => timer(0, 1000).pipe(switchMap(() => from(invoke<BoopSearchStatus>("boop` | no |
| `src/1_terminalStructuredOverlay.ts:42` | `projection.changes.subscribe` | yes |
| `src/1a2_terminalContextGutter.ts:135` | `queue.projection.changes.subscribe` | yes |
| `src/1a2_terminalContextGutter.ts:139` | `queue.anchors.visible.$.subscribe` | yes |
| `src/1b_terminalContextSync.ts:150` | `queue.changes .pipe(debounceTime(300)) .subscribe` | yes |
| `src/1b_terminalContextSync.ts:154` | `queue.sent.subscribe` | yes |
| `src/1d_terminalTurnMarks.ts:87` | `annotations.$.subscribe` | yes |
| `src/1d_terminalTurnMarks.ts:88` | `forks.$.subscribe` | yes |
| `src/1f_terminalForkRender.ts:215` | `deps.livePane.$.subscribe` | yes |
| `src/boopPanel.tsx:143` | `source$.subscribe` | no |
| `src/cdp.ts:309` | `nativeEvent$<FrameEvent>("cdp-frame").subscribe` | no |
| `src/cdp.ts:318` | `nativeEvent$<{ id: string; cursor: string }>("cdp-cursor").subscribe` | no |
| `src/cdp.ts:326` | `nativeEvent$<{ id: string; url: string }>("cdp-url").subscribe` | no |
| `src/cdp.ts:336` | `nativeEvent$<{ id: string; text: string }>("cdp-copy").subscribe` | no |
| `src/chrome.ts:134` | `panic.on.$.subscribe` | no |
| `src/chrome.ts:141` | `panic.sub.$.subscribe` | no |
| `src/chrome.ts:150` | `turnDebug.on.$.subscribe` | no |
| `src/chrome.ts:166` | `agentSquares.on.$.subscribe` | no |
| `src/chrome.ts:173` | `agentSquares.mode.$.subscribe` | no |
| `src/chrome.ts:177` | `agentSquares.userKeep.$.subscribe` | no |
| `src/main.ts:252` | `settings.skin.$.subscribe` | no |
| `src/main.ts:253` | `settings.mode.$.subscribe` | no |
| `src/main.ts:254` | `settings.inlineDiagrams.$.subscribe` | no |
| `src/main.ts:255` | `settings.inlineDiagramInference.$.subscribe` | no |
| `src/main.ts:256` | `settings.inlineStructuredSelectors.$.subscribe` | no |
| `src/main.ts:257` | `settings.showToolbar.$.subscribe` | no |
| `src/main.ts:258` | `settings.sidebar.$.subscribe` | no |
| `src/main.ts:259` | `settings.xpPixel.$.subscribe` | no |
| `src/main.ts:260` | `store.subscribe` | no |
| `src/main.ts:274` | `store.subscribe` | no |
| `src/main.ts:276` | `store.subscribe` | no |
| `src/main.ts:283` | `merge( settings.wtView.$, settings.wtExpanded.$, settings.wtFocus.$, settings.wtFavorites.$, setting` | no |
| `src/main.ts:346` | `store.subscribe` | no |
| `src/overlay.ts:71` | `merge(overlay.mode.$, overlay.target.$, overlay.fade.$, overlay.mini.$).subscribe` | no |
| `src/overlay.ts:74` | `store.subscribe` | no |
| `src/plugins/files/1_FileTree.tsx:109` | `model.grid.epicCtx.phase$.change.subscribe` | no |
| `src/plugins/metrics/1_dashboard.tsx:169` | `runtime.subscribe` | no |
| `src/preview.ts:196` | `visibility$.subscribe` | no |
| `src/preview.ts:209` | `visibleFileWatch$(visibility$, () => claimFsWatch(path, () => { clearTimeout(w.timer); w.timer = set` | no |
| `src/preview.ts:342` | `settings.mode.$.subscribe` | no |
| `src/rail.ts:283` | `settings.pluginState.$.subscribe` | no |
| `src/reactdock.tsx:258` | `settings.termSidebar.$.subscribe` | no |
| `src/reactive/runtime.ts:16` | `bus.on("status.poll.completed").subscribe` | no |
| `src/reactive/runtime.ts:17` | `aggregateHealth.$.subscribe` | no |
| `src/reactive/statusPolling.ts:41` | `timer(0, pollMs) .pipe( takeUntil(stopped), exhaustMap(async () => { const current = ++sequence; bus` | no |
| `src/rules.tsx:176` | `nativeEvent$<RuleMatch>("rule-match").subscribe` | no |
| `src/rules.tsx:179` | `nativeEvent$<Event>("activity-added").subscribe` | no |
| `src/sprefa.ts:451` | `merge(settings.sprefaScope.$, settings.sprefaScopeActive.$).subscribe` | no |
| `src/store.ts:42` | `changed.subscribe` | no |
| `src/terminal.ts:723` | `settings.active.$.subscribe` | yes |
| `src/terminal.ts:889` | `cmdClickGesture.events.subscribe` | yes |
| `src/useStore.ts:11` | `store.subscribe` | no |

## Table E. Instant call sites that would import `@hafley66/boop-xterm`

| file:line | current import |
| --- | --- |
| `src/0_settings.ts:11` | `./0_terminalDiagrams` |
| `src/1_boopSelection.tsx:10` | `./terminal` |
| `src/1g_forkPresetMenu.ts:10` | `./1e_terminalForkMarks` |
| `src/1h_forkPanel.ts:9` | `./terminal` |
| `src/2_previewRenderer.ts:8` | `./0_diagramRenderCache` |
| `src/activity.tsx:19` | `./terminal` |
| `src/browser.ts:10` | `./terminal` |
| `src/capture.ts:7` | `./terminal` |
| `src/chrome.ts:17` | `./terminal` |
| `src/clickrules.ts:12` | `./terminal` |
| `src/clickrules.ts:13` | `./termTokens` |
| `src/core.ts:8` | `./0_terminalFonts` |
| `src/dnd.ts:17` | `./terminal` |
| `src/favorites.ts:12` | `./terminal` |
| `src/favorites.ts:16` | `./0_terminalTurnVisibility` |
| `src/favorites.ts:17` | `./00a_terminalIntersection` |
| `src/jumpPalette.ts:12` | `./terminal` |
| `src/main.ts:31` | `./0_terminalDiagrams` |
| `src/main.ts:46` | `./graphics` |
| `src/main.ts:65` | `./terminal` |
| `src/tablepanels.tsx:13` | `./00a_terminalIntersection` |
| `src/tabs.ts:18` | `./terminal` |
| `src/worktrees.ts:40` | `./terminal` |

## Section F. Exact commands and output line counts

| exact command | output |
| --- | --- |
| <code>rg -l &#x27;@xterm/&#124;\bxterm\b&#x27; src packages -g &#x27;*.{ts,tsx,js,jsx,mjs,cjs}&#x27; &#124; sort</code> | 46 lines |
| <code>rg -n &#x27;from [&quot;\x27](@xterm/&#124;xterm)&#x27; src packages</code> | 17 lines |
| <code>rg --files src packages &#124; rg &#x27;\.(ts&#124;tsx&#124;js&#124;jsx&#124;mjs&#124;cjs)$&#x27; &#124; wc -l</code> | 1 line: 307 |
| <code>node -e &#x27;const t=require(&quot;typescript&quot;),fs=require(&quot;fs&quot;),c=t.readConfigFile(&quot;tsconfig.json&quot;,t.sys.readFile),o=t.parseJsonConfigFileContent(c.config,t.sys,process.cwd()),g=new Map;for(const f of o.fileNames){const x=t.preProcessFile(fs.readFileSync(f,&quot;utf8&quot;),true,true).importedFiles.map(i=&gt;i.fileName);g.set(f,x.map(i=&gt;[i,t.resolveModuleName(i,f,o.options,t.sys).resolvedModule?.resolvedFileName]))}let q=[...g].filter(([f,x])=&gt;x.some(([s])=&gt;s.startsWith(&quot;@xterm/&quot;))).map(([f])=&gt;f),n=q.length,z=new Set(q);for(const f of q)for(const [s,d] of g.get(f))if(g.has(d)&amp;&amp;!z.has(d)){z.add(d);q.push(d)}console.log(n,z.size)&#x27;</code> | 1 line: 17 189 |
| <code>wc -l src/terminal.ts</code> | 1 line: 1521 |

### Package conventions read

| file | observed convention |
| --- | --- |
| `AGENTS.md` | Library/docs `.subscribe(` count zero; application root subscription; lifecycle teardown `unsubscribe`; shared pure helpers in `src/lib`; numeric prefixes begin at 0. |
| `packages/md/package.json` | ESM `@hafley66/*` package; dist exports; Vite build, typecheck, Vitest unit/browser/e2e; peer and dev dependencies. |
| `packages/md/tsconfig.json` | Extends workspace base; includes src, fixtures, tests, lab; excludes node_modules and dist. |
| `packages/md/vite.config.ts` | vite-plugin-dts; ES library entries; external packages; preserved modules; sourcemaps. |
| `packages/md/vitest.config.ts` | Unit tests exclude browser render tests; one worker. |
| `packages/md/vitest.browser.config.ts` | Chromium Playwright tests for rendered UI. |
| `packages/md/vitest.e2e.config.ts` | Fixture Vite preview via @hafley66/vitest-playwright. |

### Inventory counts

| metric | count |
| --- | ---: |
| closure files | 189 |
| direct xterm files | 17 |
| E2E specs | 28 |
| AST subscribe call sites in closure | 71 |
| app import sites from mapped source files | 23 |
| proposed package files | 30 |
