/**
 * TimelineRow - Single operator stage row in the timeline
 *
 * Shows the operator name on the left and a timeline bar with emissions on the right.
 */

import type { PipelineStage, TimelineSubscription, TimelineEmission } from '../1_data/2_timeline';
import { EmissionMarker } from './3_TimelineEmission';

interface TimelineRowProps {
  stage: PipelineStage;
  subscriptions: TimelineSubscription[];
  emissions: TimelineEmission[];
  timeRange: { start: number; end: number };
  pixelsPerMs: number;
  isFirst: boolean;
  isLast: boolean;
}

const ROW_HEIGHT = 28;
const LABEL_WIDTH = 100;

export function TimelineRow({
  stage,
  subscriptions,
  emissions,
  timeRange,
  pixelsPerMs,
  isFirst,
  isLast,
}: TimelineRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: ROW_HEIGHT,
        position: 'relative',
      }}
    >
      {/* Stage label */}
      <div
        style={{
          width: LABEL_WIDTH,
          paddingRight: 8,
          textAlign: 'right',
          color: isFirst ? '#60a5fa' : isLast ? '#a78bfa' : '#9ca3af',
          fontWeight: isFirst || isLast ? 600 : 400,
          fontSize: 11,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={stage.label}
      >
        {stage.label}
      </div>

      {/* Timeline track */}
      <div
        style={{
          flex: 1,
          height: '100%',
          position: 'relative',
          borderLeft: '1px solid #374151',
        }}
      >
        {/* Subscription duration bars */}
        {subscriptions.map(sub => (
          <SubscriptionBar
            key={sub.id}
            subscription={sub}
            timeRange={timeRange}
            pixelsPerMs={pixelsPerMs}
          />
        ))}

        {/* Emission markers */}
        {emissions.map(emission => (
          <EmissionMarker
            key={emission.id}
            emission={emission}
            timeRange={timeRange}
            pixelsPerMs={pixelsPerMs}
          />
        ))}

        {/* Grid line */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 1,
            background: '#1f2937',
            zIndex: 0,
          }}
        />
      </div>
    </div>
  );
}

interface SubscriptionBarProps {
  subscription: TimelineSubscription;
  timeRange: { start: number; end: number };
  pixelsPerMs: number;
}

function SubscriptionBar({
  subscription,
  timeRange,
  pixelsPerMs,
}: SubscriptionBarProps) {
  const startX = (subscription.subscribedAt - timeRange.start) * pixelsPerMs;
  const endTime = subscription.unsubscribedAt || subscription.completedAt || Date.now();
  const width = Math.max((endTime - subscription.subscribedAt) * pixelsPerMs, 2);

  const isActive = !subscription.unsubscribedAt && !subscription.completedAt;
  const isCompleted = !!subscription.completedAt;

  return (
    <div
      style={{
        position: 'absolute',
        left: startX,
        top: '50%',
        transform: 'translateY(-50%)',
        width,
        height: 4,
        background: isActive ? '#22c55e' : isCompleted ? '#3b82f6' : '#6b7280',
        opacity: 0.5,
        borderRadius: 2,
        zIndex: 1,
      }}
      title={`${subscription.id}: ${subscription.subscribedAt}ms - ${endTime}ms`}
    />
  );
}
