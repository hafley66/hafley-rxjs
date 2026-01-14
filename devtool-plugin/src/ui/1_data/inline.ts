/**
 * Inline Data Provider
 *
 * Reads directly from the tracking registry.
 * Used when the visualization is embedded in the same page as the tracked code.
 */

import { BehaviorSubject, Subject, Observable, interval, Subscription } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { disableTracking, enableTracking } from '../../tracking/config';
import type { DataProvider } from './provider';
import type {
  TrackingEvent,
  ObservableMetadata,
  SubscriptionMetadata,
  GraphState,
  GraphNode,
  GraphEdge,
} from '../0_types';
import {
  observableMetadata,
  activeSubscriptions,
  archivedSubscriptions,
  getObservableById,
  getAllObservableMetadata,
} from '../../tracking/registry';
import { writeQueue$ } from '../../tracking/storage';
import { createPipeTree$, type PipeTreeState } from './pipe-tree';
import { createTimeline$, type TimelineState } from './2_timeline';

/**
 * Poll interval for registry changes (ms).
 * Registry uses WeakMap so we can't get change notifications directly.
 */
const POLL_INTERVAL = 100;

/**
 * InlineProvider - reads from the tracking registry directly.
 */
export class InlineProvider implements DataProvider {
  // Raw data subjects (internal)
  private readonly _observables$ = new BehaviorSubject<ObservableMetadata[]>([]);
  private readonly _subscriptions$ = new BehaviorSubject<SubscriptionMetadata[]>([]);
  private readonly _events$ = new Subject<TrackingEvent>();
  private readonly _graph$ = new BehaviorSubject<GraphState>({ nodes: [], edges: [] });

  // Public streams (cached asObservable to prevent tracking)
  readonly observables$: Observable<ObservableMetadata[]>;
  readonly subscriptions$: Observable<SubscriptionMetadata[]>;
  readonly events$: Observable<TrackingEvent>;
  readonly graph$: Observable<GraphState>;
  readonly pipeTree$: Observable<PipeTreeState>;
  readonly timeline$: Observable<TimelineState>;

  private readonly internalSubs: Subscription[] = [];
  private readonly seenObservableIds = new Set<string>();

  constructor() {
    // Disable tracking while setting up internal observables to prevent recursion
    disableTracking();

    // Cache asObservable() results while tracking is disabled
    this.observables$ = this._observables$.asObservable();
    this.subscriptions$ = this._subscriptions$.asObservable();
    this.events$ = this._events$.asObservable();
    this.graph$ = this._graph$.asObservable();

    // Create derived streams (FRP transforms)
    this.pipeTree$ = createPipeTree$(this.observables$, this.subscriptions$);
    this.timeline$ = createTimeline$(this.observables$, this.subscriptions$, this.events$);

    // Sync initial state from registry (for observables created before we subscribed)
    this.syncInitialState();

    this.setupPolling();
    this.setupEventStream();

    // Re-enable tracking
    enableTracking();
  }

  /**
   * Sync initial state from the registry.
   * This catches observables that were created before we started listening.
   */
  private syncInitialState(): void {
    const allMeta = getAllObservableMetadata();
    for (const meta of allMeta) {
      if (!this.seenObservableIds.has(meta.id)) {
        this.seenObservableIds.add(meta.id);
        this.addObservable(meta);
      }
    }
  }

  getObservable(id: string): ObservableMetadata | undefined {
    const obs = getObservableById(id);
    return obs ? observableMetadata.get(obs) : undefined;
  }

  getSubscription(id: string): SubscriptionMetadata | undefined {
    return activeSubscriptions.get(id) ?? archivedSubscriptions.get(id);
  }

  dispose(): void {
    this.internalSubs.forEach((s) => s.unsubscribe());
    this._observables$.complete();
    this._subscriptions$.complete();
    this._events$.complete();
    this._graph$.complete();
  }

  /**
   * Poll the registry for changes.
   * WeakMap doesn't support iteration, so we track known IDs.
   */
  private setupPolling(): void {
    const poll$ = interval(POLL_INTERVAL).pipe(startWith(0));

    const sub = poll$.subscribe(() => {
      this.updateSubscriptions();
      this.updateGraph();
    });

    this.internalSubs.push(sub);
  }

  /**
   * Listen to the write queue for real-time events.
   */
  private setupEventStream(): void {
    const sub = writeQueue$.subscribe((write) => {
      this.handleWrite(write);
    });

    this.internalSubs.push(sub);
  }

  private handleWrite(write: { store: string; key: string; data: any }): void {
    // Track new or updated observables
    if (write.store === 'observables') {
      const meta = write.data as ObservableMetadata;
      if (!this.seenObservableIds.has(meta.id)) {
        // New observable
        this.seenObservableIds.add(meta.id);
        this.addObservable(meta);
      } else {
        // Updated observable (e.g., __track$ added variableName)
        this.updateObservable(meta);
      }
    }

    // Emit subscription events
    if (write.store === 'subscriptions') {
      const meta = write.data as SubscriptionMetadata;
      this._events$.next({
        type: 'subscribe',
        timestamp: meta.subscribedAt,
        subscriptionId: meta.id,
        observableId: meta.observableId,
      });
    }

    // Emit emission events
    if (write.store === 'emissions') {
      const emission = write.data as { id: string; subscriptionId: string; observableId: string; value: unknown; timestamp: number };
      this._events$.next({
        type: 'next',
        timestamp: emission.timestamp,
        subscriptionId: emission.subscriptionId,
        observableId: emission.observableId,
        value: emission.value,
      });
    }

    // Emit error events
    if (write.store === 'errors') {
      const error = write.data as { id: string; subscriptionId: string; observableId: string; error: unknown; timestamp: number };
      this._events$.next({
        type: 'error',
        timestamp: error.timestamp,
        subscriptionId: error.subscriptionId,
        observableId: error.observableId,
        error: error.error,
      });
    }
  }

  private addObservable(newMeta: ObservableMetadata): void {
    const current = this._observables$.getValue();
    this._observables$.next([...current, newMeta]);
  }

  private updateObservable(updatedMeta: ObservableMetadata): void {
    const current = this._observables$.getValue();
    const updated = current.map(obs =>
      obs.id === updatedMeta.id ? { ...obs, ...updatedMeta } : obs
    );
    this._observables$.next(updated);
  }

  private updateSubscriptions(): void {
    const all: SubscriptionMetadata[] = [
      ...activeSubscriptions.values(),
      ...archivedSubscriptions.values(),
    ];
    this._subscriptions$.next(all);
  }

  private updateGraph(): void {
    const observables = this._observables$.getValue();
    const subscriptions = this._subscriptions$.getValue();

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Create observable nodes
    for (const meta of observables) {
      // Build label: primary name + context suffix
      const operatorName = meta.operators[meta.operators.length - 1];
      const primaryName = meta.variableName
        || operatorName
        || meta.subjectType
        || meta.creationFn
        || 'observable';
      // Add context suffix if this is a dynamic inner observable
      const contextSuffix = meta.createdByOperator
        ? ` (of ${meta.createdByOperator})`
        : '';
      nodes.push({
        id: meta.id,
        type: 'observable',
        label: `${meta.id} ${primaryName}${contextSuffix}`,
        metadata: meta,
        isActive: true,
        isRoot: !meta.triggeredBySubscription && !meta.lazyRegistered,
      });

      // Add pipe edge to parent
      if (meta.parent) {
        const parent = meta.parent.deref();
        if (parent) {
          const parentMeta = observableMetadata.get(parent);
          if (parentMeta) {
            edges.push({
              id: `pipe-${parentMeta.id}-${meta.id}`,
              type: 'pipe',
              source: parentMeta.id,
              target: meta.id,
              isActive: true,
            });
          }
        }
      }
    }

    // Count subscriptions per observable for "(2/5)" labels
    const subCountByObs = new Map<string, number>();
    for (const sub of subscriptions) {
      const count = subCountByObs.get(sub.observableId) ?? 0;
      subCountByObs.set(sub.observableId, count + 1);
    }

    // Create subscription nodes
    const subIndexByObs = new Map<string, number>();
    for (const meta of subscriptions) {
      const idx = (subIndexByObs.get(meta.observableId) ?? 0) + 1;
      subIndexByObs.set(meta.observableId, idx);
      const total = subCountByObs.get(meta.observableId) ?? 1;

      nodes.push({
        id: meta.id,
        type: 'subscription',
        label: `${meta.id} (${idx}/${total})`,
        metadata: meta,
        isActive: !meta.unsubscribedAt,
        isRoot: false,
      });

      // Add subscribe edge from observable to subscription
      edges.push({
        id: `sub-${meta.observableId}-${meta.id}`,
        type: 'subscribe',
        source: meta.observableId,
        target: meta.id,
        isActive: !meta.unsubscribedAt,
      });

      // Add parent subscription edge
      if (meta.parentSubscriptionId) {
        edges.push({
          id: `trigger-${meta.parentSubscriptionId}-${meta.id}`,
          type: 'trigger',
          source: meta.parentSubscriptionId,
          target: meta.id,
          isActive: !meta.unsubscribedAt,
        });
      }
    }

    this._graph$.next({ nodes, edges });
  }
}
