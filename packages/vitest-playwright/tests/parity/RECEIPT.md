# Parity suite receipt

Run: `cd packages/vitest-playwright && pnpm typecheck && pnpm test:parity 2>&1 | tail -40`, 2026-09-15.
`pnpm typecheck` exits 0 with no output. `pnpm test:parity`: 6 failed, 8 passed, 14 files, 18.36s.

## TOC

1. Result table
2. Validation tail
3. Notes on the rows
4. Progress edits

## 1. Result table

| id | file | red/green | why |
| --- | --- | --- | --- |
| pw-workers | `tests/parity/pw-workers.test.ts` | green | resolved workers 3, inside `floor(cores/2)` and `availableBytes / BYTES_PER_WORKER` |
| pw-debug1 | `tests/parity/pw-debug1.test.ts` | red | `VITEST_PLAYWRIGHT_DEBUG=1` child resolved workers 3, not 1 |
| pw-browser | `tests/parity/pw-browser.test.ts` | green | 2 files, 1 worker, `isolate:false`: one `pw:browser <launching>` line |
| pw-launch0 | `tests/parity/pw-launch0.test.ts` | green | under `testTimeout: 1` the body still gets an open page; acquire is outside the test timeout |
| pw-launchopts | `tests/parity/pw-launchopts.test.ts` | green | `browser.launch.args` reaches the `<launching>` command line |
| pw-ctx | `tests/parity/pw-ctx.test.ts` | green | the first test's context emits `close` and leaves `browser.contexts()` |
| pw-page | `tests/parity/pw-page.test.ts` | green | the saved page reports `isClosed()` after its context closed, with no page teardown of its own |
| pw-timeouts | `tests/parity/pw-timeouts.test.ts` | green | `timeouts.action: 50` fails a missing-node click in under 500ms |
| pw-noall | `tests/parity/pw-noall.test.ts` | red | the `beforeAll` failure is vitest's `FixtureAccessError`; nothing names the per-test basis rule |
| pw-failkill | `tests/parity/pw-failkill.test.ts` | red | 1 launch across the failing file and the next file; the worker is not recycled after a failure |
| pw-teardown | `tests/parity/pw-teardown.test.ts` | green | receipt order is `context.close`, `afterAll`, `browser.close` |
| pw-reuse | `tests/parity/pw-reuse.test.ts` | red | `contextScope: "worker"` gives each test a fresh context, so the identity assert fails in the child |
| pw-video-noreuse | `tests/parity/pw-video-noreuse.test.ts` | red | the video half holds; the video-off baseline run fails, so the opt-out is unobservable |
| pw-connect-env | `tests/parity/pw-connect-env.test.ts` | red | with `PW_TEST_CONNECT_WS_ENDPOINT` set to a live `launchServer()` endpoint the child still launched 1 local browser |

Not covered: `pw-hash`, `pw-idle`, `pw-groups` (status `n/a vitest`), `pw-sema` (another lane owns it).

## 2. Validation tail

```
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/6]⎯

 FAIL  tests/parity/pw-video-noreuse.test.ts > video opts out of a shared worker context
AssertionError: pw-video-noreuse: the video opt-out is unobservable while contextScope "worker" shares no context at all; the video-off baseline run failed

 RUN  v4.1.11 /Users/chrishafley/projects/hafley-rxjs/.boop-worktrees/feature/pwp-red-tests/packages/vitest-playwright/tests/parity/fixtures/pw-reuse

 ❯ test.test.ts (2 tests | 1 failed) 229ms
   × second test reuses the same context with storage reset 65ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
   Start at  20:51:23
   Duration  960ms (transform 84ms, setup 21ms, import 7ms, tests 229ms, environment 0ms)

: expected 1 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 1

 ❯ tests/parity/pw-video-noreuse.test.ts:15:5
     13|     baseline.code,
     14|     `pw-video-noreuse: the video opt-out is unobservable while context…
     15|   ).toBe(0)
       |     ^
     16| })
     17|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/6]⎯


 Test Files  6 failed | 8 passed (14)
      Tests  6 failed | 8 passed (14)
   Start at  20:51:12
   Duration  18.36s (transform 49ms, setup 0ms, import 294ms, tests 17.06s, environment 1ms)

[ELIFECYCLE] Command failed with exit code 1.
```

## 3. Notes on the rows

| row | note |
| --- | --- |
| pw-ctx | the row's `browser.contexts().length === 0` is not observable from a later test: the aroundEach hook opens that test's own context before its body runs, so the count is 1. The test asserts the stronger pair instead: the first context emitted `close` and is gone from `browser.contexts()`. Behavior matches the row, status unchanged |
| pw-noall | vitest rejects a fixture in `beforeAll` on its own (`FixtureAccessError: The beforeAll hook uses fixtures "page", but has no access to context`). That is a different message from playwright's, so the row stays `absent` until `4_test.ts` throws the per-test message |
| pw-launchopts | the row asks for no assert; the test pins the passthrough by matching the launch arg on the `DEBUG=pw:browser` line, which costs one extra child run and no new code |
| pw-video-noreuse | the mechanism needs `pw-reuse` first, so the test spawns two sequential child runs: the `pw-reuse` fixture as the video-off baseline and its own fixture with `video: "on"`. The second passes today, the first does not |
| pw-workers | the child compares against the live host at test time while the plugin resolved at config time; a large memory swing between the two could move the memory cap |

## 4. Progress edits

| row | old status | new status | proof |
| --- | --- | --- | --- |
| pw-teardown | unverified | present | `tests/parity/pw-teardown.test.ts` reads the child's `order.json` and the order is `context.close`, `afterAll`, `browser.close`, the order the row claims |

No other status cell changed.
