/**
 * TimelineScale - Time ruler for the timeline
 *
 * Shows tick marks and labels at appropriate intervals.
 */

interface TimelineScaleProps {
  timeRange: { start: number; end: number };
  pixelsPerMs: number;
  width: number;
}

export function TimelineScale({ timeRange, pixelsPerMs, width }: TimelineScaleProps) {
  const duration = timeRange.end - timeRange.start;

  // Calculate tick interval based on scale
  // At 0.1px/ms (100px/sec), show ticks every 500ms
  // Adjust based on zoom level
  const tickInterval = getTickInterval(duration, width);
  const ticks = generateTicks(timeRange.start, timeRange.end, tickInterval);

  return (
    <div
      style={{
        position: 'relative',
        height: 20,
        borderBottom: '1px solid #374151',
      }}
    >
      {ticks.map(tick => {
        const x = (tick - timeRange.start) * pixelsPerMs;
        const isMajor = tick % (tickInterval * 2) === 0;

        return (
          <div
            key={tick}
            style={{
              position: 'absolute',
              left: x,
              bottom: 0,
            }}
          >
            {/* Tick mark */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: 1,
                height: isMajor ? 8 : 4,
                background: '#4b5563',
              }}
            />

            {/* Label (only on major ticks) */}
            {isMajor && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 10,
                  left: 2,
                  fontSize: 9,
                  color: '#6b7280',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatTime(tick - timeRange.start)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function getTickInterval(duration: number, _width: number): number {
  // Target roughly 10-20 ticks visible
  // TODO: use width to calculate optimal tick count based on viewport
  const targetTicks = 15;
  const rawInterval = duration / targetTicks;

  // Round to nice values
  const niceIntervals = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  for (const interval of niceIntervals) {
    if (rawInterval <= interval) return interval;
  }
  return 10000;
}

function generateTicks(start: number, end: number, interval: number): number[] {
  const ticks: number[] = [];
  const firstTick = Math.ceil(start / interval) * interval;

  for (let t = firstTick; t <= end; t += interval) {
    ticks.push(t);
  }

  return ticks;
}

function formatTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${(ms / 60000).toFixed(1)}m`;
}
