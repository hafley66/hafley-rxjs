# Playwright surface over the BEWPP transport — design

Skim version: the bottom half is evidence and sequencing. If you read one thing, read the table.

## Goal

Callers write code against Playwright's **types** — `Page`, `Locator` — and it runs through
BEWPP's extension messaging, no `chrome.debugger`. Selector semantics are Playwright's own,
because the injected engine runs (measured, see Evidence).

## Method → transport → backing

| Playwright call | BEWPP command | backing | status |
| --- | --- | --- | --- |
| `page.goto(url)` | `navigate` | `chrome.tabs.update` + `webNavigation.onCommitted` | ✓ |
| `page.reload/goBack/goForward` | `navigate` variants | `tabs.reload`, `tabs.goBack/goForward` | ✓ |
| `page.url()/title()` | `inspect` / `tabs` | `tabs.get`, `document.title` | ✓ |
| `page.waitForURL(re)` | poll `tabs` + `webNavigation` | `onCommitted` per frame | ✓ |
| `page.waitForLoadState("networkidle")` | synthesized | count in-flight via `webRequest` | partial — no native event |
| `page.getByRole/getByLabel/getByTestId/getByPlaceholder/locator` | `query` | injected engine `.parseSelector` | ✓ |
| `locator.first()/last()/nth()/filter({has,hasText,visible})` | `query` with composed selector | engine `>> nth=`, `:has-text`, `:visible`, `has=` | ✓ |
| `locator.count()/isVisible()/isEnabled()/textContent()/getAttribute()/inputValue()` | `query` read actions | engine + DOM reads | ✓ |
| `locator.click()/hover()/fill()/selectOption()/press()/check()` | `query` mutations | Testing Library `user-event` | partial — synthetic, `isTrusted:false` |
| `locator.waitFor({state,timeout})` | `wait` | `waitFor` poll loop in content script | ✓ |
| strict mode, `aka getByRole(...)` suggestions | engine errors passed through verbatim | `InjectedScript.querySelector(parsed, root, strict)` | ✓ |
| `page.screenshot()` (viewport, compositor pixels) | `capture` | `tabs.captureVisibleTab` | partial — foreground tab, `<all_urls>`, ~2/s |
| `page.screenshot({fullPage, clip})` | `rasterize` | MAIN-world `foreignObject` → canvas → PNG | ✓ as a re-render; canvas/iframe subtrees blank |
| `page.clock.install/setFixedTime/runFor` | `clock` | injected `createClock(globalObject)` — Playwright's own, realm-side | ✓ |
| timezone / locale | `patchIntl` | `Intl` overrides in MAIN world | partial — JS-visible values only, not network headers |
| `page.route()/route.fulfill()` | `route` | DNR block/redirect/modifyHeaders + MAIN-world `fetch`/XHR patch | partial — no document/subresource/worker coverage, no body synth at network layer |
| `page.evaluate(fn)` | `evaluate` | `chrome.scripting.executeScript({world:"MAIN"})` | ✓ |
| cookies / storage state | `cookies` | `chrome.cookies` + injection | ✓ |
| downloads | `download` | `chrome.downloads` | ✓ (better than CDP) |
| worker / MV3 service-worker targets | — | no extension execution context | ✗ |
| `page.setViewportSize`, clock, timezone, locale | — | no `Emulation.*` equivalent | ✗ |

## Types

- Satisfy structural subsets: `Pick<Page, …>` and `Pick<Locator, …>` for the rows above.
  Callers can `import type { Locator } from "playwright"` and pass our object where the
  subset matches; no Playwright runtime object is ever constructed.
- `playwright` is a **peerDependency + devDependency only** — the repo audit flags runtime
  singletons held as dependencies, and this package must not ship its own copy.
- Option bags mirror Playwright's (`{ timeout?, force? }`); `force` is accepted and ignored
  where MV3 cannot honor it, rather than silently changing meaning.
- Errors are Playwright's own strings — strict-mode violations come out of the engine, so no
  message rewriting layer.

## Auto-wait and retry

- Default timeout 5 s, poll interval 100 ms, matching the existing `timeoutMs` default in
  `0_commands.ts`.
- Strict by default. `locator.first()` sends an explicit `nth=0` rather than relaxing strictness.
- One retry on `Target closed`/tab detach only; mutations never auto-retry (an interrupted
  response can follow an already executed click — same rule as `BridgeClient.call`).

## Engine delivery

- BEWPP already registers a MAIN-world `document_start` content script (`page-hooks.js`, built from
  `src/extension/2_page_hooks.ts` in `3_build.mjs`). The engine rides that existing slot.
- Page CSP does **not** constrain MAIN-world injected code: under `script-src 'self'`, `eval`,
  `new Function`, and an appended inline `<script>` all ran (probe `csp-eval.mjs`). So the ~320 KB
  engine does not have to be a second registered file — the worker can deliver it on demand with
  `scripting.executeScript({ world:"MAIN", func: source => eval(source), args:[engineSource] })`
  and pay the bytes only on documents that resolve selectors.
- Constructed once per document: `new InjectedScript(window, { sdkLanguage:"javascript",
  testIdAttributeName, stableRafCount:1, browserName:"chromium", isUtilityWorld:false, customEngines:[] })`.
- Frames are injected explicitly per `frameId` from `webNavigation.onCommitted` →
  `scripting.executeScript`. Static `all_frames` measured unreliable (1 of 4 runs).
- The engine's `addBinding` callbacks are replaced by `chrome.runtime.sendMessage` through the
  existing content-script relay; nothing else in the engine is patched.

## Lifetimes

- One `ExtensionConnection` owns one worker socket and the tab inventory (existing).
- A `BewppPage` borrows a tab through the existing host lock; commands run through
  `BrowserControlHost.run` so app and MCP clients keep mutual exclusion.
- Teardown is named `unsubscribe` per repo rule; `dispose`/`close`/`stop` are not used.
- Attaching to a tab the user already has does not navigate, focus, or capture it unless the
  caller asks; screenshot and `bringToFront` are the only focus-affecting calls, and they are
  documented as such.

## Fixed by measurement, not opinion (probes in `packages/bewpp/probes/`)

| claim | measurement |
| --- | --- |
| injected engine works under MAIN-world injection | resolves role/text/nth/visible/testid/internal selectors; strict violations verbatim (`injected-script.mjs`) |
| `Set-Cookie` on a synthetic `Response` sets a cookie | no (`main-world-hook.mjs`) |
| subresources, documents, workers reachable by a page hook | no — all reach the network (`main-world-hook.mjs`) |
| `window.fetch = …` preserves the hook | no — plain reassignment discards it (`main-world-hook.mjs`) |
| `tabs.captureVisibleTab` | 800×513 against a 4000px document; follows the foregrounded tab; needs `<all_urls>`; 6/6 rapid calls rejected (`screenshot.mjs`) |
| DOM-realm rasterization | element capture exact (400×200) and full-page capture **800×4400** from a **background** tab, correct pixels at y=4100 (`dom-screenshot.mjs`) |
| `foreignObject` delivery | `blob:` URL taints the canvas (`SecurityError`); the same SVG as a `data:` URL is clean — plain SVG is clean either way |
| nested `<canvas>` in a capture | content absent (sample inside the canvas region reads the parent background) |
| synthetic click `isTrusted` | false (`main-world-hook.mjs`) |

## Blocked, and what would unblock it

| blocked | unblock |
| --- | --- |
| trusted input, worker targets, true compositor pixels | `chrome.debugger` permission + allow-listed proxy (the fork's `relayConnection.ts:41` shape) |
| `route.fulfill` for documents/subresources/workers | `Fetch.enable` (debugger) or a local proxy host |
| pixel parity with Playwright screenshots | nothing in MV3 — DOM-realm capture re-renders, so layout-affecting state, animations, and canvas/iframe subtrees differ |

## Sequencing

1. Engine delivery in `buildExtension` + per-frame injection. Gate: probe asserts promoted to a package test.
2. Locator surface (`query` read + mutation actions, option bags, strictness).
3. Page surface (navigation, `waitForURL`, `evaluate`, cookies).
4. `screenshot` with an explicit capability error for `fullPage`/`clip` instead of silent partiality.
5. `@hafley66/vitest-playwright`: `{ kind: "bewpp", … }` browser source + borrowed-context ownership.

Commits per step, explicit paths, never push.

## Open decisions

1. Where the adapter lives: `@hafley66/bewpp` (one package, transport + surface) or
   `@hafley66/bewpp-playwright` on top.
2. `page.screenshot()` default: throw on `fullPage`/`clip`, or return a viewport capture with a
   `partial: true` field.
3. Whether `networkidle` synthesis is worth building or should stay unimplemented and error.
