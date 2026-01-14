# Task 1: Stack Trace Parser

## Objective
Create utility to parse JavaScript stack traces and extract file location + variable name context.

## File to Create
`src/tracking/stack-parser.ts`

## Requirements

### Function 1: `parseStackTrace(stack: string): StackInfo`

Parse Error().stack to extract:
- File path
- Line number  
- Column number
- Function/variable context if available

Return type:
```typescript
interface StackInfo {
  filePath: string;      // '/path/to/file.ts'
  line: number;          // 42
  column: number;        // 15
  context?: string;      // 'myObservable$' or 'MyComponent.method'
}
```

### Implementation Notes

Stack trace format varies by engine:
- V8 (Chrome/Node): `at functionName (file:///path/to/file.ts:42:15)`
- SpiderMonkey (Firefox): `functionName@file:///path/to/file.ts:42:15`
- JavaScriptCore (Safari): `functionName@file:///path/to/file.ts:42:15`

**Focus on V8 format for MVP**, note others in comments as TODO.

### Parsing Strategy

1. Get stack lines: `stack.split('\n')`
2. Skip first line (it's "Error") 
3. Find first line that's NOT from our tracking code (avoid recursion)
4. Extract with regex:
   - `at (.+?) \((.+?):(\d+):(\d+)\)` for V8 format
   - Group 1 = context/function name
   - Group 2 = file path (may include `file://`)
   - Group 3 = line number
   - Group 4 = column number

5. Clean file path: strip `file://` protocol
6. Extract variable name from context if format is like `Object.<anonymous>` or similar

### Function 2: `getCallerInfo(): StackInfo | null`

Convenience wrapper that:
1. Creates new Error()
2. Gets stack
3. Calls parseStackTrace()
4. Returns info about the caller (not about our own code)

### Edge Cases to Handle
- Stack is undefined/empty → return null
- Can't parse line → return null with defaults
- Internal/node_modules paths → try to skip to user code
- Webpack/bundler transformed paths → extract original if source map available (nice-to-have)

### Example Usage
```typescript
// User code:
const clicks$ = new Observable(sub => { ... });

// Inside Observable constructor:
const info = getCallerInfo();
// info = {
//   filePath: '/src/app.ts',
//   line: 42,
//   column: 15,
//   context: 'clicks$' // if we can extract it
// }
```

## Testing
Create `src/tracking/__tests__/stack-parser.test.ts`:

Test cases:
1. Parse valid V8 stack trace
2. Handle missing stack
3. Handle malformed stack
4. Skip internal frames
5. Extract variable name when present

## Constraints
- Zero dependencies (use only built-in JS)
- Must be fast (called on every Observable creation)
- Must not throw errors (return null on failure)

## Future Enhancement Note
Add comment:
```typescript
// TODO: Alternative approach using oxc/rolldown plugin to inject
// __track(observable, 'file.ts:42:variableName') at build time
// would be more reliable than stack parsing and faster at runtime
```

## Deliverables
- `src/tracking/stack-parser.ts` with both functions
- `src/tracking/__tests__/stack-parser.test.ts` with test cases
- Inline comments explaining regex patterns
- Type definitions exported
