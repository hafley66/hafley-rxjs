/**
 * Data Provider Interface
 *
 * Abstracts data access for the visualization layer.
 * Supports two modes:
 * 1. Inline: Direct access to the tracking registry
 * 2. DevTools: Receives serialized events via postMessage
 */

import type { Observable } from 'rxjs';
import type {
  TrackingEvent,
  ObservableMetadata,
  SubscriptionMetadata,
  GraphState,
} from '../0_types';
import type { PipeTreeState } from './pipe-tree';

/**
 * Abstract interface for accessing tracking data.
 * Implementations handle the actual data source (registry vs postMessage).
 */
export interface DataProvider {
  /**
   * Stream of all observable metadata.
   * Emits the full list whenever an observable is added.
   */
  observables$: Observable<ObservableMetadata[]>;

  /**
   * Stream of all subscription metadata (active + archived).
   * Emits the full list whenever subscriptions change.
   */
  subscriptions$: Observable<SubscriptionMetadata[]>;

  /**
   * Stream of tracking events as they occur.
   * Used for animating events in the graph.
   */
  events$: Observable<TrackingEvent>;

  /**
   * Pre-computed graph state for rendering.
   * Combines observables and subscriptions into nodes/edges.
   */
  graph$: Observable<GraphState>;

  /**
   * Pre-computed pipe tree state for rendering.
   * Combines observables and subscriptions, filters by active status.
   */
  pipeTree$: Observable<PipeTreeState>;

  /**
   * Get observable by ID (synchronous snapshot).
   */
  getObservable(id: string): ObservableMetadata | undefined;

  /**
   * Get subscription by ID (synchronous snapshot).
   */
  getSubscription(id: string): SubscriptionMetadata | undefined;

  /**
   * Clean up subscriptions when provider is disposed.
   */
  dispose(): void;
}

/**
 * React context key for the DataProvider.
 */
export const DataProviderContext = Symbol('DataProvider');
