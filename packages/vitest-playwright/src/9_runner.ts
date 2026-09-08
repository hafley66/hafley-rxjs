// pkg:runner: vitest:runner subclass. Releases the lazy worker browser at worker cleanup and skips
// vitest:concurrent tasks (with a task error) when pkg:contextScope is 'file'.
import type { File, Task } from "@vitest/runner"
import { inject } from "vitest"
import { VitestTestRunner } from "vitest/runners"
import { KEY } from "./0_options.js"
import { releaseLazyBrowser } from "./8_around.js"

type RunnerConfig = ConstructorParameters<typeof VitestTestRunner>[0]
// vitest: VitestTestRunner declares no onCollected, but the runner protocol calls it when present
type CollectHook = { onCollected?: (files: File[]) => unknown }

function skipConcurrent(t: Task, path: string): void {
  if (t.type === "test" && t.concurrent) {
    t.mode = "skip"
    t.result = {
      state: "fail",
      errors: [
        {
          name: "Error",
          message: `vitest-playwright: contextScope 'file' cannot run concurrent tests (${path}); use describe.sequential or contextScope 'test'`,
        },
      ],
    }
  }
  if ("tasks" in t) for (const c of t.tasks) skipConcurrent(c, `${path} > ${c.name}`)
}

export default class PwRunner extends VitestTestRunner {
  constructor(config: RunnerConfig) {
    super(config)
    this.onCleanupWorkerContext(() => releaseLazyBrowser())
  }
  onCollected(files: File[]): unknown {
    if (inject(KEY.options)?.contextScope === "file") for (const f of files) skipConcurrent(f, f.name)
    return (VitestTestRunner.prototype as CollectHook).onCollected?.call(this, files)
  }
}
