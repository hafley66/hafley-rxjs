/**
 * Tests for user code HMR transforms
 *
 * Tests transformUserCode directly without full vite build.
 */

import { beforeAll, describe, expect, it } from "vitest"
import { shouldTransformUserCode, transformUserCode } from "../2_user_transform"

describe("user-transform", () => {
  let parseSync: any

  beforeAll(async () => {
    const oxc = await import("oxc-parser")
    parseSync = oxc.parseSync
  })

  describe("shouldTransformUserCode", () => {
    it("accepts .ts files", () => {
      expect(shouldTransformUserCode("/app/test.ts")).toBe(true)
    })

    it("accepts .tsx files", () => {
      expect(shouldTransformUserCode("/app/test.tsx")).toBe(true)
    })

    it("accepts .js files", () => {
      expect(shouldTransformUserCode("/app/test.js")).toBe(true)
    })

    it("rejects node_modules", () => {
      expect(shouldTransformUserCode("/app/node_modules/foo/index.ts")).toBe(false)
    })

    it("rejects .d.ts files", () => {
      expect(shouldTransformUserCode("/app/types.d.ts")).toBe(false)
    })

    it("rejects .test.ts files", () => {
      expect(shouldTransformUserCode("/app/foo.test.ts")).toBe(false)
    })

    it("rejects .spec.ts files", () => {
      expect(shouldTransformUserCode("/app/foo.spec.ts")).toBe(false)
    })
  })

  describe("transformUserCode", () => {
    const transform = (code: string, id = "/app/test.ts") =>
      transformUserCode(code, id, parseSync, { hmrImport: "@hafley/rxjs-debugger/hmr" })

    it("returns null for files without rxjs patterns", () => {
      const result = transform("const x = 1")
      expect(result).toBeNull()
    })

    it("returns null for already instrumented files", () => {
      const code = `
import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
const __$ = _rxjs_debugger_module_start(import.meta.url)
`
      const result = transform(code)
      expect(result).toBeNull()
    })

    describe("observable wrapping", () => {
      it("wraps of() creation", () => {
        const code = `import { of } from 'rxjs'
const data$ = of(1, 2, 3)`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const data$ = __$("data$:of(1,2,3)", () => of(1, 2, 3))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("wraps new Subject()", () => {
        const code = `import { Subject } from 'rxjs'
const events$ = new Subject()`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { Subject } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const events$ = __$("events$:new Subject()", () => new Subject())
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("wraps new BehaviorSubject()", () => {
        const code = `import { BehaviorSubject } from 'rxjs'
const state$ = new BehaviorSubject(0)`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { BehaviorSubject } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const state$ = __$("state$:new BehaviorSubject(0)", () => new BehaviorSubject(0))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("wraps .pipe() chains", () => {
        const code = `import { of } from 'rxjs'
import { map } from 'rxjs/operators'
const doubled$ = source$.pipe(map(x => x * 2))`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          import { map } from 'rxjs/operators'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const doubled$ = __$("doubled$:source$.map(fn)", () => source$.pipe(map(x => x * 2)))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("wraps multiple observables in same file", () => {
        const code = `import { of, Subject } from 'rxjs'
const data$ = of(1)
const events$ = new Subject()`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of, Subject } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const data$ = __$("data$:of(1)", () => of(1))
          const events$ = __$("events$:new Subject()", () => new Subject())
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })
    })

    describe("subscription wrapping", () => {
      it("wraps .subscribe() calls", () => {
        const code = `import { of } from 'rxjs'
data$.subscribe(console.log)`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          __$.sub("sub:data$.subscribe(console.log)", () => data$.subscribe(console.log))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("wraps .subscribe() with observer object", () => {
        const code = `import { of } from 'rxjs'
data$.subscribe({ next: console.log, error: console.error })`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          __$.sub("sub:data$.subscribe({error:console.error,next:console.log})", () => data$.subscribe({ next: console.log, error: console.error }))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("wraps .forEach() calls", () => {
        const code = `import { of } from 'rxjs'
data$.forEach(console.log)`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          __$.sub("sub:data$.forEach(console.log)", () => data$.forEach(console.log))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })
    })

    describe("skip rules", () => {
      it("skips observables inside function bodies", () => {
        const code = `import { of } from 'rxjs'
function makeObs() {
  const inner$ = of(1)
  return inner$
}`

        const result = transform(code)

        // Should not wrap inner$ since it's inside a function
        expect(result).toBeNull()
      })

      it("skips observables inside arrow functions", () => {
        const code = `import { of } from 'rxjs'
const makeObs = () => {
  const inner$ = of(1)
  return inner$
}`

        const result = transform(code)

        expect(result).toBeNull()
      })

      it("skips non-rxjs functions with same name", () => {
        const code = `const of = (x: number) => x * 2
const data$ = of(1)`

        const result = transform(code)

        // 'of' is not imported from rxjs, should not wrap
        expect(result).toBeNull()
      })

      it("only wraps identifiers actually imported from rxjs", () => {
        const code = `import { of } from 'rxjs'
import { from } from './my-utils'
const a$ = of(1)
const b$ = from([1, 2])`

        const result = transform(code)

        // Should only wrap 'of', not 'from' since it's from my-utils
        expect(result).not.toBeNull()
        expect(result!.code).toContain('__$("a$:')
        expect(result!.code).not.toContain('__$("b$:')
      })
    })

    describe("import ordering", () => {
      it("handles imports after code (interleaved)", () => {
        const code = `const x = 1
import { of } from 'rxjs'
const data$ = of(1)`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          const x = 1
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const data$ = __$("data$:of(1)", () => of(1))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("handles multiple import blocks", () => {
        const code = `import { map } from 'rxjs/operators'
const config = {}
import { of } from 'rxjs'
const data$ = of(1)`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { map } from 'rxjs/operators'
          const config = {}
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const data$ = __$("data$:of(1)", () => of(1))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })
    })

    describe("key generation", () => {
      it("generates stable keys across whitespace changes", () => {
        const code1 = `import { of } from 'rxjs'
const x$ = of(1,2,3)`

        const code2 = `import { of } from 'rxjs'
const x$ = of(1, 2, 3)`

        const result1 = transform(code1)!
        const result2 = transform(code2)!

        // Same hash because whitespace is stripped from AST before hashing
        expect(result1.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const x$ = __$("x$:of(1,2,3)", () => of(1,2,3))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
        expect(result2.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const x$ = __$("x$:of(1,2,3)", () => of(1, 2, 3))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("generates different keys for different content", () => {
        const code1 = `import { of } from 'rxjs'
const x$ = of(1)`

        const code2 = `import { of } from 'rxjs'
const x$ = of(2)`

        const result1 = transform(code1)!
        const result2 = transform(code2)!

        // Different values = different hashes
        expect(result1.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const x$ = __$("x$:of(1)", () => of(1))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
        expect(result2.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const x$ = __$("x$:of(2)", () => of(2))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })
    })

    describe("module wrapper", () => {
      it("produces correct structure with import, init, and end", () => {
        const code = `import { of } from 'rxjs'
const x$ = of(1)`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const x$ = __$("x$:of(1)", () => of(1))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("generates source map with mappings", () => {
        const code = `import { of } from 'rxjs'
const x$ = of(1)`

        const result = transform(code)!

        expect(typeof result.map.mappings).toBe("string")
        expect(result.map.mappings.length).toBeGreaterThan(0)
      })
    })

    describe("high priority gaps", () => {
      it("handles aliased imports", () => {
        const code = `import { of as createObs } from 'rxjs'
const x$ = createObs(1)`

        const result = transform(code)

        expect(result).not.toBeNull()
        expect(result!.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of as createObs } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const x$ = __$("x$:createObs(1)", () => createObs(1))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("handles namespace imports", () => {
        const code = `import * as rx from 'rxjs'
const x$ = rx.of(1)`

        const result = transform(code)

        expect(result).not.toBeNull()
        expect(result!.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import * as rx from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const x$ = __$("x$:rx.of(1)", () => rx.of(1))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("handles export declarations", () => {
        const code = `import { of } from 'rxjs'
export const x$ = of(1)`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          export const x$ = __$("x$:of(1)", () => of(1))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("handles class properties", () => {
        const code = `import { of } from 'rxjs'
class Store {
  data$ = of(1)
}`

        const result = transform(code)

        expect(result).not.toBeNull()
        expect(result!.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          class Store {
            data$ = __$("data$:of(1)", () => of(1))
          }
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("handles let declarations", () => {
        const code = `import { of } from 'rxjs'
let x$ = of(1)`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          let x$ = __$("x$:of(1)", () => of(1))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("handles var declarations", () => {
        const code = `import { of } from 'rxjs'
var x$ = of(1)`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          var x$ = __$("x$:of(1)", () => of(1))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("handles chained pipe().pipe()", () => {
        const code = `import { of } from 'rxjs'
import { map, filter } from 'rxjs/operators'
const x$ = source$.pipe(map(x => x)).pipe(filter(x => x > 0))`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          import { map, filter } from 'rxjs/operators'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const x$ = __$("x$:source$.map(fn).filter(fn)", () => source$.pipe(map(x => x)).pipe(filter(x => x > 0)))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })
    })

    describe("hash collision scenarios", () => {
      it("handles two identical blocks with same content", () => {
        const code = `import { of } from 'rxjs'
const a$ = of(1)
const b$ = of(1)`

        const result = transform(code)!

        // Same content = same hash, but different var names make unique keys
        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const a$ = __$("a$:of(1)", () => of(1))
          const b$ = __$("b$:of(1)", () => of(1))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("handles subscriptions with identical content", () => {
        const code = `import { of } from 'rxjs'
a$.subscribe(console.log)
b$.subscribe(console.log)`

        const result = transform(code)!

        // Both subs have same callback, need unique keys
        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          __$.sub("sub:a$.subscribe(console.log)", () => a$.subscribe(console.log))
          __$.sub("sub:b$.subscribe(console.log)", () => b$.subscribe(console.log))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })
    })

    describe("share/shareReplay patterns", () => {
      it("wraps Subject and pipe(shareReplay) as SEPARATE tracked entities", () => {
        const code = `import { Subject } from 'rxjs'
import { shareReplay } from 'rxjs/operators'

const source$ = new Subject<number>()
const shared$ = source$.pipe(shareReplay(1))`

        const result = transform(code)!

        // CRITICAL: These should be TWO separate __$ calls
        // source$ wraps the Subject
        // shared$ wraps the pipe - and source$ inside is the STABLE wrapper
        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { Subject } from 'rxjs'
          import { shareReplay } from 'rxjs/operators'
          const __$ = _rxjs_debugger_module_start(import.meta.url)


          const source$ = __$("source$:new Subject()", () => new Subject<number>())
          const shared$ = __$("shared$:source$.shareReplay(1)", () => source$.pipe(shareReplay(1)))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("wraps Subject.pipe(share) separately", () => {
        const code = `import { Subject } from 'rxjs'
import { share } from 'rxjs/operators'

const events$ = new Subject<string>()
const shared$ = events$.pipe(share())`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { Subject } from 'rxjs'
          import { share } from 'rxjs/operators'
          const __$ = _rxjs_debugger_module_start(import.meta.url)


          const events$ = __$("events$:new Subject()", () => new Subject<string>())
          const shared$ = __$("shared$:events$.share()", () => events$.pipe(share()))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("wraps chained pipe with share in the middle", () => {
        const code = `import { Subject } from 'rxjs'
import { map, share, filter } from 'rxjs/operators'

const source$ = new Subject<number>()
const processed$ = source$.pipe(map(x => x * 2), share(), filter(x => x > 0))`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { Subject } from 'rxjs'
          import { map, share, filter } from 'rxjs/operators'
          const __$ = _rxjs_debugger_module_start(import.meta.url)


          const source$ = __$("source$:new Subject()", () => new Subject<number>())
          const processed$ = __$("processed$:source$.map(fn).share().filter(fn)", () => source$.pipe(map(x => x * 2), share(), filter(x => x > 0)))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })
    })

    describe("class this reference patterns", () => {
      it("skips this.subscribe() inside class methods", () => {
        const code = `import { BehaviorSubject } from 'rxjs'
class EasierBS<T> extends BehaviorSubject<T> {
  use$(): T {
    const sub = this.subscribe(() => console.log(this.value))
    return this.value
  }
}`
        const result = transform(code)
        expect(result).toMatchSnapshot()
      })

      it("skips this.pipe() inside class methods", () => {
        const code = `import { BehaviorSubject, Observable } from 'rxjs'
import { map } from 'rxjs/operators'
class EasierBS<T> extends BehaviorSubject<T> {
  doubled$(): Observable<number> {
    return this.pipe(map(x => x * 2))
  }
}`
        const result = transform(code)
        expect(result).toMatchSnapshot()
      })

      it("skips nested pipes in returned functions", () => {
        const code = `import { BehaviorSubject, Observable } from 'rxjs'
import { scan } from 'rxjs/operators'
class EasierBS<T> extends BehaviorSubject<T> {
  scanEager<Next>(accumulator: (sum: T, next: Next) => T) {
    return (source$: Observable<Next>) => {
      return source$.pipe(scan((_sum, next) => accumulator(this.value, next), this.value))
    }
  }
}`
        const result = transform(code)
        expect(result).toMatchSnapshot()
      })

      it("does NOT wrap extended Subject classes (runtime handles via constructor patch)", () => {
        const code = `import { BehaviorSubject } from 'rxjs'
class EasierBS<T> extends BehaviorSubject<T> {}
const state$ = new EasierBS({ count: 0 })`
        const result = transform(code)
        // Extended classes are tracked at runtime via Observable constructor patch
        // Transform only detects known RxJS classes: Subject, BehaviorSubject, etc.
        expect(result).toMatchSnapshot()
      })

      it("DOES wrap direct BehaviorSubject at module level", () => {
        const code = `import { BehaviorSubject } from 'rxjs'
const state$ = new BehaviorSubject({ count: 0 })`
        const result = transform(code)
        expect(result).toMatchSnapshot()
      })
    })
  })
})
