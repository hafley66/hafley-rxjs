# Task 2: Observable Wrapper & Registry

## Objective
Create wrapped Observable class that captures creation context and maintains metadata registry with support for:
- Three "times": Pipe time (observable creation), Subscribe time (subscription tracking), Argument time (cross-observable relationships)
- Bidirectional linking between pipe-time structure and subscribe-time execution
- Argument path tracking for complex operator configs (e.g., `repeat.delay()`)
- Emission tracking for animation/replay in debugger UI

## Files to Create
- `src/tracking/observable-wrapper.ts`
- `src/tracking/registry.ts`
- `src/tracking/types.ts`

## File 1: `src/tracking/types.ts`

Define core types with three-times philosophy:

```typescript
/**
 * PIPE TIME: Observable instance metadata
 * Captured when observables are created via operators or creation functions
 */
export interface ObservableMetadata {
  id: string;                           // Unique identifier "obs#42"
  createdAt: string;                    // ISO timestamp

  // Source location (from stack trace)
  location: {
    filePath: string;
    line: number;
    column: number;
  };
  variableName?: string;                // Extracted from stack

  // Pipe chain structure
  parent?: WeakRef<any>;                // Parent observable in pipe chain
  operators: string[];                  // Operators applied in pipe
  path: string;                         // Tree path like "0.2.1"

  // Dynamic creation context (set at subscribe time when operator events fire)
  // If these are undefined -> created at pipe/module time (static)
  // If these are set -> created at subscribe time (dynamic, like switchMap inner observables)
  createdByOperator?: string;           // Which operator created this
  operatorInstanceId?: string;          // Which operator instance (each map() call gets unique ID)
  triggeredBySubscription?: string;     // Which subscription execution triggered creation
  triggeredByObservable?: string;       // Which observable emitted the event that triggered this
  triggeredByEvent?: 'next' | 'error' | 'complete'; // Which event type triggered creation
}

/**
 * SUBSCRIBE TIME: Subscription instance metadata
 * Captured when .subscribe() is called
 */
export interface SubscriptionMetadata {
  id: string;                           // "sub#42"
  observableId: string;                 // Which observable is subscribed
  subscribedAt: number;                 // Timestamp (ms)
  unsubscribedAt?: number;

  // Subscribe tree structure
  parentSubscriptionId?: string;        // Parent subscription (for nested subscribes)
  childSubscriptionIds: string[];       // Child subscriptions created by this one

  // Link back to pipe-time structure (BIDIRECTIONAL LINKING)
  triggeredByObservableId?: string;     // Which observable caused this subscription
  triggeredByOperator?: string;         // Which operator connects them (e.g., "map")

  // Execution tracking (for animation/replay)
  emissionIds: string[];                // Emissions that flowed through
  errorIds: string[];                   // Errors that occurred
  completed: boolean;                   // Whether completed
  completedAt?: number;
}

/**
 * ARGUMENT TIME: Cross-observable relationships
 * When observables are passed as arguments to operators/combinators
 */
export type ArgumentPath = string;      // Lodash-style: "0.delay.$return", "0[1]", "0.notifier"
                                        // Use .$return sigil for function returns (lodash-compatible)

export interface ArgumentRelationship {
  relationshipId: string;               // Unique ID for this relationship
  operatorName: string;                 // "combineLatest", "repeat", "withLatestFrom"
  operatorInstanceId: string;           // Each operator call gets unique ID
  sourceObservableId: string;           // Observable created by this operator
  arguments: Map<ArgumentPath, string>; // path -> observableId
  createdAt: string;                    // ISO timestamp
}

/**
 * Emission tracking for animation/replay
 */
export interface Emission {
  id: string;                           // "emit#42"
  subscriptionId: string;               // Which subscription emitted this
  observableId: string;                 // Which observable it came from
  value: any;                           // The emitted value
  timestamp: number;                    // When it occurred
  sourceEmissionId?: string;            // What caused this (for operators)
  operatorName?: string;                // Which operator transformed it
}

/**
 * Error tracking
 */
export interface ErrorEvent {
  id: string;
  subscriptionId: string;
  error: any;
  timestamp: number;
}
```

## File 2: `src/tracking/registry.ts`

Implement storage registries with support for all three "times":

```typescript
import {
  ObservableMetadata,
  SubscriptionMetadata,
  ArgumentRelationship,
  Emission,
  ErrorEvent
} from './types';

// === PIPE TIME: Observable tracking ===

export const observableMetadata = new WeakMap<any, ObservableMetadata>();
const observableById = new Map<string, WeakRef<any>>();

let observableCounter = 0;
let operatorInstanceCounter = 0;

export function generateObservableId(): string {
  return `obs#${observableCounter++}`;
}

export function generateOperatorInstanceId(): string {
  return `op#${operatorInstanceCounter++}`;
}

export function registerObservable(obs: any, metadata: ObservableMetadata): void {
  observableMetadata.set(obs, metadata);
  observableById.set(metadata.id, new WeakRef(obs));
}

export function getObservableById(id: string): any | undefined {
  const ref = observableById.get(id);
  return ref?.deref();
}

export function getMetadata(obs: any): ObservableMetadata | undefined {
  return observableMetadata.get(obs);
}

// === SUBSCRIBE TIME: Subscription tracking ===

export const activeSubscriptions = new Map<string, SubscriptionMetadata>();
export const archivedSubscriptions = new Map<string, SubscriptionMetadata>();

let subscriptionCounter = 0;

export function generateSubscriptionId(): string {
  return `sub#${subscriptionCounter++}`;
}

export function registerSubscription(metadata: SubscriptionMetadata): void {
  activeSubscriptions.set(metadata.id, metadata);
}

export function archiveSubscription(subscriptionId: string): void {
  const metadata = activeSubscriptions.get(subscriptionId);
  if (metadata) {
    metadata.unsubscribedAt = Date.now();
    archivedSubscriptions.set(subscriptionId, metadata);
    activeSubscriptions.delete(subscriptionId);
  }
}

// === OPERATOR EXECUTION CONTEXT STACK ===
// Tracks current operator execution context for linking dynamic observables

interface OperatorExecutionContext {
  operatorName: string;
  operatorInstanceId: string;
  subscriptionId: string;
  observableId: string;
  event: 'next' | 'error' | 'complete';
  value?: any;
  timestamp: number;
}

const operatorContextStack: OperatorExecutionContext[] = [];

export const operatorContext = {
  push: (ctx: OperatorExecutionContext) => operatorContextStack.push(ctx),
  pop: () => operatorContextStack.pop(),
  peek: () => operatorContextStack[operatorContextStack.length - 1],
};

// === ARGUMENT TIME: Cross-observable relationships ===

const argumentRelationships = new Map<string, ArgumentRelationship>();
// Index for reverse lookup: observableId -> relationships where it's used
const observableUsedIn = new Map<string, Set<string>>(); // obsId -> Set<relationshipId>

let relationshipCounter = 0;

export function generateRelationshipId(): string {
  return `rel#${relationshipCounter++}`;
}

export function registerArgumentRelationship(rel: ArgumentRelationship): void {
  argumentRelationships.set(rel.relationshipId, rel);

  // Build reverse index
  for (const [path, obsId] of rel.arguments) {
    if (!observableUsedIn.has(obsId)) {
      observableUsedIn.set(obsId, new Set());
    }
    observableUsedIn.get(obsId)!.add(rel.relationshipId);
  }
}

export function getRelationshipsUsingObservable(observableId: string): ArgumentRelationship[] {
  const relIds = observableUsedIn.get(observableId);
  if (!relIds) return [];
  return Array.from(relIds)
    .map(id => argumentRelationships.get(id))
    .filter(Boolean) as ArgumentRelationship[];
}

// === EXECUTION TIME: Emission and error tracking ===

const emissions = new Map<string, Emission>();
const errors = new Map<string, ErrorEvent>();

let emissionCounter = 0;
let errorCounter = 0;

export function generateEmissionId(): string {
  return `emit#${emissionCounter++}`;
}

export function generateErrorId(): string {
  return `err#${errorCounter++}`;
}

export function recordEmission(emission: Emission): void {
  emissions.set(emission.id, emission);

  // Add to subscription's emission list
  const sub = activeSubscriptions.get(emission.subscriptionId);
  if (sub) {
    sub.emissionIds.push(emission.id);
  }
}

export function recordError(error: ErrorEvent): void {
  errors.set(error.id, error);

  const sub = activeSubscriptions.get(error.subscriptionId);
  if (sub) {
    sub.errorIds.push(error.id);
  }
}

export function getEmission(id: string): Emission | undefined {
  return emissions.get(id);
}

export function getError(id: string): ErrorEvent | undefined {
  return errors.get(id);
}

// === Helper: Get all subscriptions for an observable ===

export function getActiveSubscriptionsForObservable(
  observableId: string
): SubscriptionMetadata[] {
  const result: SubscriptionMetadata[] = [];
  for (const metadata of activeSubscriptions.values()) {
    if (metadata.observableId === observableId) {
      result.push(metadata);
    }
  }
  return result;
}

// === Cleanup ===

export function clearArchivedSubscriptions(): void {
  archivedSubscriptions.clear();
}

export function clearEmissions(): void {
  emissions.clear();
}
```

## File 3: `src/tracking/observable-wrapper.ts`

Main wrapper implementation with context stack checking:

```typescript
import { Observable as RxJSObservable } from 'rxjs';
import { getCallerInfo } from './stack-parser';
import {
  generateObservableId,
  registerObservable,
  operatorContext  // Global context stack
} from './registry';
import { ObservableMetadata } from './types';

export class Observable<T> extends RxJSObservable<T> {
  constructor(
    subscribe?: (subscriber: any) => any
  ) {
    super(subscribe);

    // Capture static creation context from stack trace
    const callerInfo = getCallerInfo();

    // Check for dynamic runtime context (operator execution)
    const ctx = operatorContext.peek();  // Returns undefined if stack is empty

    const metadata: ObservableMetadata = {
      id: generateObservableId(),
      createdAt: new Date().toISOString(),
      location: {
        filePath: callerInfo?.filePath || 'unknown',
        line: callerInfo?.line || 0,
        column: callerInfo?.column || 0,
      },
      variableName: callerInfo?.context,
      operators: [],
      path: '', // Will be set by pipe if needed

      // Dynamic context (only set if created during operator execution)
      // If undefined -> pure pipe/module time creation
      // If set -> dynamic subscribe-time creation (like switchMap inner observable)
      createdByOperator: ctx?.operatorName,
      operatorInstanceId: ctx?.operatorInstanceId,
      triggeredBySubscription: ctx?.subscriptionId,
      triggeredByObservable: ctx?.observableId,
      triggeredByEvent: ctx?.event,
    };

    registerObservable(this, metadata);
  }
}

// Re-export everything else from rxjs
// This makes our wrapper a drop-in replacement
export * from 'rxjs';
```

## Key Design Principles

### 1. Three "Times" Philosophy
- **Pipe Time**: Observable creation via operators/constructors (static structure)
- **Subscribe Time**: Subscription creation when .subscribe() is called (execution tree)
- **Argument Time**: Observables passed as operator arguments (cross-observable relationships)

### 2. Context Stack Pattern
- Global `operatorContext` stack tracks operator execution
- Pushed when operator event fires (next/error/complete)
- Contains: operator ID, subscription ID, observable ID, event type
- Any observable created while context is active gets automatically linked
- Empty stack = pipe/module time, Non-empty = subscribe/execution time

### 3. Argument Path Convention
Use lodash-style paths with `.$return` sigil for function returns:
- `"0"` - Direct parameter
- `"0.delay"` - Object property
- `"0.delay.$return"` - Function return value (use `.$return` not `()`)
- `"0[1]"` - Array element
- `"0.notifier.$return"` - Works with lodash get/set

### 4. Bidirectional Linking
- **Forward**: Observable → parent observable (via pipe chain)
- **Backward**: Subscription → triggering observable + operator (via context)
- **Lateral**: Observable → argument observables (via ArgumentRelationship)

## Setup Instructions

In `vite.config.ts` (or similar):
```typescript
export default {
  resolve: {
    alias: {
      // In dev mode, use our wrapper
      'rxjs': path.resolve(__dirname, 'src/tracking/observable-wrapper.ts')
    }
  }
}
```

## Requirements

### Observable Wrapper
- Extends RxJSObservable with same constructor signature
- Calls super() first to maintain proper Observable behavior
- Uses stack-parser to get static creation location (file/line/column)
- Checks `operatorContext` stack for dynamic runtime context
- Generates unique ID for each instance
- Stores metadata in WeakMap immediately
- Zero behavioral changes to Observable functionality
- If context stack is empty: pipe-time creation (static)
- If context stack has entries: subscribe-time creation (dynamic)

### Registry
- Use WeakMap for observable metadata (prevents leaks)
- Use Map with WeakRef for id lookup (allows GC but keeps id valid)
- Provide helper functions for registration/lookup
- Keep counters for unique IDs (observables, subscriptions, emissions, errors, relationships, operator instances)
- Support argument relationship tracking with reverse index
- Track emissions and errors for animation/replay

### Memory Safety
- Observables can be garbage collected normally
- WeakMap entries auto-cleanup
- WeakRef in id map allows GC
- Active subscriptions have strong refs (intentional)
- Archived subscriptions could have TTL cleanup

## Testing

Create `src/tracking/__tests__/observable-wrapper.test.ts`:

Test cases:
1. Observable creation registers metadata
2. Metadata includes location info
3. Same I/O as regular Observable
4. Multiple observables get unique IDs
5. Can retrieve metadata by id
6. WeakMap allows GC (mock/spy on WeakMap if needed)

## Edge Cases
- Stack parser returns null → use fallback values
- Observable created in node_modules → handle gracefully
- Subclass of Observable → should still capture correctly

## Validation

### Test 1: Pipe-time creation (no context)
```typescript
import { Observable } from './tracking/observable-wrapper';
import { getMetadata } from './tracking/registry';

const test$ = new Observable(sub => {
  sub.next(1);
  sub.complete();
});

const meta = getMetadata(test$);
console.log(meta);
// Should show: id, location, createdAt
// triggeredBySubscription should be undefined (pipe-time creation)
```

### Test 2: Subscribe-time creation (with context)
```typescript
import { operatorContext } from './registry';

// Simulate operator execution context
operatorContext.push({
  operatorName: 'switchMap',
  operatorInstanceId: 'op#1',
  subscriptionId: 'sub#5',
  observableId: 'obs#3',
  event: 'next',
  timestamp: Date.now()
});

const inner$ = new Observable(sub => sub.next(42));

operatorContext.pop();

const meta = getMetadata(inner$);
console.log(meta);
// Should show: createdByOperator='switchMap', operatorInstanceId='op#1',
//              triggeredBySubscription='sub#5', triggeredByEvent='next'
```

### Test 3: Argument path with .$return sigil
```typescript
const path = "0.delay.$return";  // Function return in first parameter's delay property
// Should work with lodash get/set utilities
```

## Dependencies
- Requires Task 1 (stack-parser) to be completed
- rxjs (peer dependency)

## Deliverables
- All three files with implementations
- Test file
- Inline comments explaining key decisions
- Type exports
