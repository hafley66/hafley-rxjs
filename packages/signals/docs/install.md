---
title: Install
---

# Install

```sh
npm install @hafley66/signals rxjs immer lodash
```

`rxjs` is the stream behind every signal, `immer` backs `setImmer`, and `lodash` is used for the
structural comparisons the proxy needs. All three are real dependencies rather than peers.

## The subpaths

| import | what it holds |
| --- | --- |
| `@hafley66/signals` | the constructor, the operators, the producers, `createSlice` |
| `@hafley66/signals/Signal` | the constructor alone, for a consumer that wants nothing else |
| `@hafley66/signals/react` | `SignalReact` and `useSignal` |
| `@hafley66/signals/jsx-runtime` | the JSX runtime the vite plugin redirects to |
| `@hafley66/signals/vite` | `signalsJsx`, the plugin that does the redirecting |

`react` and `vite` are optional peers. A consumer that never imports them never installs them.

## Logging

Every reactive step emits a structured record through LogTape, an optional peer. With no sink each
call site costs one boolean read:

```ts
import { configure, getConsoleSink } from "@logtape/logtape"
import { enableSignalLogTape } from "@hafley66/signals"

await configure({
  sinks: { console: getConsoleSink() },
  loggers: [{ category: "signals", lowestLevel: "debug", sinks: ["console"] }],
})
await enableSignalLogTape()
```

`setSignalLogEmit(fn)` installs a raw counting sink instead, which is what a benchmark wants, and
what the timing strip under every demo on this site is reading. `disableSignalLogging()` puts the
boolean back.
