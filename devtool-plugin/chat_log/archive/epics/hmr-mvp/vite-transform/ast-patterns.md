# AST Patterns Catalog

**Priority**: P1 - Foundation
**Status**: Not Started
**Blocks**: All transform tasks

---

## Goal

Document every AST pattern that needs transformation, with oxc-parser node types and transform templates.

---

## RxJS Creation Functions

These produce new Observable instances. Wrap with `__$()`.

```typescript
const RXJS_CREATORS = new Set([
  // Core
  'of', 'from', 'fromEvent', 'fromEventPattern',
  'interval', 'timer', 'defer', 'generate',

  // Combination
  'merge', 'concat', 'race', 'zip', 'forkJoin',
  'combineLatest', 'combineLatestWith',

  // Creation
  'range', 'iif', 'throwError', 'EMPTY', 'NEVER',

  // Ajax
  'ajax',

  // Web
  'webSocket',
])
```

**AST Pattern**:
```
CallExpression {
  callee: Identifier { name: <in RXJS_CREATORS> }
  arguments: [...]
}
```

**Transform**:
```typescript
// Before
const data$ = of(1, 2, 3)

// After
const data$ = __$("data$:abc123", () => of(1, 2, 3))
```

---

## Subject Constructors

These produce hot observables. Wrap with `__$()`.

```typescript
const SUBJECT_CLASSES = new Set([
  'Subject',
  'BehaviorSubject',
  'ReplaySubject',
  'AsyncSubject',
])
```

**AST Pattern**:
```
NewExpression {
  callee: Identifier { name: <in SUBJECT_CLASSES> }
  arguments: [...]  // BehaviorSubject has initial value
}
```

**Transform**:
```typescript
// Before
const trigger$ = new Subject<string>()
const state$ = new BehaviorSubject(initialValue)

// After
const trigger$ = __$("trigger$:def456", () => new Subject<string>())
const state$ = __$("state$:ghi789", () => new BehaviorSubject(initialValue))
```

---

## Pipe Chains

Pipe creates new observable from source. Wrap if assigned to variable.

**AST Pattern**:
```
CallExpression {
  callee: MemberExpression {
    object: <any observable expression>
    property: Identifier { name: "pipe" }
  }
  arguments: [...operators]
}
```

**Transform**:
```typescript
// Before
const mapped$ = source$.pipe(map(x => x * 2), filter(x => x > 0))

// After
const mapped$ = __$("mapped$:jkl012", () => source$.pipe(map(x => x * 2), filter(x => x > 0)))
```

**Edge case**: Don't double-wrap if source is already wrapped
```typescript
// This should NOT happen:
const result$ = __$("result$", () => __$("source$", () => of(1)).pipe(map(x => x)))
```

---

## Variable Declarations

The wrapper pattern targets variable declarations.

**AST Pattern**:
```
VariableDeclaration {
  declarations: [
    VariableDeclarator {
      id: Identifier { name: "varName$" }
      init: <observable expression>
    }
  ]
}
```

**Detection Logic**:
```typescript
function isObservableInit(init: Expression): boolean {
  // Creation call?
  if (init.type === 'CallExpression' &&
      init.callee.type === 'Identifier' &&
      RXJS_CREATORS.has(init.callee.name)) {
    return true
  }

  // Subject constructor?
  if (init.type === 'NewExpression' &&
      init.callee.type === 'Identifier' &&
      SUBJECT_CLASSES.has(init.callee.name)) {
    return true
  }

  // Pipe call?
  if (init.type === 'CallExpression' &&
      init.callee.type === 'MemberExpression' &&
      init.callee.property.name === 'pipe') {
    return true
  }

  return false
}
```

---

## Subscribe Calls

Subscription creation. Wrap with `__$.sub()`.

**AST Pattern**:
```
CallExpression {
  callee: MemberExpression {
    object: <observable expression>
    property: Identifier { name: "subscribe" }
  }
  arguments: [...] // observer or callbacks
}
```

**Contexts**:
```typescript
// Statement expression (most common)
data$.subscribe(console.log)
// → __$.sub("sub:xyz", () => data$.subscribe(console.log))

// Assignment
const sub = data$.subscribe(console.log)
// → const sub = __$.sub("sub:xyz", () => data$.subscribe(console.log))

// In effect/callback
useEffect(() => {
  data$.subscribe(console.log)
}, [])
// → useEffect(() => { __$.sub("sub:xyz", () => data$.subscribe(console.log)) }, [])
```

---

## Skip Patterns

Don't transform these:

```typescript
// Already wrapped (has __$ marker)
__$("key", () => of(1))

// Inside __$ factory (child scope handles)
__$("outer", $ => {
  return $("inner", () => of(1))  // Already scoped
})

// RxJS internal imports (handled by v2.ts)
import { Observable } from 'rxjs/internal/Observable'

// Type annotations (not runtime)
type MyObs = Observable<number>

// Test files (configurable)
*.test.ts, *.spec.ts
```

---

## Complex Patterns (Deferred)

### Conditional Assignment
```typescript
const obs$ = condition ? of(1) : of(2)
// Could wrap: __$("obs$", () => condition ? of(1) : of(2))
// But condition evaluated at transform time vs runtime - semantic difference
```

### Destructuring
```typescript
const { data$, error$ } = getObservables()
// Can't determine if values are observables statically
```

### Object Property
```typescript
const config = {
  data$: of(1)
}
// Would need deep AST walk into object literal
```

### Higher-Order Return
```typescript
const makeObs = () => of(1)
const obs$ = makeObs()
// Factory call should be wrapped at call site, not definition
```

---

## Key Generation

For each wrapped expression, generate stable key:

```typescript
function generateKey(varName: string, initAst: Node): string {
  const contentHash = hash(serializeAst(initAst)).slice(0, 8)
  return `${varName}:${contentHash}`
}
```

**Hash input**: Normalized AST (strip locations, whitespace)
**Hash output**: 8-char hex (2^32 collision space)

---

## Deliverables

1. `src/vite-plugin/ast-patterns.ts` - Pattern detection functions
2. `src/vite-plugin/__tests__/ast-patterns.test.ts` - Pattern detection tests
3. Update this doc with findings during implementation
