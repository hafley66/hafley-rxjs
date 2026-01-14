# Module Wrapper Injection

**Priority**: P1 - Phase B
**Status**: Not Started
**Depends on**: [file-detection.md](./file-detection.md)

---

## Goal

Inject module lifecycle wrapper around user code files that contain RxJS patterns.

---

## Transform

**Before**:
```typescript
import { map } from 'rxjs'
import { fetchData } from './api'

const data$ = of(1, 2, 3)
data$.subscribe(console.log)
```

**After**:
```typescript
import { _rxjs_debugger_module_start } from "rxjs-debugger/hmr"
const __$ = _rxjs_debugger_module_start(import.meta.url)
import { map } from 'rxjs'
import { fetchData } from './api'

const data$ = __$("data$:abc", () => of(1, 2, 3))
__$.sub("sub:def", () => data$.subscribe(console.log))
__$.end()
```

---

## Implementation Steps

### 1. Detect if file needs transformation

```typescript
function needsTransform(code: string): boolean {
  // Quick check: has rxjs import or known patterns
  return /from ['"]rxjs/.test(code) ||
         /new (Subject|BehaviorSubject|ReplaySubject)/.test(code) ||
         /\.(pipe|subscribe)\s*\(/.test(code)
}
```

### 2. Find insertion points

```typescript
interface InsertionPoints {
  moduleStartAfter: number  // After last import, before first statement
  moduleEndBefore: number   // End of file
}

function findInsertionPoints(ast: Program): InsertionPoints {
  let lastImportEnd = 0

  for (const stmt of ast.body) {
    if (stmt.type === 'ImportDeclaration') {
      lastImportEnd = stmt.end
    } else {
      break  // First non-import
    }
  }

  return {
    moduleStartAfter: lastImportEnd,
    moduleEndBefore: ast.end
  }
}
```

### 3. Inject wrapper

```typescript
const DEBUGGER_IMPORT = `import { _rxjs_debugger_module_start } from "rxjs-debugger/hmr"\n`
const MODULE_START = `const __$ = _rxjs_debugger_module_start(import.meta.url)\n`
const MODULE_END = `\n__$.end()`

function injectModuleWrapper(ms: MagicString, points: InsertionPoints): void {
  // Prepend debugger import at very start
  ms.prepend(DEBUGGER_IMPORT)

  // Insert __$ initialization after imports
  ms.appendRight(points.moduleStartAfter, `\n${MODULE_START}`)

  // Append __$.end() at file end
  ms.appendLeft(points.moduleEndBefore, MODULE_END)
}
```

---

## Edge Cases

### No imports in file
```typescript
// File with no imports
const data$ = globalRxjs.of(1)
```
→ Insert at very start of file

### Default export at end
```typescript
export default Component
```
→ Insert `__$.end()` before final export? Or after? (After is fine, export is hoisted conceptually)

### Re-exports only
```typescript
export { foo } from './foo'
export * from './bar'
```
→ Skip transformation (no runtime code)

### Already has __$
```typescript
// Manually instrumented
const __$ = _rxjs_debugger_module_start(...)
```
→ Skip transformation (detect by presence of `_rxjs_debugger_module_start`)

---

## Vite Plugin Hook

```typescript
// In v2.ts
transform(code, id) {
  // ... existing RxJS library transforms ...

  // User code transform
  if (isUserCode(id) && needsTransform(code)) {
    return transformUserCode(code, id)
  }
}

function isUserCode(id: string): boolean {
  const cleanId = id.split('?')[0]
  return !cleanId.includes('node_modules') &&
         !cleanId.endsWith('.d.ts') &&
         /\.(tsx?|jsx?)$/.test(cleanId)
}
```

---

## Files

**Modify**: `src/vite-plugin/v2.ts`
**Create**: `src/vite-plugin/user-transform.ts`

---

## Tests

```typescript
describe('module injection', () => {
  it('injects import at file start', () => {
    const input = `import { map } from 'rxjs'\nconst x = 1`
    const output = transform(input)
    expect(output).toMatch(/^import.*_rxjs_debugger_module_start/)
  })

  it('injects __$ after last import', () => {
    const input = `import { a } from 'a'\nimport { b } from 'b'\ncode()`
    const output = transform(input)
    expect(output).toContain("import { b } from 'b'\nconst __$ =")
  })

  it('injects __$.end() at file end', () => {
    const input = `const x = 1`
    const output = transform(input)
    expect(output).toMatch(/__\$\.end\(\)\s*$/)
  })

  it('skips already instrumented files', () => {
    const input = `const __$ = _rxjs_debugger_module_start(import.meta.url)`
    const output = transform(input)
    expect(output).toBe(input)  // Unchanged
  })
})
```
