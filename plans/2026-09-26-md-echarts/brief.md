# md: `echarts` fence plugin (multi-line charts)

You work in `$PWD`, a git worktree of hafley-rxjs. The package is `packages/md`.

## Goal

A fenced block with language `echarts` renders an ECharts multi-line chart.

The body is CSV:
- The first column is x.
- Every other column is one line series.
- A first column named `time` holds epoch seconds or ISO timestamps and gets a `time` axis.
- A numeric x gets a `value` axis; anything else gets a `category` axis.
- An empty cell is a gap, drawn with `connectNulls: false`.

If the body starts with `{`, parse it as a raw ECharts option JSON and pass it through.

    ```echarts title="ec temp"
    time,spark_1,spark_2
    1790353200,46.85,45.85
    1790353500,46.85,45.95
    ```

The CSV contract must match `~/projects/sparkup/scripts/5_echarts_lines.py`, so the same CSV files work in both. Read that script for the option shape: `tooltip` `axis`, a legend, `dataZoom` both `inside` and `slider`, and `yAxis.scale: true`.

## Follow the marbles plugin exactly

Mirror these files:
- `src/plugins/1_MarblesFence.tsx`
- `src/plugins/2_marblesPlugin.tsx`
- the `./plugins/marbles` entry in `package.json` exports
- the optional peer dependency setup

Create:
- `src/plugins/1_EchartsFence.tsx`
- `src/plugins/2_echartsPlugin.tsx`
- the `./plugins/echarts` subpath export and build entry

Rules:
- `echarts` is an OPTIONAL peer dependency, listed in `peerDependenciesMeta` with `optional: true`, and a devDependency for tests.
- NEVER export the plugin from `src/plugins/index.ts` or `3_defaultMdPlugins.ts`. Instant's Vite optimizer would then resolve an uninstalled peer and `just dev` dies. Afterwards, verify that `dist/index.js` and `dist/plugins/index.js` never reach `echarts`.
- Import `echarts/core` plus only `LineChart`, the Grid, Tooltip, Legend, DataZoom and Title components, and `CanvasRenderer`.
- Dispose the chart on unmount. Resize it with a `ResizeObserver` on the host element.
- RxJS law: zero `.subscribe()` in library code. If you need a stream, follow how the marbles plugin does it. Read the `rxjs` skill at `~/projects/claude-research/skills/rxjs/SKILL.md` first.

## Tests: light only

The user is angry about Playwright and browser test runs loading the machine.

Do NOT run:
- Playwright
- vitest browser mode
- any `*.browser.test.tsx`
- the full package test suite

Run only:
- `pnpm --filter @hafley66/md exec tsc --noEmit`
- ONE node-mode vitest file you write, `src/plugins/2_echartsPlugin.test.ts`. It tests the pure CSV-to-option function with `toMatchInlineSnapshot`. Never use `toBeDefined`.

The CSV-to-option function must be pure and exported from its own file, `src/plugins/0_echartsOption.ts`, so the test needs no DOM.

## Commits

- `feat(md): echarts fence - ...`, one commit per working step.
- Do not touch `packages/bewpp`; another agent has uncommitted work there.

## Done

Reply with:
- the commit list
- the inline snapshot of the option for the 3-row sample above
- the grep proving `dist/index.js` and `dist/plugins/index.js` never import echarts
