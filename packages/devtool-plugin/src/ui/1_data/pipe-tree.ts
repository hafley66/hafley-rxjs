/**
 * Pipe Tree Transforms
 *
 * Pure FRP transforms for building the pipe tree visualization.
 * All transforms are RxJS operators - React just renders the output.
 */

import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import type { ObservableMetadata, SubscriptionMetadata } from '../../tracking/types';

// ============ Types ============

export interface PipeNode {
  observable: ObservableMetadata;
  children: PipeNode[];
}

export interface PipeTreeState {
  roots: PipeNode[];
  activeCount: number;
  totalCount: number;
}

// ============ UI State (BehaviorSubjects) ============

/** Toggle for showing only active subscriptions */
export const activeOnly$ = new BehaviorSubject<boolean>(true);

// ============ Pure Transform Functions ============

/**
 * Compute the "active tree" - all observables that are part of an active subscription chain.
 * Includes observables with direct subscriptions AND their ancestors.
 */
export function computeActiveTreeIds(
  observables: ObservableMetadata[],
  subscriptions: SubscriptionMetadata[]
): Set<string> {
  // Build lookup map
  const byId = new Map<string, ObservableMetadata>();
  for (const obs of observables) {
    byId.set(obs.id, obs);
  }

  // Get directly active observable IDs
  const directlyActiveIds = new Set(
    subscriptions
      .filter(sub => !sub.unsubscribedAt)
      .map(sub => sub.observableId)
  );

  // Expand to include all ancestors
  const activeTree = new Set<string>();
  for (const obsId of directlyActiveIds) {
    let current = byId.get(obsId);
    while (current && !activeTree.has(current.id)) {
      activeTree.add(current.id);
      // Walk up via parentId (pipe chain) or triggeredByObservable (dynamic)
      const parentId = current.parentId || current.triggeredByObservable;
      current = parentId ? byId.get(parentId) : undefined;
    }
  }

  return activeTree;
}

/**
 * Build tree structure from flat observable list.
 *
 * Strategy:
 * 1. Roots: observables with no parent, no triggeredBy*, and not internal
 * 2. Pipe children: observables with `parentId` (from .pipe())
 * 3. Dynamic children: observables with `triggeredByObservable` (from switchMap, etc.)
 * 4. Phantom parents: create nodes for GC'd parents using stored parentInfo
 */
export function buildPipeTree(
  observables: ObservableMetadata[],
  activeTreeIds?: Set<string>
): PipeNode[] {
  // Build lookup map by ID
  const byId = new Map<string, ObservableMetadata>();
  for (const obs of observables) {
    byId.set(obs.id, obs);
  }

  // Create phantom nodes for GC'd parents using parentInfo
  const phantomIds = new Set<string>();
  for (const obs of observables) {
    if (obs.parentInfo && !byId.has(obs.parentInfo.id)) {
      // Parent was GC'd but we have its info - create phantom metadata
      const phantom: ObservableMetadata = {
        id: obs.parentInfo.id,
        createdAt: 0, // Unknown
        variableName: obs.parentInfo.variableName,
        creationFn: obs.parentInfo.creationFn,
        subjectType: obs.parentInfo.subjectType as ObservableMetadata['subjectType'],
        operators: obs.parentInfo.operators || [],
        path: '',
      };
      byId.set(phantom.id, phantom);
      phantomIds.add(phantom.id);
    }
  }

  // Build children map
  const childrenByParentId = new Map<string, ObservableMetadata[]>();
  const roots: ObservableMetadata[] = [];

  // Add phantom nodes as roots (they have no parent themselves)
  // Include phantom if any child references it in the active tree
  for (const phantomId of phantomIds) {
    const phantom = byId.get(phantomId)!;
    if (!activeTreeIds) {
      roots.push(phantom);
    } else {
      // Check if any observable in active tree has this phantom as parent
      const hasActiveChild = observables.some(
        obs => activeTreeIds.has(obs.id) && obs.parentId === phantomId
      );
      if (hasActiveChild) {
        roots.push(phantom);
      }
    }
  }

  // Categorize each observable
  for (const obs of observables) {
    // Skip internal subjects (from share/shareReplay)
    if (obs.isInternalSubject) continue;

    // Skip lazy-registered internal observables with no useful metadata
    // These are internal RxJS mechanism observables (e.g., shareReplay internals)
    // that get registered at subscribe time but aren't user-created
    if (obs.lazyRegistered &&
        !obs.variableName &&      // No user-assigned name
        !obs.subjectType &&       // Not a Subject
        !obs.creationFn &&        // Didn't go through our wrapped creators
        !obs.createdByOperator && // Not from switchMap/mergeMap project fn
        !obs.parentId &&          // Not from .pipe()
        (obs.operators?.length || 0) === 0) { // No operators applied
      continue;
    }

    // If filtering to active tree, skip observables not in it
    if (activeTreeIds && !activeTreeIds.has(obs.id)) {
      continue;
    }

    const hasParent = obs.parentId !== undefined && obs.parentId !== 'unknown';
    const hasDynamicParent = obs.triggeredByObservable !== undefined;

    // Check if parent actually exists (might have been GC'd)
    const parentExists = hasParent && byId.has(obs.parentId!);
    const dynamicParentExists = hasDynamicParent && byId.has(obs.triggeredByObservable!);

    if ((!hasParent && !hasDynamicParent) || (hasParent && !parentExists && !dynamicParentExists)) {
      // Root: no parent, or parent not tracked (unknown), or parent truly GC'd without parentInfo
      roots.push(obs);
    } else if (dynamicParentExists && obs.triggeredByObservable) {
      const parentId = obs.triggeredByObservable;
      const children = childrenByParentId.get(parentId) || [];
      children.push(obs);
      childrenByParentId.set(parentId, children);
    } else if (parentExists && obs.parentId) {
      const children = childrenByParentId.get(obs.parentId) || [];
      children.push(obs);
      childrenByParentId.set(obs.parentId, children);
    }
  }

  // Build tree nodes recursively
  function buildNode(obs: ObservableMetadata, visited: Set<string>): PipeNode {
    visited.add(obs.id);
    const children: PipeNode[] = [];

    const childObs = childrenByParentId.get(obs.id) || [];
    for (const child of childObs) {
      if (!visited.has(child.id)) {
        children.push(buildNode(child, visited));
      }
    }

    return { observable: obs, children };
  }

  const visited = new Set<string>();
  return roots.map(root => buildNode(root, visited));
}

// ============ Derived Streams ============

/**
 * Create the pipe tree stream from raw data streams.
 * This is the main entry point - combines all transforms.
 */
export function createPipeTree$(
  observables$: Observable<ObservableMetadata[]>,
  subscriptions$: Observable<SubscriptionMetadata[]>
): Observable<PipeTreeState> {
  return combineLatest([observables$, subscriptions$, activeOnly$]).pipe(
    map(([observables, subscriptions, activeOnly]) => {
      const activeTreeIds = activeOnly
        ? computeActiveTreeIds(observables, subscriptions)
        : undefined;

      const roots = buildPipeTree(observables, activeTreeIds);

      return {
        roots,
        activeCount: activeTreeIds?.size ?? observables.length,
        totalCount: observables.length,
      };
    }),
    // Only emit when tree actually changes (shallow compare roots array)
    distinctUntilChanged((a, b) =>
      a.roots === b.roots &&
      a.activeCount === b.activeCount &&
      a.totalCount === b.totalCount
    )
  );
}
