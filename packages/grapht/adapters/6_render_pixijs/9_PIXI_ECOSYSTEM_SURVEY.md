# PixiJS ecosystem survey for sequence diagrams

Date: 2026-08-24

Scope: packages that could reduce implementation inside the existing
`SequenceArtifact -> PixiJS` projection. The survey covers PixiJS v8 rendering,
SVG import, camera control, interaction, text, layout, culling, pooling, UI,
animation, accessibility, testing, and graph packages.

## Direct answer

| Capability | Existing package | Pixi v8 status | Sequence coverage |
| --- | --- | --- | --- |
| WebGL/WebGPU scene graph | `pixi.js` | Native | Shapes, paths, text, containers, meshes, events |
| Pan, wheel zoom, pinch, inertia, clamps | `pixi-viewport` 6.x | Declares Pixi v8+ | Full camera gesture layer |
| CSS-like box/flex layout | `@pixi/layout` 3.x | Current official package | Actor headers, notes, controls; not sequence routing |
| Canvas widgets | `@pixi/ui` 2.x | Maps to Pixi v8 | Buttons, lists, scroll boxes, inputs |
| SVG shape import | `Graphics.svg()` | Pixi v8 core | Basic shapes, paths, gradients, clipping |
| SVG DOM-shaped scene import including text | `@pixi-essentials/svg` 3.0.0 | Published package targets modular Pixi 7 peers | One-to-one SVG element scene graph; requires compatibility spike |
| Whole-SVG raster import | Pixi `Assets` + `Sprite` | Pixi v8 core | Preserves appearance; removes descendant identity |
| Pointer and touch events | Pixi federated events | Pixi v8 core | Per-occurrence hover, click, drag, bubbling |
| Dynamic labels | `Text`, `BitmapText`, `HTMLText` | Pixi v8 core | Actor, message, group, activation, note labels |
| Live HTML in scene | `DOMContainer` | Pixi v8 core | Focus cards and controls; separate DOM render layer |
| Offscreen culling | `CullerPlugin`, `Culler` | Pixi v8 core | Cull sequence rows/groups outside camera |
| Alternate culling index | `pixi-cull` | Pixi-independent API; examples use older Pixi construction | Simple scan or spatial hash |
| Object pools | Application-owned arrays or `@pixi-essentials/object-pool` | Essentials releases stopped in 2023 | Reuse occurrence views |
| Tween/action composition | `pixijs-actions` | Declares Pixi v6/v7/v8+ | Focus and placement transitions |
| React reconciler | `@pixi/react` 8.x | Current Pixi v8 line | Applicable only if projection becomes React-owned |
| Scene inspection | PixiJS DevTools 2.x | Release notes include Pixi 8.15 support | Scene tree and property inspection |
| Asset preprocessing | AssetPack 1.x | Current official tool | Fonts, atlases, textures; little effect on native sequence SVG |
| General graph renderer | `pixi-graph` / `pixi-graph-fork` | Archived; Pixi 6-era dependencies | Node-link graph only; no sequence model |
| New graph renderer | `pixi-graph-engine` 0.1.1 | Claims Pixi 8 + Vue 3; zero dependents in npm result | Node-link graph; no sequence model |

## PixiJS core already covers

### Graphics and SVG

Pixi v8 `Graphics` and `GraphicsContext` provide retained vector paths and shared
geometry. `Graphics.svg()` parses SVG into Pixi vector geometry. The official SVG
guide records these limitations:

- SVG texture mode rasterizes the document into one sprite.
- Graphics mode preserves vector scaling.
- Graphics mode does not support SVG `<text>`.
- Filters and patterns are unsupported in Graphics mode.
- Complex SVG parsing has startup cost; `GraphicsContext` can share parsed output.
- Texture mode is bounded by the GPU texture-size limit and loses descendant identity.

Source: [PixiJS SVG guide](https://pixijs.com/8.x/guides/components/assets/svg)

### Events and picking

Pixi v8 has a federated, DOM-like event system. `eventMode` controls hit testing;
pointer events include down, up, move, over, out, enter, leave, tap, and outside
variants. Explicit `hitArea` values avoid geometry-derived hit testing.

Source: [PixiJS events guide](https://pixijs.com/8.x/guides/components/events)

### Scene graph and layers

`Container` supplies hierarchy, transforms, labels, child lookup, z-index sorting,
render groups, and cache-as-texture. These map directly to occurrence groups and
screen-space overlays.

Source: [PixiJS Container guide](https://pixijs.com/8.x/guides/components/scene-objects/container)

### High-cardinality rendering

Pixi core includes sprites, meshes, `ParticleContainer`, culling, texture GC,
prepare/upload systems, batching, and reusable `GraphicsContext` geometry.
`ParticleContainer` removes scene-graph features for throughput. This fits distant
actor/message marks, while retained containers fit interactive occurrences.

Sources: [ParticleContainer guide](https://pixijs.com/8.x/guides/components/scene-objects/particle-container),
[PixiJS performance reference](https://github.com/pixijs/pixijs/blob/dev/skills/pixijs-performance/SKILL.md)

### Text choices

| Type | Representation | Relevant property |
| --- | --- | --- |
| `Text` | Canvas-rasterized texture | General labels with Pixi text metrics |
| `BitmapText` | Glyph atlas | Large counts or frequently changing labels |
| `HTMLText` | SVG `foreignObject` rasterized to texture | HTML styling, without live DOM interaction |
| `DOMContainer` | Real HTML element in a Pixi-managed DOM layer | Inputs, selectable content, accessible focus cards |

`DOMContainer` elements receive world transforms after rendering. The repository
already contains a device-pixel-ratio and offset lab for this path.

Sources: [PixiJS DOMContainer example](https://pixijs.com/8.x/examples/basic/dom-container/),
[PixiJS text guide](https://pixijs.com/8.x/guides/components/scene-objects/text)

## Packages with direct sequence relevance

### `pixi-viewport`

Version 6 moved to Pixi v8+. It provides drag, pinch, wheel, deceleration, follow,
snap, clamp, bounce, and edge-scroll plugins. It requires `app.renderer.events`.
The npm result reports 6.0.3 and the repository currently has open issues involving
some Pixi 8.10 combinations, resolution, masks, wheel propagation, and negative scaling.

Sources: [pixi-viewport repository](https://github.com/pixijs-userland/pixi-viewport),
[pixi-viewport npm](https://www.npmjs.com/package/pixi-viewport),
[pixi-viewport issues](https://github.com/pixijs-userland/pixi-viewport/issues)

Covered project code:

- Camera gesture recognition
- Pointer-anchored wheel zoom
- Pinch zoom
- Inertial pan
- Bounds and minimum/maximum zoom
- Camera lifecycle events

Remaining project code:

- Sticky actor/group overlays
- Occurrence focus semantics
- Camera state serialization into `SequenceBoardReceipt`

### `@pixi/layout`

Official Yoga-backed Flexbox layout for Pixi objects. It supports containers,
sprites, graphics, text, percentages, gaps, wrapping, positioning, overflow,
backgrounds, borders, object fit, and object position. npm reports 3.2.1 published
two months before this survey.

Sources: [PixiJS Layout repository](https://github.com/pixijs/layout),
[layout documentation](https://layout.pixijs.io/docs/guides/core/concepts/flexbox/),
[@pixi/layout npm](https://www.npmjs.com/package/@pixi/layout)

Covered project code:

- Contents inside actor headers and notes
- Canvas-native toolbar or inspector layouts
- Horizontal/vertical stacking within overlay components

Uncovered project code:

- Sequence participant placement
- Lifeline routing
- Message ordering
- Nested group geometry
- Sticky stacking driven by the camera

### `@pixi/ui`

Official UI component set. Version mapping states `@pixi/ui` 2.x for Pixi v8.
Components include buttons, switches, checkboxes, inputs, lists, masked frames,
progress bars, radio groups, scroll boxes, selects, and sliders. npm reports 2.3.2.

Sources: [PixiJS UI repository](https://github.com/pixijs/ui),
[@pixi/ui npm](https://www.npmjs.com/package/@pixi/ui)

This covers canvas-native controls around a sequence board. Diagram occurrences and
their semantic focus graph remain outside the package.

### `@pixi-essentials/svg`

This is the closest package to the current SVG binding architecture. Its documented
model maps each SVG DOM element one-to-one into a Pixi scene graph and supports
`<text>` and `<tspan>`. It includes internal culling and a texture atlas for images.

Published compatibility evidence:

- npm latest shown: 3.0.0, published two years before this survey.
- The visible 2.0.1 package metadata declares Pixi 7 modular peer dependencies.
- The repository has an open request for Pixi v8 support on another Essentials package.
- The repository's latest listed release was April 2023.

Sources: [@pixi-essentials/svg npm](https://www.npmjs.com/package/@pixi-essentials/svg),
[published package metadata](https://app.unpkg.com/%40pixi-essentials/svg%402.0.1/files/package.json),
[Pixi Essentials repository](https://github.com/ShukantPal/pixi-essentials),
[Pixi Essentials issues](https://github.com/ShukantPal/pixi-essentials/issues)

Required compatibility spike:

1. Install against the repository's pinned Pixi version in isolation.
2. Render the Mermaid and D2 fixture SVGs.
3. Verify `text`, `tspan`, nested transforms, markers, dashed strokes, clipping,
   masks, gradients, and element lookup.
4. Verify WebGL and WebGPU.
5. Record bundle duplication and peer-resolution output.
6. Measure parse time, first render, memory, and replacement behavior.

### `pixijs-actions`

The package declares Pixi v6, v7, and v8+ compatibility and supplies composable
sequences, groups, repeats, path following, timing functions, pause, and speed.

Source: [pixijs-actions repository](https://github.com/reececomo/pixijs-actions)

It can drive focus fades and retained-placement transitions. The repository already
has RxJS scene/tween machinery covering the same output boundary, so this package is
an alternate animation driver rather than sequence infrastructure.

## Packages with limited or historical relevance

| Package | Evidence | Sequence-specific gap |
| --- | --- | --- |
| `pixi-graph` | Archived by its owner in June 2023; Graphology model, hover styles, node and edge events | General node-link graph; older Pixi stack |
| `pixi-graph-fork` | Package metadata and current Logseq warnings show Pixi 6 modular peers | General node-link graph; incompatible peer surface |
| `pixi-graph-engine` | npm search reports 0.1.1, Pixi 8 + Vue 3 + RBush, zero dependents | No sequence artifact or SVG binding model |
| `pixi-vector-graphics` | npm 0.0.5, published eight years ago | Historical SVG parser |
| `pixi-svg` | npm profile shows 3.2.0 published four years ago | Predates Pixi v8 core SVG support |
| `pixi-cull` | Simple and spatial-hash culling; no Pixi dependency | Pixi v8 now exposes `CullerPlugin` and manual `Culler` |
| `@pixi-essentials/object-pool` | Essentials kit release history stopped in 2023 | Pool policy remains application-specific |
| `@pixi/react` | Current 8.x reconciler | Adds value only under React ownership |
| `@pixi/filters` | Official shader/filter collection | Visual effects only |
| `AssetPack` | Official asset transform/compress/combine pipeline | Useful if labels move to bitmap fonts or shapes to atlases |

Sources: [archived pixi-graph](https://github.com/zakjan/pixi-graph),
[PixiJS ecosystem warning for userland compatibility](https://pixijs.com/8.x/guides/getting-started/ecosystem),
[pixi-cull](https://github.com/pixi-viewport/pixi-cull),
[AssetPack](https://github.com/pixijs/assetpack)

## Tooling

| Tool | Verified function |
| --- | --- |
| PixiJS DevTools | Browser extension for inspecting Pixi applications; 2.3.1 release notes state Pixi 8.15 support |
| Playwright | Existing repository visual, interaction, and performance receipts |
| AssetPack | Asset transforms, compression, combination, and manifests |
| Pixi text-style editor | Interactive generation of Pixi text styles |
| Pixi Storybook | Component-story tooling in the official Pixi organization |

Sources: [PixiJS DevTools releases](https://github.com/pixijs/devtools/releases),
[official ecosystem links](https://github.com/pixijs/pixijs.com/blob/main/docusaurus.config.ts)

## Project coverage map

```text
SequenceArtifact
  ├─ identity / relations / focus       existing grapht-model
  ├─ SVG bindings and geometry          existing mmd + d2 + grapht
  └─ Pixi projection
       ├─ camera                         pixi-viewport
       ├─ scene tree / picking           pixi.js
       ├─ shapes                         GraphicsContext / Graphics
       ├─ repeated lines and arrows      Mesh
       ├─ labels                         Text, BitmapText
       ├─ focused HTML                   DOMContainer
       ├─ local box layout               @pixi/layout
       ├─ optional canvas controls       @pixi/ui
       ├─ culling                        CullerPlugin
       └─ inspection                     PixiJS DevTools
```

The uncovered boundary is the semantic SVG-to-Pixi lowering that preserves the
existing occurrence IDs, roles, transforms, focus relationships, and sticky overlay
rules. `@pixi-essentials/svg` is the only surveyed package claiming a one-to-one SVG
element scene graph with text; its Pixi v8 compatibility requires execution evidence.

## Material limitations

- npm search results provide publish recency, version, and download metadata but do
  not prove runtime compatibility.
- GitHub activity proves repository activity, not correctness against the project's
  Mermaid and D2 fixture corpus.
- No surveyed package advertises a Pixi v8 sequence-diagram model or renderer.
- Pixi v8 changes quickly. The project currently declares `pixi.js ^8.9.0`; exact
  lockfile resolution must be recorded in every compatibility receipt.
- Current Pixi issue listings include recent GraphicsContext memory, BitmapText line,
  Canvas renderer, and WebGPU lifecycle reports. They require fixture-specific tests
  before affecting the projection design.

## Research stop condition

Search covered official Pixi repositories and documentation, Pixi userland, npm
package records, SVG importers, graph renderers, camera packages, layout/UI packages,
culling/pooling packages, animation packages, and development tools. Additional search
results repeated v5-v7 packages or game-specific extensions and did not add a maintained
Pixi v8 sequence renderer.
