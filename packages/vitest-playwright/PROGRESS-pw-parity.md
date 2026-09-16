# playwright/test parity: progress

Source lines: `STUDY-2026-09-15-playwright-test-perf.md`. `PW` = `node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/lib`,
`CORE` = same for `playwright-core`. Marker in code: `// pwp:<id>` at the site that implements or decides the row.
Red tests: `tests/parity/<id>.test.ts`, run with `pnpm test:parity` (config `vitest.parity.config.ts`, files serial,
child vitest runs pinned to `--maxWorkers=1`). A row is done when its test is green and its marker exists.

## TOC

1. Rows
2. Status legend
3. Semaphore: build-vs-buy
4. Machine safety rules for the parity suite

## 1. Rows

| id | mechanism | playwright line | status | impl site (marker) | red test asserts |
| --- | --- | --- | --- | --- | --- |
| pw-workers | workers default = floor(cpus/2); ours = memory+idle cores | `PW/common/index.js:579,670-679` | present | `src/0_options.ts` pwp:pw-workers, `src/12_budget.ts` | resolved `workers` <= floor(cores/2) and <= availableBytes/BYTES_PER_WORKER |
| pw-debug1 | `--inspect`/debug forces workers=1 | `PW/common/index.js:579` | absent | `src/0_options.ts` pwp:pw-debug1 | `NODE_OPTIONS=--inspect` or `VITEST_PLAYWRIGHT_DEBUG=1` child run resolves workers=1 |
| pw-browser | one browser per worker, `handleSIGINT:false` | `PW/index.js:201-238` | present | `src/5_streams.ts` pwp:pw-browser | child run with 2 files, `--maxWorkers=1`, `isolate:false`: 1 launch (count `browserType.launch` via `PW_TEST_CONNECT`-free `DEBUG=pw:browser` log lines) |
| pw-launch0 | browser fixture `timeout:0` | `PW/index.js:238` | equivalent | `src/5_streams.ts` pwp:pw-launch0 | launch under `testTimeout: 1` still succeeds (browser acquire is outside the test timeout) |
| pw-launchopts | launch options via `_defaultLaunchOptions` singleton | `PW/index.js:213` | equivalent | `src/5_streams.ts` pwp:pw-browser | none (cosmetic) |
| pw-ctx | context per test, all closed with `Promise.all` | `PW/index.js:384,413` | present | `src/5_streams.ts` pwp:pw-ctx | after a test, `browser.contexts().length === 0`; two contexts opened in one test both closed |
| pw-page | page has no own teardown | `PW/index.js:445` | present | `src/5_streams.ts` pwp:pw-page | page closed by context close only: `page.isClosed()` true after test, no second close call |
| pw-timeouts | action/nav timeouts set per test | `PW/index.js:349-352` | present | `src/5_streams.ts` pwp:pw-timeouts | `timeouts.action: 50` makes `locator.click()` on a missing node fail in < 500ms |
| pw-noall | `context`/`page` in beforeAll throws | `PW/index.js:368-375` | absent | `src/4_test.ts` pwp:pw-noall | child file with `beforeAll(({page}) => ...)` fails with message containing `per-test basis` |
| pw-hash | worker reuse only across same fixture set | `PW/common/index.js:2102`, `PW/runner/index.js:5251-5274` | n/a vitest | none | none: vitest has no worker-hash seam |
| pw-failkill | worker stopped after any failed test, next file gets a fresh browser | `PW/runner/index.js:5293-5296` | absent | `src/9_runner.ts` pwp:pw-failkill | child run: file A fails, file B in same worker sees a different `browser` pid / `browser.version()` object identity via a marker file written by each launch |
| pw-idle | stop idle workers whose hash has no queued jobs | `PW/runner/index.js:5297,5321-5328` | n/a vitest | none | none |
| pw-teardown | teardown order: test scope, afterAll, worker scope, reverse creation | `PW/worker/workerProcessEntry.js:268-284,1692-1704` | present | `src/9_runner.ts` pwp:pw-teardown | child run writes an order log: `context.close` before `afterAll` before `browser.close` |
| pw-reuse | `reuseContext`: one context per worker, `resetForReuse` between tests | `PW/index.js:418-424`, `CORE/coreBundle.js:52312-52322,51334-51356` | absent | `src/5_streams.ts` pwp:pw-reuse | option `contextScope:"worker"`: two tests share `context` identity, second test sees `about:blank`, no cookies, one page |
| pw-video-noreuse | video on disables reuse | `PW/index.js:364,423` | absent | `src/5_streams.ts` pwp:pw-reuse | `contextScope:"worker"` + `video:"on"` yields a new context per test |
| pw-connect-env | `PW_TEST_CONNECT_WS_ENDPOINT` switches every worker to connect | `PW/index.js:197-199,540` | absent | `src/0_options.ts` pwp:pw-connect-env | env set to a `launchServer()` endpoint: child run launches 0 local browsers |
| pw-groups | fullyParallel / hook-suite chunking | `PW/runner/index.js:2355-2420` | n/a vitest | none | none |
| pw-sema | machine-wide browser slots: a worker waits for a slot before launch | none (new) | absent | `src/13_semaphore.ts` pwp:pw-sema | two child vitest runs with `slots:1`, each 1 worker: second run's launch timestamp >= first run's browser close timestamp |

## 2. Status legend

| status | meaning |
| --- | --- |
| present | code exists at the marker; red test written to pin it |
| equivalent | same effect by another route; marker names the route |
| unverified | code exists, no test proves the order/behavior |
| absent | no code; red test fails until implemented |
| n/a vitest | vitest scheduler owns this; no seam |

## 3. Semaphore: build-vs-buy

| candidate | scope | counting | cross-process | stale recovery | notes |
| --- | --- | --- | --- | --- | --- |
| vitest `maxWorkers` | one run | yes | no | n/a | cap per run only; N worktrees still stack N pools. `vitest/dist/chunks/cli-api.BK8pd4xc.js:2355` |
| vitest `fileParallelism:false` | one run | 1 | no | n/a | serializes files, does nothing across runs |
| vitest `maxConcurrency` (default 5) | one file | yes | no | n/a | concurrent tests inside a file, `defaults.9aQKnqFk.js:71` |
| vitest custom `poolRunner` | one run | yes | no | n/a | vitest 4.1 `reporters.d.DtoKVV2s.d.ts:3523`; a scheduler seam, still per run |
| vitest issue #9696 | one run | requested | no | n/a | open, no native cross-project cap |
| `proper-lockfile` (already a root dep, 4.1.2) | machine | via N slot files | yes | mtime stale + `onCompromised` | `scripts/browser-queue.mjs` uses it as a 1-slot run mutex today |
| globalSetup net server + `provide(port)` | one run + optional peers | yes | yes if a well-known socket path | server death frees all | bespoke ~80 lines; second run must discover the first run's socket |
| `p-limit` / `async-mutex` | one process | yes | no | n/a | in-process only |

Sources: [Parallelism guide](https://vitest.dev/guide/parallelism), [globalSetup](https://vitest.dev/config/globalsetup), [maxWorkers](https://vitest.dev/config/maxworkers), [maxConcurrency](https://vitest.dev/config/maxconcurrency), [issue #9696](https://github.com/vitest-dev/vitest/issues/9696), [discussion #6527](https://github.com/vitest-dev/vitest/discussions/6527).

Build target for pw-sema: `proper-lockfile` over N slot files in `~/.cache/hafley-rxjs/slots/<i>`, N = `semaphore.slots ?? workerBudget().workers`,
one slot held per launched browser for the worker's life, released in the browser resource teardown. Same lock dir the run-level
queue uses, so the two compose.

## 4. Machine safety rules for the parity suite

- `vitest.parity.config.ts`: `fileParallelism: false`, `maxWorkers: 1`.
- Every child `vitest run` a parity test spawns passes `--maxWorkers=1` and `--no-file-parallelism`, `stdio: pipe`, `timeout` on the child.
- No parity test launches more than 2 browsers at once.
- `pnpm test` does not include `tests/parity`; `pnpm test:parity` does.
