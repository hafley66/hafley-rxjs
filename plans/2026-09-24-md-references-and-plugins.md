# md: batched references and optional viz plugins

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

## 2. Optional viz plugins

Each plugin is an export of `@hafley66/md/plugins/<name>`, backed by an optional peer dependency and a
dynamic `import()` that runs only when a fence or component of its kind renders. A missing peer renders
the fence as plain code.

| plugin | fence / trigger | library | status |
| --- | --- | --- | --- |
| marbles | ```` ```marbles ```` | `@hafley66/marbler`, `@hafley66/signal-marbles` | in-repo |
| code over time | ```` ```steps ```` or a fence of stacked `diff` patches | `shiki-magic-move` (animates token moves between code states), `diff` (jsdiff `applyPatch` turns patches into states) | npm |
| scrollycoding | MDX `<Scrollycoding>` | Code Hike (`codehike`) | npm |
| highlighting | every code fence | `shiki` (Streamdown's `@streamdown/code` already carries it) | present |
| MDX | `.mdx` documents | `@mdx-js/mdx` `evaluate` | npm |
| state machines | ```` ```xstate ```` | `xstate` + `@xstate/graph` for the graph, drawn and animated by grapht | npm + in-repo |

Diff fence to animation:

```text
fence text  : patch1 --- patch2 --- patch3
applyPatch  : s0 -> s1 -> s2 -> s3         (jsdiff; s0 = the fence's base block or empty)
steps$      : s0 --s1 --s2 --s3            (interval or scroll position, a Signal index)
magic-move  : animates tokens s(n) -> s(n+1)
```

## 3. Shared styling

grapht renderers, marbles and state-machine views read one semantic custom-property set
(`--grapht-node-bg`, `--grapht-edge-stroke`, `--grapht-focus`, `--grapht-dim`, ...) with `light-dark()`
defaults. JS writes data attributes and classes only. md's `--md-guide-*`, `--md-line`, `--md-section-indent`
follow the same rule.

Owner rule (2026-09-25): every bespoke visual ask (heading rail, pill boxes, selection tint, ...) lands as
a customization of md's existing classes through custom properties, never as one-off markup or hardcoded
colours. Colours and as much geometry as possible are variables a theme or plugin stylesheet overrides.

## 4. Fence rules (the click rules, duplicated for code fences)

instant's ⌘-click config is an ordered JSON list, first match wins
(`instant/src/state.ts:235` `ClickRule { pattern, command }`, defaults at `state.ts:239`, editor panel
`instant/src/clickrules.ts:429`). Code fences get the same shape and the same editor, keyed on the fence
language instead of the clicked token.

### Type signatures

```ts
// md (packages/md/src/ports.ts): md names the rule; the host runs it.
export interface FenceRule {
  pattern: string;             // JS regex over the fence info string's language (`ts`, `rust`, `json`, ...)
  command: string;             // shell; $1 = temp file holding the fence text, $WIDTH = pane columns
  as: "replace" | "annotate";  // stdout replaces the fence text, or renders under the fence (lint output)
}

// host port, optional: no runner means fences render as written
runFenceRule?(rule: FenceRule, lang: string, text: string, width: number): Promise<{ stdout: string; code: number }>;

// instant settings, beside clickRules
settings.fenceRules: Signal<FenceRule[] | null>   // null = DEFAULT_FENCE_RULES
```

### Defaults (formatters found on PATH; absent binary = rule skipped)

| pattern | command | as |
| --- | --- | --- |
| `^(ts\|tsx\|js\|jsx\|json\|css\|scss\|md\|yaml\|yml)$` | `prettier --print-width $WIDTH --stdin-filepath x.$LANG < $1` | replace |
| `^(rust\|rs)$` | `rustfmt --edition 2021 --config max_width=$WIDTH < $1` | replace |
| `^(py\|python)$` | `ruff format --line-length $WIDTH - < $1` | replace |
| `^go$` | `golines -m $WIDTH $1` | replace |
| `^(sh\|bash\|zsh)$` | `shellcheck -f gcc $1` | annotate |

mermaid and d2 stay renderers (`0_Streamdown.tsx:95-103`); a fence rule runs on the text before the
renderer sees it.

### Body (pseudo)

```ts
// per fence, inside the code renderer
// rule = first fenceRules entry whose pattern matches lang
// no rule or no runFenceRule -> render text as written
// key = hash(rule.command, lang, width, text); cached result -> render it
// else render text as written now, run runFenceRule, cache, swap in stdout (replace) or append it (annotate)
// non-zero exit on a replace rule -> keep the original text, annotate with stderr
```

### Instance timelines

- Rules: app lifetime, one settings signal, edited in a panel cloned from the click-rules panel.
- A run: one per (rule, lang, width, text hash). Width changes re-key by column count, not pixels, so
  resizing within a column does not rerun.
- Cache: in-memory LRU per app; persistence not planned.

### Storage, reads, writes, uniqueness

- `settings.fenceRules` persists like `settings.clickRules`.
- Cache key unique on (command, lang, width, hash(text)). Two panes at the same width share a run.
- Temp files live under the app's temp dir, one per run, deleted after the run.

### Built-ins become entries (owner, 2026-09-25)

Everything md renders specially today moves onto the same list, so nothing is hardcoded in
`0_Streamdown.tsx`. A rule gains an optional `render` naming a plugin export; `command` stays optional.

```ts
export interface FenceRule {
  pattern: string;                        // over the fence language, or `^table$` for GFM tables
  command?: string;                       // shell pre-pass (format / lint), as above
  as?: "replace" | "annotate";
  render?: string;                        // plugin id from @hafley66/md/plugins/<id>; absent = plain code block
}
```

| pattern | render | today's code |
| --- | --- | --- |
| `^table$` | `table` | `2_MarkdownTable.tsx` + `5_PersistedMarkdownTable.tsx`, wired as `table: TableRenderer` (`0_Streamdown.tsx`) |
| `^mermaid$` | `mermaid` | `0a_MermaidDiagram.tsx` (`renderers` list, `0_Streamdown.tsx:95-103`) |
| `^d2$` | `d2` | `0a_D2Diagram.tsx` (same list) |
| `.*` (last) | `code` | Streamdown's code block with shiki, as rendered today |

The defaults list is these four rows plus the formatter rows above; a user list replaces it whole, like
click rules. Each built-in's CSS stays customizable through its custom properties (`--sg-*` and
`--md-select-*` for tables, `--md-code-*` for code).
