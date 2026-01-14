# Vite Transform Sub-Epic

**Parent**: [HMR MVP Epic](../board.md)
**Goal**: Auto-transform user code to wrap observables with `__$()` and subscriptions with `__$.sub()`

---

## Current State

**What exists** (in `src/vite-plugin/v2.ts`):
- RxJS Observable constructor patching
- Operator decoration (`decorateOperatorFun`)
- Creation operator decoration (`decorateCreate`)

**What's missing**:
- User code module wrapping
- Observable declaration wrapping (`__$`)
- Subscription wrapping (`__$.sub`)

---

## Task Breakdown

### Phase A: Foundation

| Task | Status | File |
|------|--------|------|
| Document AST patterns | ⬜ | [ast-patterns.md](./ast-patterns.md) |
| Detect transformable files | ⬜ | [file-detection.md](./file-detection.md) |

### Phase B: Module Wrapper

| Task | Status | File |
|------|--------|------|
| Inject module start/end | ⬜ | [module-injection.md](./module-injection.md) |
| Import statement handling | ⬜ | [import-handling.md](./import-handling.md) |

### Phase C: Observable Wrapping

| Task | Status | File |
|------|--------|------|
| Variable declaration detection | ⬜ | [var-decl-detection.md](./var-decl-detection.md) |
| Key generation (stable hash) | ⬜ | [key-generation.md](./key-generation.md) |
| MagicString transforms | ⬜ | [observable-transforms.md](./observable-transforms.md) |

### Phase D: Subscription Wrapping

| Task | Status | File |
|------|--------|------|
| Subscribe call detection | ⬜ | [subscribe-detection.md](./subscribe-detection.md) |
| Subscription key generation | ⬜ | [subscription-transforms.md](./subscription-transforms.md) |

### Phase E: Testing

| Task | Status | File |
|------|--------|------|
| Transform unit tests | ⬜ | [transform-tests.md](./transform-tests.md) |
| Integration tests | ⬜ | [integration-tests.md](./integration-tests.md) |

---

## Architecture

```
User Code (before transform)
┌────────────────────────────────────────────────┐
│ import { map } from 'rxjs'                     │
│ const data$ = of(1, 2, 3).pipe(map(x => x*2)) │
│ data$.subscribe(console.log)                   │
└────────────────────────────────────────────────┘
                    ↓ Vite Plugin
User Code (after transform)
┌────────────────────────────────────────────────┐
│ import { _rxjs_debugger_module_start }         │
│   from "rxjs-debugger/hmr"                     │
│ const __$ = _rxjs_debugger_module_start(       │
│   import.meta.url)                             │
│ import { map } from 'rxjs'                     │
│ const data$ = __$("data$:a1b2c3",              │
│   () => of(1, 2, 3).pipe(map(x => x*2)))      │
│ __$.sub("sub:d4e5f6",                          │
│   () => data$.subscribe(console.log))          │
│ __$.end()                                      │
└────────────────────────────────────────────────┘
```

---

## Detection Rules

### Files to Transform
- `*.ts`, `*.tsx`, `*.js`, `*.jsx` in project
- Has RxJS imports OR uses Observable patterns
- NOT in `node_modules` (except rxjs - already handled)
- NOT `.d.ts` files
- NOT test files (configurable)

### Observable Patterns to Wrap

| Pattern | AST Node | Priority |
|---------|----------|----------|
| `of(...)` | CallExpression, callee = Identifier | P1 |
| `from(...)` | CallExpression, callee = Identifier | P1 |
| `new Subject()` | NewExpression | P1 |
| `new BehaviorSubject(x)` | NewExpression | P1 |
| `source$.pipe(...)` | CallExpression, callee.property = "pipe" | P1 |
| `interval(...)` | CallExpression, callee = Identifier | P2 |
| `timer(...)` | CallExpression, callee = Identifier | P2 |
| `merge(...)` | CallExpression, callee = Identifier | P2 |
| `combineLatest(...)` | CallExpression, callee = Identifier | P2 |

### Subscription Patterns to Wrap

| Pattern | AST Node |
|---------|----------|
| `obs$.subscribe(...)` | CallExpression, callee.property = "subscribe" |
| `obs$.subscribe({ next, error, complete })` | Same |
| `obs$.forEach(...)` | CallExpression, callee.property = "forEach" |

---

## Key Generation Strategy

Keys must be **stable across HMR** (line number changes shouldn't invalidate).

**Option A: Variable name + content hash**
```
key = `${varName}:${hash(initExpression)}`
// "data$:a1b2c3" where a1b2c3 = hash of "of(1,2,3).pipe(map(x=>x*2))"
```

**Option B: Variable name only (per-module unique)**
```
key = varName
// Works if variable names are unique per module
```

**Option C: Full path hash**
```
key = hash(module + varName + initExpression)
```

**Recommendation**: Option A - content hash ensures structural changes create new tracks (HMR orphan cleanup works)

---

## Edge Cases

### Handled
- Nested scopes (`__$` passes child `$` to factory)
- Subject bi-sync (runtime handles)
- defer() lazy factories (runtime handles)

### Deferred
- Destructuring: `const { data$ } = obj` - can't statically determine value
- Conditional: `const x$ = flag ? a$ : b$` - multiple branches
- Array spread: `const [a$, b$] = obs` - dynamic
- Dynamic property: `obj[key] = of(1)` - computed key

### Won't Handle
- eval/dynamic code
- Observables from untyped imports
- Third-party library internal observables

---

## Files to Create/Modify

**Modify**:
- `src/vite-plugin/v2.ts` - Add user code transform hook

**Create**:
- `src/vite-plugin/user-transform.ts` - User code transformation logic
- `src/vite-plugin/ast-utils.ts` - AST detection helpers
- `src/vite-plugin/__tests__/user-transform.test.ts` - Transform tests
