/**
 * Tests for rxjs-track vite plugin
 *
 * Tests the transform function directly without full vite build.
 */

import { beforeAll, describe, expect, it } from "vitest"
import { rxjsTrackPlugin } from "../rxjs-track-plugin"

describe("rxjsTrackPlugin", () => {
  let plugin: ReturnType<typeof rxjsTrackPlugin>
  let transform: (code: string, id: string) => Promise<{ code: string; map: any } | null>

  beforeAll(async () => {
    plugin = rxjsTrackPlugin({
      trackImport: "rxjs-debugger/track",
      requireOptIn: false, // Disable opt-in for tests
    })

    // Initialize the plugin (loads oxc-parser)
    if (plugin.buildStart) {
      await plugin.buildStart()
    }

    transform = plugin.transform as typeof transform
  })

  describe("transform", () => {
    it("should skip non-matching files", async () => {
      const result = await transform("const x = 1;", "/app/test.json")
      expect(result).toBeNull()
    })

    it("should skip files without rxjs imports", async () => {
      const result = await transform("const x = 1;", "/app/test.ts")
      expect(result).toBeNull()
    })

    it("should transform of() creation", async () => {
      const code = `
import { of } from 'rxjs';
const data$ = of(1, 2, 3);
`
      const result = await transform(code, "/app/test.ts")

      expect(result).not.toBeNull()
      expect(result!.code).toContain("__track$")
      expect(result!.code).toContain("n:'data$'")
      expect(result!.code).toContain("f:'app/test.ts'")
    })

    it("should transform from() creation", async () => {
      const code = `
import { from } from 'rxjs';
const stream$ = from([1, 2, 3]);
`
      const result = await transform(code, "/app/service.ts")

      expect(result).not.toBeNull()
      expect(result!.code).toContain("__track$")
      expect(result!.code).toContain("n:'stream$'")
    })

    it("should transform interval() creation", async () => {
      const code = `
import { interval } from 'rxjs';
const tick$ = interval(1000);
`
      const result = await transform(code, "/app/timer.ts")

      expect(result).not.toBeNull()
      expect(result!.code).toContain("__track$")
      expect(result!.code).toContain("n:'tick$'")
    })

    it("should transform new Subject()", async () => {
      const code = `
import { Subject } from 'rxjs';
const events$ = new Subject();
`
      const result = await transform(code, "/app/events.ts")

      expect(result).not.toBeNull()
      expect(result!.code).toContain("__track$")
      expect(result!.code).toContain("n:'events$'")
    })

    it("should transform new BehaviorSubject()", async () => {
      const code = `
import { BehaviorSubject } from 'rxjs';
const state$ = new BehaviorSubject(0);
`
      const result = await transform(code, "/app/state.ts")

      expect(result).not.toBeNull()
      expect(result!.code).toContain("__track$")
      expect(result!.code).toContain("n:'state$'")
    })

    it("should transform .pipe() calls", async () => {
      const code = `
import { of } from 'rxjs';
import { map } from 'rxjs/operators';
const source$ = of(1);
const doubled$ = source$.pipe(map(x => x * 2));
`
      const result = await transform(code, "/app/transform.ts")

      expect(result).not.toBeNull()
      expect(result!.code).toContain("__track$")
      expect(result!.code).toContain("n:'doubled$'")
    })

    it("should transform combineLatest()", async () => {
      const code = `
import { combineLatest, of } from 'rxjs';
const a$ = of(1);
const b$ = of(2);
const combined$ = combineLatest([a$, b$]);
`
      const result = await transform(code, "/app/combine.ts")

      expect(result).not.toBeNull()
      expect(result!.code).toContain("__track$")
      expect(result!.code).toContain("n:'combined$'")
    })

    it("should transform merge()", async () => {
      const code = `
import { merge, of } from 'rxjs';
const merged$ = merge(of(1), of(2));
`
      const result = await transform(code, "/app/merge.ts")

      expect(result).not.toBeNull()
      expect(result!.code).toContain("__track$")
      expect(result!.code).toContain("n:'merged$'")
    })

    it("should add import statement", async () => {
      const code = `
import { of } from 'rxjs';
const x$ = of(1);
`
      const result = await transform(code, "/app/test.ts")

      expect(result).not.toBeNull()
      expect(result!.code).toContain("import { __track$ } from 'rxjs-debugger/track'")
    })

    it("should include line numbers", async () => {
      const code = `import { of } from 'rxjs';

const first$ = of(1);

const second$ = of(2);
`
      const result = await transform(code, "/app/lines.ts")

      expect(result).not.toBeNull()
      // first$ is on line 3, second$ is on line 5
      expect(result!.code).toContain("l:3")
      expect(result!.code).toContain("l:5")
    })

    it("should generate sourcemap", async () => {
      const code = `
import { of } from 'rxjs';
const data$ = of(1);
`
      const result = await transform(code, "/app/test.ts")

      expect(result).not.toBeNull()
      expect(result!.map).toBeDefined()
      expect(result!.map.mappings).toBeDefined()
    })

    it("should handle multiple declarations", async () => {
      const code = `
import { of, interval, Subject } from 'rxjs';
const a$ = of(1);
const b$ = interval(1000);
const c$ = new Subject();
`
      const result = await transform(code, "/app/multi.ts")

      expect(result).not.toBeNull()
      expect(result!.code).toContain("n:'a$'")
      expect(result!.code).toContain("n:'b$'")
      expect(result!.code).toContain("n:'c$'")
    })

    it("should skip node_modules by default", async () => {
      const code = `
import { of } from 'rxjs';
const x$ = of(1);
`
      const result = await transform(code, "/app/node_modules/some-lib/index.ts")
      expect(result).toBeNull()
    })
  })

  describe("options", () => {
    it("should respect custom include pattern", async () => {
      const customPlugin = rxjsTrackPlugin({
        include: /\.rxjs\.ts$/,
        requireOptIn: false,
      })
      if (customPlugin.buildStart) await customPlugin.buildStart()

      const transformFn = customPlugin.transform as typeof transform

      // Should skip regular .ts
      const result1 = await transformFn(`import { of } from 'rxjs'; const x$ = of(1);`, "/app/test.ts")
      expect(result1).toBeNull()

      // Should transform .rxjs.ts
      const result2 = await transformFn(`import { of } from 'rxjs'; const x$ = of(1);`, "/app/test.rxjs.ts")
      expect(result2).not.toBeNull()
    })

    it("should respect custom trackImport", async () => {
      const customPlugin = rxjsTrackPlugin({
        trackImport: "@my-lib/tracking",
        requireOptIn: false,
      })
      if (customPlugin.buildStart) await customPlugin.buildStart()

      const transformFn = customPlugin.transform as typeof transform
      const result = await transformFn(`import { of } from 'rxjs'; const x$ = of(1);`, "/app/test.ts")

      expect(result).not.toBeNull()
      expect(result!.code).toContain("import { __track$ } from '@my-lib/tracking'")
    })
  })
})
