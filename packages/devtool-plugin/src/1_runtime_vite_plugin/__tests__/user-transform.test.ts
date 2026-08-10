/**
 * Tests for user code HMR transforms
 *
 * Tests transformUserCode directly without full vite build.
 */

import { describe, expect, it } from "vitest"
import { shouldTransformUserCode, transformUserCode } from "../2_user_transform"

describe("user-transform", () => {
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

    it("accepts .test.ts files", () => {
      expect(shouldTransformUserCode("/app/foo.test.ts")).toBe(true)
    })

    it("accepts .spec.ts files", () => {
      expect(shouldTransformUserCode("/app/foo.spec.ts")).toBe(true)
    })
  })

  describe("transformUserCode", () => {
    const transform = (code: string, id = "/app/test.ts") =>
      transformUserCode(code, id, {
        hmrImport: "@hafley66/rxjs-debugger/hmr",
      })

    it("returns null for files without rxjs patterns", () => {
      const result = transform("const x = 1")
      expect(result).toBeNull()
    })

    it("returns null for already instrumented files", () => {
      const code = `
import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr"
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { Subject } from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { BehaviorSubject } from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
          import { map } from 'rxjs/operators'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of, Subject } from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
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
      it("skips observables inside function bodies but wraps the function for HMR", () => {
        const code = `import { of } from 'rxjs'
function makeObs() {
  const inner$ = of(1)
  return inner$
}`

        const result = transform(code)!

        // inner$ is NOT wrapped (inside function body)
        // but the function itself IS wrapped for HMR, with hoisting preserved
        expect(result.code).toMatchInlineSnapshot(`
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
          const __fn$0 = __$.fn("fn:makeObs", function makeObs() {
            const inner$ = of(1)
            return inner$
          })
          function makeObs() { return __fn$0.apply(this, arguments) }
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("skips observables inside arrow functions but wraps the function for HMR", () => {
        const code = `import { of } from 'rxjs'
const makeObs = () => {
  const inner$ = of(1)
  return inner$
}`

        const result = transform(code)!

        // inner$ is NOT wrapped (inside arrow function body)
        // arrow function is wrapped directly (no hoisting concern)
        expect(result.code).toMatchInlineSnapshot(`
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
          const makeObs = __$.fn("fn:makeObs", () => {
            const inner$ = of(1)
            return inner$
          })
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("skips non-rxjs functions with same name", () => {
        const code = `const of = (x: number) => x * 2
const data$ = of(1)`

        const result = transform(code)

        // 'of' is not imported from rxjs, should not wrap
        expect(result).toMatchInlineSnapshot(`
          {
            "code": "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          const of = __$.fn("fn:of", (x: number) => x * 2)
          const data$ = of(1)
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          ",
            "map": SourceMap {
              "file": undefined,
              "mappings": ";;;AAAA,KAAK,CAAC,EAAE,CAAC,CAAC,iBAAC,CAAC,CAAC,CAAC,CAAC,MAAM,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC;AAC9B,KAAK,CAAC,IAAI,CAAC,CAAC,CAAC,CAAC,EAAE,CAAC,CAAC;;;;;",
              "names": [],
              "sources": [
                "/app/test.ts",
              ],
              "sourcesContent": undefined,
              "version": 3,
            },
          }
        `)
      })

      it("only wraps identifiers actually imported from rxjs", () => {
        const code = `import { of } from 'rxjs'
import { from } from './my-utils'
const a$ = of(1)
const b$ = from([1, 2])`

        const result = transform(code)

        // Should only wrap 'of', not 'from' since it's from my-utils
        expect(result).toMatchInlineSnapshot(`
          {
            "code": "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
          import { from } from './my-utils'
          const a$ = __$("a$:of(1)", () => of(1))
          const b$ = from([1, 2])
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          ",
            "map": SourceMap {
              "file": undefined,
              "mappings": ";;;AAAA,MAAM,CAAC,CAAC,CAAC,EAAE,CAAC,CAAC,CAAC,IAAI,CAAC,CAAC,IAAI;AACxB,MAAM,CAAC,CAAC,CAAC,IAAI,CAAC,CAAC,CAAC,IAAI,CAAC,CAAC,CAAC,CAAC,EAAE,CAAC,KAAK;AAChC,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,uBAAC,EAAE,CAAC,CAAC;AACf,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,IAAI,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC;;;;;",
              "names": [],
              "sources": [
                "/app/test.ts",
              ],
              "sourcesContent": undefined,
              "version": 3,
            },
          }
        `)
      })
    })

    describe("import ordering", () => {
      it("handles imports after code (interleaved)", () => {
        const code = `const x = 1
import { of } from 'rxjs'
const data$ = of(1)`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          const x = 1
          import { of } from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { map } from 'rxjs/operators'
          const config = {}
          import { of } from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
          const x$ = __$("x$:of(1,2,3)", () => of(1,2,3))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
        expect(result2.code).toMatchInlineSnapshot(`
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
          const x$ = __$("x$:of(1)", () => of(1))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
        expect(result2.code).toMatchInlineSnapshot(`
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of as createObs } from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import * as rx from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
          import { map, filter } from 'rxjs/operators'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { of } from 'rxjs'
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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { Subject } from 'rxjs'
          import { shareReplay } from 'rxjs/operators'

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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { Subject } from 'rxjs'
          import { share } from 'rxjs/operators'

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
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { Subject } from 'rxjs'
          import { map, share, filter } from 'rxjs/operators'

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

    describe("Observable subclass patterns", () => {
      it("wraps new Observable() directly", () => {
        const code = `import { Observable } from 'rxjs'
const custom$ = new Observable(subscriber => {
  subscriber.next(1)
  subscriber.complete()
})`
        const result = transform(code)!
        expect(result.code).toMatchInlineSnapshot(`
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { Observable } from 'rxjs'
          const custom$ = __$("custom$:new Observable(fn)", () => new Observable(subscriber => {
            subscriber.next(1)
            subscriber.complete()
          }))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("wraps user-defined Observable subclass", () => {
        const code = `import { Observable } from 'rxjs'
class MyObservable<T> extends Observable<T> {}
const custom$ = new MyObservable()`
        const result = transform(code)!
        // MyObservable extends Observable, so new MyObservable() should be wrapped
        expect(result.code).toMatchInlineSnapshot(`
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { Observable } from 'rxjs'
          class MyObservable<T> extends Observable<T> {}
          const custom$ = __$("custom$:new MyObservable()", () => new MyObservable())
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("wraps transitive Observable subclass", () => {
        const code = `import { Observable } from 'rxjs'
class BaseObs<T> extends Observable<T> {}
class DerivedObs<T> extends BaseObs<T> {}
const custom$ = new DerivedObs()`
        const result = transform(code)!
        // DerivedObs extends BaseObs extends Observable
        expect(result.code).toMatchInlineSnapshot(`
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { Observable } from 'rxjs'
          class BaseObs<T> extends Observable<T> {}
          class DerivedObs<T> extends BaseObs<T> {}
          const custom$ = __$("custom$:new DerivedObs()", () => new DerivedObs())
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("does NOT include Subject subclasses in Observable tracking (they have their own)", () => {
        const code = `import { Subject, Observable } from 'rxjs'
class MySubject<T> extends Subject<T> {}
const subj$ = new MySubject()`
        const result = transform(code)!
        // MySubject is tracked as a Subject, not Observable
        // The wrapping still happens, but via subject path
        expect(result.code).toMatchInlineSnapshot(`
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import { Subject, Observable } from 'rxjs'
          class MySubject<T> extends Subject<T> {}
          const subj$ = __$("subj$:new MySubject()", () => new MySubject())
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("wraps namespace Observable construction", () => {
        const code = `import * as rx from 'rxjs'
const custom$ = new rx.Observable(sub => sub.next(1))`
        const result = transform(code)!
        expect(result.code).toMatchInlineSnapshot(`
          "
          import { _rxjs_debugger_module_start } from "@hafley66/rxjs-debugger/hmr";
          const __$ = _rxjs_debugger_module_start(import.meta.url);
          import * as rx from 'rxjs'
          const custom$ = __$("custom$:new Observable(fn)", () => new rx.Observable(sub => sub.next(1)))
          __$.end()
          if (import.meta.hot) {
            import.meta.hot.accept()
          }
          "
        `)
      })

      it("wraps namespace Observable construction", () => {
        const code = `import { BehaviorSubject, filter, map, of, of as rxjsOf, Subject, take } from "rxjs"
import { describe, expect, it } from "vitest"
import { _eventBuffer, state$ } from "../00.types"
import { __$ } from "./0_runtime"
import "../03_scan-accumulator"
import { useTrackingTestSetup } from "../0_test-utils"
import { getDanglingSubscriptions } from "../06_queries"
import { findTrackByKey } from "./1_queries"
import { trackedBehaviorSubject, trackedSubject } from "./3_tracked-subject"
import { ___rxjs_hmr_key___ } from "./4_module-scope"

describe("__$ HMR runtime", () => {
  useTrackingTestSetup(true)

  it("tracks observable creation", () => {
    const obs = of(1, 2, 3)

    expect(findTrackByKey(state$.value, obs[___rxjs_hmr_key___])).toMatchInlineSnapshot(\`undefined\`)
  })
})`
        const result = transform(code, "/app/derp.ts")!
        expect(result).toEqual(null)
      })
    })
  })
})
