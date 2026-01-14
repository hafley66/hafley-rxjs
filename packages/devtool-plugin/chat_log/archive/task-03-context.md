# Context Isolation: Task 3 - Pipe Patching

**READ THIS FIRST BEFORE IMPLEMENTING**

## Your Exclusive Responsibility
- **You write:** `src/tracking/pipe-patch.ts`
- **You write:** `src/tracking/__tests__/pipe-patch.test.ts`
- **You own:** All pipe() method patching logic

## What Already Exists (Dependencies from Task 2)

### Registry Module (`src/tracking/registry.ts`)
Already complete. You can import:
```typescript
import { 
  getMetadata,           // (obs: Observable<any>) => ObservableMetadata | undefined
  observableMetadata,    // WeakMap<any, ObservableMetadata>
  registerObservable,    // (obs: any, meta: ObservableMetadata) => void
  generateObservableId   // () => string
} from './registry';
```

### Types Module (`src/tracking/types.ts`)
Already complete. Interface you need:
```typescript
interface ObservableMetadata {
  id: string;
  createdAt: string;
  location: { filePath: string; line: number; column: number };
  variableName?: string;
  parent?: WeakRef<any>;
  operators: string[];
  path: string;
}
```

## What You MUST NOT Do

### DO NOT Touch These Files
- ❌ `subscribe-patch.ts` - Task 4 is writing this in parallel
- ❌ `debugger-api.ts` - Task 5 will write this later
- ❌ `special-operators.ts` - Task 6 will write this later
- ❌ `registry.ts` - Already complete, read-only
- ❌ `types.ts` - Already complete, read-only

### DO NOT Import From Parallel Tasks
Task 4 is simultaneously working on subscribe patching. DO NOT:
```typescript
// ❌ WRONG - Task 4 isn't done yet
import { patchSubscribe } from './subscribe-patch';
```

### DO NOT Make Assumptions About
- How subscriptions work (that's Task 4's job)
- What the debugger API looks like (that's Task 5)
- How special operators work (that's Task 6)

## Your Interface Contract

Tasks 5 and 6 will import from you. You MUST export:

```typescript
// Required exports:
export function patchPipe(): void;
export function unpatchPipe(): void;

// Optional but recommended:
export function getOperatorName(operator: any): string;
export function annotateOperator<T>(op: T, displayName: string): T;
```

## Key Implementation Facts

### 1. Observable.prototype.pipe is Safe to Patch
```typescript
const originalPipe = Observable.prototype.pipe;
Observable.prototype.pipe = function(...ops) {
  // Your patched version
};
```
Task 4 patches Observable.prototype.subscribe separately. No conflict.

### 2. You Work with Piped Observables
```typescript
const result$ = source$.pipe(map(x => x * 2));
// Your job: capture that this piped observable has:
// - parent: source$
// - operators: ['map']
// - path: based on parent's path
```

### 3. Path Generation Logic
Given parent path and operator count:
- Root (no parent): path = String(operatorCount)
- Has parent: path = `${parent.path}.${operatorCount}`

Example:
```typescript
source$                          // path: ""
source$.pipe(map, filter)        // path: "2" (2 operators)
  .pipe(take)                    // path: "2.1" (parent "2" + 1 operator)
```

## What Happens in Parallel (Task 4)

While you're working, Task 4 is patching subscribe():
- Task 4: Tracks when subscribe() is called
- Task 4: Links subscriptions to observable IDs
- Task 4: Builds subscription trees

Your work is orthogonal:
- You: Track pipe chains (static structure)
- Task 4: Track subscriptions (runtime behavior)

Both modify Observable.prototype, different methods, no conflict.

## Testing Strategy

Your tests should:
1. Mock Observable without importing from Task 4
2. Test pipe patching in isolation
3. Verify metadata registration
4. Check parent-child relationships
5. Validate path generation

```typescript
// Good test
it('captures operator chain', () => {
  const source$ = of(1, 2, 3);
  const result$ = source$.pipe(map(x => x * 2), filter(x => x > 2));
  
  const meta = getMetadata(result$);
  expect(meta.operators).toEqual(['map', 'filter']);
});
```

## Completion Criteria

You're done when:
- [x] `patchPipe()` and `unpatchPipe()` exist and work
- [x] Pipe chains are captured in metadata
- [x] Parent references are set correctly
- [x] Paths are generated correctly
- [x] Tests pass in isolation
- [x] No imports from Task 4, 5, or 6

## Questions/Ambiguities

If you're unsure about:
- **Operator naming**: Use func.name, fallback to "operator"
- **WeakRef vs strong ref**: Always use WeakRef for parent
- **Error handling**: Return gracefully, don't throw

Focus on YOUR scope. Ignore everything else.
