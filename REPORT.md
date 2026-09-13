# signal-grid color-scheme lane

- Step 1 commit: `6c513bf signal-grid: the host owns color-scheme`
- Step 1 correction: `4e31a77 signal-grid: the demo picker still owns its scheme`. `.demo`
  keeps `color-scheme: var(--demo-scheme)`; the added `:root` override is removed.
- Step 2 commit: none; neither test command printed a warning
- Chromium before: 240 (task baseline). After: 243 passed (240 + 3 new tests)
- typecheck: exit 0. docs: exit 1, pre-existing (see below)

## Step 2 warning grep

`pnpm -F @hafley66/signal-grid test 2>&1 | grep -i warn` -> no output, grep exit 1.
`pnpm -F @hafley66/signal-grid test:browser 2>&1 | grep -i warn` -> no output, grep exit 1.
No config key changed.

## docs

Exit 1, pre-existing: 32 violations (5 missing-file, 27 hard-coded) in
`packages/signal-grid/docs/*.md` and `PITCH.md`, all absent generated artifacts and
stale stats. No page states the color-scheme rule (`grep -rn color-scheme docs README.md`
is empty), so no sentence was corrected. Main at `8a260f1` also exits 1 (29 hard-coded).

## Files changed

`src/theme.css`, `src/9_css.test.ts`, `bench/scroll/{gallery,knobs,chaos}.html`,
`demo/demo.css`, `REPORT.md`
