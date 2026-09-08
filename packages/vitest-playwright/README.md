# @hafley66/vitest-playwright

playwright/test folded into node-realm vitest 4: one `test`, one `expect`, one `$page`; playwright `Locator` as the only query vocabulary; RxJS resource handles and `@hafley66/signals` roots underneath; LogTape records for every page, network and API event.

## TOC

1. Install
2. Config
3. Writing tests
4. Fixtures
5. Matchers
6. The serve slot
7. Artifacts
8. Logging and telemetry
9. Lifetimes (how it works)
10. Limits

## 1. Install

```bash
pnpm add -D @hafley66/vitest-playwright playwright
```

| dependency | kind |
| --- | --- |
| `vitest` ^4.1, `vite` ^8 | peer |
| `playwright` | dependency (browsers via `pnpm exec playwright install`) |
| `@logtape/logtape`, `@opentelemetry/api` | optional peer; absent = no records, no spans |
| `@hafley66/signals`, `rxjs`, `@vitest/runner` | dependency |

## 2. Config

```ts
// vitest.e2e.config.ts
import { defineConfig } from "vitest/config"
import { vitestPlaywright } from "@hafley66/vitest-playwright/plugin"

export default defineConfig({
  plugins: [
    vitestPlaywright({
      contextScope: "test",                       // or "file": one context + page per file, sequential
      context: { viewport: { width: 1200, height: 800 } },
      expect: { timeout: 5000 },
      artifacts: { outDir: "out/pw", screenshot: "only-on-failure", trace: "retain-on-failure" },
      log: { failOnPageError: true, failOnConsoleError: true },
      serve: { kind: "vite", build: { configFile: "vite.config.ts" }, serve: "file", reuseExisting: true },
    }),
  ],
  test: { include: ["tests/*.e2e.test.ts"] },
})
```

The plugin fills `test.setupFiles`, `test.globalSetup`, `test.provide`, `test.runner`, and `test.isolate` (default `false`, one browser per worker). A user-set `isolate` is kept; a user-set `runner` is an error.

| option | default | owner |
| --- | --- | --- |
| `browser.name` / `browser.launch` / `browser.connect` | chromium, `{}` | pw: |
| `context` | `{}` | pw:BrowserContextOptions, cloneable subset |
| `contextScope` | `test` | pkg: |
| `expect.timeout` | 5000 | pkg:, matchers |
| `expect.toHaveScreenshot.dir` / `animations` / `caret` / `scale` / `maxDiffPixels` / `maxDiffPixelRatio` / `threshold` | `__screenshots__`, disabled, hide, css, unset | pkg:toHaveScreenshot defaults |
| `timeouts.action` / `timeouts.navigation` | 0 | pw: |
| `clock.install` / `clock.time` / `clock.mode` | off | pw:context.clock |
| `har` | off | pw:routeFromHAR |
| `artifacts.outDir` / `screenshot` / `trace` / `video` / `budgetMs` | `out/pw`, only-on-failure, retain-on-failure, off, 5000 | pkg: |
| `log.page` / `net` / `api` / `failOnPageError` / `failOnConsoleError` | all true | tel: |
| `serve` | none | pkg:globalSetup |
| `testIdAttribute` | `data-testid` | pw: |
| `workers` | 2 | vitest `test.maxWorkers` unless the user config sets it; one browser per worker, so vitest's `cores - 1` default means that many chromiums (playwright/test defaults to `"50%"`) |

Every option crosses `vitest:provide` into workers, so it must be structured-cloneable; `resolveOptions` throws on the key that is not.

## 3. Writing tests

```ts
import { expect, test } from "@hafley66/vitest-playwright"
import { inject } from "vitest"

const base = inject("vitest-playwright:baseURL")

test("counter", async ({ page }) => {
  await page.goto(`${base}/`)
  await page.getByRole("button", { name: "add" }).click()
  await expect(page.getByTestId("count")).toHaveText("1")
})

test("same thing through the global", async () => {
  await $page.goto(`${base}/`)
  await expect($page.getByTestId("count")).toHaveText("0")
})
```

`$page` and `$context` are globals that resolve to the running attempt's page and context. They work in the test body, `beforeEach`, `afterEach`, and inside callbacks the test started (timers, promises, RxJS). Inside a playwright event or route handler, which playwright dispatches outside the test's async context, they resolve to the sole running attempt; under `describe.concurrent` use the `page` fixture there instead. A callback from a finished test gets an error naming the phase.

Plain vitest `it` works too: the bridge launches a worker browser lazily on the first `$page` read.

Two import paths cover everything: the root for test files, `/plugin` for the config. The other subpaths (`/setup`, `/test`, `/global-setup`, `/runner`) are what the plugin wires for itself.

## 4. Fixtures

| fixture | scope | value |
| --- | --- | --- |
| `options` | worker | resolved plugin options |
| `baseURL` | worker | from the serve slot, else `context.baseURL` |
| `browser` | worker | one `pw:Browser` per worker |
| `fileRoot` | file | context + page shared by the file when `contextScope: "file"` |
| `contextOptions` | test | override per file with `test.extend<{ $test: { contextOptions: BrowserContextOptions } }>` |
| `context`, `page` | test | acquired by the hook before the body runs |
| `clock` | test | `context.clock` |
| `request` | test | `pw:APIRequestContext`, independent of the browser |
| `step(title, body)` | test | timed annotation on the test |
| `log` | test | the attempt log signal: `log.$().errors`, `.console`, `.net` |

## 5. Matchers

30 keys, 29 over `pw:Locator._expect` polling server-side inside playwright: `toBeAttached toBeChecked toBeDisabled toBeEditable toBeEmpty toBeEnabled toBeFocused toBeHidden toBeVisible toBeInViewport toHaveText toContainText toHaveClass toContainClass toHaveId toHaveRole toHaveValue toHaveValues toHaveAccessibleName toHaveAccessibleDescription toHaveAccessibleErrorMessage toHaveAttribute toHaveCSS toHaveCount toHaveJSProperty toHaveTitle toHaveURL toBeOK toPass`, plus `toHaveScreenshot`.

`.not`, `expect.soft`, and `{ timeout }` work as in playwright. `expect.poll` refuses them (they retry already). `toPass` retries on timers captured at import, so `vi.useFakeTimers()` cannot freeze it. Failure text:

```
expect(locator('#hidden')).toBeVisible() failed

Locator:  locator('#hidden')
Expected: visible
Received: hidden
Timeout:  200ms (exceeded)
```

### toHaveScreenshot

```ts
await expect(page).toHaveScreenshot()                       // <slug of the full test name>-1.png
await expect(page).toHaveScreenshot("hero.png", { maxDiffPixelRatio: 0.01 })
await expect(page.locator("#chart")).toHaveScreenshot(["charts", "bar.png"])
await expect($page).toMatchSnapshot("hero.png")             // alias: a Page or Locator receiver routes here
await expect({ a: 1 }).toMatchSnapshot()                    // every other receiver keeps vitest's snapshot
```

| piece | where |
| --- | --- |
| compare | `pw:Page._expectScreenshot`: the server waits for two consecutive frames to agree, then compares with its bundled pixelmatch; no image library on this side |
| baseline | `<test dir>/__screenshots__/<test file>/<name>-<browser>-<platform>.png` (`baselinePath()` exported) |
| update | vitest's own mode: `-u` rewrites, default writes missing, CI (`none`) fails on missing |
| failure | `<name>-expected.png`, `-actual.png`, `-diff.png` in the attempt dir, recorded as a `visual-regression` artifact |
| options | `animations caret clip fullPage mask maskColor omitBackground scale style stylePath timeout maxDiffPixels maxDiffPixelRatio threshold`, defaults from `expect.toHaveScreenshot` |

`toMatchSnapshot` on a page takes a name only; vitest types its second argument as a hint string, so per-call options go through `toHaveScreenshot`.

## 6. The serve slot

| kind | what happens in `vitest:globalSetup` |
| --- | --- |
| `{ kind: "url", url }` | provides the URL |
| `{ kind: "command", command, url, cwd?, env?, readyTimeoutMs? }` | spawns the command detached, polls `url` until 2xx/3xx, kills the process group at the end |
| `{ kind: "vite", build, mode?, serve: "preview" \| "file", entry?, reuseExisting? }` | `vite.build(build)` (skipped when `reuseExisting` and `dist` is newer than `src`), then `vite.preview` or a `file://` URL to `entry` |

`serve.build` crosses into global setup as JSON; pass `configFile`, not plugin instances. Workers read the result with `inject("vitest-playwright:baseURL")`.

## 7. Artifacts

`out/pw/<file-slug>/<test-slug>.<task.id>.r<retry>.p<repeat>/` holds `failed.png` or `finished.png`, `trace.zip`, and `*.webm`. The directory is created only when something is written. Failure screenshots are also recorded as vitest artifacts, so reporters show them. Capture is bounded by `artifacts.budgetMs`.

## 8. Logging and telemetry

LogTape categories, emitted only when `@logtape/logtape` resolves:

| category | records |
| --- | --- |
| `["vitest-playwright", "page"]` | `pageerror` (error), `console.<type>` (debug; `console.error` as warn) |
| `["vitest-playwright", "net"]` | browser requests, responses, failures (`pw:Page` events) and node-realm `fetch` (undici diagnostics channels); `owner` = test id |
| `["vitest-playwright", "api"]` | every playwright client call with duration; `fakeTimers` flag |
| `["vitest-playwright", "bridge"]` | warnings from the bridge itself: fake timers restored, capture skipped |

One `pw.test` span per attempt through `@opentelemetry/api` when present. Sinks and the report belong to `@hafley66/vitest-telemetry`.

`log.failOnPageError` / `log.failOnConsoleError` fail a passing test at teardown with the collected lines.

## 9. Lifetimes (how it works)

```mermaid
sequenceDiagram
  participant W as worker fixture (browser)
  participant H as aroundEach hook
  participant B as test body
  W->>H: browser
  H->>H: attempt root + log signal; AsyncLocalStorage.run
  H->>H: acquire context$, page$ (Resource handles)
  H->>B: runTest (beforeEach, body, afterEach)
  B-->>H: result
  H->>H: capture: screenshot, trace; real timers restored
  H->>H: assertLog: page/console errors fail the test
  H->>H: release page, context (awaited close)
```

| lifetime | root | owner |
| --- | --- | --- |
| worker | `workerRoot` (options, baseURL, browser) | `browser` fixture, released at worker cleanup |
| file | `fileRoot` (context, page, activeAttempt) | `fileRoot` fixture under `contextScope: "file"` |
| attempt | `testRoot` (task, signal, phase, context, page) + `testLog` (`Signal(events$)`) | the hook; the log connects when the hook subscribes and disconnects at release |

Signals hold state; RxJS producers (`resource$`, `pageEvents$`, `nodeFetch$`, `apiCall$`, `poll$`) hold effects; exactly three subscriptions exist: `acquire`, the hook's log connection, and the worker tap for api/net records.

Each attempt gets its own `AbortSignal` derived from vitest's (which is never reset across retries), so a retry after a timeout still polls.

## 10. Limits

- Every test acquires a context and a page (31 ms on this machine) whether or not it touches one.
- The playwright client itself needs real timers; a body that calls playwright under `vi.useFakeTimers()` hangs until the test timeout. The bridge restores real timers at capture and logs a `bridge` warning. Use `context.clock` for page time.
- `contextScope: "file"` skips `describe.concurrent` tests with an error.
- `toMatchAriaSnapshot` and a component `render()` are not implemented.
