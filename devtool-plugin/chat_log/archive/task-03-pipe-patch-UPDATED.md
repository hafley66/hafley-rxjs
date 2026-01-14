# Task 3: Pipe Method Patching & Generic Operator Decoration

## Objective
Implement comprehensive operator tracking through:
- Pipe method patching for operator chain capture
- Generic operator decoration for event interception
- Argument crawling with `.$return` sigil for function returns
- Operator instance tracking (each `map()` call gets unique ID)
- Automatic context-based linking of dynamic observables

## Key Innovation: Universal Context Pattern

Instead of special-casing each operator, we:
1. **Intercept ALL events** (next/error/complete) for every operator
2. **Set global context** before operator logic: `{ operatorInstanceId, subscriptionId, observableId, event }`
3. **Any observable created** during that context gets automatically linked
4. **Works for everything**: switchMap, repeat, retry, mergeMap, etc.

## Files to Create
- `src/tracking/operator-decorator.ts` - Generic operator event interception
- `src/tracking/pipe-patch.ts` - Pipe method patching with argument crawling
- `src/tracking/argument-crawler.ts` - Recursive argument inspection

## Architecture

### Three-Layer Approach

**Layer 1: Pipe-Time (Static)**
```typescript
source$.pipe(repeat({ delay: () => timer(1000) }))
// - Detect repeat operator
// - Generate operator instance ID: op#5
// - Crawl arguments: find delay function at path "0.delay"
// - Wrap delay function with op#5 closure
// - Register ArgumentRelationship if observables found
```

**Layer 2: Subscribe-Time (Dynamic)**
```typescript
// When source$ completes:
// 1. repeat's complete handler runs
// 2. Push context: { opId: op#5, subId: sub#2, obsId: obs#1, event: 'complete' }
// 3. repeat calls wrapped delay()
// 4. delay() returns timer(1000)
// 5. Observable constructor sees context, marks timer with all context data
// 6. Pop context
```

**Layer 3: Event-Time (Execution)**
```typescript
// Every operator event is intercepted:
next: (value) => {
  operatorContext.push({ opId, subId, obsId, event: 'next', value });
  try {
    originalNext(value);
  } finally {
    operatorContext.pop();
  }
}
```

## File 1: `src/tracking/operator-decorator.ts`

Generic operator decorator that works for ALL operators:

```typescript
import { Observable } from 'rxjs';
import { operatorContext, getMetadata } from './registry';

/**
 * Decorates ANY operator to intercept events and set execution context.
 * This enables automatic linking of dynamically-created observables.
 *
 * Usage: decorateOperator(originalOperatorFn, 'switchMap', 'op#42')
 */
export function decorateOperator(
  operatorFn: Function,
  operatorName: string,
  operatorInstanceId: string
): Function {
  return (...operatorArgs: any[]) => {
    // Call original operator factory to get operator function
    const operatorImpl = operatorFn(...operatorArgs);

    // Return decorated operator function
    return (source: Observable<any>) => {
      return new Observable(subscriber => {
        const sourceMetadata = getMetadata(source);
        const observableId = sourceMetadata?.id || 'unknown';

        // Subscribe with intercepted callbacks
        const subscription = operatorImpl(source).subscribe({
          next: (value: any) => {
            // Set context before operator logic executes
            operatorContext.push({
              operatorName,
              operatorInstanceId,
              subscriptionId: getCurrentSubscriptionId(), // From subscription context stack
              observableId,
              event: 'next',
              value,
              timestamp: Date.now()
            });

            try {
              subscriber.next(value);
            } finally {
              operatorContext.pop();
            }
          },

          error: (err: any) => {
            operatorContext.push({
              operatorName,
              operatorInstanceId,
              subscriptionId: getCurrentSubscriptionId(),
              observableId,
              event: 'error',
              timestamp: Date.now()
            });

            try {
              subscriber.error(err);
            } finally {
              operatorContext.pop();
            }
          },

          complete: () => {
            operatorContext.push({
              operatorName,
              operatorInstanceId,
              subscriptionId: getCurrentSubscriptionId(),
              observableId,
              event: 'complete',
              timestamp: Date.now()
            });

            try {
              subscriber.complete();
            } finally {
              operatorContext.pop();
            }
          }
        });

        return subscription;
      });
    };
  };
}

// Helper to get current subscription ID from subscribe context stack
function getCurrentSubscriptionId(): string {
  // TODO: Implement in subscribe-patch.ts
  // Returns current subscription ID from subscription context stack
  return 'sub#unknown';
}
```

## File 2: `src/tracking/argument-crawler.ts`

Recursive argument inspection with `.$return` sigil:

```typescript
import { isObservable } from 'rxjs';
import { getMetadata } from './registry';

/**
 * Crawls operator arguments to find observables and functions that return observables.
 * Returns Map of argument paths to observable IDs.
 *
 * Path convention:
 * - "0" = first parameter (direct)
 * - "0.delay" = delay property of first parameter
 * - "0.delay.$return" = return value of delay function (use .$return not ())
 * - "0[1]" = second element of array
 */
export function crawlArguments(
  args: any[],
  operatorInstanceId: string,
  operatorName: string
): {
  observables: Map<string, string>;  // path -> observableId
  wrappedArgs: any[];                // args with wrapped functions
} {
  const observables = new Map<string, string>();
  const wrappedArgs: any[] = [];

  args.forEach((arg, index) => {
    const basePath = String(index);
    const { wrapped, found } = crawlValue(arg, basePath, operatorInstanceId, operatorName);
    wrappedArgs.push(wrapped);
    found.forEach((obsId, path) => observables.set(path, obsId));
  });

  return { observables, wrappedArgs };
}

function crawlValue(
  value: any,
  path: string,
  operatorInstanceId: string,
  operatorName: string
): { wrapped: any; found: Map<string, string> } {
  const found = new Map<string, string>();

  if (isObservable(value)) {
    // Direct observable
    const meta = getMetadata(value);
    if (meta) {
      found.set(path, meta.id);
    }
    return { wrapped: value, found };
  }

  if (typeof value === 'function') {
    // Wrap function to detect observable returns
    const wrapped = wrapArgumentFunction(value, path, operatorInstanceId, operatorName);
    return { wrapped, found };
  }

  if (Array.isArray(value)) {
    // Recursively crawl array
    const wrappedArray = value.map((item, index) => {
      const result = crawlValue(item, `${path}[${index}]`, operatorInstanceId, operatorName);
      result.found.forEach((obsId, p) => found.set(p, obsId));
      return result.wrapped;
    });
    return { wrapped: wrappedArray, found };
  }

  if (typeof value === 'object' && value !== null) {
    // Recursively crawl object
    const wrappedObject: any = {};
    Object.entries(value).forEach(([key, val]) => {
      const result = crawlValue(val, `${path}.${key}`, operatorInstanceId, operatorName);
      result.found.forEach((obsId, p) => found.set(p, obsId));
      wrappedObject[key] = result.wrapped;
    });
    return { wrapped: wrappedObject, found };
  }

  // Primitive value
  return { wrapped: value, found };
}

/**
 * Wraps a function to detect if it returns an observable.
 * Captures operator instance ID and path in closure.
 */
function wrapArgumentFunction(
  fn: Function,
  argumentPath: string,
  operatorInstanceId: string,
  operatorName: string
): Function {
  return function wrapped(...args: any[]) {
    // Call original function
    // Context is ALREADY SET by operator decorator!
    const result = fn.apply(this, args);

    // Check if result is observable
    if (isObservable(result)) {
      // Observable constructor already marked it with operator context
      // Just add the argument path info
      const meta = getMetadata(result);
      if (meta) {
        (meta as any).argumentPath = `${argumentPath}.$return`;
      }
    }

    return result;
  };
}
```

## File 3: `src/tracking/pipe-patch.ts`

Pipe method patching that ties everything together:

```typescript
import { Observable } from 'rxjs';
import {
  getMetadata,
  registerObservable,
  generateObservableId,
  generateOperatorInstanceId,
  registerArgumentRelationship,
  generateRelationshipId
} from './registry';
import { ObservableMetadata, ArgumentRelationship } from './types';
import { decorateOperator } from './operator-decorator';
import { crawlArguments } from './argument-crawler';

const originalPipe = Observable.prototype.pipe;
let isPatched = false;

export function patchPipe(): void {
  if (isPatched) {
    console.warn('pipe() already patched');
    return;
  }

  Observable.prototype.pipe = function(this: Observable<any>, ...operators: any[]) {
    const sourceMetadata = getMetadata(this);
    const resultId = generateObservableId();
    const operatorNames: string[] = [];

    // Process each operator
    const decoratedOperators = operators.map((op, index) => {
      const opName = getOperatorName(op);
      operatorNames.push(opName);

      // Generate unique operator instance ID
      const opInstanceId = generateOperatorInstanceId();

      // Crawl operator arguments for observables
      const { observables, wrappedArgs } = crawlArguments(
        [op], // Operators are typically functions created with args already applied
        opInstanceId,
        opName
      );

      // Register ArgumentRelationship if observables found
      if (observables.size > 0) {
        const relationship: ArgumentRelationship = {
          relationshipId: generateRelationshipId(),
          operatorName: opName,
          operatorInstanceId: opInstanceId,
          sourceObservableId: resultId,
          arguments: observables,
          createdAt: new Date().toISOString(),
        };
        registerArgumentRelationship(relationship);
      }

      // Decorate operator for event interception
      return decorateOperator(wrappedArgs[0] || op, opName, opInstanceId);
    });

    // Call original pipe with decorated operators
    const result = originalPipe.apply(this, decoratedOperators);

    // Generate path
    const path = generatePath(sourceMetadata, operators.length);

    // Create metadata for result
    const resultMetadata: ObservableMetadata = {
      id: resultId,
      createdAt: new Date().toISOString(),
      location: sourceMetadata?.location || {
        filePath: 'unknown',
        line: 0,
        column: 0,
      },
      variableName: sourceMetadata?.variableName,
      parent: sourceMetadata ? new WeakRef(this) : undefined,
      operators: operatorNames,
      path,
    };

    registerObservable(result, resultMetadata);

    return result;
  };

  isPatched = true;
}

function getOperatorName(operator: any): string {
  if (operator.displayName) return operator.displayName;
  if (operator.name && operator.name !== 'anonymous') return operator.name;
  return 'operator';
}

function generatePath(
  parentMetadata: ObservableMetadata | undefined,
  operatorCount: number
): string {
  if (!parentMetadata || !parentMetadata.path) {
    return String(operatorCount);
  }
  return `${parentMetadata.path}.${operatorCount}`;
}

export function unpatchPipe(): void {
  if (!isPatched) return;
  Observable.prototype.pipe = originalPipe;
  isPatched = false;
}
```

## How It All Works Together

### Example: `repeat({ delay: () => timer(1000) })`

**Pipe Time:**
```typescript
source$.pipe(repeat({ delay: () => timer(1000) }))

// 1. patchPipe intercepts
// 2. Generates op#5 for repeat instance
// 3. crawlArguments finds delay function at "0.delay"
// 4. Wraps delay function, captures op#5 + "0.delay" in closure
// 5. decorateOperator wraps repeat to intercept events
// 6. Returns result observable
```

**Subscribe Time:**
```typescript
// source$ completes

// 1. decorateOperator's complete handler fires
// 2. Pushes context: { opId: op#5, subId: sub#2, obsId: obs#1, event: 'complete' }
// 3. repeat's logic calls wrapped delay()
// 4. delay() returns timer(1000)
// 5. Observable constructor checks operatorContext.peek()
// 6. Marks timer with: createdByOperator='repeat', opInstanceId=op#5,
//                      triggeredBySub=sub#2, triggeredByObs=obs#1, event='complete'
// 7. Wrapped delay adds: argumentPath="0.delay.$return"
// 8. Context is popped
// 9. repeat subscribes to timer
```

## Testing

Create `src/tracking/__tests__/pipe-patch.test.ts`:

```typescript
import { of, interval } from 'rxjs';
import { map, filter, repeat, switchMap } from 'rxjs/operators';
import { patchPipe } from '../pipe-patch';
import { getMetadata, operatorContext } from '../registry';

describe('pipe-patch', () => {
  beforeAll(() => patchPipe());

  it('tracks operator instances', () => {
    const mapOp = map(x => x * 2);
    const a$ = of(1).pipe(mapOp);
    const b$ = of(2).pipe(mapOp);

    const metaA = getMetadata(a$);
    const metaB = getMetadata(b$);

    // Different observables, same operator instance
    expect(metaA?.id).not.toBe(metaB?.id);
    expect(metaA?.operators).toEqual(['map']);
    expect(metaB?.operators).toEqual(['map']);
  });

  it('detects observable arguments with .$return sigil', () => {
    const notifier$ = interval(1000);
    const result$ = of(1).pipe(
      repeat({ delay: () => notifier$ })
    );

    // ArgumentRelationship should be registered
    // with path "0.delay.$return" pointing to notifier$
  });

  it('sets context during operator events', (done) => {
    operatorContext.push = jest.fn();
    operatorContext.pop = jest.fn();

    of(1).pipe(map(x => x * 2)).subscribe({
      complete: () => {
        expect(operatorContext.push).toHaveBeenCalled();
        expect(operatorContext.pop).toHaveBeenCalled();
        done();
      }
    });
  });
});
```

## Integration Points
- Requires Task 2 (registry with operatorContext)
- Works with Task 4 (subscribe-patch for subscription IDs)
- Enables Task 5 (debugger API for querying relationships)

## Edge Cases
- Empty pipe: `source$.pipe()` → still creates result observable
- Null/undefined operators → skip gracefully
- Operators without arguments → no ArgumentRelationship created
- Nested function returns → only mark immediate return with `.$return`

## Performance Notes
- Minimal overhead: one context push/pop per event
- Argument crawling happens once at pipe-time
- Function wrapping is lazy (only executes when function is called)
- No deep cloning or complex transformations

## Deliverables
- `src/tracking/operator-decorator.ts` with generic event interception
- `src/tracking/argument-crawler.ts` with recursive crawling
- `src/tracking/pipe-patch.ts` tying it all together
- Comprehensive test suite
- Comments explaining the universal context pattern
