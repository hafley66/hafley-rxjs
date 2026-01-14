/**
 * Timeline - Main container for pipeline timeline visualization
 *
 * Shows pipelines as vertical stacks of operator stages with time flowing left-to-right.
 * Emissions appear as markers on each stage row.
 */

import type { TimelineState, Pipeline, TimelineSubscription } from '../1_data/2_timeline';
import { TimelineRow } from './2_TimelineRow';
import { TimelineScale } from './4_TimelineScale';

interface TimelineProps {
  state: TimelineState;
  pixelsPerMs?: number;
}

/** Default scale: 100 pixels per second */
const DEFAULT_PIXELS_PER_MS = 0.1;

export function Timeline({ state, pixelsPerMs = DEFAULT_PIXELS_PER_MS }: TimelineProps) {
  const { pipelines, subscriptions, timeRange } = state;

  if (pipelines.length === 0) {
    return (
      <div style={{ color: '#6b7280', padding: 16 }}>
        No pipelines with subscriptions yet.
      </div>
    );
  }

  // Group subscriptions by pipeline
  const subsByPipeline = new Map<string, TimelineSubscription[]>();
  for (const sub of subscriptions) {
    const subs = subsByPipeline.get(sub.pipelineId) || [];
    subs.push(sub);
    subsByPipeline.set(sub.pipelineId, subs);
  }

  // Calculate timeline width
  const duration = timeRange.end - timeRange.start;
  const timelineWidth = Math.max(duration * pixelsPerMs, 400);

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
      {pipelines.map(pipeline => {
        const pipelineSubs = subsByPipeline.get(pipeline.id) || [];
        if (pipelineSubs.length === 0) return null;

        return (
          <PipelineTimeline
            key={pipeline.id}
            pipeline={pipeline}
            subscriptions={pipelineSubs}
            timeRange={timeRange}
            pixelsPerMs={pixelsPerMs}
            timelineWidth={timelineWidth}
          />
        );
      })}
    </div>
  );
}

interface PipelineTimelineProps {
  pipeline: Pipeline;
  subscriptions: TimelineSubscription[];
  timeRange: { start: number; end: number };
  pixelsPerMs: number;
  timelineWidth: number;
}

function PipelineTimeline({
  pipeline,
  subscriptions,
  timeRange,
  pixelsPerMs,
  timelineWidth,
}: PipelineTimelineProps) {
  const { stages, name } = pipeline;

  // Collect all emissions for this pipeline
  const allEmissions = subscriptions.flatMap(sub => sub.emissions);

  return (
    <div style={{ marginBottom: 24, background: '#1e293b', borderRadius: 8, padding: 12 }}>
      {/* Pipeline header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
        paddingBottom: 8,
        borderBottom: '1px solid #374151',
      }}>
        <span style={{ color: '#60a5fa', fontWeight: 600 }}>{name}</span>
        <span style={{ color: '#6b7280', fontSize: 10 }}>
          ({stages.length} stages, {subscriptions.length} subs)
        </span>
      </div>

      {/* Time scale */}
      <div style={{ marginLeft: 100, marginBottom: 4 }}>
        <TimelineScale
          timeRange={timeRange}
          pixelsPerMs={pixelsPerMs}
          width={timelineWidth}
        />
      </div>

      {/* Stage rows */}
      <div style={{ position: 'relative' }}>
        {stages.map((stage, index) => (
          <TimelineRow
            key={`${stage.observableId}-${index}`}
            stage={stage}
            subscriptions={subscriptions}
            emissions={allEmissions.filter(e => e.stageIndex === index)}
            timeRange={timeRange}
            pixelsPerMs={pixelsPerMs}
            isFirst={index === 0}
            isLast={index === stages.length - 1}
          />
        ))}

        {/* Vertical flow lines connecting emissions */}
        <FlowLines
          emissions={allEmissions}
          stageCount={stages.length}
          timeRange={timeRange}
          pixelsPerMs={pixelsPerMs}
        />
      </div>
    </div>
  );
}

interface FlowLinesProps {
  emissions: Array<{ id: string; timestamp: number; stageIndex: number }>;
  stageCount: number;
  timeRange: { start: number; end: number };
  pixelsPerMs: number;
}

function FlowLines({ emissions, stageCount, timeRange, pixelsPerMs }: FlowLinesProps) {
  if (stageCount <= 1) return null;

  // Group emissions by base ID (entry and exit share base ID)
  const emissionsByBase = new Map<string, number[]>();
  for (const e of emissions) {
    const baseId = e.id.replace(/-exit$/, '');
    const stages = emissionsByBase.get(baseId) || [];
    stages.push(e.stageIndex);
    emissionsByBase.set(baseId, stages);
  }

  // Find emissions that have both entry and exit
  const flowEmissions = Array.from(emissionsByBase.entries())
    .filter(([_, stages]) => stages.length > 1)
    .map(([baseId]) => {
      const entry = emissions.find(e => e.id === baseId);
      return entry;
    })
    .filter(Boolean);

  const ROW_HEIGHT = 28;
  const LABEL_WIDTH = 100;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: LABEL_WIDTH,
        width: '100%',
        height: stageCount * ROW_HEIGHT,
        pointerEvents: 'none',
      }}
    >
      {flowEmissions.map(e => {
        if (!e) return null;
        const x = (e.timestamp - timeRange.start) * pixelsPerMs;
        const y1 = 14; // First row center
        const y2 = (stageCount - 1) * ROW_HEIGHT + 14; // Last row center

        return (
          <line
            key={e.id}
            x1={x}
            y1={y1}
            x2={x}
            y2={y2}
            stroke="#374151"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        );
      })}
    </svg>
  );
}
