# md: batched references and plugins

Issues: `md-reference-provider`, `md-optional-viz-plugins`, `grapht-semantic-css-theming` (hafley-rxjs),
`turn-hover-highlights-square` (instant).

## 1. Reference provider

md finds reference-looking spans and asks a host-supplied resolver, in batches. md owns the contract and
the render; it never knows about instant, boop, tmux, or git.

### Type signatures

```ts
// packages/md: the contract a host implements
type RefKind = "path" | "path-line" | "symbol" | "turn" | "url"

type RefCandidate = {
  key: string            // `${docPath}\u0000${text}`: one request per distinct ref per document
  text: string           // `2_call.rs:561,583`, `#202`, `S145`, `ReactDOM.render`
  kind: RefKind          // md's classifier; the host may still answer miss
  docPath: string | null // the file the markdown came from, the resolver's anchor
}

type RefTarget = { href: string; label: string; line?: number; range?: [number, number] }

type RefResolution =
  | { key: string; status: "hit"; target: RefTarget }
  | { key: string; status: "choices"; targets: RefTarget[] }
  | { key: string; status: "miss" }

// host supplied; cold; one call per batch
type ReferenceResolver = (batch: RefCandidate[]) => Observable<RefResolution[]>

// md's surface
type RefState = { seen: Record<string, RefCandidate>; resolved: Record<string, RefResolution> }
function referencesModel(resolver: ReferenceResolver): {
  state: Signal<RefState>                    // grouped root, read by JSX
  offer: Signal<RefCandidate>                // bare event signal: a span came into view
  resolved$: Observable<RefState>            // the graph; md never subscribes it
}
```

### Body (pseudo)

```ts
// offer.$ is written by the inline-code / text renderer's ref callback when a span is in view
resolved$ = offer.$.pipe(
  distinct(c => c.key),                       // a key is asked once per model lifetime
  bufferTime(16, null, 64),                   // one frame, at most 64 per batch
  filter(batch => batch.length > 0),
  mergeMap(batch => resolver(batch), 2),      // two batches in flight
  scan((s, rows) => ({ ...s, resolved: { ...s.resolved, ...byKey(rows) } }), empty),
)
state = Signal(resolved$, empty)              // the JSX tracker is the only subscriber
// <CodeRef c={c}/> reads state.resolved[c.key].$(): underline on hit, picker on choices, plain on miss
```

### Instance timelines

| instance | born | dies |
| --- | --- | --- |
| `referencesModel` | once per mounted markdown document | document unmount: the tracker's last reader leaves, `finalize` drops in-flight batches |
| `offer` event | span enters view (xdom in-view producer) | same frame |
| batch | 16 ms after the first offer in it, or at 64 offers | resolver completes or model dies |
| resolver call | per batch, cold | completion or unsubscribe (host cancels its IPC) |

### Storage, reads, writes, uniqueness

| data | stored in | written by | read by | unique on |
| --- | --- | --- | --- | --- |
| candidates | `state.seen` | `offer` via `distinct` | nobody else (debug) | `key` = docPath + text |
| resolutions | `state.resolved` | `scan` over resolver output | `<CodeRef>` JSX | `key` |
| host cache | host side (boop-harness roots cache) | host | host | host's choice |

Sequence for one visible table of refs:

```text
offer     --a-b-c---------d-------|      spans scroll into view
distinct  --a-b-c---------d-------       a repeat `a` is dropped here
batch     ------[abc]---------[d]--      bufferTime(16)
resolver  ----------R(abc)------R(d)-    host answers per batch
resolved  ----------{abc}-------{abcd}   scan; JSX re-renders the three, then one
```

### Host side (not in md)

instant supplies `ReferenceResolver` as one IPC: `resolve_refs(batch)` → boop-harness `resolve` with a
document root per `docPath` (its dir, git toplevel, worktrees). Turn refs (`#202`, `S145`) resolve through
boop-store. md stays free of all of it; another host (VS Code webview, docs site) passes its own resolver
or none. No resolver means every span renders plain.

## 2. Plugins

One format for everything md renders specially. A plugin is a value: a factory call returns an object, the
host imports the factories and passes an array. Order is precedence. Same shape as vite/rollup plugins and
eslint flat config: no string ids, no lookup table, no second registry.

```ts
import {
  mermaidPlugin, d2Plugin, tablePlugin, codePlugin, codeRefPlugin, linkPlugin, imagePlugin, commandPlugin,
} from "@hafley66/md/plugins"

installMdviewHost({
  ...host,
  mdPlugins: [
    commandPlugin({ match: "^(ts|tsx|json)$", command: "prettier --print-width $WIDTH ...", as: "replace" }),
    mermaidPlugin(), d2Plugin(), tablePlugin(), codePlugin(), codeRefPlugin(), linkPlugin(), imagePlugin(),
  ],
  runFenceCommand: (request) => ipc("run_fence_command", request), // cold Observable
})
```

The reference provider (section 1) stays a host port: it supplies data to md's inline renderer and draws
nothing. Inline renderers (inline code, links, images) are plugin slots in the same array; `MdPanel` provides
the document they render in (`MdInlineDoc`) and no longer overrides those elements itself.

### Type signatures

```ts
// packages/md/src/plugins/0_types.ts
type MdFenceProps = { code: string; language: string; meta?: string; isIncomplete: boolean; dark: boolean }
type MdTableProps = ComponentProps<"table"> & { node?: MdTableNode; tableSectionId?: string; tableOrdinal?: number }

// JSON-serializable: a settings file holds a list of these
type MdFenceCommand = {
  match: string              // RegExp source over the fence language (`ts`, `rust`, ...)
  command: string            // opaque to md; the host expands $WIDTH / $LANG / $1
  as: "replace" | "annotate" // stdout replaces the fence body, or renders as a `text` fence under it
}

// the document an inline renderer sits in; MdPanel provides it through MdInlineDocContext
type MdInlineDoc = {
  path: string                        // absolute path of the rendered document
  jumpTo: (id: string) => void        // expand the section chain to a heading, scroll it into view
  onNavigate: (path: string) => void  // replace the panel's document in place
}
// streamdown's per-element props (`node` = the hast element) plus the document
type MdInlineCodeProps = ComponentProps<"code"> & { node?: unknown; doc: MdInlineDoc }
type MdLinkProps       = ComponentProps<"a">    & { node?: unknown; doc: MdInlineDoc }
type MdImageProps      = ComponentProps<"img">  & { node?: unknown; doc: MdInlineDoc }

// one object type; each optional slot is a capability. `name` is for diagnostics only.
type MdPlugin = {
  name: string
  fence?: { languages: readonly string[]; component: ComponentType<MdFenceProps> }
  table?: ComponentType<MdTableProps>
  highlight?: CodeHighlighterPlugin   // streamdown's `plugins.code` shape
  command?: MdFenceCommand
  inlineCode?: ComponentType<MdInlineCodeProps>  // streamdown `components.inlineCode`
  link?: ComponentType<MdLinkProps>              // streamdown `components.a`
  image?: ComponentType<MdImageProps>            // streamdown `components.img`
}

// host port (ports.ts, optional member of MdviewHost). Cold; unsubscribe = the host kills the process.
type MdFenceCommandRequest = { command: string; language: string; text: string; columns: number }
type MdFenceCommandResult = { stdout: string; stderr: string; code: number }
type MdFenceCommandRunner = (request: MdFenceCommandRequest) => Observable<MdFenceCommandResult>
interface MdviewHost {
  mdPlugins?: readonly MdPlugin[]          // absent = defaultMdPlugins
  runFenceCommand?: MdFenceCommandRunner   // absent = fences render as written
}

// factories (packages/md/src/plugins/*), exported from "@hafley66/md/plugins"
function mermaidPlugin(): MdPlugin     // fence ["mermaid"], lazy component
function d2Plugin(): MdPlugin          // fence ["d2"], lazy component
function tablePlugin(): MdPlugin       // table
function codePlugin(): MdPlugin        // highlight (shiki via @streamdown/code, dl6 -> prolog)
function commandPlugin(command: MdFenceCommand): MdPlugin
function codeRefPlugin(): MdPlugin    // inlineCode: ⌘-click on a file-citing span -> host.openCodeRef(text, doc.path)
function linkPlugin(): MdPlugin       // link: `#id` -> doc.jumpTo, *.md -> setPendingFrag + doc.onNavigate, else host.openHref
function imagePlugin(): MdPlugin      // image: remote/data/blob as written, local -> host.readImage (data URL)
// subpath "@hafley66/md/plugins/marbles", optional peer @hafley66/signal-marbles, not in the defaults
function marblesPlugin(): MdPlugin     // fence ["marbles"], lazy component
const defaultMdPlugins: readonly MdPlugin[] = [
  mermaidPlugin(), d2Plugin(), tablePlugin(), codePlugin(), codeRefPlugin(), linkPlugin(), imagePlugin(),
]

// React contexts (packages/md/src/plugins/4_MdPluginContext.ts)
const MdPluginContext: Context<{ plugins?: readonly MdPlugin[]; runCommand?: MdFenceCommandRunner; columns: number }>
const MdInlineDocContext: Context<MdInlineDoc | undefined>   // undefined outside MdPanel

// pure resolution (packages/md/src/lib/3_mdPlugins.ts)
type MdPluginSet = {
  fences: readonly { name: string; languages: readonly string[]; component: ComponentType<MdFenceProps> }[]
  table: ComponentType<MdTableProps> | undefined
  highlight: CodeHighlighterPlugin | undefined
  commands: readonly MdFenceCommand[]
  inlineCode?: ComponentType<MdInlineCodeProps>   // keys present only when some plugin claims the slot
  link?: ComponentType<MdLinkProps>
  image?: ComponentType<MdImageProps>
}
function resolveMdPlugins(plugins: readonly MdPlugin[]): MdPluginSet

// command pre-pass (packages/md/src/lib/4_fenceCommands.ts)
type FenceEdit = { at: number; remove: number; insert: string }
type FencePass = { source: string; text: string; edits: readonly FenceEdit[] }
function fenceCommandPass(markdown: string, commands: readonly MdFenceCommand[],
  run: MdFenceCommandRunner | undefined, columns: number): Observable<FencePass>
function shiftOffsets(offsets: readonly number[], edits: readonly FenceEdit[]): readonly number[]
```

### Body (pseudo)

```ts
resolveMdPlugins(plugins):
  // walk in array order; first plugin holding a slot wins it
  fences   = plugins with .fence, each language kept only by its first claimant
  table    = first .table
  highlight = first .highlight
  commands = every .command, in order
  inlineCode / link / image = first claimant each; key omitted when unclaimed

StreamdownBody (0_Streamdown.tsx):
  { plugins, runCommand, columns } = useContext(MdPluginContext)   // MdPanel provides from the host
  set  = resolveMdPlugins(plugins)
  pass = commands and runner ? useSignal(Signal(fenceCommandPass(children, ...), identity(children)))
                             : identity(children)
  renderers  = set.fences.map(f => ({ language: [...f.languages], component: props => <f.component {...props} dark/> }))
  doc  = useContext(MdInlineDocContext)                             // MdPanel provides { path, jumpTo, onNavigate }
  inline = doc ? { inlineCode: p => <set.inlineCode {...p} doc/>, a: p => <set.link {...p} doc/>,
                   img: p => <set.image {...p} doc/> }  (each only when the slot is claimed)
             : {}                                                  // no doc: streamdown's own inline markup
  components = { ...components, ...inline, table: ordinal-computing wrapper around set.table (when claimed) }
  <Streamdown plugins={{ code: set.highlight, renderers }} components>{pass.text}</Streamdown>
  // table ordinals: renderedOffsetsForSourceStarts on children, then shiftOffsets(pass.edits)

fenceCommandPass(markdown, commands, run, columns):
  no commands or no run -> of(identity)
  fences = mdast `code` nodes at column 1 whose body equals node.value
  jobs   = fences.map(f => first command whose RegExp(match) tests f.lang)  // first match wins
  each job: run({ command, language, text, columns }).pipe(
    take(1),
    map(result => edits for as / code),   // replace+0 -> body; replace+!0 -> stderr fence; annotate -> stdout fence
    catchError(() => of([])),
    startWith(null),                       // unanswered
  )
  combineLatest(jobs) -> drop while every job is null -> apply edits right-to-left -> { source, text, edits }
  // emits nothing until the first answer; the consumer's Signal seed is the text as written
```

### Instance timelines

| instance | born | dies |
| --- | --- | --- |
| plugin objects | host module load (factory call) | never; identity stable for the app, so Streamdown keeps renderer identity |
| `defaultMdPlugins` | `@hafley66/md/plugins` module load | never |
| `MdPluginSet` | per `StreamdownBody` render, memoized on the array identity | with the array |
| `MdInlineDoc` | per `MdPanel` render, memoized on (path, onNavigate, parsed doc) | path, navigate handler, or reparse |
| inline wrapper components | per `StreamdownBody`, memoized on (`MdPluginSet`, `MdInlineDoc`) | either changes: streamdown remounts inline elements |
| code-ref native listeners | each code-ref `<code>` commit (ref callback) | ref cleanup on next commit or unmount |
| lazy renderer chunk (mermaid, d2) | first fence of that language renders | page lifetime (module cache) |
| command pass | per (section text, commands, runner, columns) | section text or columns change, or section unmount: useSignal unsubscribes, the runner's teardown kills the process |
| one run | pass subscription, per matched fence | first result (`take(1)`) or unsubscribe |

Columns derive from the prose width (px / 7.8, the 13px code font advance), so resizing within one column
does not rerun.

### Storage, reads, writes, uniqueness

| data | stored in | written by | read by | unique on |
| --- | --- | --- | --- | --- |
| plugin array | `MdviewHost.mdPlugins` (host memory) | host at boot | `MdPanel` -> `MdPluginContext` | array identity |
| inline document | `MdInlineDocContext` value | `MdPanel` render | `StreamdownBody` -> inline slot props (`doc`) | one per panel |
| pending `#frag` | `open.ts` `pendingFrag` map | `linkPlugin` on a markdown link | target panel once its doc is ready | target path, one-shot |
| user command list | host settings JSON (instant `settings.fenceCommands`, beside `clickRules`) | settings panel | host maps `commandPlugin` over it | list position (first match wins) |
| pass result | `Signal` inside `StreamdownBody` | runner output | Streamdown children | section text + columns |
| run output cache | none in phase 1 | | | (command, language, columns, text) when added |

Sequence, one `ts` fence, prettier command, runner present:

```text
children  a--------------------|          section text
pass      a(as written)---a'---|           startWith identity, then the formatted body
run            R(ts,80)--r|                host process, take(1)
render    a--------------a'                Streamdown re-renders once
```

### Current hardcoded sites -> plugins

| site today | plugin | slot |
| --- | --- | --- |
| `0_Streamdown.tsx` `renderers: [{ language: "mermaid", component: MermaidRenderer }]` (+ sequence branch) | `mermaidPlugin()` | `fence` |
| `0_Streamdown.tsx` `{ language: "d2", component: D2Renderer }` (+ sequence branch) | `d2Plugin()` | `fence` |
| `0_Streamdown.tsx` `table: TableRenderer` -> `5_PersistedMarkdownTable.tsx` | `tablePlugin()` | `table` |
| `0_Streamdown.tsx` `code` (`@streamdown/code` + dl6 -> prolog) | `codePlugin()` | `highlight` |
| instant ⌘-click rules shape `{ pattern, command }` applied to fences | `commandPlugin({ match, command, as })` | `command` |
| `MdPanel.tsx` `inlineCode` (⌘-click refs, native listeners that stop propagation) | `codeRefPlugin()` | `inlineCode` |
| `MdPanel.tsx` `a` (jump / in-place navigate / openHref) | `linkPlugin()` | `link` |
| `MdPanel.tsx` `img` -> `MdImg` | `imagePlugin()` | `image` |

Removing a built-in from the array drops it: no `tablePlugin()` means Streamdown's own table, no
`codePlugin()` means unhighlighted code blocks, no `mermaidPlugin()` means a mermaid fence renders as code,
no `codeRefPlugin()` means streamdown's plain inline code with no ⌘-click, no `linkPlugin()` / `imagePlugin()`
means streamdown's own `a` / `img`. A plugin with `inlineCode` placed before `codeRefPlugin()` takes inline code.
The ⌘-held panel mark (`data-md-meta`, which reveals `code[data-md-ref]` as a link) stays in `MdPanel`.

### Suggested command list (instant settings; binary absent = the host answers code 127, fence unchanged)

| match | command | as |
| --- | --- | --- |
| `^(ts\|tsx\|js\|jsx\|json\|css\|scss\|md\|yaml\|yml)$` | `prettier --print-width $WIDTH --stdin-filepath x.$LANG < $1` | replace |
| `^(rust\|rs)$` | `rustfmt --edition 2021 --config max_width=$WIDTH < $1` | replace |
| `^(py\|python)$` | `ruff format --line-length $WIDTH - < $1` | replace |
| `^go$` | `golines -m $WIDTH $1` | replace |
| `^(sh\|bash\|zsh)$` | `shellcheck -f gcc $1` | annotate |

### Future plugins (same format, each its own subpath and optional peer, lazy `import()`)

| factory | slot | library |
| --- | --- | --- |
| `stepsPlugin()` (shipped, section 2a, subpath `@hafley66/md/plugins/steps`) | fence `steps` | `codehike` `Pre` + token-transitions, `diff` (`applyPatch` turns patches into states) |
| `xstatePlugin()` | fence `xstate` | `xstate` + `@xstate/graph`, drawn by grapht |
| `mdxPlugin()` | new slot: document transform | `@mdx-js/mdx` `evaluate` |
| Code Hike scrollycoding | needs MDX slot (lab demo 3) | `codehike`, `@mdx-js/mdx` |

Diff fence to animation:

```text
fence text  : patch1 --- patch2 --- patch3
applyPatch  : s0 -> s1 -> s2 -> s3         (jsdiff; s0 = the fence's base block or empty)
steps$      : s0 --s1 --s2 --s3            (interval or scroll position, a Signal index)
token FLIP  : animates tokens s(n) -> s(n+1)   (codehike/utils/token-transitions)
```

### `marblesPlugin()` (built)

A ```` ```marbles ```` fence renders a `@hafley66/signal-marbles` diagram. md writes no parser and no
renderer: the fence body goes to `parseMarbles`, the document to `useMarblePlayer`, the player to
`MarbleDiagram`.

````md
```marbles
@title map(v => v * 10) throws on d
@legend A=10 B=20 C=30

source : -a-(bc)-d-|
  map(v => v * 10) : ^A-(BC)-#
```
````

Which in-repo package:

| | `@hafley66/signal-marbles` | `@hafley66/marbler` |
| --- | --- | --- |
| input | `MarbleDoc`; `parseMarbles(text)` reads the ASCII notation | `MarbleEvent[]` (method, status, phases, frames): a network/agent trace |
| text notation | yes, `src/1_notation.ts`, round-trips through `printMarbles` | none |
| surface | DOM + CSS grid, `renderMarbles(player, host)`, React `MarbleDiagram` | PixiJS waterfall + time navigator, grid table |
| theming | `--mb-*` custom properties, two cascade layers | `phaseStyles` option (JS colors) |
| its own README on a fence | lists "a markdown fence" as a gap owned by `@hafley66/md` | describes itself as the live trace viewer |

Chosen: signal-marbles. The fence is a static text document, which is signal-marbles' notation; marbler
has no notation and draws a live timeline.

Notation (all of it signal-marbles' parser, unchanged):

| in a lane | means |
| --- | --- |
| `label : marbles` | one named stream per line; leading spaces make it a child of the nearest shallower line |
| `-` | one column |
| any other character | a value on that column (`@legend a=alpha` spells it out) |
| `(ab)` | a group: every element on the column the group opens |
| `\|` | complete |
| `#` | error (carries no value) |
| `^` | subscribed here (a marker on its column, spends one column) |
| `!` | unsubscribed here, spends no time |
| `10ms`, `2s`, `1m` | a column that costs that much time, at a token boundary |
| `@title`, `@legend`, `# comment` | directives and comment lines |

Deviations from RxJS `TestScheduler` marbles, all signal-marbles' documented choices: a group spends
one column's time rather than one frame per character; `^` is a marker on the column written rather
than the frame-0 origin of a hot observable.

Operator lines: written as the derived lane's label (`  map(v => v * 10) : ...`). A separate operator
row between lanes (swirly's `> concatAll`) needs a `MarbleDoc` field and a parser directive in
signal-marbles; not built (open).

Build vs buy (candidates read 2026-09-25):

| candidate | parser | renderer | styling | status |
| --- | --- | --- | --- | --- |
| `@hafley66/signal-marbles` (in repo) | `parseMarbles`, diagnostics with line numbers | DOM, React adapter, reveal player | `--mb-*` custom properties | used |
| `@hafley66/marbler` (in repo) | none | PixiJS trace timeline | JS `phaseStyles` | trace input, not notation |
| `@swirly/parser` + `@swirly/renderer` 0.21.0, MIT | RxJS marble syntax + `> operator` lines + `[styles]` INI | SVG | INI `[styles]`, theme packages | last npm publish 2022-07-03 |
| `rxjs` `TestScheduler` marble parsing | internal to testing, frames only | none | none | no renderer |

Default array: `marblesPlugin()` is not in `defaultMdPlugins`. `defaultMdPlugins` lives in the
`@hafley66/md/plugins` index; referencing the marbles chunk from there makes every host's bundler
resolve `@hafley66/signal-marbles` (and its `zod` dependency) at build time, lazy `import()` or not. It
ships as its own subpath with `peerDependenciesMeta` optional, per the future-plugins rule above; a
host opts in with `import { marblesPlugin } from "@hafley66/md/plugins/marbles"`.

Theme: `MarblesFence` writes `data-diagram-theme="dark|light"` from md's `dark` prop on
`.mdview-marbles`; `mdview.css` pins every `--mb-*` color for both values on `.mdview-marbles[...]
.mb-root` (specificity 0,2,0 over signal-marbles' `.mb-root` inside `prefers-color-scheme`). Surface and
ink match the mermaid/d2 frames (`#f8fafc`/`#111827`, `#0f172a`/`#f8fafc`). No inline style, no JS color.

| instance | born | dies |
| --- | --- | --- |
| `marblesPlugin()` object | host module load | never |
| `1_MarblesFence` chunk + signal-marbles | first marbles fence renders | page lifetime (module cache) |
| parsed `MarbleDoc` | `useMemo` per fence body | body text changes or fence unmounts |
| player | `useMarblePlayer` ref, per fence component | fence unmount; `load(doc)` on a new body |
| `renderMarbles` subscriptions | `MarbleDiagram` effect | effect teardown (`unsubscribe`) |

Parse diagnostics render as `.mdview-marbles-error` above whatever the parser could still draw.

Receipts: `packages/md/src/plugins/2_marblesPlugin.test.ts` (plugin shape + `parseMarbles` snapshot),
`packages/md/src/plugins/2_marblesPlugin.browser.test.tsx` (marbles per lane, labels, dark and light
`--mb-surface`, diagnostics).

### Phases

1. md: types, `resolveMdPlugins`, the eight factories (fence, table, highlight, command, inline slots), `defaultMdPlugins`, `StreamdownBody` driven by the
   array, `fenceCommandPass`, `MdviewHost.mdPlugins` / `runFenceCommand`, `@hafley66/md/plugins` subpath.
2. instant: `settings.fenceCommands` + panel cloned from the click-rules panel, `run_fence_command` IPC
   (temp file, `$WIDTH` expansion, kill on unsubscribe).
3. Run cache, future plugins.

### Open

- Run cache (LRU, key above) and whether two panes at one width share a run.
- Column derivation: fixed 7.8 px advance vs measuring `1ch` of the code font.
- Indented fences (inside list items) are skipped by the pass.
- A replace result containing a fence of the same backtick length breaks out of the fence; not escaped.
- Marbles operator rows between lanes (`> op`): needs a `MarbleDoc` field + parser directive in signal-marbles.
- Marbles fence: signal-marbles' header controls (play, step) and legend render inside every fence; no
  static-only mode exists in `renderMarbles`.

## 2a. Code Hike lab and `stepsPlugin()` (2026-09-25)

### Lab

`packages/md/lab/code-hike/`, one page, six demos. Receipts: `lab/code-hike/7_lab.browser.test.tsx`
(inline snapshots, screenshots to `packages/md/out/lab/screens/`).

```sh
cd packages/md
npx vite lab/code-hike            # dev server, open the printed URL
npx vite build lab/code-hike      # -> out/lab/code-hike
LAB_ENTRY=<entry> npx vite build --config lab/code-hike/measure/vite.config.ts lab/code-hike/measure
node ../../scripts/browser-queue.mjs vitest run --config vitest.browser.config.ts lab/code-hike/7_lab.browser.test.tsx
```

| # | demo | Code Hike surface | MDX |
| --- | --- | --- | --- |
| 1 | `// !mark`, `// !focus(1:5)`, `// !callout[/take/] text` | `highlight` + `Pre` + handlers (`codehike/code`) | no |
| 2 | three states, prev/next on a Signal index | `codehike/utils/token-transitions` (SmoothPre recipe) | no |
| 3 | scrollycoding, prose beside a sticky code panel | `remarkCodeHike` + `recmaCodeHike` + `parse`, `SelectionProvider`/`Selectable`/`Selection` | yes, `@mdx-js/mdx` `evaluate` at runtime |
| 4 | a ```` ```hike rust ```` fence inside `StreamdownBody` through an `MdPlugin` | `highlight` + `Pre` | no |
| 5 | demo 2's states through `@shikijs/magic-move` | comparison | no |
| 6 | the shipped `stepsPlugin()` inside `StreamdownBody` | `Pre` + token transitions, tokens from md's shiki | no |

What runs without MDX:

| module | without MDX | note |
| --- | --- | --- |
| `codehike/code` (`highlight`, `Pre`, `InnerPre/Line/Token`, handlers) | yes | `highlight(RawCode, theme)` is async; comment annotations are extracted there |
| `codehike/utils/token-transitions` | yes | `getStartingSnapshot` / `calculateTransitions` over any element; FLIP via WAAPI |
| `codehike/utils/selection`, `static-fallback` | yes | selection state is React `useState` inside `SelectionProvider` |
| `codehike/mdx` (`remarkCodeHike`, `recmaCodeHike`) | no | remark stage walks plain mdast (`## !!steps`, ```` ```lang ! ````), then emits `mdxJsxFlowElement` nodes with estree attributes; recma makes the compiled component return the block tree |
| `codehike` `parse` | no | `parse(Content)` = `Content({ _returnBlocks: true })`; needs the recma output |
| `codehike/blocks` (`parseRoot`, `Block`, `HighlightedCodeBlock`) | no | imports `zod`, which `codehike@1.1.0` does not declare as a dependency |

Observations:

- `@code-hike/lighter` export conditions: `browser` (the one Vite picks) fetches every grammar and theme
  from `https://lighter.codehike.org/<name>.json` at runtime; `default` holds them as 240 local
  `import()` chunks. The lab aliases lighter to the default build (`lab/code-hike/0_lighterAlias.ts`, also
  wired into `vitest.browser.config.ts`).
- lighter's eager chunk inlines `onig.wasm` (466,610 B) as base64; that is most of `codehike/code`'s cost.
- `Pre` + token transitions do not import lighter: `HighlightedCode` is a public type, so tokens from any
  highlighter render through `Pre`. Comment annotations (`// !mark`) need `highlight()`.
- The SmoothPre recipe sets inline `position: relative` on `<pre>`; a sticky panel needs a wrapper element.
- Token transitions: moved tokens translate + recolour, added tokens fade in after the moves, removed
  tokens leave at t=0 (`removeDuration = 0`), container height jumps. Magic-move animates leave, enter,
  move and container size.
- Demo 4 callout: inside Streamdown's code styles the callout box renders at column 0, not under the range.
- `shiki-magic-move` is deprecated on npm ("now @shikijs/magic-move"); `@shikijs/magic-move@4.4.3`.

### Bundle cost (Vite 8 / rolldown, minified, react external; gzip = `gzip -c` level 6)

| entry | eager bytes | eager gzip | lazy per language (ts) |
| --- | --- | --- | --- |
| `codehike/code` `highlight` + `Pre`, lighter `default` build | 784,586 | 273,838 | 192,065 (18,677 gz) + theme 15,834 |
| same, lighter `browser` build | 770,107 | 269,685 | fetched from lighter.codehike.org |
| + token-transitions + selection | 796,978 | 277,924 | same |
| + `@mdx-js/mdx` `evaluate` + remark/recma + `parse` | 1,361,866 | 418,518 | same |
| `@shikijs/magic-move/react` `ShikiMagicMove` + `shiki/core` 4 + JS regex engine + lang/theme maps + `diff` | 295,045 | 82,793 | 190,897 (16,824 gz) + theme 12,859 |
| `codehike/code` `Pre` + token-transitions, no lighter | 18,648 | 5,845 | 0 (tokens supplied) |
| same + `diff` (`applyPatch`) | 39,887 | 11,279 | 0 |
| `@shikijs/magic-move` renderer + core + `diff`, no shiki | 52,001 | 15,781 | 0 (tokens supplied) |

md already ships shiki 3 through `@streamdown/code` (the `codePlugin()` highlight slot);
`ShikiMagicMove` requires a shiki 4 highlighter, a second instance.

### Engine for `stepsPlugin()`: Code Hike

| option | packages | gzip added | tokens from | leave animation | container resize | annotation handlers |
| --- | --- | --- | --- | --- | --- | --- |
| **Code Hike `Pre` + token-transitions** (chosen) | `codehike`, `diff` | 11,279 | md's highlight slot | no | no | yes, same `Pre` (mark/focus/callout from the lab) |
| magic-move renderer | `@shikijs/magic-move`, `diff` | 15,781 | md's highlight slot (`toKeyedTokens`) | yes | yes | no |
| `ShikiMagicMove` | `@shikijs/magic-move`, `shiki@4`, `diff` | 82,793 + grammar | own shiki 4 | yes | yes | no |
| Code Hike `highlight()` + `Pre` | `codehike` (+ lighter) | 277,924 + grammar | lighter | no | no | yes, from comments |

One engine: Code Hike `Pre` + `codehike/utils/token-transitions`, tokens from the md highlight slot
(the plugin array's first `highlight`, shiki 3 today). The annotation handlers from the lab plug into the
same `Pre` when steps gain annotations. Cost: no leave animation, no height animation.

### `stepsPlugin()`

Fence syntax:

````md
```steps ts
--- step start
const total = items.length
--- step count done items
@@ -1 +1,3 @@
-const total = items.length
+const total = items
+  .filter((item) => item.done)
+  .length
```
````

Types:

```ts
// src/lib/5_stepsFence.ts
type CodeStep = { title: string; code: string; from: "literal" | "patch"; error?: string }
type StepsFence = { lang: string; steps: readonly CodeStep[] }
function parseStepsFence(body: string, meta: string | undefined): StepsFence
  // lang = meta's first word; split on /^--- ?step(?::|\s|$)\s*(.*)$/
  // empty leading segment dropped; segment opening with @@ / --- / diff / Index: = applyPatch(previous)
  // failed patch: previous code kept, error set

// src/lib/6_hikeTokens.ts
function toHighlightedCode(result: HighlightResult, code: string, lang: string, dark: boolean): HighlightedCode
  // shiki lines -> flat Code Hike tokens; whitespace split out as bare strings; dark reads --shiki-dark
function highlight$(highlighter: CodeHighlighterPlugin | undefined, code: string, lang: string, dark: boolean): Observable<HighlightedCode>
  // cold; sync or callback answer; absent / unsupported language -> uncoloured tokens

// src/plugins/2_stepsPlugin.tsx, entry src/plugins/steps.ts = subpath @hafley66/md/plugins/steps
// (absent from the plugins index and defaultMdPlugins, so hosts without codehike/diff never resolve them)
function stepsPlugin(): MdPlugin   // fence ["steps"], lazy 1_StepsFence chunk
```

Instance timelines:

| instance | born | dies |
| --- | --- | --- |
| lazy chunk (`1_StepsFence`, `codehike/code`, token-transitions, `diff`) | first steps fence renders | page lifetime |
| parsed fence | per (code, meta) | fence text change |
| highlighted steps Signal | per (fence, highlight slot, dark); `combineLatest` over `highlight$` per step | inputs change or unmount (useSignal unsubscribes) |
| step index Signal | fence mount | fence unmount (resets to 0 on remount) |
| WAAPI animations | each index change, in `componentDidUpdate` | after `--md-steps-duration` (900 ms default, 0 under reduced motion) |

Visuals: `src/plugins/steps.css`, custom properties only (`--md-steps-bg`, `-fg`, `-border`, `-radius`,
`-pad-block`, `-pad-inline`, `-font`, `-bar-gap`, `-button-*`, `-muted`, `-error`, `-duration`).
`data-theme` on `.md-steps` sets `color-scheme` from the `dark` fence prop.

Package: `codehike` and `diff` are optional peers of `@hafley66/md` (and devDependencies);
`@shikijs/magic-move`, `shiki@4`, `@mdx-js/mdx` are devDependencies for the lab only.

### Open

- Scroll-driven step index (the plan's "scroll position" source); buttons only today.
- Annotations inside steps: comment syntax needs lighter's `highlight()` (274 KB gz eager) or annotation
  data from the fence parser.
- Scrollycoding in md: needs the `mdxPlugin()` document-transform slot (`@mdx-js/mdx`, +141 KB gz over
  `codehike/code`), since `parse` needs recma output.
- Callout column placement under Streamdown code styles.

## 3. Shared styling

grapht renderers, marbles and state-machine views read one semantic custom-property set
(`--grapht-node-bg`, `--grapht-edge-stroke`, `--grapht-focus`, `--grapht-dim`, ...) with `light-dark()`
defaults. JS writes data attributes and classes only. md's `--md-guide-*`, `--md-line`, `--md-section-indent`
follow the same rule.

Owner rule (2026-09-25): every bespoke visual ask (heading rail, pill boxes, selection tint, ...) lands as
a customization of md's existing classes through custom properties, never as one-off markup or hardcoded
colours. Colours and as much geometry as possible are variables a theme or plugin stylesheet overrides.

