/**
 * EmissionMarker - Visual marker for an emission on the timeline
 *
 * Shows as a colored circle with tooltip showing the value.
 */

import { useState } from 'react';
import type { TimelineEmission } from '../1_data/2_timeline';

interface EmissionMarkerProps {
  emission: TimelineEmission;
  timeRange: { start: number; end: number };
  pixelsPerMs: number;
}

const MARKER_SIZE = 10;

const TYPE_COLORS = {
  next: '#22c55e',     // green
  error: '#ef4444',    // red
  complete: '#3b82f6', // blue
};

export function EmissionMarker({
  emission,
  timeRange,
  pixelsPerMs,
}: EmissionMarkerProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const x = (emission.timestamp - timeRange.start) * pixelsPerMs;
  const color = TYPE_COLORS[emission.type];

  // Format value for display
  const valueStr = formatValue(emission.value);

  return (
    <div
      style={{
        position: 'absolute',
        left: x - MARKER_SIZE / 2,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 10,
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Marker circle */}
      <div
        style={{
          width: MARKER_SIZE,
          height: MARKER_SIZE,
          borderRadius: '50%',
          background: color,
          border: '2px solid #0f172a',
          cursor: 'pointer',
        }}
      />

      {/* Tooltip */}
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 4,
            padding: '4px 8px',
            background: '#0f172a',
            border: '1px solid #374151',
            borderRadius: 4,
            fontSize: 10,
            whiteSpace: 'pre',
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            zIndex: 100,
          }}
        >
          <div style={{ color: '#9ca3af', marginBottom: 2 }}>
            {emission.type} @ {emission.timestamp - timeRange.start}ms
          </div>
          <div style={{ color: '#e2e8f0' }}>{valueStr}</div>
        </div>
      )}
    </div>
  );
}

function formatValue(value: any): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';

  try {
    const str = JSON.stringify(value, null, 2);
    // Truncate long values
    if (str.length > 100) {
      return str.slice(0, 100) + '...';
    }
    return str;
  } catch {
    return String(value);
  }
}
