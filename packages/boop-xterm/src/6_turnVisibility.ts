import { Signal, createMutation, createQuery, toSignal, type Query } from "@hafley66/signals";
import type { Terminal } from "@xterm/xterm";
import { EMPTY, Observable, catchError, combineLatest, concat, debounceTime, defer, distinctUntilChanged, exhaustMap, expand, filter, forkJoin, map, merge, of, scan, share, shareReplay, skip, skipWhile, startWith, switchMap, take, takeUntil, tap, timer } from "rxjs";
import { regionAtBufferRow as findRegion, type ProjectedTurnRegion } from "./0_turnRegions.js";
import type { BoopTurn, LogicalLine, VisibleTurn } from "./0_types.js";
import { projectionTurnSources } from "./1_ompTurnBinding.js";
import { attachTurnRegions, dropTerminalInputRows, dropTmuxStatusRow, locateVisibleTurns, selectProjectionTurns, tmuxConfirms, TURN_ACTIVITY_LEASE_MS, TURN_ACTIVITY_POLL_MS, type TurnSpan, type TurnVisibilityEvent } from "./2_turnLocate.js";
import type { BoopXtermPorts, PaneIdentity, PaneRuntimeState, PaneSessionBinding, TurnVisibilityModel, TurnVisibilityState, ViewportModel, ViewportSnapshot } from "./3_ports.js";
import type { Signal as SignalType } from "@hafley66/signals";

export function turnAtBufferRow(visible: VisibleTurn[], row: number | null): VisibleTurn | null {
  return row === null ? null : visible.find((turn) => turn.anchorStart <= row && row <= turn.anchorEnd) ?? null;
}

export function regionAtBufferRow(visible: VisibleTurn[], row: number | null): ProjectedTurnRegion | null;
export function regionAtBufferRow(regions: ProjectedTurnRegion[], row: number): ProjectedTurnRegion | null;
export function regionAtBufferRow(visibleOrRegions: VisibleTurn[] | ProjectedTurnRegion[], row: number | null): ProjectedTurnRegion | null {
  if (row === null || !visibleOrRegions.length) return null;
  if ("regions" in visibleOrRegions[0]) {
    const turn = turnAtBufferRow(visibleOrRegions as VisibleTurn[], row);
    return turn ? findRegion(turn.regions, row) : null;
  }
  return findRegion(visibleOrRegions as ProjectedTurnRegion[], row);
}

function queryData<I, O>(query: Query<I, O>, fallback: O): Observable<O> {
  return query.$.pipe(
    filter((state) => !state.isLoading && (state.isSuccess || state.isError)),
    take(1),
    map((state) => state.data ?? fallback),
  );
}

function turnsFor(session: string, ports: BoopXtermPorts): Observable<BoopTurn[]> {
  return queryData(createQuery(ports.boop_turns, { session }, { staleTime: 1_000 }), []);
}

function allTurns(sessions: string[], ports: BoopXtermPorts): Observable<BoopTurn[]> {
  const unique = [...new Set(sessions.filter(Boolean))];
  return unique.length
    ? forkJoin(unique.map((session) => turnsFor(session, ports))).pipe(map((groups) => groups.flat()))
    : of([]);
}

function recentTurns(harness: string | null, ports: BoopXtermPorts): Observable<BoopTurn[]> {
  if (!harness || harness === "omp") return of([]);
  const query = (since: number) => queryData(createQuery(ports.boop_turns_recent, { since, harness }, { staleTime: 10_000 }), []);
  return query(Date.now() - 6 * 60 * 60 * 1_000).pipe(
    switchMap((recent) => recent.length ? of(recent) : query(0)),
    switchMap((recent) => allTurns(recent.map((turn) => turn.session), ports)),
  );
}

function locate(
  lines: LogicalLine[], turns: BoopTurn[], capture: string, harness: string | null, ports: BoopXtermPorts,
): Observable<VisibleTurn[]> {
  const paneLines = dropTmuxStatusRow(lines, capture);
  const native = createQuery(ports.boop_locate_turns, { lines: paneLines, turns }, { cacheTime: 0 });
  return native.$.pipe(
    skipWhile((state) => !state.isLoading),
    filter((state) => !state.isLoading && (state.isSuccess || state.isError)),
    take(1),
    map((state) => state.isSuccess && state.data
      ? attachTurnRegions(state.data, paneLines, tmuxConfirms(paneLines, capture))
      : locateVisibleTurns(dropTerminalInputRows(paneLines, harness ?? ""), turns, capture)),
    catchError(() => of(locateVisibleTurns(dropTerminalInputRows(paneLines, harness ?? ""), turns, capture))),
  );
}

type ScanTrigger = { snapshot: ViewportSnapshot; kind: "viewport" | "capture" | "manual" | "resume" };

export function turnVisibilityStream(
  _term: Terminal, _identity: PaneIdentity, viewport: ViewportModel,
  paneSession: Query<{ target: string; socket: string | null }, PaneSessionBinding | null>,
  runtime: SignalType<PaneRuntimeState>, ports: BoopXtermPorts,
): TurnVisibilityModel {
  const stateInitial: TurnVisibilityState = { visible: [] };
  const changes = Signal<TurnVisibilityEvent>();
  const settled = Signal<void>();
  const scanning = Signal(false);
  const visible = toSignal(ports.paneVisible);
  const closed$ = toSignal(ports.paneClosed).$.pipe(filter(Boolean));
  const harness = toSignal(ports.harness);
  const tabSessionIds = toSignal(ports.tabSessionIds);
  const activity$ = viewport.changes.$.pipe(
    filter((change) => change !== undefined && (change.kind === "write" || change.kind === "scroll")),
    share(),
  );
  const lease$ = activity$.pipe(
    switchMap(() => concat(of(true), timer(TURN_ACTIVITY_LEASE_MS).pipe(map(() => false)))),
    startWith(false),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  const pauseWhen$ = combineLatest([visible.$, lease$]).pipe(map(([shown, active]) => !shown || !active));
  const capture = createQuery(ports.boop_mux_capture, paneSession.data.$.pipe(
    map((binding) => binding?.session ? { target: _identity.target, socket: _identity.socket } : undefined),
  ), {
    cacheTime: 0,
    refetchInterval: TURN_ACTIVITY_POLL_MS,
    pauseWhen: pauseWhen$,
  });
  const currentSnapshot$ = viewport.snapshot.$.pipe(shareReplay({ bufferSize: 1, refCount: true }));
  const viewportTriggers$ = currentSnapshot$.pipe(
    skip(1),
    filter(() => visible.$()),
    switchMap((snapshot) => snapshot.change.kind === "write"
      ? timer(120).pipe(map(() => ({ snapshot, kind: "viewport" as const })))
      : of({ snapshot, kind: "viewport" as const })),
  );
  const captureTriggers$ = capture.$.pipe(
    filter((result) => result.isSuccess && !result.isLoading),
    switchMap(() => currentSnapshot$.pipe(take(1), map((snapshot) => ({ snapshot, kind: "capture" as const })))),
  );
  const manualTriggers$ = ports.scanRequested.$.pipe(
    switchMap(() => currentSnapshot$.pipe(take(1), map((snapshot) => ({ snapshot, kind: "manual" as const })))),
  );
  const resumeTriggers$ = visible.$.pipe(
    distinctUntilChanged(), filter(Boolean),
    switchMap(() => currentSnapshot$.pipe(take(1), map((snapshot) => ({ snapshot, kind: "resume" as const })))),
  );
  const scanOnce = (trigger: ScanTrigger): Observable<VisibleTurn[] | null> => defer(() => {
    if (!visible.$()) return of(null);
    const revision = runtime.viewportRevision.$();
    const binding = paneSession.data.$();
    const activeHarness = harness.$();
    const tabIds = tabSessionIds.$();
    const direct$ = binding?.session ? turnsFor(binding.session, ports) : of([] as BoopTurn[]);
    const tab$ = activeHarness === "omp" ? of([] as BoopTurn[]) : allTurns(tabIds, ports);
    const candidates$ = recentTurns(activeHarness, ports);
    const capture$ = binding?.session ? queryData(capture, "") : of("");
    scanning.$(true);
    return forkJoin({ direct: direct$, tab: tab$, candidates: candidates$, capture: capture$ }).pipe(
      switchMap(({ direct, tab, candidates, capture: captured }) => {
        const sources = projectionTurnSources(activeHarness, binding?.session ?? null, direct, tab, candidates);
        const turns = selectProjectionTurns(sources.direct, sources.candidates);
        return locate(trigger.snapshot.lines, turns, captured, activeHarness, ports);
      }),
      map((found) => revision === runtime.viewportRevision.$() ? found : null),
      tap({ finalize: () => { scanning.$(false); settled.$(undefined); } }),
      catchError(() => of(null)),
    );
  });
  const scanResults$ = defer(() => {
    let pending: ScanTrigger | null = null;
    return merge(viewportTriggers$, captureTriggers$, manualTriggers$, resumeTriggers$).pipe(
      tap((trigger) => { pending = trigger; }),
      exhaustMap((trigger) => {
        pending = null;
        return scanOnce(trigger).pipe(
          expand(() => {
            if (!pending) return EMPTY;
            const next = pending;
            pending = null;
            return scanOnce(next);
          }),
        );
      }),
      filter((found): found is VisibleTurn[] => found !== null),
      takeUntil(closed$),
      share(),
    );
  });
  const retained = Signal(scanResults$.pipe(
    startWith([] as VisibleTurn[]),
    scan((prior, found) => {
      const before = prior.visible;
      const changed = JSON.stringify(before) !== JSON.stringify(found);
      if (changed) {
        const beforeIds = new Set(before.map((turn) => turn.id));
        const afterIds = new Set(found.map((turn) => turn.id));
        changes.$({ visible: found, entered: found.filter((turn) => !beforeIds.has(turn.id)),
          exited: before.filter((turn) => !afterIds.has(turn.id)) });
      }
      return { visible: found };
    }, stateInitial),
  ), stateInitial);
  const sync$ = activity$.pipe(
    debounceTime(120),
    filter(() => visible.$()),
    switchMap(() => {
      const binding = paneSession.data.$();
      const activeHarness = harness.$();
      return binding?.session && activeHarness
        ? of({ session: binding.session, harness: activeHarness }) : EMPTY;
    }),
    exhaustMap((input) => createMutation(ports.boop_sync_session, input).$.pipe(
      filter((result) => result.isSuccess || result.isError), take(1),
      tap((result) => { if (result.data && result.data.written + result.data.dropped > 0) capture.refetch(); }),
      map(() => void 0),
    )),
    takeUntil(closed$),
  );
  return { state: retained, scanning, changes, settled,
    effects: merge(retained.$.pipe(map(() => void 0)), sync$) };
}
