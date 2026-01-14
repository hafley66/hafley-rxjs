# Task 3: Pipe Method Patching

## Objective
Monkey-patch `Observable.prototype.pipe` to:
- Capture operator chains and build parent-child relationships
- Track operator instances (each `map()` call gets unique ID)
- Crawl operator arguments for observables (e.g., `withLatestFrom(other$)`, `repeat({ delay: () => timer() })`)
- Register ArgumentRelationships for cross-observable tracking
- Support lodash-style argument paths for complex configs

## File to Create
`src/tracking/pipe-patch.ts`

## Requirements

### Core Functionality
When `observable.pipe(op1, op2, op3)` is called:
1. Call original pipe (preserve behavior)
2. Extract operator names from op1, op2, op3
3. Create metadata for result observable
4. Link result to source via WeakRef parent
5. Generate hierarchical path
6. Store operators list

### Path Generation Strategy
- Root observable (no parent): path = ""
- First pipe: path = "0" (0 operators in this pipe)
- Nested pipe: path = `${parent.path}.${operatorCount}`
- Example: `source$.pipe(map, filter).pipe(take)` → paths: "", "2", "2.1"

This gives us tree structure where path tells us depth and sibling position.

## Implementation

```typescript
import { Observable } from 'rxjs';
import { 
  getMetadata, 
  observableMetadata, 
  registerObservable,
  generateObservableId 
} from './registry';
import { ObservableMetadata } from './types';

// Store original before patching
const originalPipe = Observable.prototype.pipe;

// Track if we've already patched (prevent double-patching)
let isPatched = false;

export function patchPipe(): void {
  if (isPatched) {
    console.warn('pipe() already patched');
    return;
  }
  
  Observable.prototype.pipe = function(this: Observable<any>, ...operators: any[]) {
    // Call original pipe to get result
    const result = originalPipe.apply(this, operators);
    
    // Get metadata for source (this)
    const sourceMetadata = getMetadata(this);
    
    // Extract operator names
    const operatorNames = operators.map(op => getOperatorName(op));
    
    // Generate path
    const path = generatePath(sourceMetadata, operators.length);
    
    // Create metadata for result
    const resultMetadata: ObservableMetadata = {
      id: generateObservableId(),
      createdAt: new Date().toISOString(),
      location: sourceMetadata?.location || {
        filePath: 'unknown',
        line: 0,
        column: 0,
      },
      parent: sourceMetadata ? new WeakRef(this) : undefined,
      operators: operatorNames,
      path,
    };
    
    // Register result
    registerObservable(result, resultMetadata);
    
    return result;
  };
  
  isPatched = true;
}

// Helper: Extract operator name
function getOperatorName(operator: any): string {
  // Priority order for naming:
  // 1. Explicit displayName property (user-annotated)
  if (operator.displayName && typeof operator.displayName === 'string') {
    return operator.displayName;
  }
  
  // 2. Function name
  if (operator.name && operator.name !== 'anonymous') {
    return operator.name;
  }
  
  // 3. Try to extract from toString() for arrow functions
  const str = operator.toString();
  const match = str.match(/^(?:function\s+)?(\w+)/);
  if (match && match[1] !== 'function') {
    return match[1];
  }
  
  // 4. Check if it's a known RxJS operator by reference
  const knownName = getKnownOperatorName(operator);
  if (knownName) {
    return knownName;
  }
  
  // 5. Fallback
  return 'operator';
}

// Helper: Check against known RxJS operators
// This is optional but helpful for built-ins
function getKnownOperatorName(operator: any): string | null {
  // TODO: Build a map of known RxJS operators
  // For now, return null
  // Could import from rxjs/operators and build WeakMap at init time
  return null;
}

// Helper: Generate hierarchical path
function generatePath(
  parentMetadata: ObservableMetadata | undefined, 
  operatorCount: number
): string {
  if (!parentMetadata || !parentMetadata.path) {
    // Root observable
    return String(operatorCount);
  }
  
  // Child of existing pipe
  return `${parentMetadata.path}.${operatorCount}`;
}

// Export for cleanup/testing
export function unpatchPipe(): void {
  if (!isPatched) return;
  Observable.prototype.pipe = originalPipe;
  isPatched = false;
}
```

## Operator Naming Enhancement (Optional)

To support user annotations:

```typescript
// Helper function users can call
export function annotateOperator<T extends Function>(
  operator: T,
  displayName: string
): T {
  (operator as any).displayName = displayName;
  return operator;
}

// Usage:
import { map } from 'rxjs/operators';
import { annotateOperator } from './tracking/pipe-patch';

const double = annotateOperator(map(x => x * 2), 'double');
source$.pipe(double); // Will show as "double" in devtools
```

## Testing

Create `src/tracking/__tests__/pipe-patch.test.ts`:

Test cases:
1. Patching works and preserves behavior
2. Simple pipe captures operator names
3. Nested pipe creates correct paths
4. Parent reference is set correctly
5. Multiple pipes from same source work independently
6. Operator instance tracking works (same operator, multiple uses)
7. Argument crawling finds observables in operator args
8. Function wrapping detects observable returns with `.$return` path
9. Context stack links dynamically-created observables
10. Generic operator decoration intercepts events correctly

Example test:
```typescript
import { of } from 'rxjs';
import { map, filter, take } from 'rxjs/operators';
import { patchPipe } from '../pipe-patch';
import { getMetadata } from '../registry';

describe('pipe-patch', () => {
  beforeAll(() => patchPipe());
  
  it('captures operator chain', () => {
    const source$ = of(1, 2, 3);
    const result$ = source$.pipe(
      map(x => x * 2),
      filter(x => x > 2)
    );
    
    const meta = getMetadata(result$);
    expect(meta.operators).toEqual(['map', 'filter']);
    expect(meta.path).toBe('2'); // 2 operators
  });
  
  it('handles nested pipes', () => {
    const source$ = of(1);
    const middle$ = source$.pipe(map(x => x));
    const final$ = middle$.pipe(filter(x => x > 0));
    
    const middleMeta = getMetadata(middle$);
    const finalMeta = getMetadata(final$);
    
    expect(middleMeta.path).toBe('1');
    expect(finalMeta.path).toBe('1.1');
    expect(finalMeta.parent?.deref()).toBe(middle$);
  });
});
```

## Integration Points
- Requires Task 2 (registry) to be completed
- Must be called during app initialization
- Should patch before any user code creates observables

## Setup

In app entry point:
```typescript
import { patchPipe } from './tracking/pipe-patch';

// Initialize tracking
patchPipe();

// Now user code runs
import './app';
```

## Edge Cases
- Empty pipe: `observable.pipe()` → operators = [], path still increments
- Operator is null/undefined → skip or use placeholder name
- Piping an observable that has no metadata → create new root entry

## Performance Notes
- Patching adds minimal overhead (few object property lookups)
- WeakRef doesn't prevent normal GC
- Operator name extraction happens once per pipe call
- No watchers or subscriptions are created

## Deliverables
- `src/tracking/pipe-patch.ts` with patch/unpatch functions
- Helper for operator annotation
- Test file with comprehensive cases
- Comments explaining path generation logic
