# pw-sema receipt

Validation command, run from `packages/vitest-playwright`:

```
pnpm lint && pnpm typecheck && pnpm test:semaphore 2>&1 | tail -30 && pnpm test 2>&1 | tail -15
```

## Result

| step | result |
| --- | --- |
| `pnpm lint` | 3 errors, all pre-existing at HEAD in files this lane does not own: `src/12_budget.ts` (format), `src/9_runner.ts` (format), `src/index.ts` (organizeImports). `biome check src/0_options.ts src/5_streams.ts src/13_semaphore.ts` is clean. |
| `pnpm typecheck` | exit 0 |
| `pnpm test:semaphore` | 1 file, 2 tests passed |
| `pnpm test` | 8 files, 114 passed, 5 expected fail |

## Tail

```
$ pnpm lint
        9 │ + export·{·availableMemoryBytes,·BYTES_PER_WORKER,·type·WorkerBudget,·workerBudget·}·from·"./12_budget.js"
    10 10 │

Checked 16 files in 61ms. No fixes applied.
Found 3 errors.
check ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × Some errors were emitted while running checks.

[ELIFECYCLE] Command failed with exit code 1.

$ pnpm typecheck
$ tsc --noEmit -p tsconfig.json
typecheck exit: 0

$ pnpm test:semaphore
$ vitest run --config vitest.semaphore.config.ts

 RUN  v4.1.11 packages/vitest-playwright

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  20:49:48
   Duration  7.61s (transform 13ms, setup 0ms, import 19ms, tests 7.51s, environment 0ms)

$ pnpm test

 Test Files  8 passed (8)
      Tests  114 passed | 5 expected fail (119)
   Start at  20:49:56
   Duration  6.86s (transform 264ms, setup 195ms, import 76ms, tests 17.11s, environment 3ms)
```

## What the two tests prove

| test | assertion | why it is not vacuous |
| --- | --- | --- |
| `slots:1 serializes two child browser lifetimes` | later child's `launch` timestamp >= earlier child's `close` timestamp, both children exit 0 | the `slots:2` case is the control: the same two children, same fixture, overlap |
| `slots:2 lets two child browser lifetimes overlap` | later child's `launch` < earlier child's `close` | fails if the slot dir served one child at a time |

Both children are real `vitest run` processes (`node:child_process` spawn, `stdio: "pipe"`, `--maxWorkers=1 --no-file-parallelism`,
90s kill timer, at most 2 alive) on `tests/semaphore/fixtures/`, which loads the real plugin and a real chromium. No mocks,
no fake locks, no stubbed playwright. Timestamps cross processes as JSON lines in a temp file named by `PW_SEMA_LOG`.
