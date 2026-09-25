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
import { mermaidPlugin, d2Plugin, tablePlugin, codePlugin, commandPlugin } from "@hafley66/md/plugins"

installMdviewHost({
  ...host,
  mdPlugins: [
    commandPlugin({ match: "^(ts|tsx|json)$", command: "prettier --print-width $WIDTH ...", as: "replace" }),
    mermaidPlugin(), d2Plugin(), tablePlugin(), codePlugin(),
  ],
  runFenceCommand: (request) => ipc("run_fence_command", request), // cold Observable
})
```

The reference provider (section 1) stays a host port: it supplies data to md's inline renderer and draws
nothing. Inline slots (`inlineCode`, `a`, `img` in `MdPanel.tsx`) stay outside the plugin array in phase 1.

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

// one object type; each optional slot is a capability. `name` is for diagnostics only.
type MdPlugin = {
  name: string
  fence?: { languages: readonly string[]; component: ComponentType<MdFenceProps> }
  table?: ComponentType<MdTableProps>
  highlight?: CodeHighlighterPlugin   // streamdown's `plugins.code` shape
  command?: MdFenceCommand
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
const defaultMdPlugins: readonly MdPlugin[] = [mermaidPlugin(), d2Plugin(), tablePlugin(), codePlugin()]

// pure resolution (packages/md/src/lib/3_mdPlugins.ts)
type MdPluginSet = {
  fences: readonly { name: string; languages: readonly string[]; component: ComponentType<MdFenceProps> }[]
  table: ComponentType<MdTableProps> | undefined
  highlight: CodeHighlighterPlugin | undefined
  commands: readonly MdFenceCommand[]
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

StreamdownBody (0_Streamdown.tsx):
  { plugins, runCommand, columns } = useContext(MdPluginContext)   // MdPanel provides from the host
  set  = resolveMdPlugins(plugins)
  pass = commands and runner ? useSignal(Signal(fenceCommandPass(children, ...), identity(children)))
                             : identity(children)
  renderers  = set.fences.map(f => ({ language: [...f.languages], component: props => <f.component {...props} dark/> }))
  components = set.table ? { ...components, table: ordinal-computing wrapper around set.table } : components
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
    startWith([]),                         // render as written until the host answers
  )
  combineLatest(jobs) -> apply edits right-to-left -> { source: markdown, text, edits }
```

### Instance timelines

| instance | born | dies |
| --- | --- | --- |
| plugin objects | host module load (factory call) | never; identity stable for the app, so Streamdown keeps renderer identity |
| `defaultMdPlugins` | `@hafley66/md/plugins` module load | never |
| `MdPluginSet` | per `StreamdownBody` render, memoized on the array identity | with the array |
| lazy renderer chunk (mermaid, d2) | first fence of that language renders | page lifetime (module cache) |
| command pass | per (section text, commands, runner, columns) | section text or columns change, or section unmount: useSignal unsubscribes, the runner's teardown kills the process |
| one run | pass subscription, per matched fence | first result (`take(1)`) or unsubscribe |

Columns derive from the prose width (px / 7.8, the 13px code font advance), so resizing within one column
does not rerun.

### Storage, reads, writes, uniqueness

| data | stored in | written by | read by | unique on |
| --- | --- | --- | --- | --- |
| plugin array | `MdviewHost.mdPlugins` (host memory) | host at boot | `MdPanel` -> `MdPluginContext` | array identity |
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
| `MdPanel.tsx` `inlineCode` / `a` / `img` | none in phase 1 | |

Removing a built-in from the array drops it: no `tablePlugin()` means Streamdown's own table, no
`codePlugin()` means unhighlighted code blocks, no `mermaidPlugin()` means a mermaid fence renders as code.

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
| `marblesPlugin()` | fence `marbles` | `@hafley66/marbler`, `@hafley66/signal-marbles` |
| `stepsPlugin()` | fence `steps` / stacked `diff` | `shiki-magic-move`, `diff` (`applyPatch` turns patches into states) |
| `xstatePlugin()` | fence `xstate` | `xstate` + `@xstate/graph`, drawn by grapht |
| `mdxPlugin()` | new slot: document transform | `@mdx-js/mdx` `evaluate` |
| Code Hike scrollycoding | needs MDX slot | `codehike` |

Diff fence to animation:

```text
fence text  : patch1 --- patch2 --- patch3
applyPatch  : s0 -> s1 -> s2 -> s3         (jsdiff; s0 = the fence's base block or empty)
steps$      : s0 --s1 --s2 --s3            (interval or scroll position, a Signal index)
magic-move  : animates tokens s(n) -> s(n+1)
```

### Phases

1. md: types, `resolveMdPlugins`, the five factories, `defaultMdPlugins`, `StreamdownBody` driven by the
   array, `fenceCommandPass`, `MdviewHost.mdPlugins` / `runFenceCommand`, `@hafley66/md/plugins` subpath.
2. instant: `settings.fenceCommands` + panel cloned from the click-rules panel, `run_fence_command` IPC
   (temp file, `$WIDTH` expansion, kill on unsubscribe).
3. Run cache, future plugins.

### Open

- Run cache (LRU, key above) and whether two panes at one width share a run.
- Column derivation: fixed 7.8 px advance vs measuring `1ch` of the code font.
- Indented fences (inside list items) are skipped by the pass.
- Inline slots (`inlineCode`, links, images) as plugin slots.
- A replace result containing a fence of the same backtick length breaks out of the fence; not escaped.

## 3. Shared styling

grapht renderers, marbles and state-machine views read one semantic custom-property set
(`--grapht-node-bg`, `--grapht-edge-stroke`, `--grapht-focus`, `--grapht-dim`, ...) with `light-dark()`
defaults. JS writes data attributes and classes only. md's `--md-guide-*`, `--md-line`, `--md-section-indent`
follow the same rule.

Owner rule (2026-09-25): every bespoke visual ask (heading rail, pill boxes, selection tint, ...) lands as
a customization of md's existing classes through custom properties, never as one-off markup or hardcoded
colours. Colours and as much geometry as possible are variables a theme or plugin stylesheet overrides.

