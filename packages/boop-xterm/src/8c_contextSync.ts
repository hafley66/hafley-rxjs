import { Signal, createMutation, createQuery, toSignal, type Endpoint, type SignalSource } from "@hafley66/signals";
import { EMPTY, Observable, catchError, concat, concatMap, debounceTime, defer, filter, map, merge, of, startWith, take, tap, throwError } from "rxjs";
import type { VisibleTurn } from "./0_types.js";
import type { PromptContextItem } from "./1_contextQueuePure.js";
import { diffItems, rowShowsOn, shapeOf, toComment, toItem, type BoopTurnComment, type BoopTurnCommentFork, type SyncedShape } from "./2_contextSyncPure.js";
import type { BoopXtermPorts } from "./3_ports.js";
import type { ContextQueueModel } from "./8a_contextQueue.js";

export type ContextSyncModel = {
  annotations: Signal<BoopTurnComment[]>;
  forks: Signal<BoopTurnCommentFork[]>;
  refresh: Signal<void | undefined>;
  flush: Signal<void | undefined>;
  sendSelection: Signal<PromptContextItem | undefined>;
  selectionWritten: Signal<{ clientId: string; commentId: number | null } | undefined>;
  effects: Observable<void>;
};

function queryResult<I, O>(endpoint: Endpoint<I, O>, input: I): Observable<O> {
  return createQuery(endpoint, input, { cacheTime: 0 }).$.pipe(
    filter((result) => result.isSuccess || result.isError), take(1),
    concatMap((result) => result.isSuccess ? of(result.data as O) : throwError(() => result.error)),
  );
}

function mutationResult<I, O>(endpoint: Endpoint<I, O>, input: I): Observable<O> {
  return createMutation(endpoint, of(input)).$.pipe(
    filter((result) => result.isSuccess || result.isError), take(1),
    concatMap((result) => result.isSuccess ? of(result.data as O) : throwError(() => result.error)),
  );
}

export function contextSyncStream(
  queue: ContextQueueModel, tabName: SignalSource<string>, sessions: SignalSource<string[]>,
  visibleTurns: Signal<VisibleTurn[]>, ports: BoopXtermPorts,
): ContextSyncModel {
  const annotations = Signal<BoopTurnComment[]>([]);
  const forks = Signal<BoopTurnCommentFork[]>([]);
  const refresh = Signal<void>();
  const flush = Signal<void>();
  const sendSelection = Signal<PromptContextItem>();
  const selectionWritten = Signal<{ clientId: string; commentId: number | null }>();
  const tab = toSignal(tabName);
  const sessionIds = toSignal(sessions);
  const effects = defer(() => {
    const last = new Map<string, SyncedShape>();
    const sentIds = new Set<string>();
    const annotationPull = () => queryResult(ports.boop_turn_annotations, { sessions: sessionIds.$() }).pipe(
      tap((rows) => annotations.$(rows)),
      concatMap((rows) => rows.length
        ? queryResult(ports.boop_turn_comment_forks, { commentIds: rows.map((row) => row.commentId) })
        : of([] as BoopTurnCommentFork[])),
      tap((rows) => forks.$(rows)),
      map(() => void 0),
      catchError(() => EMPTY),
    );
    const pull$ = refresh.$.pipe(startWith(undefined), concatMap(() => queryResult(ports.boop_turn_comments,
      { tab: tab.$(), sessions: sessionIds.$() }).pipe(
      tap((rows) => {
        const visible = new Set(visibleTurns.$().map((turn) => turn.id));
        const local = new Set(queue.state.items.$().map((item) => item.id));
        const items = rows.filter((row) => rowShowsOn(row, tab.$(), visible)).map(toItem)
          .filter((item) => !(last.has(item.id) && !local.has(item.id)));
        for (const item of items) last.set(item.id, shapeOf(item));
        queue.hydrate.$(items);
      }),
      concatMap(() => annotationPull()),
      catchError(() => EMPTY),
    )));
    type Write = { kind: "push"; items: PromptContextItem[]; keep: boolean }
      | { kind: "sent"; ids: string[]; items: PromptContextItem[] }
      | { kind: "selection"; item: PromptContextItem };
    const queued$ = queue.state.$.pipe(debounceTime(300), map(({ items }): Write => ({ kind: "push", items, keep: false })));
    const flush$ = flush.$.pipe(map((): Write => ({ kind: "push", items: queue.state.items.$(), keep: true })));
    const sent$ = queue.sent.$.pipe(filter((value) => value !== undefined), map(({ ids, items }): Write => ({ kind: "sent", ids, items })));
    const selection$ = sendSelection.$.pipe(filter((item) => item !== undefined), map((item): Write => ({ kind: "selection", item })));
    const pagehide$ = new Observable<Write>((subscriber) => {
      const onHide = () => subscriber.next({ kind: "push", items: queue.state.items.$(), keep: true });
      window.addEventListener("pagehide", onHide);
      return function unsubscribe() { window.removeEventListener("pagehide", onHide); };
    });
    const push = (items: PromptContextItem[], keep: boolean): Observable<void> => defer(() => {
      const { upserts, removals } = diffItems(last, items);
      const writes = upserts.map((item) => mutationResult(ports.boop_turn_comment_upsert,
        { comment: toComment(item, tab.$()) }).pipe(
        tap(() => last.set(item.id, shapeOf(item))), map(() => void 0), catchError(() => EMPTY),
      ));
      if (!keep) writes.push(...removals.map((id) => defer(() => {
        last.delete(id);
        if (sentIds.delete(id)) return EMPTY;
        return mutationResult(ports.boop_turn_comment_delete, { clientId: id }).pipe(map(() => void 0));
      }).pipe(catchError(() => EMPTY))));
      return concat(...writes);
    });
    const write$ = merge(queued$, flush$, sent$, selection$, pagehide$).pipe(concatMap((action) => {
      if (action.kind === "push") return push(action.items, action.keep);
      if (action.kind === "sent") return concat(
        push(action.items, true),
        mutationResult(ports.boop_turn_comments_sent, { clientIds: action.ids }).pipe(
          tap(() => { for (const id of action.ids) sentIds.add(id); }), map(() => void 0), catchError(() => EMPTY),
        ),
        annotationPull(),
      );
      return mutationResult(ports.boop_turn_comment_upsert, { comment: toComment(action.item, tab.$()) }).pipe(
        concatMap((commentId) => concat(
          mutationResult(ports.boop_turn_comments_sent, { clientIds: [action.item.id] }).pipe(catchError(() => of(undefined))),
          annotationPull(),
        ).pipe(tap({ complete: () => selectionWritten.$({ clientId: action.item.id, commentId }) }))),
        catchError(() => { selectionWritten.$({ clientId: action.item.id, commentId: null }); return EMPTY; }),
      );
    }), map(() => void 0));
    return merge(pull$, write$);
  });
  return { annotations, forks, refresh, flush, sendSelection, selectionWritten, effects };
}
