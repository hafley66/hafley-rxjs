# Observable Declaration Transforms

**Priority**: P1 - Phase C
**Status**: Not Started
**Depends on**: [module-injection.md](./module-injection.md), [key-generation.md](./key-generation.md)

---

## Goal

Wrap observable variable declarations with `__$()` for HMR tracking.

---

## Transform Examples

### Creation Functions
```typescript
// Before
const data$ = of(1, 2, 3)

// After
const data$ = __$("data$:a1b2", () => of(1, 2, 3))
```

### Subject Constructors
```typescript
// Before
const trigger$ = new Subject<void>()
const state$ = new BehaviorSubject({ count: 0 })

// After
const trigger$ = __$("trigger$:c3d4", () => new Subject<void>())
const state$ = __$("state$:e5f6", () => new BehaviorSubject({ count: 0 }))
```

### Pipe Chains
```typescript
// Before
const mapped$ = source$.pipe(
  map(x => x * 2),
  filter(x => x > 0)
)

// After
const mapped$ = __$("mapped$:g7h8", () => source$.pipe(
  map(x => x * 2),
  filter(x => x > 0)
))
```

---

## Implementation

### AST Walking

```typescript
import { parseSync } from 'oxc-parser'

function findObservableDeclarations(ast: Program): ObservableDecl[] {
  const declarations: ObservableDecl[] = []

  walk(ast, {
    VariableDeclarator(node) {
      if (node.id.type === 'Identifier' && node.init) {
        if (isObservableExpression(node.init)) {
          declarations.push({
            varName: node.id.name,
            initStart: node.init.start,
            initEnd: node.init.end,
            initNode: node.init,
          })
        }
      }
    }
  })

  return declarations
}
```

### Observable Detection

```typescript
function isObservableExpression(node: Expression): boolean {
  // Creation function call
  if (node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      RXJS_CREATORS.has(node.callee.name)) {
    return true
  }

  // Subject constructor
  if (node.type === 'NewExpression' &&
      node.callee.type === 'Identifier' &&
      SUBJECT_CLASSES.has(node.callee.name)) {
    return true
  }

  // Pipe call on observable
  if (node.type === 'CallExpression' &&
      node.callee.type === 'MemberExpression' &&
      node.callee.property.type === 'Identifier' &&
      node.callee.property.name === 'pipe') {
    return true
  }

  return false
}
```

### Transform Application

```typescript
function transformObservableDeclarations(
  ms: MagicString,
  declarations: ObservableDecl[]
): void {
  // Process in reverse order to preserve positions
  for (const decl of declarations.reverse()) {
    const key = generateKey(decl.varName, decl.initNode)

    // Wrap: init → __$("key", () => init)
    ms.appendLeft(decl.initStart, `__$("${key}", () => `)
    ms.appendRight(decl.initEnd, `)`)
  }
}
```

---

## Edge Cases

### Multiple declarations in one statement
```typescript
// Before
const a$ = of(1), b$ = of(2)

// After
const a$ = __$("a$:x", () => of(1)), b$ = __$("b$:y", () => of(2))
```

### let vs const
```typescript
// Before
let data$ = of(1)
data$ = of(2)  // Reassignment

// After
let data$ = __$("data$:x", () => of(1))
data$ = __$("data$:y", () => of(2))  // Different key (different content hash)
```

### Export declarations
```typescript
// Before
export const data$ = of(1)

// After
export const data$ = __$("data$:x", () => of(1))
```

### Type annotations preserved
```typescript
// Before
const data$: Observable<number> = of(1)

// After
const data$: Observable<number> = __$("data$:x", () => of(1))
```

---

## Skip Rules

Don't wrap if:

1. **Inside `__$` factory already**
   ```typescript
   __$("outer", () => {
     const inner$ = of(1)  // DON'T wrap - parent scope handles
   })
   ```

2. **In function/arrow body (wrap at call site)**
   ```typescript
   const makeObs = () => of(1)  // DON'T wrap definition
   const obs$ = makeObs()  // DO wrap call site
   ```

3. **Return statement in function**
   ```typescript
   function getObs() {
     return of(1)  // DON'T wrap - caller wraps
   }
   ```

4. **Callback argument**
   ```typescript
   someFunc(() => of(1))  // DON'T wrap - unclear identity
   ```

---

## Files

**Create**: `src/vite-plugin/observable-transform.ts`
**Test**: `src/vite-plugin/__tests__/observable-transform.test.ts`

---

## Tests

```typescript
describe('observable transforms', () => {
  it('wraps of() call', () => {
    const input = `const data$ = of(1, 2, 3)`
    const output = transform(input)
    expect(output).toContain('__$("data$:')
    expect(output).toContain('() => of(1, 2, 3))')
  })

  it('wraps new Subject()', () => {
    const input = `const trigger$ = new Subject<void>()`
    const output = transform(input)
    expect(output).toContain('__$("trigger$:')
  })

  it('wraps pipe chains', () => {
    const input = `const mapped$ = source$.pipe(map(x => x))`
    const output = transform(input)
    expect(output).toContain('__$("mapped$:')
  })

  it('handles multiple declarations', () => {
    const input = `const a$ = of(1), b$ = of(2)`
    const output = transform(input)
    expect(output).toMatch(/__\$\("a\$:.*"\)/)
    expect(output).toMatch(/__\$\("b\$:.*"\)/)
  })

  it('preserves type annotations', () => {
    const input = `const data$: Observable<number> = of(1)`
    const output = transform(input)
    expect(output).toContain(': Observable<number> = __$(')
  })

  it('skips inside __$ factory', () => {
    const input = `__$("outer", () => { const inner$ = of(1) })`
    const output = transform(input)
    // Should not double-wrap
    expect(output.match(/__\$/g)?.length).toBe(1)
  })
})
```
