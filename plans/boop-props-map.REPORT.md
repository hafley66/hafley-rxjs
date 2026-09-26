# Boop props map

| Scope key | Source |
| --- | --- |
| `i/` | `/Users/chrishafley/projects/instant/src/` |
| `r/` | `/Users/chrishafley/projects/instant/src-tauri/src/` |
| `p/` | This repository's `packages/` and `plans/` |
| Generated transport | `i/generated/native.ts:128-154` exposes `commandEndpoint<T = unknown>(CommandName)` and `invoke<T = unknown>(CommandName, NativeCommandInput): Promise<T>`; it declares no per-command I/O types. A's TypeScript types come from the caller, or from the Rust signature where no caller exists. |
| Import closure | `i/generated/native.ts` → `i/reactive/0_requestTransport.ts`, `i/reactive/nativeTransport.ts` → command callers below; `i/1_agentSquaresFeed.ts` → `i/1_agentSquares.ts` → `i/terminal.ts` → `i/main.ts`; `i/0_boopGraph.ts`, `i/0_boopPresentation.ts` → `i/boopPanel.tsx` → `i/panels.ts` → `i/main.ts`; `i/1_boopSearchRows.ts` → `i/1_boopSearch.tsx` → `i/panels.ts` → `i/main.ts`; `i/0_boopSelection.ts` → `i/1_boopSelection.tsx` → `i/panels.ts` → `i/main.ts`; `i/1b_terminalContextSync.ts` → `i/terminal.ts`, `i/1d_terminalTurnMarks.ts`, `i/1e_terminalForkMarks.ts`, `i/1f_terminalForkRender.ts`; `i/0_stfuButton.ts` → `i/main.ts`; `i/jumpPalette.ts` → `i/main.ts`; `i/1g_forkPresetMenu.ts` → `i/terminal.ts` → `i/main.ts`; `i/favorites.ts` → `i/1_agentSquaresMarks.ts`, `i/1_turnPanel.ts`, `i/chrome.ts`, `i/main.ts`, `i/panels.ts`, `i/terminal.ts`. |

| Import seed | Direct non-test importers in instant `src` | Terminal/UI path |
| --- | --- | --- |
| `i/harness.ts` | `i/favorites.ts`, `i/terminal.ts`, `i/worktrees.ts` | `favorites/terminal/worktrees` → `main.ts`; `favorites` → `1_turnPanel.ts`, `1_agentSquaresMarks.ts`, `panels.ts` |
| `i/00a_terminalIntersection.ts` | `i/00b_terminalLineAnchors.ts`, `i/0_terminalTurnVisibility.ts`, `i/favorites.ts`, `i/tablepanels.tsx`, `i/terminal.ts` | `0_terminalTurnVisibility` → terminal overlays; `tablepanels` → `panels.ts` → `main.ts` |
| `i/favorites.ts` | `i/1_agentSquaresMarks.ts`, `i/1_turnPanel.ts`, `i/chrome.ts`, `i/main.ts`, `i/panels.ts`, `i/terminal.ts` | `1_agentSquaresMarks` → `1_agentSquares.ts` → terminal; `1_turnPanel` → squares/card; `panels` → rail |
| `i/1_agentSquaresFeed.ts` | `i/1_agentSquares.ts`, `i/1_agentSquaresMarks.ts`, `i/1_agentSquaresModel.ts` | model/marks → squares DOM → `terminal.ts` → `main.ts` |
| `i/1b_terminalContextSync.ts` | `i/1d_terminalTurnMarks.ts`, `i/1e_terminalForkMarks.ts`, `i/1f_terminalForkRender.ts`, `i/terminal.ts` | marks/forks → terminal gutter/card → `main.ts` |
| `i/boopPanel.tsx`, `i/1_boopSearch.tsx`, `i/1_boopSelection.tsx` | `i/panels.ts` | `panels.ts` → `main.ts` |
| `i/0_stfuButton.ts`, `i/jumpPalette.ts`, `i/1g_forkPresetMenu.ts` | `i/0_panicSettings.ts` and `i/main.ts`; `i/main.ts`; `i/terminal.ts` respectively | button/palette/terminal composition in `main.ts` |

## A. Commands and event

| Row | Command/event | Rust fn file:line | TS I type | TS O type | Direct callers (file:line) |
| --- | --- | --- | --- | --- | --- |
| A01 | `harness_session` | `r/harness.rs:21` | `{tool:string; cwd:string}` | `string \| null` | `i/harness.ts:26` → `i/favorites.ts:42-89` |
| A02 | `harness_sessions` | `r/harness.rs:7` | `{tool:string; cwd:string}` | `string[]` | `i/harness.ts:25` → `i/favorites.ts:95-109` |
| A03 | `boop_turns` | `r/0_boop.rs:294` | `{session:string}` | `BoopTurn[]` | `i/favorites.ts:132`; via `boopTurnsForSession`: `i/terminal.ts:783`, `i/1_turnPanel.ts:415` |
| A04 | `boop_turns_recent` | `r/0_boop.rs:308` | `{since:number; harness:string}` | `BoopTurn[]` | `i/favorites.ts:177` → `boopCandidateTurns` → `i/terminal.ts:785` |
| A05 | `boop_sync_session` | `r/0_boop.rs:301` | `{session:string; harness:string}` | `{written:number; dropped:number}` | `i/terminal.ts:811-821` |
| A06 | `boop_locate_turns` | `r/0_boop.rs:1063` | `{lines:LogicalLine[]; turns:BoopTurn[]}` | `TurnSpan[]` (`LocatedTurn[]` Rust) | `i/terminal.ts:798` → `i/0_terminalTurnVisibility.ts:394-418` |
| A07 | `boop_favorite_add` | `r/0_boop.rs:869` | `{turn:BoopTurn}` | `void` | No instant `src` call found; generated name `i/generated/native.ts:251` |
| A08 | `boop_favorites` | `r/0_boop.rs:876` | `{}` | `BoopFavorite[]` | `i/favorites.ts:528` |
| A09 | `boop_favorite_toggle` | `r/0_boop.rs:883` | `{turn:BoopTurn; note?:string}` | `BoopFavorite[]` | `i/favorites.ts:190` → `i/1_turnPanel.ts:379` and terminal favorite actions |
| A10 | `boop_tags_recent` | `r/0_boop.rs:903` | `{limit?:number}` | `BoopTag[]` | `i/favorites.ts:211` |
| A11 | `boop_tags_search` | `r/0_boop.rs:918` | `{query:string; limit?:number}` | `BoopTag[]` | `i/favorites.ts:210` |
| A12 | `boop_tags_apply` | `r/0_boop.rs:934` | `{note:string; source:string}` | `string[]` | `i/favorites.ts:232` → `i/1_turnPanel.ts:401`, `i/terminal.ts` |
| A13 | `boop_tags_for` | `r/0_boop.rs:947` | `{source:string}` | `string[]` | `i/1_turnPanel.ts:373` |
| A14 | `boop_turn_comments` | `r/0_boop.rs:751` | `{tab:string; sessions:string[]}` | `BoopTurnComment[]` | `i/1b_terminalContextSync.ts:189` |
| A15 | `boop_turn_comment_upsert` | `r/0_boop.rs:763` | `{comment:BoopTurnComment}` | `number` | `i/1b_terminalContextSync.ts:234,249` |
| A16 | `boop_turn_comment_delete` | `r/0_boop.rs:790` | `{clientId:string}` | `void` | `i/1b_terminalContextSync.ts:257` |
| A17 | `boop_turn_comments_sent` | `r/0_boop.rs:803` | `{clientIds:string[]}` | `void` | `i/1b_terminalContextSync.ts:238,264` |
| A18 | `boop_turn_annotations` | `r/0_boop.rs:564` | `{sessions:string[]}` | `BoopTurnComment[]` | `i/1b_terminalContextSync.ts:208` |
| A19 | `boop_turn_comment_forks` | `r/0_boop.rs:744` | `{commentIds:number[]}` | `BoopTurnCommentFork[]` | `i/1b_terminalContextSync.ts:225` |
| A20 | `boop_config_presets` | `r/0_boop.rs:625` | `{}` | `BoopPreset[]` | `i/1g_forkPresetMenu.ts:90` |
| A21 | `boop_lanes` | `r/0_boop.rs:453` | `{}` | `BoopLane[]` | No instant `src` call found; generated name `i/generated/native.ts:265` |
| A22 | `boop_lane_events` | `r/0_boop.rs:460` | `{sinceMs:number}` | `BoopLaneEvent[]` | `i/boopPanel.tsx:190` |
| A23 | `boop_agent_touches` | `r/0_boop.rs:1498` | `{sessions:string[]; limit?:number}` | `AgentTouchRow[]` | `i/jumpPalette.ts:46` |
| A24 | `boop_session_graph` | `r/0_boop.rs:1606` | `{historySinceMs?:number}` | `SessionGraph` | `i/boopPanel.tsx:117,132` |
| A25 | `boop_search` | `r/1_boop_search.rs:375` | `{query:string; role:string; limit?:number}` | `BoopSearchHit[]` | `i/1_boopSearch.tsx:169` |
| A26 | `boop_search_status` | `r/1_boop_search.rs:336` | `{}` | `BoopSearchStatus` | `i/1_boopSearch.tsx:188,193` |
| A27 | `boop_search_sync` | `r/1_boop_search.rs:350` | `{}` | `BoopSearchStatus` | `i/1_boopSearch.tsx:189,232` |
| A28 | `boop_mux_capture` | `r/0_tmux.rs:9` | `{target:string; socket?:string \| null}` | `string` | `i/00a_terminalIntersection.ts:113`; `i/terminal.ts:886` |
| A29 | `boop_mux_session` | `r/0_harness_store.rs:36` | `{target:string; socket?:string \| null}` | `PaneSessionBinding \| null` | `i/00a_terminalIntersection.ts:123` → `i/terminal.ts:770-800` |
| A30 | `boop_mux_send_keys` | `r/0_tmux.rs:111` | `{body:string; target?:string; socket?:string; mode?:string}` | `string` | `i/0_stfuButton.ts:207` |
| A31 | `boop_mux_exit_copy_mode` | `r/0_tmux.rs:27` | `{target:string; socket?:string}` | `boolean` (caller leaves generic) | `i/terminal.ts:859` |
| A32 | `squares_watch` | `r/lib.rs:683` → `r/1_squares.rs:473` | `{pty:string; session:string; target:string; socket?:string; options:SquaresOptions}` | `void` | `i/1_agentSquaresFeed.ts:131` → `i/1_agentSquares.ts:179` |
| A33 | `squares_unwatch` | `r/lib.rs:705` → `r/1_squares.rs:489` | `{pty:string}` | `void` | `i/1_agentSquaresFeed.ts:132` → `i/1_agentSquares.ts:243-245` |
| A34 | `squares-update` Tauri/WebSocket event | `r/1_squares.rs:40,450` (`publish`) | server `Strip` | client `Strip` | `i/1_agentSquaresFeed.ts:21,119` → `i/1_agentSquares.ts:162` |
| A35 | `boop beep selection list/set/focus/clear/shout` CLI | External boop CLI; `i/0_boopSelection.ts:110-135,238-259` builds and runs commands | route/checked/target/time/recipients/body | `BoopSelectionRow[]` for list; `string` for shout; other results ignored | `i/1_boopSelection.tsx:124-321`; `i/terminal.ts:89` focus recorder |
| A36 | `boop beep fork` CLI | External boop CLI; `i/1f_terminalForkRender.ts:130-155` builds/parses command | comment ID, preset, cwd | lane name | `i/terminal.ts:230-258,880`; `i/1h_forkPanel.ts` |

## B. Instant state holders

| Row | Holder | File:line | Holds | Written by | Read by |
| --- | --- | --- | --- | --- | --- |
| B01 | `graphQuery` / Endpoint cache | `i/boopPanel.tsx:117,132`; `p/packages/signals/src/4_Query.ts:151,203,300` | `QueryState<SessionGraph>` keyed by endpoint and args; 3 s poll while observed, infinite cache time | A24 | `i/boopPanel.tsx:153-159` |
| B02 | `warmPin` | `i/boopPanel.tsx:140-149` | optional subscription retaining B01; no production `warmBoopGraph()` call found in instant `src` | `warmBoopGraph` (tests only) | graph query lifetime if invoked |
| B03 | `events`, `lastTs`, `invokeError` | `i/boopPanel.tsx:154,183-209` | append-only lane tail for panel mount, cursor, failure | A22, 1 s interval | roster and marbler projections `:213-298` |
| B04 | roster view state | `i/boopPanel.tsx:157,171-182` | `boopOnlyActive`, expansion, selected route | setting and UI handlers | `:160-180,243-298,307-399` |
| B05 | `marbler` | `i/boopPanel.tsx:185,249-272,302` | timeline source, selected ID, viewport, hover | C04 and user gestures | `MarblerPanel` `:390` |
| B06 | search `model`, `syncRequested`, `activeTerms`, `previews` | `i/1_boopSearch.tsx:40-41,70,128-139` | signals for query/role/tree/hits/error/status/sizing; sync flag; preview DOM cache | A25-A27, settings and handlers `:164-233` | search columns and JSX `:73-124,152-260` |
| B07 | session resolution caches | `i/favorites.ts:40-55` | `(harness,cwd) → session` TTL 5 s plus in-flight Promise | A01 | `tabSessions` `:59-89` |
| B08 | boop turn caches | `i/favorites.ts:117-143,171-184` | per-session and candidate turns plus in-flight Promises | A03, A04 | `boopTurnsForTab`, terminal visibility, TurnPanel |
| B09 | favorites and tags | `i/favorites.ts:121,187-236,528-535` | `boopFavorites` array; prompt suggestions | A08-A13 | favorite rail, marks, TurnPanel |
| B10 | `NativeTmuxPane` fields | `i/00a_terminalIntersection.ts:102-130` | session id, read timestamp, binding | A29 | `i/terminal.ts:770-800`, harness binding |
| B11 | terminal `Tab` | `i/terminal.ts:99-128,177-207,770-821` | pane session/harness, visibility, squares instance, `syncTurns` | B10, A05, settings | terminal and overlays |
| B12 | `TerminalTurnVisibilityV2` | `i/0_terminalTurnVisibility.ts:284-325,344-427` | visible turns, scan state, revision, capture/match results | A03-A06, A28 | debug/structured overlays, context queue, turn marks, terminal click |
| B13 | `TerminalContextSync` | `i/1b_terminalContextSync.ts:129-140,183-229` | last synced shapes, skipped removals, serialized writes, annotations/forks signals | A14-A19, queue changes | `i/1d_terminalTurnMarks.ts:87-122`, `i/1e_terminalForkMarks.ts`, `i/1f_terminalForkRender.ts` |
| B14 | context queue | `i/1a_terminalContextQueue.ts:78-122,243-325` | prompt items, selected turn IDs, changes/sent streams | terminal selection and DOM controls | B13 and gutter overlay |
| B15 | squares view instance | `i/1_agentSquares.ts:94-131,161-252,285-345` | last/held frame, keyed visual entries, panel ID, scroll offset and pane geometry | A34 and browser interactions | DOM strip and TurnPanel |
| B16 | squares settings | `i/0_agentSquaresSettings.ts:14-34` | `agentSquares.on/mode/userKeep` persisted signals | toolbar/settings | `i/terminal.ts:184-207`, A32 arguments |
| B17 | fork preset cache | `i/1g_forkPresetMenu.ts:84-101` | preset rows and read timestamp | A20 | fork menu `:105-130` |
| B18 | selection panel state | `i/1_boopSelection.tsx:119-155` | CLI rows, errors, draft, sending, generations, size | A35, UI events | selection TreeTable and composer |
| B19 | persisted panel state | `i/0_settings.ts:93,135`; `i/1_boopSelection.tsx:93-117` | `boopOnlyActive`; plugin slice `boopSelectionPanel` size | settings and resize | roster filter, selection panel |

## C. Derived values

| Row | Derived value | File:line | Inputs (A/B rows) | Pure? |
| --- | --- | --- | --- | --- |
| C01 | resolved tab sessions, candidate session IDs and sorted unique turns | `i/favorites.ts:59-89,147-184` | A01-A04, B07-B08, tab metadata | n (async reads); `candidateSessions` and dedupe/sort substeps y |
| C02 | chosen direct/candidate turns and located visible regions | `i/0b_ompTurnBinding.ts`; `i/0_terminalTurnVisibility.ts:79-237,344-427`; `i/terminal.ts:783-799` | A03-A06, A28-A29, B10-B12 | n overall; matching and region attachment y |
| C03 | graph tree, active filter, flattening and roster state | `i/0_boopGraph.ts:118-297`; `i/0_boopPanelState.ts:28`; `i/boopPanel.tsx:158-180,280-295` | A24, B01, B04 | y |
| C04 | lane mail frames, stats, timestamps, subtree and `BoopRow` | `i/0_boopPresentation.ts:30-170`; `i/boopPanel.tsx:212-281` | A22, A24, B03-B04 | y |
| C05 | search chat/hit rows and labels | `i/1_boopSearchRows.ts:50-110`; `i/1_boopSearch.tsx:64-124,141-150` | A25-A27, B06 | y for fixed `now`; `whenLabel` reads clock by default |
| C06 | strip squares, gap, preview, row-to-px placement | `i/1_agentSquaresModel.ts:42-189` | A34, B15 | y for given frame and geometry; preview timestamp formatting is locale-dependent |
| C07 | marks and square visual seed | `i/1_agentSquaresMarks.ts:19-29`; `i/1_agentSquares.ts:285-345` | A34, B09, B15 | marks y; DOM render n |
| C08 | comment visibility, queue item, annotation/fork placement | `i/1b_terminalContextSync.ts:50-125`; `i/1d_terminalTurnMarks.ts:117-128`; `i/1e_terminalForkMarks.ts` | A14-A19, B12-B14 | y for input rows; painting n |
| C09 | eligible selection rows and relative focus time | `i/0_boopSelection.ts:139-190`; `i/1_boopSelection.tsx:150` | A35, B18-B19 | y for explicit `now` |
| C10 | live preset groups and current preset | `i/1g_forkPresetMenu.ts:26-77,105-130` | A20, B17, stored fork preferences | y |
| C11 | tag suggestions and favorite membership | `i/favorites.ts:209-235` | A08-A13, B09 | n for suggestions; membership y |

## D. UI consumers

| Row | UI consumer | File:line | Prop/field read | Source row | Rendering tech |
| --- | --- | --- | --- | --- | --- |
| D01 | boop roster columns and empty state | `i/boopPanel.tsx:32-99,307-364` | `BoopRow.label/kind/state/harness/cwd/mailCount/startedTs/lastTs/endedTs`, `roster.kind/message` | B01-B04, C03-C04 | React `TreeTable` |
| D02 | boop mail timeline | `i/boopPanel.tsx:367-390` | `shown`, `summary`, `viewport`, `hovered` | B05, C04 | React `MarblerPanel` |
| D03 | boop search table/status | `i/1_boopSearch.tsx:73-124,237-259` | `SearchRow.snippet/chat/role/ts/lastTs/count`, status/error | B06, C05 | React `TreeTable` |
| D04 | search hit preview | `i/1_boopSearch.tsx:43-57` | `BoopSearchHit.said/session/turn/role/harness/cwd` | A25, B06 | DOM in reactdock preview |
| D05 | squares gutter | `i/1_agentSquares.ts:285-345,470-512` | `AgentSquaresProps.squares/gap/track`, square `y/scale/active/kind`, marks | B09, B15, C06-C07 | DOM beside xterm |
| D06 | turn card | `i/1_turnPanel.ts:203-235,337-375` | `TurnPanelTarget.turn.said/preview`, tags, favorite | A03, A13, B09, B15 | React content mounted into DOM card |
| D07 | visible turn overlays | `i/0_turnDebugOverlay.ts:110`; `i/1_terminalStructuredOverlay.ts:42`; `i/1d_terminalTurnMarks.ts:117-161` | located turn spans, annotations/forks | B12-B14, C02, C08 | xterm overlay/DOM gutter |
| D08 | context queue and fork reply | `i/1a_terminalContextQueue.ts:243-325`; `i/1f_terminalForkRender.ts:215-294` | queue items, fork state/reply, live pane | B13-B14, C08 | xterm adjacent DOM |
| D09 | selection rail/composer | `i/1_boopSelection.tsx:43-82,124-155,330-410` | route/session/title/checked/focus, draft/results | A35, B18-B19, C09 | React `TreeTable` and DOM controls |
| D10 | jump palette | `i/jumpPalette.ts:35-153` | `AgentTouchRow` sessions and turn targets | A23 | DOM palette |
| D11 | favorite rail | `i/favorites.ts:396-535` | `BoopFavorite` source/body/note/tags | A08-A13, B09 | plugin rail and preview DOM |
| D12 | fork preset menu | `i/1g_forkPresetMenu.ts:26-77,88-130`; `i/1h_forkPanel.ts` | preset name/harness/model/status | A20, B17, C10 | DOM menu/panel |

## E. Subscription, callback and Promise sites

| Site | File:line | What it drives |
| --- | --- | --- |
| `firstValueFrom(commandEndpoint.execute(args))` | `i/generated/native.ts:148-154` | Every `invoke` Promise; `Endpoint.execute` cold request `p/packages/signals/src/3_Endpoint.ts:49-69` |
| `.subscribe()` warm pin | `i/boopPanel.tsx:140-149` | Optional B01 polling before panel mount; no production caller found |
| `setInterval(refresh)` plus `invoke` | `i/boopPanel.tsx:186-209` | A22 append tail into B03 |
| search `.subscribe(rows/status)` | `i/1_boopSearch.tsx:163-204` | A25-A27 → B06 signals; React effect returns `unsubscribe` |
| search reindex Promise `.then` | `i/1_boopSearch.tsx:232` | A27 → status signal |
| squares `watchSquares` Promise and returned callback | `i/1_agentSquaresFeed.ts:130-133`; `i/1_agentSquares.ts:179,243-245` | A32 watcher lifetime and A33 unwatch |
| squares feed `.subscribe(frame)` | `i/1_agentSquares.ts:162` | A34 → B15 render; `:228` unsubscribes |
| visual `.subscribe(state)` | `i/1_agentSquares.ts:495-512` | square DOM classes and styles |
| tmux pane `onSessionBinding(binding)` callback | `i/00a_terminalIntersection.ts:102-130`; `i/terminal.ts:770-774` | A29 → B11 pane session/harness |
| visibility source subscriptions | `i/0_terminalTurnVisibility.ts:301-325` | viewport/write/scroll/activity/lease → scan scheduling |
| visibility Promise fan-in | `i/0_terminalTurnVisibility.ts:363-401`; `i/terminal.ts:783-825` | A03-A06, A28-A29 → B12 and sync/invalidation |
| queue `.subscribe(changes/sent)` and serialized Promise | `i/1b_terminalContextSync.ts:148-165,181-264` | A14-A19 writes, hydration, annotation/fork pulls |
| marks/fork subscriptions | `i/1d_terminalTurnMarks.ts:87-88`; `i/1f_terminalForkRender.ts:215` | B13 changes → gutter paint |
| terminal settings/gesture subscriptions | `i/terminal.ts:723,889` | active tab state and command-click routing |
| terminal anchor/overlay subscriptions | `i/00b_terminalLineAnchors.ts:41-42`; `i/0_turnDebugOverlay.ts:110`; `i/1_terminalStructuredOverlay.ts:42`; `i/0_terminalDiagrams.ts:457-468` | xterm viewport/turn changes → paint |
| resolution and turn cache Promises | `i/favorites.ts:42-55,127-184` | A01-A04 dedupe and TTL caches |
| favorite/tag Promises | `i/favorites.ts:187-232,528-535` | A08-A13 → B09 and favorite rail |
| CLI Promise wrapper, selection poll/callback | `i/0_boopSelection.ts:231-259`; `i/1_boopSelection.tsx:173-322` | A35 list/mutate/focus/shout → B18 |
| `nativeEvent$` callback bridge | `i/reactive/nativeTransport.ts:109-128` | Tauri `listen` or WebSocket event → A34 observable |

## F. Overlap

| Existing coverage | Rows here | Evidence / boundary |
| --- | --- | --- |
| boop-xterm wave 2 planned ports | A03-A06, A28-A29, B07-B08, B10-B12, C01-C02, D07, relevant E visibility/anchor/overlay rows | `p/plans/boop-xterm-lift-map.REPORT.md:236-250`; `p/plans/boop-xterm-wave2.DESIGN.md:289-309,370-386,543-616` defines Endpoint ports and stream replacements; these are design targets, not implemented claims. |
| boop-adapters existing projections | C03-C04 and D01-D02 have *conceptual* tree/timeline/topology overlap; none is a direct wire adapter | `p/packages/boop-adapters/src/0_types.ts:52,137-177`, `2_tree.ts:20`, `3_timeline.ts:39`, `4_topology.ts:4`, `7_network.ts:44,103`; inputs are `BoopAgentSnapshot` or `AgentNetworkExport`, not instant `SessionGraph` plus `BoopLaneEvent[]`. |
| signals existing transport primitive | A24/B01-B02 and proposed wave 2 endpoint ports | `p/packages/signals/src/3_Endpoint.ts:49-69`, `4_Query.ts:151-235,300-362`; instant uses this directly for graph but retains `invoke` Promise bridges elsewhere. |
| covered by neither xterm wave 2 nor boop-adapters | A07-A27, A30-A36; B03-B06, B09, B13-B19; C03-C11; D01-D06, D08-D12; E roster/search/squares/context/CLI/favorite rows | Existing package projections do not consume instant's roster/search/selection/favorite/comment/strip wire shapes. |

## G. Instant-only coupling

| Coupling | File:line | Extraction boundary it currently supplies |
| --- | --- | --- |
| Native command transport and events | `i/generated/native.ts:128-154`; `i/reactive/nativeTransport.ts:1-128` | Tauri invoke or serve WebSocket command/event delivery |
| Pane/tab registry and session metadata | `i/terminal.ts:99-128,435-470,770-825`; `i/favorites.ts:83-89` | tmux target, cwd, command, harness, active session and tab lifecycle |
| App store sessions | `i/terminal.ts:440-461`; `i/main.ts:276` | pane cwd and process command observations |
| Local settings keys | `i/0_agentSquaresSettings.ts:14-22`; `i/0_settings.ts:93,135`; `i/1_boopSearch.tsx:131-136` | `agentSquares.*`, `boopOnlyActive`, `pluginState`, `boopSearchRole/Tree/Sizing` |
| Selection panel size and draft | `i/1_boopSelection.tsx:93-155` | `boopSelectionPanel` pluginState slice and module draft |
| Plugin panel registry | `i/panels.ts:80-135`; `i/main.ts:332` | boop roster, search, selection and favorites mount points |
| reactdock previews | `i/1_boopSearch.tsx:43-57`; `i/favorites.ts:345,365`; `i/terminal.ts:51` | hit and favorite detail placement |
| xterm DOM and gutter geometry | `i/1_agentSquares.ts:94-175,285-345`; `i/terminal.ts:177-207` | strip host, measured pane, active tab and width callback |
| CLI shell RPC | `i/0_boopSelection.ts:110-135,238-259`; `i/1f_terminalForkRender.ts:130-155`; `i/terminal.ts:230-258` | boop selection and fork commands executed via instant click RPC/PTY |
| Favorite app store and status | `i/favorites.ts:187-204,528-540`; `i/main.ts:346` | badge refresh and status flash after store mutation |
| Context queue/tab name | `i/1b_terminalContextSync.ts:143-165,187-203`; `i/1a_terminalContextQueue.ts:78-122` | comment ownership, hydration and pagehide flush |

## H. Commands and output line counts

| Command run | Output lines |
| --- | ---: |
| `rg --files instant/src instant/src-tauri/src \| wc -l` | 344 count |
| `wc -l instant/src/generated/native.ts instant/src-tauri/src/{0_boop,1_squares,0_harness_store,0_tmux}.rs plans/boop-xterm-lift-map.REPORT.md plans/boop-xterm-wave2.DESIGN.md packages/boop-adapters/src/*.ts packages/signals/src/{3_Endpoint,4_Query}.ts` | 22 output lines; 5,904 total source lines |
| `rg -n 'boop_\|squares_\|harness_' instant/src --glob '!generated/native.ts' > /tmp/boop-props-hits.txt; wc -l ...` | 321 matches |
| `rg -n 'invoke...\|commandEndpoint...\|listen' instant/src ... > /tmp/boop-props-calls.txt; wc -l ...` | 33 selected call lines |
| Python import-reverse traversal over instant `src` for 14 seed files, four depths | 14 output lines |
| `rg -n '\.subscribe\('` across 20 named instant layer files `\| wc -l` | 36 text matches (NUL-bearing `1b_terminalContextSync.ts` reported as binary; its two calls recorded at lines 150,154) |
| `rg -n 'pub async fn ...'` plus Rust signature inspection over `0_boop.rs`, `0_harness_store.rs`, `0_tmux.rs`, `1_squares.rs`, `1_boop_search.rs`, `harness.rs`, `lib.rs` | 34 printed signatures including internal/test functions |
| `rg -n` and `sed -n` targeted reads of callers, projections, plans, packages, Rust bodies, and UI consumers | Output inspected in bounded slices; line counts are the cited source ranges in A-G |
