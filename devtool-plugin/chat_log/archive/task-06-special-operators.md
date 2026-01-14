# Task 6: Special Operator Handling

## Objective
Add enhanced tracking for stateful operators: `share`, `shareReplay`, `retry`, `repeat`. These need special handling because they have internal state that affects behavior.

## File to Create
`src/tracking/special-operators.ts`

## Requirements

### Operators to Handle

1. **share / shareReplay**: Track reference count and shared subscriptions
2. **retry**: Track retry attempts and errors
3. **repeat**: Track iteration count

### Detection Strategy

During pipe patching, detect these operators by:
1. Function name matching
2. Reference equality with known RxJS exports
3. User annotation via displayName

When detected, wrap them to emit state updates.

## Implementation

```typescript
import { Observable, OperatorFunction } from 'rxjs';
import { 
  share as rxjsShare, 
  shareReplay as rxjsShareReplay,
  retry as rxjsRetry,
  repeat as rxjsRepeat 
} from 'rxjs/operators';

// State storage for special operators
export interface SpecialOperatorState {
  operatorType: 'share' | 'shareReplay' | 'retry' | 'repeat';
  observableId: string;
  state: any;
}

const specialOperatorStates = new Map<string, SpecialOperatorState>();

// === Detection ===

export function isSpecialOperator(operator: any): boolean {
  return (
    isShareOperator(operator) ||
    isRetryOperator(operator) ||
    isRepeatOperator(operator)
  );
}

function isShareOperator(operator: any): boolean {
  // Check by reference or name
  return (
    operator === rxjsShare ||
    operator === rxjsShareReplay ||
    operator?.name === 'share' ||
    operator?.name === 'shareReplay' ||
    operator?.displayName === 'share' ||
    operator?.displayName === 'shareReplay'
  );
}

function isRetryOperator(operator: any): boolean {
  return (
    operator === rxjsRetry ||
    operator?.name === 'retry' ||
    operator?.displayName === 'retry'
  );
}

function isRepeatOperator(operator: any): boolean {
  return (
    operator === rxjsRepeat ||
    operator?.name === 'repeat' ||
    operator?.displayName === 'repeat'
  );
}

// === Wrapper Functions ===

/**
 * Wrap share/shareReplay to track reference count
 */
export function wrapShareOperator<T>(
  operator: OperatorFunction<T, T>,
  observableId: string
): OperatorFunction<T, T> {
  
  return (source: Observable<T>) => {
    let refCount = 0;
    
    const state: SpecialOperatorState = {
      operatorType: operator === rxjsShareReplay ? 'shareReplay' : 'share',
      observableId,
      state: { refCount },
    };
    
    specialOperatorStates.set(observableId, state);
    
    // Apply original operator
    const shared = operator(source);
    
    // Intercept subscribe to track ref count
    const originalSubscribe = shared.subscribe.bind(shared);
    
    (shared as any).subscribe = function(...args: any[]) {
      refCount++;
      state.state.refCount = refCount;
      
      const subscription = originalSubscribe(...args);
      const originalUnsubscribe = subscription.unsubscribe.bind(subscription);
      
      subscription.unsubscribe = () => {
        refCount--;
        state.state.refCount = refCount;
        originalUnsubscribe();
      };
      
      return subscription;
    };
    
    return shared;
  };
}

/**
 * Wrap retry to track attempts
 */
export function wrapRetryOperator<T>(
  operator: OperatorFunction<T, T>,
  observableId: string
): OperatorFunction<T, T> {
  
  return (source: Observable<T>) => {
    let attempts = 0;
    let lastError: any = null;
    
    const state: SpecialOperatorState = {
      operatorType: 'retry',
      observableId,
      state: { attempts, lastError },
    };
    
    specialOperatorStates.set(observableId, state);
    
    // Wrap source to track errors
    const trackedSource = new Observable<T>(subscriber => {
      return source.subscribe({
        next: (value) => subscriber.next(value),
        error: (err) => {
          attempts++;
          lastError = err;
          state.state = { attempts, lastError };
          subscriber.error(err);
        },
        complete: () => subscriber.complete(),
      });
    });
    
    // Apply original retry operator
    return operator(trackedSource);
  };
}

/**
 * Wrap repeat to track iterations
 */
export function wrapRepeatOperator<T>(
  operator: OperatorFunction<T, T>,
  observableId: string
): OperatorFunction<T, T> {
  
  return (source: Observable<T>) => {
    let iterations = 0;
    
    const state: SpecialOperatorState = {
      operatorType: 'repeat',
      observableId,
      state: { iterations },
    };
    
    specialOperatorStates.set(observableId, state);
    
    // Wrap source to track completions
    const trackedSource = new Observable<T>(subscriber => {
      return source.subscribe({
        next: (value) => subscriber.next(value),
        error: (err) => subscriber.error(err),
        complete: () => {
          iterations++;
          state.state.iterations = iterations;
          subscriber.complete();
        },
      });
    });
    
    // Apply original repeat operator
    return operator(trackedSource);
  };
}

// === API ===

export function getSpecialOperatorState(observableId: string): SpecialOperatorState | undefined {
  return specialOperatorStates.get(observableId);
}

export function getAllSpecialOperatorStates(): SpecialOperatorState[] {
  return Array.from(specialOperatorStates.values());
}
```

## Integration with Pipe Patch

Update `src/tracking/pipe-patch.ts` to use special operator wrappers:

```typescript
// Add to pipe-patch.ts

import { 
  isSpecialOperator, 
  wrapShareOperator, 
  wrapRetryOperator,
  wrapRepeatOperator 
} from './special-operators';

// In patchPipe(), enhance operator processing:

Observable.prototype.pipe = function(this: Observable<any>, ...operators: any[]) {
  // Process operators, wrapping special ones
  const processedOperators = operators.map((op, idx) => {
    if (isSpecialOperator(op)) {
      const obsId = `${generateObservableId()}-special-${idx}`;
      
      if (isShareOperator(op)) {
        return wrapShareOperator(op, obsId);
      } else if (isRetryOperator(op)) {
        return wrapRetryOperator(op, obsId);
      } else if (isRepeatOperator(op)) {
        return wrapRepeatOperator(op, obsId);
      }
    }
    return op;
  });
  
  // Call original with processed operators
  const result = originalPipe.apply(this, processedOperators);
  
  // ... rest of metadata tracking
};
```

## Debugger API Enhancement

Add methods to `src/tracking/debugger-api.ts`:

```typescript
// Add to RxJSDebugger class

import { getSpecialOperatorState, getAllSpecialOperatorStates } from './special-operators';

/**
 * Get state of special operators (share, retry, repeat)
 */
getSpecialOperatorState(observableId: string) {
  return getSpecialOperatorState(observableId);
}

/**
 * Get all special operator states
 */
getAllSpecialOperatorStates() {
  return getAllSpecialOperatorStates();
}

/**
 * Check if observable has shared subscriptions
 */
isShared(obs: Observable<any>): boolean {
  const meta = this.getObservableMetadata(obs);
  if (!meta) return false;
  
  const state = getSpecialOperatorState(meta.id);
  return state?.operatorType === 'share' || state?.operatorType === 'shareReplay';
}

/**
 * Get share ref count
 */
getShareRefCount(obs: Observable<any>): number | null {
  const meta = this.getObservableMetadata(obs);
  if (!meta) return null;
  
  const state = getSpecialOperatorState(meta.id);
  if (!state || (state.operatorType !== 'share' && state.operatorType !== 'shareReplay')) {
    return null;
  }
  
  return state.state.refCount || 0;
}
```

## Testing

Create `src/tracking/__tests__/special-operators.test.ts`:

Test cases:
1. Detect share operator
2. Track reference count on share
3. Detect retry operator  
4. Track retry attempts
5. Detect repeat operator
6. Track repeat iterations

Example test:
```typescript
import { of, throwError } from 'rxjs';
import { share, retry, repeat, delay } from 'rxjs/operators';
import { patchPipe } from '../pipe-patch';
import { debugger } from '../debugger-api';

describe('special-operators', () => {
  beforeAll(() => patchPipe());
  
  it('tracks share ref count', (done) => {
    const source$ = of(1, 2, 3).pipe(share());
    
    const sub1 = source$.subscribe();
    const sub2 = source$.subscribe();
    
    setTimeout(() => {
      const refCount = debugger.getShareRefCount(source$);
      expect(refCount).toBe(2);
      
      sub1.unsubscribe();
      
      setTimeout(() => {
        const refCount2 = debugger.getShareRefCount(source$);
        expect(refCount2).toBe(1);
        
        sub2.unsubscribe();
        done();
      }, 10);
    }, 10);
  });
  
  it('tracks retry attempts', (done) => {
    let attempts = 0;
    const source$ = new Observable(sub => {
      attempts++;
      if (attempts < 3) {
        sub.error(new Error('Test error'));
      } else {
        sub.next(1);
        sub.complete();
      }
    }).pipe(retry(2));
    
    source$.subscribe({
      complete: () => {
        const state = debugger.getSpecialOperatorState(/* observableId */);
        expect(state?.state.attempts).toBe(2);
        done();
      }
    });
  });
  
  it('tracks repeat iterations', (done) => {
    const source$ = of(1).pipe(repeat(3));
    
    let emissions = 0;
    source$.subscribe({
      next: () => emissions++,
      complete: () => {
        const state = debugger.getSpecialOperatorState(/* observableId */);
        expect(state?.state.iterations).toBe(3);
        expect(emissions).toBe(3);
        done();
      }
    });
  });
});
```

## Edge Cases

1. **Nested share operators**: Track each independently
2. **Retry with no limit**: Handle infinite retries gracefully
3. **Repeat with no limit**: Same as retry
4. **Share after unsubscribe all**: Reset ref count properly
5. **Multiple special operators in one pipe**: Track each state separately

## Performance Considerations

- State map lookup is O(1)
- Wrapping adds minimal overhead (one extra observable wrapper)
- Ref count tracking is just increment/decrement
- Consider cleanup for long-lived observables with many retries/repeats

## Future Enhancements

Add tracking for:
- `publishReplay`, `refCount`
- `debounceTime`, `throttleTime` (timing info)
- `scan`, `reduce` (accumulator state)
- `buffer` operators (buffer size)

## Deliverables
- `src/tracking/special-operators.ts` with detection and wrappers
- Integration with pipe-patch.ts
- Enhancement to debugger-api.ts
- Test file with comprehensive cases
- Comments explaining each wrapper's behavior
