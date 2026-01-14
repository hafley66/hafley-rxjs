# Subscription Transforms

**Priority**: P1 - Phase D
**Status**: Not Started
**Depends on**: [module-injection.md](./module-injection.md)

---

## Goal

Wrap `.subscribe()` calls with `__$.sub()` for subscription tracking and HMR cleanup.

---

## Transform Examples

### Basic subscription
```typescript
// Before
data$.subscribe(console.log)

// After
__$.sub("sub:a1b2", () => data$.subscribe(console.log))
```

### Assignment to variable
```typescript
// Before
const subscription = data$.subscribe(handler)

// After
const subscription = __$.sub("sub:c3d4", () => data$.subscribe(handler))
```

### Observer object
```typescript
// Before
data$.subscribe({
  next: x => console.log(x),
  error: e => console.error(e),
  complete: () => console.log('done')
})

// After
__$.sub("sub:e5f6", () => data$.subscribe({
  next: x => console.log(x),
  error: e => console.error(e),
  complete: () => console.log('done')
}))
```

---

## Implementation

### Detection

```typescript
function findSubscribeCalls(ast: Program): SubscribeCall[] {
  const calls: SubscribeCall[] = []

  walk(ast, {
    CallExpression(node) {
      if (node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'subscribe') {
        calls.push({
          start: node.start,
          end: node.end,
          node,
        })
      }
    }
  })

  return calls
}
```

### Transform

```typescript
function transformSubscribeCalls(
  ms: MagicString,
  calls: SubscribeCall[]
): void {
  for (const call of calls.reverse()) {
    const key = generateSubscriptionKey(call)

    // Wrap: expr.subscribe(...) → __$.sub("key", () => expr.subscribe(...))
    ms.appendLeft(call.start, `__$.sub("${key}", () => `)
    ms.appendRight(call.end, `)`)
  }
}
```

---

## Key Generation

Subscription keys need to be unique but stable:

```typescript
function generateSubscriptionKey(call: SubscribeCall): string {
  // Option 1: Line:column based
  return `sub:${call.node.loc.start.line}:${call.node.loc.start.column}`

  // Option 2: Content hash (more stable across line changes)
  const sourceText = getSourceText(call.start, call.end)
  return `sub:${hash(sourceText).slice(0, 6)}`
}
```

**Recommendation**: Content hash - stable across line number changes

---

## Edge Cases

### Chained after operators
```typescript
// Before
data$.pipe(map(x => x * 2)).subscribe(console.log)

// After
__$.sub("sub:x", () => data$.pipe(map(x => x * 2)).subscribe(console.log))
```
Note: The whole chain is wrapped, not just `.subscribe()`

### Inside callback
```typescript
// Before
useEffect(() => {
  data$.subscribe(console.log)
  return () => sub.unsubscribe()
}, [])

// After
useEffect(() => {
  __$.sub("sub:x", () => data$.subscribe(console.log))
  return () => sub.unsubscribe()
}, [])
```

### Conditional subscription
```typescript
// Before
if (condition) {
  data$.subscribe(console.log)
}

// After
if (condition) {
  __$.sub("sub:x", () => data$.subscribe(console.log))
}
```

### forEach (alternative subscription)
```typescript
// Before
await data$.forEach(console.log)

// After
await __$.sub("forEach:x", () => data$.forEach(console.log))
```

---

## Skip Rules

Don't wrap if:

1. **Already inside `__$.sub()`**
   ```typescript
   __$.sub("x", () => data$.subscribe(...))  // Already wrapped
   ```

2. **Inside `__$` factory body**
   ```typescript
   __$("obs", () => {
     inner$.subscribe(...)  // Part of creation, not external subscription
   })
   ```

3. **Internal RxJS subscription**
   ```typescript
   // Inside operator implementation (in node_modules)
   source.subscribe(new OperatorSubscriber(...))
   ```

---

## Files

**Create**: `src/vite-plugin/subscription-transform.ts`
**Test**: `src/vite-plugin/__tests__/subscription-transform.test.ts`

---

## Tests

```typescript
describe('subscription transforms', () => {
  it('wraps basic subscribe', () => {
    const input = `data$.subscribe(console.log)`
    const output = transform(input)
    expect(output).toMatch(/__\$\.sub\("sub:.*", \(\) => data\$\.subscribe/)
  })

  it('wraps subscribe with assignment', () => {
    const input = `const sub = data$.subscribe(handler)`
    const output = transform(input)
    expect(output).toContain('const sub = __$.sub(')
  })

  it('wraps observer object', () => {
    const input = `data$.subscribe({ next: x => x })`
    const output = transform(input)
    expect(output).toContain('__$.sub(')
  })

  it('wraps chained subscribe', () => {
    const input = `data$.pipe(map(x => x)).subscribe(console.log)`
    const output = transform(input)
    expect(output).toContain('__$.sub(')
    expect(output).toContain('.pipe(map(x => x)).subscribe')
  })

  it('wraps forEach', () => {
    const input = `data$.forEach(console.log)`
    const output = transform(input)
    expect(output).toContain('__$.sub(')
  })

  it('skips already wrapped', () => {
    const input = `__$.sub("x", () => data$.subscribe(console.log))`
    const output = transform(input)
    expect(output.match(/__\$\.sub/g)?.length).toBe(1)
  })
})
```
