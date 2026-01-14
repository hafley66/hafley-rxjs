# Task 5: Debugger Query API

## Objective
Create high-level API for querying observable and subscription data. This is the interface devtools UI will use.

## File to Create
`src/tracking/debugger-api.ts`

## Requirements

Provide methods to:
1. Query observables by ID or reference
2. List all active subscriptions
3. Build subscription trees (parent-child hierarchy)
4. Traverse pipeline chains (pipe parent links)
5. Get execution paths (all operators from root to leaf)
6. Find root observables (no parent)

## Implementation

```typescript
import { Observable } from 'rxjs';
import {
  getMetadata,
  getObservableById,
  activeSubscriptions,
  archivedSubscriptions,
} from './registry';
import { ObservableMetadata, SubscriptionMetadata } from './types';

export class RxJSDebugger {
  
  // === Observable Queries ===
  
  /**
   * Get metadata for an observable instance
   */
  getObservableMetadata(obs: Observable<any>): ObservableMetadata | undefined {
    return getMetadata(obs);
  }
  
  /**
   * Get observable by its ID
   */
  getObservableById(id: string): Observable<any> | undefined {
    return getObservableById(id);
  }
  
  /**
   * Get all root observables (those with no parent)
   */
  getRootObservables(): Array<{ id: string; metadata: ObservableMetadata }> {
    const roots: Array<{ id: string; metadata: ObservableMetadata }> = [];
    
    // We need to iterate through all observables
    // Since we use WeakMap, we can't iterate directly
    // Solution: track roots separately or traverse from active subscriptions
    
    // For now, traverse from active subscriptions backwards
    const seen = new Set<string>();
    
    for (const subMeta of activeSubscriptions.values()) {
      const obsId = subMeta.observableId;
      if (seen.has(obsId)) continue;
      
      const obs = getObservableById(obsId);
      if (!obs) continue;
      
      const root = this.findRoot(obs);
      const rootMeta = getMetadata(root);
      
      if (rootMeta && !seen.has(rootMeta.id)) {
        seen.add(rootMeta.id);
        roots.push({ id: rootMeta.id, metadata: rootMeta });
      }
    }
    
    return roots;
  }
  
  /**
   * Find root observable by traversing parent chain
   */
  findRoot(obs: Observable<any>): Observable<any> {
    let current = obs;
    let meta = getMetadata(current);
    
    while (meta?.parent) {
      const parent = meta.parent.deref();
      if (!parent) break; // Parent was GC'd
      
      current = parent;
      meta = getMetadata(current);
    }
    
    return current;
  }
  
  /**
   * Get full pipeline chain from observable to root
   */
  getPipelineChain(obs: Observable<any>): ObservableMetadata[] {
    const chain: ObservableMetadata[] = [];
    let current = obs;
    
    while (current) {
      const meta = getMetadata(current);
      if (!meta) break;
      
      chain.unshift(meta); // Add to front (root first)
      
      if (!meta.parent) break;
      const parent = meta.parent.deref();
      if (!parent) break;
      
      current = parent;
    }
    
    return chain;
  }
  
  /**
   * Get all operators in execution order from root to this observable
   */
  getExecutionPath(obs: Observable<any>): string[] {
    const chain = this.getPipelineChain(obs);
    const operators: string[] = [];
    
    for (const meta of chain) {
      operators.push(...meta.operators);
    }
    
    return operators;
  }
  
  // === Subscription Queries ===
  
  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): SubscriptionMetadata[] {
    return Array.from(activeSubscriptions.values());
  }
  
  /**
   * Get archived (unsubscribed) subscriptions
   */
  getArchivedSubscriptions(): SubscriptionMetadata[] {
    return Array.from(archivedSubscriptions.values());
  }
  
  /**
   * Get subscription by ID
   */
  getSubscription(id: string): SubscriptionMetadata | undefined {
    return activeSubscriptions.get(id) || archivedSubscriptions.get(id);
  }
  
  /**
   * Build subscription tree starting from a subscription
   */
  getSubscriptionTree(subId: string): SubscriptionTreeNode | null {
    const meta = this.getSubscription(subId);
    if (!meta) return null;
    
    return this.buildSubscriptionTree(meta);
  }
  
  /**
   * Get all root subscriptions (those with no parent)
   */
  getRootSubscriptions(): SubscriptionMetadata[] {
    return this.getActiveSubscriptions().filter(
      sub => !sub.parentSubscriptionId
    );
  }
  
  /**
   * Build tree structure recursively
   */
  private buildSubscriptionTree(meta: SubscriptionMetadata): SubscriptionTreeNode {
    const children = meta.childSubscriptionIds
      .map(id => this.getSubscription(id))
      .filter((m): m is SubscriptionMetadata => m !== undefined)
      .map(childMeta => this.buildSubscriptionTree(childMeta));
    
    return {
      subscription: meta,
      children,
    };
  }
  
  // === Statistics ===
  
  /**
   * Get subscription statistics
   */
  getStats(): {
    activeCount: number;
    archivedCount: number;
    rootCount: number;
  } {
    return {
      activeCount: activeSubscriptions.size,
      archivedCount: archivedSubscriptions.size,
      rootCount: this.getRootSubscriptions().length,
    };
  }
  
  /**
   * Get subscription lifetime in ms
   */
  getSubscriptionLifetime(subId: string): number | null {
    const meta = this.getSubscription(subId);
    if (!meta) return null;
    
    const end = meta.unsubscribedAt || Date.now();
    return end - meta.subscribedAt;
  }
  
  // === Debug Helpers ===
  
  /**
   * Print subscription tree to console
   */
  printSubscriptionTree(subId: string, indent = 0): void {
    const meta = this.getSubscription(subId);
    if (!meta) {
      console.log('Subscription not found:', subId);
      return;
    }
    
    const prefix = '  '.repeat(indent);
    const status = meta.unsubscribedAt ? '✗' : '✓';
    const lifetime = this.getSubscriptionLifetime(subId);
    
    console.log(
      `${prefix}${status} ${meta.id} → ${meta.observableId} (${lifetime}ms)`
    );
    
    for (const childId of meta.childSubscriptionIds) {
      this.printSubscriptionTree(childId, indent + 1);
    }
  }
  
  /**
   * Print observable pipeline chain
   */
  printPipelineChain(obs: Observable<any>): void {
    const chain = this.getPipelineChain(obs);
    
    console.log('Pipeline chain:');
    for (let i = 0; i < chain.length; i++) {
      const meta = chain[i];
      const indent = '  '.repeat(i);
      const ops = meta.operators.length > 0 
        ? `→ ${meta.operators.join(' → ')}` 
        : '(source)';
      
      console.log(`${indent}${meta.id} ${ops}`);
      console.log(`${indent}  ${meta.location.filePath}:${meta.location.line}`);
    }
  }
}

// Export singleton instance
export const debugger = new RxJSDebugger();

// Export types
export interface SubscriptionTreeNode {
  subscription: SubscriptionMetadata;
  children: SubscriptionTreeNode[];
}
```

## Enhanced Registry for Root Tracking

Update `src/tracking/registry.ts` to track roots:

```typescript
// Add to registry.ts

// Track root observables separately for efficient lookup
export const rootObservables = new Set<string>(); // observable IDs

export function registerObservable(obs: any, metadata: ObservableMetadata): void {
  observableMetadata.set(obs, metadata);
  observableById.set(metadata.id, new WeakRef(obs));
  
  // Track if it's a root
  if (!metadata.parent) {
    rootObservables.add(metadata.id);
  }
}
```

## Testing

Create `src/tracking/__tests__/debugger-api.test.ts`:

Test cases:
1. Get observable metadata
2. Find root observables
3. Build pipeline chain
4. Get execution path
5. Get active subscriptions
6. Build subscription tree
7. Calculate subscription lifetime
8. Print helpers work without errors

Example test:
```typescript
import { of } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import { debugger } from '../debugger-api';
import { patchPipe, patchSubscribe } from '../';

describe('debugger-api', () => {
  beforeAll(() => {
    patchPipe();
    patchSubscribe();
  });
  
  it('gets pipeline chain', () => {
    const source$ = of(1, 2, 3);
    const piped$ = source$.pipe(
      map(x => x * 2),
      filter(x => x > 2)
    );
    
    const chain = debugger.getPipelineChain(piped$);
    expect(chain).toHaveLength(2); // source + piped
    expect(chain[1].operators).toEqual(['map', 'filter']);
  });
  
  it('finds root observable', () => {
    const source$ = of(1);
    const piped$ = source$.pipe(map(x => x));
    
    const root = debugger.findRoot(piped$);
    expect(root).toBe(source$);
  });
  
  it('builds subscription tree', (done) => {
    const outer$ = of(1);
    const inner$ = of(2);
    
    const outerSub = outer$.subscribe(() => {
      inner$.subscribe();
    });
    
    setTimeout(() => {
      const roots = debugger.getRootSubscriptions();
      expect(roots.length).toBeGreaterThan(0);
      
      const tree = debugger.getSubscriptionTree(roots[0].id);
      expect(tree).toBeTruthy();
      expect(tree!.children.length).toBe(1);
      
      outerSub.unsubscribe();
      done();
    }, 10);
  });
});
```

## Usage Examples

```typescript
import { debugger } from './tracking/debugger-api';

// Get all active subscriptions
const active = debugger.getActiveSubscriptions();
console.log('Active subscriptions:', active.length);

// Print a subscription tree
const roots = debugger.getRootSubscriptions();
roots.forEach(root => {
  debugger.printSubscriptionTree(root.id);
});

// Inspect an observable's pipeline
const result$ = source$.pipe(map(x => x * 2), filter(x => x > 5));
debugger.printPipelineChain(result$);

// Get execution path
const operators = debugger.getExecutionPath(result$);
console.log('Operators:', operators); // ['map', 'filter']
```

## Integration Points
- Requires all previous tasks (registry, patches)
- Used by React DevTools UI components
- Can be exposed globally for console debugging

## Setup

```typescript
// In app entry or devtools init
import { debugger } from './tracking/debugger-api';

// Expose globally for debugging
if (process.env.NODE_ENV === 'development') {
  (window as any).__rxjsDebugger = debugger;
}
```

## Future Enhancements
- Export to JSON for external analysis
- Filter/search capabilities
- Performance metrics per operator
- Memory usage tracking
- Observable lifecycle events (create, complete, error)

## Deliverables
- `src/tracking/debugger-api.ts` with full API
- Update to registry.ts for root tracking
- Test file with comprehensive cases
- Usage examples in comments
- Type exports for external use
