# Context Isolation: Task 4 - Subscribe Patching

**READ THIS FIRST BEFORE IMPLEMENTING**

## Your Exclusive Responsibility
- **You write:** `src/tracking/subscribe-patch.ts`
- **You write:** `src/tracking/__tests__/subscribe-patch.test.ts`
- **You own:** All subscribe() method patching logic

## What Already Exists (Dependencies from Task 2)

### Registry Module (`src/tracking/registry.ts`)
Already complete. You can import:
```typescript
import { 
  activeSubscriptions,        // Map<string, SubscriptionMetadata>
  archivedSubscriptions,      // Map<string, SubscriptionMetadata>
  generateSubscriptionId,     // () => string
  getMetadata                 // (obs: Observable<any>) => ObservableMetadata | undefined
} from './registry';
```

### Types Module (`src/tracking/types.ts`)
Already complete. Interface you need:
```typescript
interface SubscriptionMetadata {
  id: string;
  observableId: string;
  subscribedAt: number;
  unsubscribedAt?: number;
  parentSubscriptionId?: string;
  childSubscriptionIds: string[];
}
```

## What You MUST NOT Do

### DO NOT Touch These Files
- ❌ `pipe-patch.ts` - Task 3 is writing this in parallel
- ❌ `debugger-api.ts` - Task 5 will write this later
- ❌ `special-operators.ts` - Task 6 will write this later
- ❌ `registry.ts` - Already complete, read-only
- ❌ `types.ts` - Already complete, read-only

### DO NOT Import From Parallel Tasks
Task 3 is simultaneously working on pipe patching. DO NOT:
```typescript
// ❌ WRONG - Task 3 isn't done yet
import { patchPipe } from './pipe-patch';
```

### DO NOT Make Assumptions About
- How pipe chains work (that's Task 3's job)
- What the debugger API looks like (that's Task 5)
- How special operators work (that's Task 6)

## Your Interface Contract

Tasks 5 and 6 will import from you. You MUST export:

```typescript
// Required exports:
export function patchSubscribe(): void;
export function unpatchSubscribe(): void;

// Optional but recommended:
export function getCurrentSubscriptionContext(): string | undefined;
```

## Key Implementation Facts

### 1. Observable.prototype.subscribe is Safe to Patch
```typescript
const originalSubscribe = Observable.prototype.subscribe;
Observable.prototype.subscribe = function(...args) {
  // Your patched version
};
```
Task 3 patches Observable.prototype.pipe separately. No conflict.

### 2. You Work with Subscriptions
```typescript
const sub = observable$.subscribe(value => console.log(value));
// Your job: capture that this subscription:
// - has unique ID
// - links to observable ID (from getMetadata)
// - has parent subscription (if nested)
// - tracks lifetime (subscribed -> unsubscribed)
```

### 3. Parent-Child Detection Strategy
Use a call stack:
```typescript
const subscriptionContextStack: string[] = [];

// Before calling original subscribe
subscriptionContextStack.push(subId);

// After subscribe completes
subscriptionContextStack.pop();

// Parent = top of stack before push
```

Example:
```typescript
outer$.subscribe(() => {
  // Stack: ['sub#0']
  inner$.subscribe();  // Parent: 'sub#0'
  // Stack after inner push: ['sub#0', 'sub#1']
});
```

### 4. Unsubscribe Wrapping
```typescript
const subscription = originalSubscribe.apply(this, args);
const originalUnsubscribe = subscription.unsubscribe.bind(subscription);

subscription.unsubscribe = () => {
  // Mark as unsubscribed in metadata
  // Move to archived subscriptions
  originalUnsubscribe();
};
```

## What Happens in Parallel (Task 3)

While you're working, Task 3 is patching pipe():
- Task 3: Tracks operator chains
- Task 3: Links piped observables to parents
- Task 3: Builds pipeline structure

Your work is orthogonal:
- You: Track subscriptions (runtime behavior)
- Task 3: Track pipe chains (static structure)

Both modify Observable.prototype, different methods, no conflict.

## Testing Strategy

Your tests should:
1. Mock Observable without importing from Task 3
2. Test subscribe patching in isolation
3. Verify subscription tracking
4. Check parent-child relationships
5. Validate unsubscribe behavior

```typescript
// Good test
it('tracks parent-child subscriptions', (done) => {
  const outer$ = of(1);
  const inner$ = of(2);
  
  const outerSub = outer$.subscribe(() => {
    const innerSub = inner$.subscribe();
    
    // Verify parent-child link
    const innerMeta = activeSubscriptions.get(innerSub.id);
    expect(innerMeta.parentSubscriptionId).toBe(outerSub.id);
    
    innerSub.unsubscribe();
    done();
  });
  
  outerSub.unsubscribe();
});
```

## Archive Cleanup (Nice to Have)

Consider adding automatic cleanup for old archived subscriptions:
```typescript
// After 5 minutes or 1000 entries
function cleanupArchivedSubscriptions() { ... }
setInterval(cleanupArchivedSubscriptions, 60_000);
```

Not required for MVP, but good practice.

## Completion Criteria

You're done when:
- [x] `patchSubscribe()` and `unpatchSubscribe()` exist and work
- [x] Subscriptions are tracked in activeSubscriptions
- [x] Unsubscribed move to archivedSubscriptions
- [x] Parent-child relationships are captured
- [x] Context stack works correctly
- [x] Tests pass in isolation
- [x] No imports from Task 3, 5, or 6

## Questions/Ambiguities

If you're unsure about:
- **Observable ID lookup**: Use `getMetadata(observable)?.id`
- **Context stack management**: Use try/finally to ensure pop
- **Error handling**: Don't throw, fail gracefully

Focus on YOUR scope. Ignore everything else.
