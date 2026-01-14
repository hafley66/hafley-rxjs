# Transformable File Detection

**Priority**: P1 - Phase A
**Status**: Not Started

---

## Goal

Determine which files need user code transformation (module wrapper + observable/subscription wrapping).

---

## Detection Criteria

### Include if:
1. File extension is `.ts`, `.tsx`, `.js`, `.jsx`
2. File contains RxJS patterns (imports or usage)
3. File is user code (not in node_modules, except rxjs)

### Exclude if:
1. File is `.d.ts` (type declarations)
2. File is in `node_modules` (handled separately for rxjs)
3. File is already instrumented (`_rxjs_debugger_module_start` present)
4. File is test file (configurable via options)
5. File explicitly excluded via config

---

## Implementation

### Quick Pre-check (Regex)

Before parsing, do fast string check:

```typescript
function mightNeedTransform(code: string): boolean {
  // Has rxjs import?
  if (/from ['"]rxjs/.test(code)) return true

  // Has Subject usage?
  if (/new\s+(Subject|BehaviorSubject|ReplaySubject|AsyncSubject)/.test(code)) return true

  // Has observable patterns?
  if (/\.(pipe|subscribe)\s*\(/.test(code)) return true

  // Has creation functions?
  if (/\b(of|from|interval|timer|merge|combineLatest)\s*\(/.test(code)) return true

  return false
}
```

### File Path Checks

```typescript
function isTransformableFile(id: string, options: PluginOptions): boolean {
  const cleanId = id.split('?')[0]

  // Must be JS/TS
  if (!/\.(tsx?|jsx?)$/.test(cleanId)) return false

  // Skip type declarations
  if (cleanId.endsWith('.d.ts')) return false

  // Skip node_modules (rxjs handled separately)
  if (cleanId.includes('node_modules')) return false

  // Check exclude patterns
  if (options.exclude?.some(pattern => minimatch(cleanId, pattern))) {
    return false
  }

  // Check include patterns (if specified)
  if (options.include?.length) {
    return options.include.some(pattern => minimatch(cleanId, pattern))
  }

  return true
}
```

### Already Instrumented Check

```typescript
function isAlreadyInstrumented(code: string): boolean {
  return code.includes('_rxjs_debugger_module_start')
}
```

---

## Plugin Options

```typescript
interface RxjsDebuggerPluginOptions {
  // Existing
  debug?: boolean
  patchModulePath?: string

  // New for user transforms
  transformUserCode?: boolean  // default: true
  include?: string[]          // glob patterns to include
  exclude?: string[]          // glob patterns to exclude
  skipTests?: boolean         // default: true, skip *.test.*, *.spec.*
}
```

### Default Test Exclusions

```typescript
const DEFAULT_TEST_PATTERNS = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/__tests__/**',
  '**/__mocks__/**',
]
```

---

## Transform Flow

```typescript
// In v2.ts transform hook
transform(code, id) {
  const cleanId = id.split('?')[0]

  // 1. Existing RxJS library transforms
  if (cleanId.includes('/rxjs/')) {
    return transformRxjsLibrary(code, cleanId)
  }

  // 2. User code transforms
  if (options.transformUserCode !== false &&
      isTransformableFile(cleanId, options) &&
      mightNeedTransform(code) &&
      !isAlreadyInstrumented(code)) {
    return transformUserCode(code, cleanId)
  }

  return null
}
```

---

## Edge Cases

### Virtual modules
```typescript
// Vite virtual modules have special IDs
if (id.startsWith('\0') || id.startsWith('virtual:')) {
  return false  // Skip virtual modules
}
```

### Query strings
```typescript
// Vite adds query strings for HMR
// id = "/path/to/file.ts?t=123456"
const cleanId = id.split('?')[0]
```

### Symlinks
```typescript
// Some monorepos use symlinks
// Use fs.realpathSync if needed for node_modules check
```

### CSS-in-JS
```typescript
// Some files import .css but have JS
// Should still be transformed if they have rxjs patterns
```

---

## Files

**Modify**: `src/vite-plugin/v2.ts` - Add user code detection
**Create**: `src/vite-plugin/file-detection.ts` - Detection logic

---

## Tests

```typescript
describe('file detection', () => {
  it('includes .ts files with rxjs import', () => {
    const code = `import { of } from 'rxjs'\nconst x = 1`
    expect(mightNeedTransform(code)).toBe(true)
  })

  it('includes files with Subject usage', () => {
    const code = `const s = new Subject()`
    expect(mightNeedTransform(code)).toBe(true)
  })

  it('excludes .d.ts files', () => {
    expect(isTransformableFile('foo.d.ts', {})).toBe(false)
  })

  it('excludes node_modules', () => {
    expect(isTransformableFile('node_modules/foo/bar.ts', {})).toBe(false)
  })

  it('excludes test files by default', () => {
    const options = { skipTests: true }
    expect(isTransformableFile('foo.test.ts', options)).toBe(false)
    expect(isTransformableFile('foo.spec.ts', options)).toBe(false)
  })

  it('respects exclude patterns', () => {
    const options = { exclude: ['**/legacy/**'] }
    expect(isTransformableFile('src/legacy/old.ts', options)).toBe(false)
  })

  it('skips already instrumented', () => {
    const code = `const __$ = _rxjs_debugger_module_start(import.meta.url)`
    expect(isAlreadyInstrumented(code)).toBe(true)
  })
})
```
