# bewpp

Local browser controls through a Manifest V3 extension. The host application supplies
the permitted sites and interprets the DOM using `PageControls` and `LocatorControls`.

```text
Host application / test / optional MCP tool
  → ExtensionConnection → authenticated loopback WebSocket
  → Chrome service worker → extension messaging → isolated content script → DOM
                                                    ↕ observation events
                                               main-world storage hooks
```

## Use

Node 24+, Chrome 120+. From the workspace root: `pnpm --filter @hafley66/bewpp receipts`.
The package can be copied outside its current workspace. `pnpm pack` includes built
Node exports and the extension source consumed by the build API.

```js
import Fastify from "fastify"
import { ExtensionConnection, registerExtensionBridge } from "@hafley66/bewpp"
import { buildExtension } from "@hafley66/bewpp/build"
import { pairingToken } from "@hafley66/bewpp/pairing"

const connection = new ExtensionConnection()
const app = Fastify()
const token = pairingToken("./local-data")
registerExtensionBridge(app, { connection, token })
await app.listen({ host: "127.0.0.1", port: 7870 })
await buildExtension({
  outDir: "/absolute/path/to/unpacked", token,
  url: "ws://127.0.0.1:7870/extension",
  matches: ["http://localhost/*"], name: "bewpp",
})
// Load that directory through Chrome's Load unpacked, then open the permitted site.
// Once connection.status().page_ready is true:
const page = connection.getPage()
await page.getByLabel("Search").fill("fixture")
await page.getByRole("button", { name: "Search" }).click()
// On host shutdown, settle application jobs before closing this connection.
await connection.shutdown()
await app.close()
```

## Public boundaries

| Export | Responsibility |
| --- | --- |
| `PageControls`, `LocatorControls`, `DomCommand`, `ExtensionCommands` | Browser contract and serialized commands |
| `ExtensionConnection` | RPC peer, tab inventory, default page selection, connection lifecycle |
| `ExtensionPage`, `ExtensionLocator` | Host-side page and locator commands |
| `registerExtensionBridge(app, { connection, token, path? })` | Authenticated Fastify WebSocket endpoint |
| `BrowserControlHost(connection, busy?)` | Shared app/MCP command lock and validated command dispatch |
| `registerBrowserControl(app, { host, token })` | Authenticated loopback `/bewpp/command` endpoint for local clients |
| `browserCommandSchema`, `locatorActionSchema`, `locatorSchema`, `tabSchema` | Zod command schemas shared with MCP tools |
| `/build`: `buildExtension({ outDir, token, url, matches, name?, version? })` | Rolldown content-script and worker bundles plus MV3 manifest |
| `/pairing`: `pairingToken(dataDir)` | Persistent local pairing token |
| `/dom`: `executeDom(command)` | Browser-only executor source for bundling into owned extensions or tests |

`connection.tabs` contains permitted tabs. `getPage(tabId)` addresses a particular
tab; `getPage()` retains its selected tab while available. The optional `acceptsPage`
predicate limits default selection. `page.bringToFront()` activates its tab/window.

Locators support role/name, label, placeholder, test ID, CSS, nested roles, `has`/visibility
filters, and `nth`. With the selector engine installed (`page.installSelectorEngine(loadEngineSource())`)
a locator compiles to the Playwright selector its `getBy*` would compile to and resolves through
Playwright's own engine, so `exact`, strict mode, and error text are Playwright's; without an engine
each operation falls back to Testing Library resolution, which matches role names exactly and treats
`exact: false` as a case-sensitive substring. Operations include click, fill, select, navigation keys,
hover, wait, value/text reads, structured page inspection, image enumeration, and image download.
Single-element operations resolve strictly, retry until `timeout` expires (default 5000 ms), and fail
with `Expected one element; found N.`; `count`, `allTextContents`, and `waitFor` resolve loosely, and
`isVisible` answers `false` rather than failing. Playwright's `delay`/`timeout`/`noWaitAfter`/`force`
options are accepted, `force` and `noWaitAfter` change nothing because no actionability preflight runs,
and any option value that would change what the action does (`trial`, `button`, `clickCount`,
`modifiers`, `position`, `steps`) is refused instead of ignored. Submission-labelled/form buttons
require `{ allowSubmit: true }`. Page navigation stays within the extension's granted origins.

`page.observe(...)` starts a bounded per-document event buffer. Sources can include
debounced DOM text snapshots, `localStorage`, `sessionStorage`, IndexedDB mutations, and
`click` (see below). `readObservations({ afterSequence, limit })` supports cursor-based reads;
`stopObserving()` stops collection and returns the retained buffer. Storage values
are excluded unless `includeValues` is true. Main-world hooks observe same-tab page
writes while the isolated content script retains the buffer and extension channel.
Observations and cursors are discarded by navigation.

`page.evaluate(source, args)` runs a function expression in the page's own realm and returns its
awaited, serializable result; `readStorage(kind, key)` and `snapshotStorage(kind)` read Web Storage,
which observation cannot do for values written before it started.

The `click` source records clicks with a Playwright selector when the selector engine is installed,
plus fallback candidates (`#id`, `[data-testid=…]`, `[aria-label=…]`, `:has-text(…)`) and the clicked
element's ancestry. `ClickLog({ path })` persists them to SQLite through `node:sqlite` and reads the
most recent back with `recent(limit)`, so a person can click through a flow and hand the targets over
for automation without anyone parsing the DOM.

## Lifetimes and state

A connection owns one WebSocket peer and a tab inventory. A worker replacement
closes the previous peer. `disconnect()` pauses page selection; `connect()` enables
it again. `shutdown()` closes the peer. The worker retries connections after closure,
sends heartbeats, and uses an alarm to wake after suspension. It publishes permitted
tabs on connection and tab changes. It does not retain or replay DOM commands.

Locators retain query descriptions. Each operation resolves the current DOM, so a
React render may replace an element between calls. Content-script registration is
guarded per bundle build and document. The host receives results through birpc;
Chrome messages use `@webext-core/messaging`. Query resolution uses Playwright's
injected engine where it is installed — the engine runs in the main world and the
content script in the isolated world, so the engine tags its matches with a marker
attribute and the content script addresses those elements by marker. Interaction and
the engine-less fallback use Testing Library. Rolldown builds both the Node entry and
the extension bundles.

Application jobs, retries, receipts, provider wiring, and UI subscriptions belong to
the host. The package has no host-app imports.

## Extension testing and limits

The integration test loads bewpp alongside another extension and controls DOM added
by that extension's content script. This supports testing extension effects on
permitted web pages. An owned extension can also bundle `/dom` into its own execution
context and expose a message handler.

Implemented operations use synthetic DOM events. IndexedDB operations issued inside
Web Workers do not pass through the page-world hook. Trusted-input-only flows, debugger
commands, cross-origin frames, closed shadow roots, browser chrome, and another
extension's popup/service-worker internals are outside the current controls. Images
are read from the page; HTTPS image downloads can fall back to the Node host when
the page fetch fails. That fallback has no browser cookies.

The local bridge accepts a paired Chrome extension origin. The generated extension
contains its pairing token, and the host application should keep that output local.
Any local client can attach to `/bewpp/command` on the existing host, so app and
external tooling share one extension socket. App actions must use `host.run(...)` to
participate in mutual exclusion; the optional `busy` callback reserves access during
longer application jobs. Overlapping commands return a busy error without queuing or
automatic retries.
