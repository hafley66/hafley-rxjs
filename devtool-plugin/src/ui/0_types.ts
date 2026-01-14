/**
 * Visualization Types
 *
 * Types specific to the UI layer. These extend/wrap the tracking types
 * for graph rendering and animation.
 */

import type { ObservableMetadata, SubscriptionMetadata, Emission, ErrorEvent } from '../tracking/types';

/**
 * Event types that can occur in the system
 */
export type TrackingEventType = 'next' | 'error' | 'complete' | 'subscribe' | 'unsubscribe';

/**
 * Unified event for the visualization layer
 */
export interface TrackingEvent {
  type: TrackingEventType;
  timestamp: number;
  subscriptionId: string;
  observableId: string;
  value?: unknown; // For 'next' events
  error?: unknown; // For 'error' events
}

/**
 * Node types in the graph
 */
export type GraphNodeType = 'observable' | 'subscription';

/**
 * Graph node - represents either an Observable or Subscription
 */
export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string; // e.g., "obs#2 interval" or "sub#3 (2/5)"

  // D3 force simulation positions
  x?: number;
  y?: number;
  fx?: number | null; // Fixed x position
  fy?: number | null; // Fixed y position

  // Metadata reference
  metadata: ObservableMetadata | SubscriptionMetadata;

  // Visual state
  isActive: boolean; // For subscriptions: not unsubscribed
  isRoot: boolean; // Module-level observable (no triggeredBySubscription)
}

/**
 * Edge types in the graph
 */
export type GraphEdgeType = 'pipe' | 'subscribe' | 'trigger';

/**
 * Graph edge - represents a relationship between nodes
 */
export interface GraphEdge {
  id: string;
  type: GraphEdgeType;
  source: string; // Node ID
  target: string; // Node ID

  // Visual state
  isActive: boolean;
}

/**
 * Complete graph state
 */
export interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Animation state for an event pulse
 */
export interface EventAnimation {
  id: string;
  event: TrackingEvent;
  edgeId: string;
  progress: number; // 0 to 1
  startTime: number;
}

/**
 * Color mapping for event types
 */
export const EVENT_COLORS: Record<TrackingEventType, string> = {
  next: '#22c55e', // green
  complete: '#3b82f6', // blue
  error: '#ef4444', // red
  subscribe: '#eab308', // yellow
  unsubscribe: '#6b7280', // gray
};

/**
 * Re-export tracking types for convenience
 */
export type { ObservableMetadata, SubscriptionMetadata, Emission, ErrorEvent };
