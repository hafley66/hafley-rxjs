# Task 4: Subscribe Method Patching

## Objective
Monkey-patch `Observable.prototype.subscribe` to track subscription lifecycle and parent-child relationships.

## File to Create
`src/tracking/subscribe-patch.ts`

## Requirements

### Core Functionality
When `observable.subscribe()` is called:
1. Generate subscription ID
2. Link to observable metadata
3. Detect parent subscription (if called within another subscription)
4. Call original subscribe
5. Wrap unsubscribe to track lifecycle
6. Return wrapped subscription

### Parent Detection Strategy
Use a call stack to track active subscription contexts:
- Before calling original subscribe, push current sub ID
- After subscribe completes, pop from stack
- Parent = top of stack before push

This captures nested subscriptions like:
```typescript
outer$.subscribe(() => {
  inner$.subscribe(); // parent is outer$'s subscription
});
```

## Implementation

```typescript
import { Observable, Subscription } from 'rxjs';
import { 
  activeSubscriptions, 
  archivedSubscriptions,
  generateSubscriptionId,
  getMetadata 
} from './registry';
import { SubscriptionMetadata } from './types';

// Store original
const originalSubscribe = Observable.prototype.subscribe;

// Context stack for parent detection
const subscriptionContextStack: string[] = [];

let isPatched = false;

export function patchSubscribe(): void {
  if (isPatched) {
    console.warn('subscribe() already patched');
    return;
  }
  
  Observable.prototype.subscribe = function(this: Observable<any>, ...args: any[]) {
    // Generate ID for this subscription
    const subId = generateSubscriptionId();
    
    // Get observable metadata
    const obsMeta = getMetadata(this);
    
    // Detect parent subscription
    const parentSubId = getParentSubscription();
    
    // Create subscription metadata
    const subMeta: SubscriptionMetadata = {
      id: subId,
      observableId: obsMeta?.id || 'unknown',
      subscribedAt: Date.now(),
      parentSubscriptionId: parentSubId,
      childSubscriptionIds: [],
    };
    
    // Register in active subscriptions
    activeSubscriptions.set(subId, subMeta);
    
    // Add to parent's children list
    if (parentSubId) {
      const parentMeta = activeSubscriptions.get(parentSubId);
      if (parentMeta) {
        parentMeta.childSubscriptionIds.push(subId);
      }
    }
    
    // Call original subscribe with context
    let subscription: Subscription;
    
    try {
      // Push context before calling original
      subscriptionContextStack.push(subId);
      
      subscription = originalSubscribe.apply(this, args);
    } finally {
      // Always pop, even if error
      subscriptionContextStack.pop();
    }
    
    // Wrap unsubscribe to track cleanup
    const originalUnsubscribe = subscription.unsubscribe.bind(subscription);
    
    subscription.unsubscribe = () => {
      // Mark as unsubscribed
      const meta = activeSubscriptions.get(subId);
      if (meta) {
        meta.unsubscribedAt = Date.now();
        
        // Move to archive
        archivedSubscriptions.set(subId, meta);
        activeSubscriptions.delete(subId);
      }
      
      // Call original unsubscribe
      originalUnsubscribe();
    };
    
    return subscription;
  };
  
  isPatched = true;
}

// Helper: Get current parent subscription
function getParentSubscription(): string | undefined {
  if (subscriptionContextStack.length === 0) {
    return undefined;
  }
  // Parent is top of stack
  return subscriptionContextStack[subscriptionContextStack.length - 1];
}

// Helper: Get current subscription context (useful for debugging)
export function getCurrentSubscriptionContext(): string | undefined {
  return getParentSubscription();
}

// Cleanup
export function unpatchSubscribe(): void {
  if (!isPatched) return;
  Observable.prototype.subscribe = originalSubscribe;
  isPatched = false;
}
```

## Archive Cleanup (Optional)

To prevent memory growth, periodically clean old archived subscriptions:

```typescript
// Add to subscribe-patch.ts

const MAX_ARCHIVED_SUBSCRIPTIONS = 1000;
const MAX_ARCHIVE_AGE_MS = 5 * 60 * 1000; // 5 minutes

export function cleanupArchivedSubscriptions(): void {
  const now = Date.now();
  const toDelete: string[] = [];
  
  for (const [id, meta] of archivedSubscriptions.entries()) {
    // Remove old entries
    if (meta.unsubscribedAt && (now - meta.unsubscribedAt > MAX_ARCHIVE_AGE_MS)) {
      toDelete.push(id);
    }
  }
  
  // Also enforce max size
  if (archivedSubscriptions.size > MAX_ARCHIVED_SUBSCRIPTIONS) {
    const entries = Array.from(archivedSubscriptions.entries());
    entries.sort((a, b) => (a[1].unsubscribedAt || 0) - (b[1].unsubscribedAt || 0));
    
    const toRemove = entries.slice(0, archivedSubscriptions.size - MAX_ARCHIVED_SUBSCRIPTIONS);
    toRemove.forEach(([id]) => toDelete.push(id));
  }
  
  toDelete.forEach(id => archivedSubscriptions.delete(id));
}

// Auto-cleanup every minute
setInterval(cleanupArchivedSubscriptions, 60_000);
```

## Testing

Create `src/tracking/__tests__/subscribe-patch.test.ts`:

Test cases:
1. Subscribe creates metadata entry
2. Unsubscribe moves to archive
3. Parent-child relationships captured correctly
4. Multiple subscriptions to same observable work
5. Nested subscriptions (switchMap) track hierarchy
6. Context stack is properly maintained (push/pop)

Example test:
```typescript
import { of, interval } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { patchSubscribe } from '../subscribe-patch';
import { activeSubscriptions } from '../registry';

describe('subscribe-patch', () => {
  beforeAll(() => patchSubscribe());
  
  it('tracks active subscription', () => {
    const sub = of(1).subscribe();
    
    expect(activeSubscriptions.size).toBe(1);
    const [meta] = activeSubscriptions.values();
    expect(meta.subscribedAt).toBeLessThanOrEqual(Date.now());
    
    sub.unsubscribe();
  });
  
  it('tracks parent-child relationships', (done) => {
    const outer$ = of(1);
    const inner$ = of(2);
    
    let outerSubId: string;
    let innerSubId: string;
    
    const outerSub = outer$.subscribe(() => {
      // Capture outer sub id
      outerSubId = Array.from(activeSubscriptions.keys())[0];
      
      // Subscribe to inner
      const innerSub = inner$.subscribe(() => {
        innerSubId = Array.from(activeSubscriptions.keys())[1];
        
        const innerMeta = activeSubscriptions.get(innerSubId);
        expect(innerMeta?.parentSubscriptionId).toBe(outerSubId);
        
        const outerMeta = activeSubscriptions.get(outerSubId);
        expect(outerMeta?.childSubscriptionIds).toContain(innerSubId);
        
        innerSub.unsubscribe();
        done();
      });
    });
    
    outerSub.unsubscribe();
  });
  
  it('handles switchMap correctly', (done) => {
    const outer$ = interval(10).pipe(take(2));
    const inner$ = (n: number) => of(n * 2);
    
    const sub = outer$.pipe(
      switchMap(inner$)
    ).subscribe({
      complete: () => {
        // Should have parent-child relationships
        const subs = Array.from(activeSubscriptions.values());
        expect(subs.length).toBeGreaterThan(0);
        sub.unsubscribe();
        done();
      }
    });
  });
});
```

## Integration Points
- Requires Task 2 (registry) to be completed
- Must be patched after pipe patching
- Should be called during app initialization

## Setup

In app entry point:
```typescript
import { patchPipe } from './tracking/pipe-patch';
import { patchSubscribe } from './tracking/subscribe-patch';

// Initialize tracking
patchPipe();
patchSubscribe();
```

## Edge Cases
- Subscribe called with partial observer vs functions
- Unsubscribe called multiple times (should be idempotent)
- Error in subscription callback (should still track)
- Synchronous completion (should still track)
- Context stack corruption (try/finally ensures cleanup)

## Performance Notes
- Minimal overhead: just Map operations and a stack push/pop
- No deep copying or complex operations
- Archive cleanup runs in background
- WeakRef would be ideal for archived subs but Map is fine

## Memory Management
- Active subscriptions: strong refs (intentional - they're active)
- Archived subscriptions: strong refs but time-limited
- Auto-cleanup prevents unbounded growth
- Consider making archive size/age configurable

## Deliverables
- `src/tracking/subscribe-patch.ts` with patch/unpatch functions
- Archive cleanup function with auto-runner
- Test file with comprehensive cases
- Comments explaining context stack mechanism
