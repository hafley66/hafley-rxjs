# Key Generation Strategy

**Priority**: P1 - Phase C
**Status**: Not Started

---

## Goal

Generate stable, unique keys for `__$()` wrappers that survive HMR code changes.

---

## Requirements

1. **Stable across HMR**: Same observable structure → same key
2. **Unique per module**: No collisions within a file
3. **Deterministic**: Same input always produces same key
4. **Semantic**: Key reflects what's tracked (variable name + structure)

---

## Key Format

```
${varName}:${contentHash}
```

Examples:
- `data$:a1b2c3d4`
- `trigger$:e5f6g7h8`
- `mapped$:i9j0k1l2`
- `sub:m3n4o5p6` (for subscriptions)

---

## Content Hash Algorithm

### Input: Normalized AST

Strip location info, normalize whitespace:

```typescript
function normalizeAst(node: Node): object {
  const clone = { ...node }
  delete clone.start
  delete clone.end
  delete clone.loc
  delete clone.range

  // Recursively normalize children
  for (const [key, value] of Object.entries(clone)) {
    if (Array.isArray(value)) {
      clone[key] = value.map(normalizeAst)
    } else if (typeof value === 'object' && value !== null) {
      clone[key] = normalizeAst(value)
    }
  }

  return clone
}
```

### Hash Function

Use FNV-1a (fast, good distribution):

```typescript
function fnv1aHash(str: string): string {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = (hash * 16777619) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function generateContentHash(node: Node): string {
  const normalized = normalizeAst(node)
  const json = JSON.stringify(normalized)
  return fnv1aHash(json)
}
```

---

## Key Generation Functions

### Observable Declaration

```typescript
function generateObservableKey(varName: string, initNode: Node): string {
  const hash = generateContentHash(initNode)
  return `${varName}:${hash}`
}

// Example:
// const data$ = of(1, 2, 3)
// → "data$:a1b2c3d4"
```

### Subscription

```typescript
function generateSubscriptionKey(subscribeNode: Node): string {
  const hash = generateContentHash(subscribeNode)
  return `sub:${hash}`
}

// Example:
// data$.subscribe(console.log)
// → "sub:e5f6g7h8"
```

---

## Collision Handling

With 32-bit hash, birthday problem gives ~50% collision at 77k items.
For per-module uniqueness, this is acceptable.

If collision detected (same key, different AST):
```typescript
function makeUniqueKey(baseKey: string, existingKeys: Set<string>): string {
  if (!existingKeys.has(baseKey)) {
    return baseKey
  }

  // Append counter
  let counter = 2
  while (existingKeys.has(`${baseKey}_${counter}`)) {
    counter++
  }
  return `${baseKey}_${counter}`
}
```

---

## Stability Examples

### Line number changes (stable)
```typescript
// Before (line 5)
const data$ = of(1, 2, 3)

// After (line 10, added comments above)
const data$ = of(1, 2, 3)

// Key: SAME (content unchanged)
// → "data$:a1b2c3d4"
```

### Argument changes (new key)
```typescript
// Before
const data$ = of(1, 2, 3)

// After
const data$ = of(1, 2, 3, 4)

// Key: DIFFERENT (content changed)
// Before: "data$:a1b2c3d4"
// After:  "data$:x9y8z7w6"
```

### Operator changes (new key)
```typescript
// Before
const mapped$ = source$.pipe(map(x => x * 2))

// After
const mapped$ = source$.pipe(map(x => x * 2), filter(x => x > 0))

// Key: DIFFERENT (operators changed)
```

### Whitespace/formatting (stable)
```typescript
// Before
const data$=of(1,2,3)

// After
const data$ = of( 1, 2, 3 )

// Key: SAME (AST structure unchanged)
```

---

## Edge Cases

### Anonymous observable
```typescript
return of(1)  // No variable name
// Key: "return:hash" or just "hash"
```

### Computed property
```typescript
obj[key] = of(1)  // Dynamic key
// Skip or use "computed:hash"
```

### Multiple same-name vars in different scopes
```typescript
function a() { const x$ = of(1) }
function b() { const x$ = of(2) }
// Keys differ due to content hash:
// "x$:hash1" and "x$:hash2"
```

---

## Files

**Create**: `src/vite-plugin/key-generator.ts`
**Test**: `src/vite-plugin/__tests__/key-generator.test.ts`

---

## Tests

```typescript
describe('key generation', () => {
  it('includes variable name', () => {
    const key = generateObservableKey('data$', parseExpr('of(1)'))
    expect(key).toMatch(/^data\$:/)
  })

  it('stable across whitespace changes', () => {
    const key1 = generateObservableKey('x$', parseExpr('of(1,2)'))
    const key2 = generateObservableKey('x$', parseExpr('of( 1, 2 )'))
    expect(key1).toBe(key2)
  })

  it('different for different content', () => {
    const key1 = generateObservableKey('x$', parseExpr('of(1)'))
    const key2 = generateObservableKey('x$', parseExpr('of(2)'))
    expect(key1).not.toBe(key2)
  })

  it('different for different operators', () => {
    const key1 = generateObservableKey('x$', parseExpr('s$.pipe(map(x=>x))'))
    const key2 = generateObservableKey('x$', parseExpr('s$.pipe(filter(x=>x))'))
    expect(key1).not.toBe(key2)
  })

  it('generates subscription keys', () => {
    const key = generateSubscriptionKey(parseExpr('x$.subscribe(fn)'))
    expect(key).toMatch(/^sub:/)
  })
})
```
