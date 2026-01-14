# Transform Test Suite

**Priority**: P1 - Phase E
**Status**: Not Started
**Depends on**: All Phase A-D tasks

---

## Goal

Comprehensive test suite for user code transforms, ensuring correctness and stability.

---

## Test File Structure

```
src/vite-plugin/__tests__/
├── v2.test.ts                    # Existing rxjs lib tests
├── user-transform.test.ts        # NEW: Integration tests
├── file-detection.test.ts        # NEW: Detection logic
├── key-generator.test.ts         # NEW: Key generation
├── observable-transform.test.ts  # NEW: Observable wrapping
└── subscription-transform.test.ts # NEW: Subscription wrapping
```

---

## Test Categories

### 1. File Detection Tests

```typescript
describe('file detection', () => {
  describe('mightNeedTransform', () => {
    it.each([
      [`import { of } from 'rxjs'`, true],
      [`new Subject()`, true],
      [`data$.pipe(map)`, true],
      [`data$.subscribe()`, true],
      [`const x = 1`, false],
      [`import React from 'react'`, false],
    ])('detects %s → %s', (code, expected) => {
      expect(mightNeedTransform(code)).toBe(expected)
    })
  })

  describe('isTransformableFile', () => {
    it.each([
      ['src/app.ts', true],
      ['src/app.tsx', true],
      ['src/app.d.ts', false],
      ['node_modules/foo/bar.ts', false],
      ['src/app.test.ts', false],  // with skipTests: true
    ])('file %s → %s', (path, expected) => {
      expect(isTransformableFile(path, { skipTests: true })).toBe(expected)
    })
  })
})
```

### 2. Key Generation Tests

```typescript
describe('key generation', () => {
  it('produces stable keys across whitespace changes', () => {
    const key1 = generateKey('x$', 'of(1, 2)')
    const key2 = generateKey('x$', 'of( 1,  2 )')
    expect(key1).toBe(key2)
  })

  it('produces different keys for different content', () => {
    const key1 = generateKey('x$', 'of(1)')
    const key2 = generateKey('x$', 'of(2)')
    expect(key1).not.toBe(key2)
  })

  it('includes variable name', () => {
    const key = generateKey('myData$', 'of(1)')
    expect(key).toMatch(/^myData\$:/)
  })
})
```

### 3. Observable Transform Tests

```typescript
describe('observable transforms', () => {
  const transform = (code: string) => transformUserCode(code, 'test.ts')

  describe('creation functions', () => {
    it.each([
      'of(1, 2, 3)',
      'from([1, 2, 3])',
      'interval(1000)',
      'timer(1000)',
      'merge(a$, b$)',
      'combineLatest([a$, b$])',
      'defer(() => of(1))',
    ])('wraps %s', (expr) => {
      const input = `const data$ = ${expr}`
      const output = transform(input)
      expect(output).toContain('__$("data$:')
      expect(output).toContain(`() => ${expr})`)
    })
  })

  describe('Subject constructors', () => {
    it.each([
      'new Subject()',
      'new Subject<number>()',
      'new BehaviorSubject(0)',
      'new ReplaySubject(1)',
      'new AsyncSubject()',
    ])('wraps %s', (expr) => {
      const input = `const trigger$ = ${expr}`
      const output = transform(input)
      expect(output).toContain('__$("trigger$:')
    })
  })

  describe('pipe chains', () => {
    it('wraps simple pipe', () => {
      const input = `const mapped$ = source$.pipe(map(x => x))`
      const output = transform(input)
      expect(output).toContain('__$("mapped$:')
    })

    it('wraps multi-operator pipe', () => {
      const input = `const result$ = data$.pipe(
        map(x => x * 2),
        filter(x => x > 0),
        take(10)
      )`
      const output = transform(input)
      expect(output).toContain('__$("result$:')
    })
  })

  describe('edge cases', () => {
    it('handles multiple declarations', () => {
      const input = `const a$ = of(1), b$ = of(2)`
      const output = transform(input)
      expect(output).toMatch(/__\$\("a\$:/)
      expect(output).toMatch(/__\$\("b\$:/)
    })

    it('preserves type annotations', () => {
      const input = `const data$: Observable<number> = of(1)`
      const output = transform(input)
      expect(output).toContain(': Observable<number> = __$(')
    })

    it('handles export declarations', () => {
      const input = `export const data$ = of(1)`
      const output = transform(input)
      expect(output).toContain('export const data$ = __$(')
    })
  })
})
```

### 4. Subscription Transform Tests

```typescript
describe('subscription transforms', () => {
  const transform = (code: string) => transformUserCode(code, 'test.ts')

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
    const input = `data$.pipe(map(x => x)).subscribe(fn)`
    const output = transform(input)
    expect(output).toContain('__$.sub(')
    expect(output).toContain('.pipe(map(x => x)).subscribe')
  })
})
```

### 5. Integration Tests

```typescript
describe('full transform', () => {
  it('transforms complete module', () => {
    const input = `
import { map } from 'rxjs'

const data$ = of(1, 2, 3)
const mapped$ = data$.pipe(map(x => x * 2))
mapped$.subscribe(console.log)
`
    const output = transformUserCode(input, 'test.ts')

    expect(output).toMatchInlineSnapshot(`
      "import { _rxjs_debugger_module_start } from \\"rxjs-debugger/hmr\\"
      const __$ = _rxjs_debugger_module_start(import.meta.url)
      import { map } from 'rxjs'

      const data$ = __$(\\"data$:abc\\", () => of(1, 2, 3))
      const mapped$ = __$(\\"mapped$:def\\", () => data$.pipe(map(x => x * 2)))
      __$.sub(\\"sub:ghi\\", () => mapped$.subscribe(console.log))
      __$.end()"
    `)
  })

  it('skips already instrumented files', () => {
    const input = `
const __$ = _rxjs_debugger_module_start(import.meta.url)
const data$ = __$("data$", () => of(1))
`
    const output = transformUserCode(input, 'test.ts')
    expect(output).toBe(input)
  })
})
```

### 6. Snapshot Tests

For complex transforms, use snapshots:

```typescript
describe('transform snapshots', () => {
  it.each([
    'basic-observable',
    'subject-creation',
    'pipe-chain',
    'multiple-subscriptions',
    'react-component',
    'nested-callbacks',
  ])('transforms %s correctly', (fixture) => {
    const input = readFixture(`${fixture}.input.ts`)
    const output = transformUserCode(input, `${fixture}.ts`)
    expect(output).toMatchSnapshot()
  })
})
```

---

## Fixture Files

Create test fixtures in `src/vite-plugin/__tests__/fixtures/`:

```
fixtures/
├── basic-observable.input.ts
├── subject-creation.input.ts
├── pipe-chain.input.ts
├── multiple-subscriptions.input.ts
├── react-component.input.ts
└── nested-callbacks.input.ts
```

---

## Coverage Goals

| Area | Target |
|------|--------|
| File detection | 100% |
| Key generation | 100% |
| Observable wrapping | 95% |
| Subscription wrapping | 95% |
| Integration | 90% |
| Edge cases | 80% |
