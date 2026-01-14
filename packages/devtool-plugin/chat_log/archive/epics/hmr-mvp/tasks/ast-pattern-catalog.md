# Task: Document AST Patterns to Transform

**Priority**: P1
**Status**: Not Started
**Blocks**: All other Phase 5 tasks

---

## Goal

Before writing transforms, catalog all code patterns that need transformation. This prevents missed edge cases and informs parser design.

---

## Pattern Categories

### 1. Module Wrapper

**Input**:
```typescript
import { map } from 'rxjs'
const data$ = of(1,2,3).pipe(map(x => x*2))
data$.subscribe(console.log)
```

**Output**:
```typescript
const __$ = _rxjs_debugger_module_start(import.meta.url)
import { map } from 'rxjs'
const data$ = __$("data$:3:7", () => of(1,2,3).pipe(map(x => x*2)))
__$.sub("sub:4:1", () => data$.subscribe(console.log))
__$.end()
```

---

### 2. Observable Declarations

| Pattern | Key Format | Notes |
|---------|------------|-------|
| `const foo$ = ...` | `foo$:line:col` | Named export/const |
| `let bar$ = ...` | `bar$:line:col` | Reassignable |
| `this.data$ = ...` | `data$:line:col` | Class property |
| `return of(1)` | `return:line:col` | Anonymous return |
| `foo$.pipe(...)` | Skip | Piped obs, same identity |

**Edge cases**:
- Destructuring: `const { a$, b$ } = getStreams()`
- Spread: `const streams = [a$, b$, c$]`
- Conditional: `const x$ = flag ? a$ : b$`

---

### 3. Subscription Sites

| Pattern | Notes |
|---------|-------|
| `obs$.subscribe(...)` | Direct |
| `obs$.subscribe({ next, error, complete })` | Observer object |
| `obs$.forEach(...)` | Promise-based |
| `obs$.toPromise()` | Deprecated |
| `firstValueFrom(obs$)` | Promise |
| `lastValueFrom(obs$)` | Promise |

---

### 4. Subject Creation

| Pattern | Wrapper |
|---------|---------|
| `new Subject()` | trackedSubject |
| `new BehaviorSubject(x)` | trackedBehaviorSubject |
| `new ReplaySubject(n)` | trackedReplaySubject (TBD) |
| `new AsyncSubject()` | trackedAsyncSubject (TBD) |

---

### 5. Nested/Dynamic Patterns

```typescript
// Nested scope (recursive __$)
__$("outer", $ => {
  return $("inner", () => of(1))
})

// Higher-order callbacks
data$.pipe(
  switchMap(x => __$("inner", () => fetchData(x)))  // Must wrap inner
)

// Defer factories
defer(() => __$("lazy", () => expensiveObs$))
```

---

### 6. Skip Patterns (Don't Transform)

- RxJS internal imports (already instrumented)
- Test files (optional flag)
- node_modules (except rxjs)
- `.d.ts` files
- Non-observable code

---

## Deliverable

Create `chat_log/epics/hmr-mvp/ast-patterns.md` with:
1. Complete pattern list with examples
2. AST node types for each (oxc/estree)
3. Transform template for each
4. Edge cases and how to handle
5. Skip rules

---

## Files

- New: `chat_log/epics/hmr-mvp/ast-patterns.md`
- Reference: `src/vite-plugin/v2.ts` (existing rxjs transforms)
