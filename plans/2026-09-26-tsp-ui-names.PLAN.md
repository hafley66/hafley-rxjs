# Plan: TypeSpec-first UI names (vars, classes, test ids, data hooks, id paths)

Status: draft. Nothing is compiled yet. Every TypeSpec syntax claim marked **verify** must pass gate G0 before anything depends on it.

## 0. References read, and gaps

| read | result |
|---|---|
| `claude-research/skills/typespec/SKILL.md` and its routes (core, cross-layer, emitters, emitter-framework, custom-emitters, alloy-core, enums, templates, functions, tooling), tsp-arch `0_basis.tsp`…`8_evolution.md` | read |
| hafley-tsp packages (sql, sqlx, rusqlite, binding-core, rust, react, asyncapi, decorator-def, emit-helper) | compiler 1.10.0, Alloy 0.23-dev. None emits CSS, class names, test ids or theme tokens. |
| hafley-rxjs `.tsp` | only `packages/json-rx`: imperative emitter, compiler **1.14.0**, `typespec:check` / `generate:check` gate |
| hafley-rs `.tsp` | `crates/sprefa-extract/schema/*.tsp`; `plans/boop-typespec-map.REPORT.md` has no UI rows |

Missing or conflicting references:
1. No archived reference covers TypeSpec **values** (`const`, `#{}`, `#[]`, scalar constructors, value defaults, `OptionalProperties<T>`).
2. `typespec-core` calls inline anonymous models a parse error; public docs describe model expressions. The two conflict, so this plan avoids inline models.
3. There is no Alloy CSS package.
4. The references describe compiler 1.10; hafley-rxjs pins 1.14.
5. `tsp-arch` has no UI-names or theming design.

## 1. Current state (boop-xterm, md, instant)

| item | fact |
|---|---|
| `boop-xterm/src/theme.css` | 653 lines, 234 `--boop-xterm-*` vars (kebab), ~20 private `--asq-*` runtime vars, 0 `@layer` |
| duplicated defaults | CSS `gutter-offset: 42px` and TS `1_contextGutterPure.ts:5 gutter_offset_px = 42`; also `gutter_check_px` 16, `fork_indent_px` 26, `fork_pane_rows` 8 |
| TS var reads | `8b:58`, `8d:27-28`, `8e:71`, `8f:69-70`, `8j:82-85,95,112-113`, `8k:88-89`; `8g:37` builds names dynamically (`--boop-xterm-diagram-${key}-${name}`) |
| TS var writes | `8a:167` `--boop-xterm-chip-hue`; tests at `8_models:245`, `8g test:190,202`, `8h test:50` |
| class strings | 46 sites in `src/8*_*.ts`: `term-context-*` 15, `turn-panel*` 10, `asq*` 8, `term-fork*` 4, `term-structured-*` 3, `term-diagram*` 2, `term-turn-debug*` 2, `term-graphics` 1 |
| `0_termTokens.ts` | the ⌘-click text-token scanner, not theme tokens. Generated files avoid the word "tokens" in their filenames. |
| instant | imports `xp.css` unlayered (`main.ts:7`), whose `input[type=checkbox]{position:fixed;opacity:0}` beat a package selector on 2026-09-26. Duplicates 58 `term-*`/`asq*`/`turn-panel*` class rules in its own CSS. `e2e-real` selects by class (`.term-diagram` 44 times, `.term-context-*` ~30, `.asq*` 9). |
| md | `mdview.css`: 16 vars (`--mb-*`, `--md-code-*`), 35 `.mdview-*` classes, ~79 `className` literals, `data-md-*` hooks, no `data-testid` |
| xdom | `Dom(template)` cached per template: `.id(values)`, `.$[event]`, `.route[event]` via `data-route` + `data-<kebab(param)>`; `layout()` writes `--track-<name>` |
| prior art | `signal-grid/src/3_paths.ts`: one hand-written declaration per grid part gives id, route, var namespace and test selector |
| `extract rename` | no CSS front-end, so it cannot rename custom properties or selectors |
| platform | custom properties and class names are case-sensitive; HTML attribute names are lowercased (`data-turnId` is stored as `data-turnid`); `dataset.turnId` ↔ `data-turn-id` is the platform's bijection |

## 2. Library candidates (facts)

| candidate | input | emits | classes / test ids / paths | lacks here |
|---|---|---|---|---|
| TypeSpec 1.14 (in lock) | `.tsp` | via `$onEmit` | enums, models, values | an emitter |
| `@typespec/emitter-framework` 0.17 | TypeSpec types | TS/C#/Python declarations | – | value tables from defaults; CSS; experimental |
| `@alloy-js/core` + `/typescript` | JSX | TS | – | CSS |
| Style Dictionary v5 | DTCG JSON | CSS vars, SCSS, JS/TS, iOS, Android | none | TypeSpec input; classes, test ids, paths |
| Terrazzo | DTCG JSON | CSS vars with modes, sass, tailwind, JS | none | same as Style Dictionary |
| vanilla-extract | `.css.ts` | CSS + TS; contract vars unhashed via mapper | hashed classes unless `globalStyle` | TS is the source; hashing by default |
| Panda CSS | TS config | codegen + atomic CSS | atomic classes | fixed var scheme |
| StyleX | TS + babel | atomic CSS | hashed | hashed names |
| CSS Modules | `.module.css` | hashed classes | classes only | hashed names |
| lightningcss 1.33 (in lock) | CSS | parse/print, visitors for `DashedIdent` and selectors, `@layer`, `@property`, `@import … layer()` | – | not a token system; **it is the tool for the CSS rename codemod and default validation** |
| DTCG 2025.10 | – | token JSON | none | tokens only; possible optional output |
| CSS `@property` | – | typed registration; `getComputedStyle` returns computed values | – | Safari 16.4+ |
| CSS `@layer` | – | layer order; unlayered beats layered | – | Safari 15.4+ |

No candidate takes TypeSpec input and models classes, test ids and paths. What's left to write: one small emitter, plus a ~60-line var read/write runtime in xdom.

## 3. Minimal TypeSpec representation

### 3.1 Shared lib `@hafley66/ui-names` (`lib/0_main.tsp`)

```tsp
namespace Hafley.Ui;
scalar px extends float64;        // TS number; CSS `${n}px`; @property "<length>"
scalar length extends string;     // any <length-percentage> or list ("0 2px", "52%", "90vw")
scalar number extends float64;    // "<number>" (verify: the name `number` is legal)
scalar duration extends float64;  // ms
scalar color extends string;      // "<color>"
scalar font extends string;       // font shorthand
scalar css extends string;        // raw: shadows, easings, tone pairs
extern dec ui(target: Reflection.Namespace, prefix: valueof string);   // once per package
```

### 3.2 Candidates (each shows 6 tokens, 3 classes, 2 test ids, 1 path, 1 theme)

**A: model defaults + enums**
```tsp
import "@hafley66/ui-names"; using Hafley.Ui;
@ui("boop-xterm") namespace BoopXterm;
model Tokens {
  gutterOffset: px = 42;
  contextQueueBg: color = "#fff";
  forkPaneRows: number = 8;
  squaresMove: duration = 260;
  contextFont: font = "11px/1.3 Menlo, Monaco, monospace";
  contextQueueShadow: css = "0 6px 22px rgb(0 0 0 / .34)";
}
enum Class { contextRoot, contextQueue, forkHeader }
enum TestId { contextQueue, forkLayer }
enum Path { forkRow: "/{paneId}/fork/{forkKey}" }
model Themes { dark: OptionalProperties<Tokens> = #{ contextQueueBg: "#1e1e1e" }; }
```

**B: const object values**
```tsp
const prefix = "boop-xterm";
const Tokens = #{ gutterOffset: px(42), contextQueueBg: color("#fff"), forkPaneRows: number(8),
  squaresMove: duration(260), contextFont: font("11px/1.3 Menlo, Monaco, monospace"),
  contextQueueShadow: css("0 6px 22px rgb(0 0 0 / .34)") };
const Class = #["contextRoot", "contextQueue", "forkHeader"];
const TestId = #["contextQueue", "forkLayer"];
const Path = #{ forkRow: "/{paneId}/fork/{forkKey}" };
const dark = #{ contextQueueBg: color("#1e1e1e") };
```

**C: a decorator per token**
```tsp
model Tokens {
  @token(Kind.px, "42px") gutterOffset: string;
  @token(Kind.color, "#fff") contextQueueBg: string;
  …
}
@theme("dark", #{ contextQueueBg: "#1e1e1e" }) model DarkTheme {}
```

| | A | B | C |
|---|---|---|---|
| lines | 15 | 15 | 15 |
| lexemes per token | 6 | 7 | 11 |
| decorators | 1 | 0 | 8 |
| default checked against its type | yes (verify) | yes via constructors (verify) | no |
| theme keys/types checked | yes via `OptionalProperties<Tokens>` (verify) | no | no |
| doc comment on a token | yes | no | yes |
| cross-file grouping | model spread; duplicates are compile errors | object spread (verify) | spread |
| cannot express | a default of `var(--other)`; per-token `@property` opt-out without a decorator; composed paths; state modifiers except via `enum Data` | type references; checked themes; docs | typed defaults; checked themes |

**Pick A.** It has the fewest lexemes per token and one decorator per package. The compiler checks defaults and theme values against the scalar, docs attach, and duplicates are compile errors.

### 3.3 Conventions (shared by md, signal-grid, grapht, and later packages)

| declaration | meaning | line syntax |
|---|---|---|
| `model Tokens` (spreads allowed) | `--${prefix}-${field}` | `field: scalar = value;` |
| `model Themes` | value sets over `OptionalProperties<Tokens>` | `name: OptionalProperties<Tokens> = #{…};` |
| `enum Class` | `${prefix}-${member}`; a string value is the legacy spelling during migration only | `member,` |
| `enum TestId` | `data-testid="${prefix}-${member}"` | `member,` |
| `enum Data` | dataset key = member | `member,` |
| `enum Path` | xdom `Dom("/${prefix}" + value)` | `member: "/…/{param}",` |

The prefix comes from `@ui("…")` once per package, never derived from the namespace name.

## 4. Spelling (one spelling per field)

| layer | token | class | test id | data | path |
|---|---|---|---|---|---|
| tsp | `gutterOffset` | `contextQueue` | `contextQueue` | `turnId` | `forkRow` |
| TS | `Tokens.gutterOffset` | `Class.contextQueue` | `TestId.contextQueue` | `el.dataset.turnId` | `Path.forkRow` |
| CSS/DOM | `--boop-xterm-gutterOffset` | `.boop-xterm-contextQueue` | `boop-xterm-contextQueue` | `data-turn-id` (platform bijection) | `id="/boop-xterm/p1/fork/k"` |
| JSON | `"gutterOffset"` | `"contextQueue"` | … | `"turnId"` | `"forkRow"` |

`prefix + "-"` is a separator, like `.` in TS. Fields contain no `-`, so names stay injective across packages. The emitter reports `duplicate-prefix` when two packages share a prefix.

## 5. Emitter (`hafley-rxjs/packages/ui-names`, compiler 1.14)

```ts
// src/0_types.ts
export type VarKind = "px" | "length" | "number" | "duration" | "color" | "font" | "css"
export type TokenDef = { field: string; kind: VarKind; fallback: string | number; doc?: string }
export type ThemeDef = { name: string; values: Record<string, string | number> }
export type NameDef  = { field: string; legacy?: string }
export type PathDef  = { field: string; template: string; params: string[] }
export type UiPackage = { prefix: string; namespace: string; tokens: TokenDef[]; themes: ThemeDef[];
  classes: NameDef[]; testIds: NameDef[]; data: NameDef[]; paths: PathDef[] }
export type EmitOptions = { "legacy-kebab"?: boolean; "property-registration"?: boolean; "out-dir": string }

// src/1_lib.ts
export const $lib: TypeSpecLibrary<…>   // diagnostics: duplicate-prefix, bad-default, legacy-missing, unknown-decl
export function $ui(ctx: DecoratorContext, ns: Namespace, prefix: string): void   // stateMap(ns) = prefix

// src/2_collect.ts
export function collect(program: Program): UiPackage[]
// per @ui namespace: Tokens properties -> kind from the base scalar, fallback from defaultValue, doc from getDoc;
// Themes -> ObjectValue defaults; enums Class/TestId/Data -> {field, legacy?}; enum Path -> template + params

// src/3_validate.ts
export function validate(pkgs: UiPackage[], opts: EmitOptions): Diagnostic[]
// duplicate prefix; lightningcss parses each fallback as a value of its kind; legacy-kebab names exist in the pre-migration CSS

// src/4_emitTs.ts, 5_emitCss.ts, 6_emitManifest.ts (json + renames.tsv), 7_emit.ts ($onEmit: collect -> validate -> write)
```

Runtime in xdom (hand-written), `packages/xdom/src/6_cssVars.ts`:

```ts
export type KindValue = { px: number; length: string; number: number; duration: number; color: string; font: string; css: string }
export type VarSpec<K extends VarKind = VarKind> = { readonly name: `--${string}`; readonly kind: K; readonly fallback: KindValue[K] }
export function formatVar<K extends VarKind>(kind: K, value: KindValue[K]): string   // px -> `${v}px`, duration -> `${v}ms`
export function parseVar<K extends VarKind>(kind: K, raw: string, fallback: KindValue[K]): KindValue[K]
export function readVar<K extends VarKind>(el: Element, spec: VarSpec<K>): KindValue[K]   // getComputedStyle, parse, fallback
export function writeVar<K extends VarKind>(el: HTMLElement, spec: VarSpec<K>, value: KindValue[K]): void   // inside tap()
export function cssVars<S extends Record<string, VarSpec>>(host: HTMLElement, spec: S): {
  read: Signal<VarValues<S>>; write: Signal<Partial<VarValues<S>> | undefined>; refresh: Signal<void | undefined>; effects: Observable<void>
}
// never subscribes; the caller merges effects
```

### 5.1 Emitted files per package

| file | generated? | content |
|---|---|---|
| `ui/0_ui.tsp` | authored | §3 shape |
| `src/0_ui.ts` | yes | `prefix`, `Tokens` (VarSpec table), `Themes`, `Class`, `TestId`, `Data`, `Path` (`Dom` templates), `Selector` |
| `src/0_ui.css` | yes | layer order, `@property`, `:root` defaults, theme scopes |
| `src/1_rules.css` | authored | component rules inside `@layer hafley.ui` |
| `src/theme.css` | authored, 2 lines | imports the two files above |
| `ui/0_ui.names.json` | yes | manifest for Rust and other consumers |
| `ui/0_ui.renames.tsv` | yes, during migration | `old<TAB>new` for the codemod |

### 5.2 Cascade layers (fix for the XP.css collision)

| layer, in order | writer | contents |
|---|---|---|
| `hafley.tokens` | package `0_ui.css` | defaults and theme scopes |
| `hafley.host` | host app | `@import "xp.css" layer(hafley.host);` and resets |
| `hafley.ui` | package `1_rules.css` | component rules; these beat the XP reset whatever its specificity |
| `hafley.override` | host app | per-package overrides |
| unlayered | host app | beats all layers |
| inline `setProperty` | runtime | beats normal declarations |

Verify that Vite 8 inlines `@import … layer()`. `!important` reverses layer order: theme.css has 3 and XP.css has 1.

## 6. Lifetimes, storage, read/write order, uniqueness

| instance | created | lives | torn down |
|---|---|---|---|
| generated consts | module load | process, frozen | never |
| `Dom(template)` | module load | process; listeners only while a stream is subscribed | last unsubscribe |
| `@property` + `:root` | stylesheet parse | document | stylesheet removal |
| `cssVars(host, Tokens)` | per pane, in `createBoopXtermView` | the view's `effects` subscription | view unsubscribe |

Storage: defaults in `hafley.tokens`, overrides in `hafley.override` or unlayered, runtime writes inline. `Tokens.x.fallback` is the only JS copy of a value.

Read/write order: stylesheets load → view creates `cssVars` → the boundary subscribes `effects` → paints call `readVar` → writes call `writeVar` inside the stream's `tap` → `refresh` → re-read.

Uniqueness: prefix per program (diagnostic); field per package (compiler); var/class/test-id strings per document (injective naming); test ids per pane root (locators scoped to the host); Path ids per document (template must carry an instance param such as `{paneId}`).

## 7. boop-xterm migration and gates

Gates:
- **G0**: `tsp compile` of fixtures, one per verify item.
- **G1**: emitter snapshots + `generate:check` (regenerate, `git diff --exit-code`).
- **G2**: boop-xterm typecheck, unit and browser tests.
- **G3**: one browser golden. It mounts the real `createBoopXtermView` and snapshots `readVar` for all tokens; the snapshot must be identical before and after each step.
- **G4**: rg counts: 0 `getPropertyValue("--`/`setProperty("--` in src; 0 `className = "` in `src/8*`; after M6, 0 kebab `--boop-xterm-a-b` names.
- **G5**: instant e2e on the new package version.

| step | scope | tool | gates |
|---|---|---|---|
| M0 | `packages/ui-names`, xdom `6_cssVars.ts` | – | G0, G1 |
| M1 | author `ui/0_ui.tsp` for all 234 vars (drafted from `:root` by a lightningcss script, reviewed by hand); emit with `legacy-kebab`; delete the `:root` blocks from theme.css | lightningcss script | G1, G2, G3 |
| M2 | the ~30 TS-read vars; 8g's dynamic names become a static table; delete the duplicated TS default constants | hand, ~12 sites | G2, G3, G4 |
| M3 | split theme.css into `0_ui.css` + `1_rules.css` in `@layer hafley.ui`; the XP-reset test runs under a layered reset | – | G2 |
| M4 | 46 class sites to `Class.x` with legacy values (strings unchanged); add `TestId` to the roots e2e uses | hand/script | G2, G4 |
| M5 | tests to `Selector.*` through real components | – | G2 |
| M6 | respell: drop `legacy-kebab` and legacy enum values; apply `renames.tsv` to CSS in the package and instant | lightningcss visitor | G2, G3, G4 |
| M7 | instant: layered XP import, import package theme.css, delete 58 duplicated rules, e2e imports `Selector` | – | G5 |

md goes second with the same steps. There, `@ui("md")` covers 16 vars, 35 classes, `data-md-*` as `enum Data`, and test ids for its roots. React reads through `cssVars(...).read.x.$()` inside `SignalReact`.

## 8. Tests use real components

```ts
// src/test/2_mountView.ts
export function mountView(script: Script = emptyTransport, identity = { id: "p1", target: "tmux:1", socket: null }) {
  const { term, host } = openRealTerminal()
  const view = createBoopXtermView(term, host, identity, testPorts(script))
  const subscription = view.effects.subscribe()   // the test is the boundary
  return { term, host, view, subscription }
}
```

Tests assert through `Selector.*` / `getByTestId(TestId.x)` scoped to the pane. No `document.createElement` stand-ins.

## 9. Open questions

1. Classes: package prefix (`boop-xterm-contextQueue`), or keep short `term-`/`asq` under a second `@ui` argument?
2. `data-*`: accept the platform bijection (`turnId` ↔ `data-turn-id`), or only allow single lowercase words?
3. Themes: attribute scope, `light-dark()`, or `prefers-color-scheme`? Collapse the 14 `diagramLight*`/`diagramDark*` tokens into one set plus `Themes.dark`?
4. Register `@property` for px/number/duration/color (computed values, invalid overrides fall back)?
5. Require every boop-xterm `Path` to start with `{paneId}`?
6. Emitter home: hafley-rxjs `packages/ui-names` (compiler 1.14), or hafley-tsp (1.10 + Alloy)?
7. TS writer: plain strings (json-rx precedent), or Alloy?
8. boop-xterm depends on `@hafley66/xdom`: OK?
9. Rust constants and/or DTCG JSON outputs now, or the manifest only?
10. Ship M6 + M7 as one coordinated instant bump?
