# boop-xterm-wave2-design revision 2 (sol6)

Revise `plans/boop-xterm-wave2.DESIGN.md` in place. Same 8 sections. Commit subject exactly:
`plans: boop-xterm wave 2 design r2 (signals endpoints)`.

Read first, whole files: `~/projects/claude-research/skills/signals/SKILL.md`,
`packages/signals/src/{2_Signal.ts,3_Endpoint.ts,4_Query.ts,7_signalMap.ts,index.ts}`, `packages/signals/GUIDE.md`,
`packages/xdom/README.md` + `packages/xdom/src/index.ts`, `packages/path/README.md`,
`~/projects/instant/src/generated/native.ts` (commandEndpoint) and `~/projects/instant/src/reactive/0_requestTransport.ts`.

## Rulings (user, 2026-09-25) replacing r1 choices
1. DELETE the request$/response$ + requestId + RpcResponse + host requestBus Subjects design. None of it survives.
2. Every native call is an `Endpoint<I, O>` from `@hafley66/signals`. The port record carries Endpoints, typed by the
   domain I/O. Reads use `createQuery(endpoint, inputSignal, options)`; writes use `createMutation`.
   Polling (the 1s/5s TTLs, activity lease) uses `QueryOptions.refetchInterval` / `pauseWhen`, not interval+flags.
   instant supplies them with its existing `commandEndpoint("<rust command name>")`. Copy command names exactly from
   generated/native.ts; list each: port field | rust command | I | O | query or mutation.
3. State is `Signal` roots, one grouped root per pane lifetime, nested paths for fields. Use every Signal kind where it fits
   and say which kind per field: `Signal(value)`, `Signal(source$, initial)`, `Signal(() => derived)`, `signalMap`,
   bare `Signal<Event>()` for transient events. No Subject/BehaviorSubject in the package. No mirrored copies.
4. Host inputs (pane visible, harness, clipboard enabled, pane closed) are Signals the host passes in (`SignalSource`),
   not Observables-of-void.
5. DOM and xterm events: xdom operators / `new Observable` adapters with teardown in the source. xterm `onX` registrations
   become `new Observable` whose teardown calls the native `dispose()` at the direct call site only.
6. React surfaces (turn marks etc. later waves) read `signal.$()` in plain JSX through `signalsJsx()`; no useEffect wiring.
   Say which of this wave's outputs a JSX reader would read.
7. Casing: port fields named after a Rust command keep the Rust spelling; every other TS field is camelCase. No `_` names
   otherwise.
8. `.subscribe(` count in package: 0. Function-typed params allowed only where the signals API itself takes them
   (Endpoint config, Signal(() => ...)); list any other and justify with file:line.

## Keep from r1
Current-signature column, open questions (answer any the reading resolves), test plan (rewrite cases against the
new shapes; TestScheduler + a test EndpointTransport, no mocks of product code).

## Validation
`rg -n 'requestId|RpcResponse|requestBus|Subject' plans/boop-xterm-wave2.DESIGN.md` prints only lines inside the
"Current signature" column.
Receipt: status / sha / files / validation / next.
