/**
 * RxJS Debugger UI
 *
 * React-based visualization for RxJS observable tracking.
 */

// Mount functions
export { mount, mountFloating } from './5_mount';
export type { MountOptions, MountResult } from './5_mount';

// Components (for custom integration)
export { App } from './4_App';
export { PipeTree } from './3_components/PipeTree';

// Data providers
export type { DataProvider } from './1_data/provider';
export { InlineProvider } from './1_data/inline';

// Hooks
export { use$, use$Optional } from './2_hooks/use$';

// Types
export type {
  TrackingEvent,
  TrackingEventType,
  GraphNode,
  GraphNodeType,
  GraphEdge,
  GraphEdgeType,
  GraphState,
  EventAnimation,
} from './0_types';
export { EVENT_COLORS } from './0_types';
