/**
 * Timeline Data Transforms
 *
 * Pure FRP transforms for building the pipeline timeline visualization.
 * Shows emissions flowing through operator stages in a waterfall/network-tab style.
 */

import { Observable, combineLatest, BehaviorSubject } from 'rxjs';
import { map, scan, startWith } from 'rxjs/operators';
import type { ObservableMetadata, SubscriptionMetadata, TrackingEvent } from '../0_types';

// ============ Types ============

/** A single stage in a pipeline (one operator or source) */
export interface PipelineStage {
  observableId: string;
  operatorName: string | null;  // null for source
  operatorIndex: number;        // 0 = source
  label: string;                // Display name
}

/** A complete pipeline from source to final output */
export interface Pipeline {
  id: string;                   // Final observable ID
  name: string;                 // Variable name or fallback
  stages: PipelineStage[];      // Source -> op1 -> op2 -> output
}

/** Emission positioned in timeline */
export interface TimelineEmission {
  id: string;
  timestamp: number;
  value: any;
  stageIndex: number;           // Which row (0=source, N=output)
  type: 'next' | 'error' | 'complete';
}

/** Subscription with timeline data */
export interface TimelineSubscription {
  id: string;
  pipelineId: string;
  subscribedAt: number;
  unsubscribedAt?: number;
  completedAt?: number;
  emissions: TimelineEmission[];
}

/** Complete timeline state */
export interface TimelineState {
  pipelines: Pipeline[];
  subscriptions: TimelineSubscription[];
  timeRange: { start: number; end: number };
}

// ============ Pipeline Building ============

/**
 * Build pipeline stages by walking parentId chain from final observable to source.
 * Returns stages in order: [source, op1, op2, ..., output]
 */
function buildPipelineStages(
  observablesById: Map<string, ObservableMetadata>,
  finalObsId: string
): PipelineStage[] {
  const stages: PipelineStage[] = [];
  let current = observablesById.get(finalObsId);

  if (!current) return stages;

  // Walk up the parent chain, collecting observables
  const chain: ObservableMetadata[] = [];
  while (current) {
    chain.unshift(current); // Add to front (we're walking backwards)
    if (current.parentId) {
      current = observablesById.get(current.parentId);
    } else {
      break;
    }
  }

  // Convert to stages
  for (let i = 0; i < chain.length; i++) {
    const obs = chain[i]!;
    const isSource = i === 0;

    // For source: use creationFn, subjectType, or variableName
    // For piped: use the last operator in the chain (the one this obs added)
    let operatorName: string | null = null;
    let label: string;

    if (isSource) {
      label = obs.variableName || obs.subjectType || obs.creationFn || obs.id;
    } else {
      // Get the operator this observable added (last in its operators array)
      const prevOps = chain[i - 1]?.operators || [];
      const currentOps = obs.operators || [];

      // The new operator is the one in currentOps that's not in prevOps
      if (currentOps.length > prevOps.length) {
        operatorName = currentOps[currentOps.length - 1] || null;
      }

      label = obs.variableName || operatorName || obs.id;
    }

    stages.push({
      observableId: obs.id,
      operatorName: isSource ? null : operatorName,
      operatorIndex: i,
      label,
    });
  }

  return stages;
}

/**
 * Build all pipelines from observable metadata.
 * A pipeline is built from each "leaf" observable (one with subscriptions or a variableName).
 */
function buildPipelines(
  observables: ObservableMetadata[],
  subscriptions: SubscriptionMetadata[]
): Pipeline[] {
  const observablesById = new Map<string, ObservableMetadata>();
  for (const obs of observables) {
    observablesById.set(obs.id, obs);
  }

  // Find leaf observables (those with subscriptions or named variables)
  const subscribedObsIds = new Set(subscriptions.map(s => s.observableId));
  const leafObservables = observables.filter(obs =>
    subscribedObsIds.has(obs.id) || obs.variableName
  );

  // Build pipeline for each leaf
  const pipelines: Pipeline[] = [];
  const seenPipelineIds = new Set<string>();

  for (const leaf of leafObservables) {
    // Skip if we've already built a pipeline ending here
    if (seenPipelineIds.has(leaf.id)) continue;

    const stages = buildPipelineStages(observablesById, leaf.id);
    if (stages.length === 0) continue;

    seenPipelineIds.add(leaf.id);

    pipelines.push({
      id: leaf.id,
      name: leaf.variableName || stages[stages.length - 1]?.label || leaf.id,
      stages,
    });
  }

  return pipelines;
}

// ============ Emission Mapping ============

/**
 * Map emissions to timeline positions.
 * Phase 1: Show at entry (source, index 0) and exit (final stage, last index).
 */
function mapEmissionsToTimeline(
  emissions: Array<{ id: string; timestamp: number; value: any; type: 'next' | 'error' | 'complete' }>,
  stageCount: number
): TimelineEmission[] {
  const result: TimelineEmission[] = [];

  for (const emission of emissions) {
    // Show at source (entry point)
    result.push({
      ...emission,
      stageIndex: 0,
    });

    // Show at output (exit point) - only if we have multiple stages
    if (stageCount > 1) {
      result.push({
        ...emission,
        id: `${emission.id}-exit`,
        stageIndex: stageCount - 1,
      });
    }
  }

  return result;
}

// ============ Main Stream ============

/** Accumulated emissions by subscription ID */
interface EmissionAccumulator {
  bySubscription: Map<string, Array<{ id: string; timestamp: number; value: any; type: 'next' | 'error' | 'complete' }>>;
}

/**
 * Create the timeline stream from raw data streams.
 */
export function createTimeline$(
  observables$: Observable<ObservableMetadata[]>,
  subscriptions$: Observable<SubscriptionMetadata[]>,
  events$: Observable<TrackingEvent>
): Observable<TimelineState> {
  // Accumulate emissions from events stream
  const emissions$ = events$.pipe(
    scan((acc: EmissionAccumulator, event: TrackingEvent) => {
      if (event.type === 'next' || event.type === 'error' || event.type === 'complete') {
        const subEmissions = acc.bySubscription.get(event.subscriptionId) || [];
        subEmissions.push({
          id: `emit-${event.subscriptionId}-${subEmissions.length}`,
          timestamp: event.timestamp,
          value: event.value,
          type: event.type,
        });
        acc.bySubscription.set(event.subscriptionId, subEmissions);
      }
      return acc;
    }, { bySubscription: new Map() }),
    startWith({ bySubscription: new Map() } as EmissionAccumulator)
  );

  return combineLatest([observables$, subscriptions$, emissions$]).pipe(
    map(([observables, subscriptions, emissionAcc]) => {
      // Build pipelines
      const pipelines = buildPipelines(observables, subscriptions);

      // Create pipeline lookup
      const pipelineByObsId = new Map<string, Pipeline>();
      for (const pipeline of pipelines) {
        pipelineByObsId.set(pipeline.id, pipeline);
      }

      // Build timeline subscriptions
      const timelineSubscriptions: TimelineSubscription[] = [];
      let minTime = Infinity;
      let maxTime = 0;

      for (const sub of subscriptions) {
        const pipeline = pipelineByObsId.get(sub.observableId);
        if (!pipeline) continue;

        const stageCount = pipeline.stages.length;
        const rawEmissions = emissionAcc.bySubscription.get(sub.id) || [];
        const emissions = mapEmissionsToTimeline(rawEmissions, stageCount);

        timelineSubscriptions.push({
          id: sub.id,
          pipelineId: pipeline.id,
          subscribedAt: sub.subscribedAt,
          unsubscribedAt: sub.unsubscribedAt,
          completedAt: sub.completedAt,
          emissions,
        });

        // Update time range
        minTime = Math.min(minTime, sub.subscribedAt);
        maxTime = Math.max(maxTime, sub.unsubscribedAt || Date.now());
        for (const e of emissions) {
          maxTime = Math.max(maxTime, e.timestamp);
        }
      }

      // Default time range if no data
      if (minTime === Infinity) minTime = Date.now();
      if (maxTime === 0) maxTime = minTime + 1000;

      return {
        pipelines,
        subscriptions: timelineSubscriptions,
        timeRange: { start: minTime, end: maxTime },
      };
    })
  );
}

// ============ UI State ============

/** Selected pipeline for detailed view */
export const selectedPipelineId$ = new BehaviorSubject<string | null>(null);

/** Pixels per millisecond for timeline scale */
export const timelineScale$ = new BehaviorSubject<number>(0.1); // 100px per second
