// pkg:runner: vitest:runner subclass. Releases the lazy worker browser at worker cleanup and skips
// vitest:concurrent tasks (with a task error) when pkg:contextScope is 'file'.
import { VitestTestRunner } from "vitest/runners"
import { inject } from "vitest"
import type { File, Task } from "@vitest/runner"
import { KEY } from "./0_options.js"
import { releaseLazyBrowser } from "./8_around.js"

export default class PwRunner extends VitestTestRunner {
  constructor(config: any) {
    super(config)
    this.onCleanupWorkerContext(() => releaseLazyBrowser())
  }
  onCollected(files: File[]): void {
    if (inject(KEY.options)?.contextScope === "file") {
      const walk = (t: Task, path: string) => {
        if ((t as any).concurrent && t.type === "test") {
          t.mode = "skip"
          t.result = { state: "fail", errors: [{ name: "Error", message: `vitest-playwright: contextScope 'file' cannot run concurrent tests (${path}); use describe.sequential or contextScope 'test'` }] } as any
        }
        for (const c of (t as any).tasks ?? []) walk(c, `${path} > ${c.name}`)
      }
      for (const f of files) walk(f as any, f.name)
    }
    const parent = (VitestTestRunner.prototype as any).onCollected
    return parent?.call(this, files)
  }
}
