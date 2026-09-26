# Brief: chore/the-gang-drops-the-map

Do `issues/boop-xterm-no-map-one-signal/item.md` in full, in `packages/boop-xterm` only.

Rules:
- Read `~/projects/claude-research/skills/signals/SKILL.md` and `skills/rxjs/SKILL.md` first. One `Signal<BoopXtermHostState>` read by path; no per-field Signal records; libraries never `.subscribe()`.
- No JS `Map` anywhere in `src` (tests included); `Set` is allowed.
- Symbol renames go through `extract rename` (read `extract rename --help`, dry-run, then `--commit`).
- Gates: `pnpm typecheck`, `pnpm test`, and the browser suite via `node ../../scripts/browser-queue.mjs vitest run --config vitest.browser.config.ts`. Each command capped at 300s.
- Don't add tests. Update existing ones to the new ports shape.
- Instant must follow: write `plans/2026-09-26-instant-one-host-state.BRIEF.md` describing the instant `terminal.ts` ports change (one object literal). Do not edit instant.
- Commit on the branch; do not push; do not merge; do not publish.

Report (mail back), 3 lines: `BoopXtermHostState` fields; the Map count before → after; gate receipts.
