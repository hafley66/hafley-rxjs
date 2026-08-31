---
created: 2026-08-30
updated: 2026-08-30
type: bug
status: obsolete
priority: normal
labels: [md, mermaid, d2]
closed: 2026-08-30
disposition_note: invalid
---

# Expose Markdown diagrams when sections start folded

## Description

## Problem

Instant routes Markdown files into `@hafley66/md`, and the package defaults `MdUi.startFolded` to `true`. `initCollapsedForReadyDoc()` fills the collapse set with every section ID. `SectionView` mounts `MarkdownBody` only when its section is expanded. A document whose Mermaid or D2 fences live below headings therefore mounts zero diagram renderers on initial open, so valid diagrams appear absent.

Observed with `/Users/chrishafley/projects/instant/docs/0_terminal-stack-flow.md` and Instant package `@hafley66/md@0.1.1-dev.1788134367104`.

## Boundary Evidence

- Instant registration and routing reach the package through `registerMdview()` and `openMarkdownPanel()`.
- `parseMdSections()` retains all 5 Mermaid fences in the expected H2 section slices.
- Streamdown 2.5.0 custom renderer dispatch finds all 5 fences when the same document is rendered directly.
- Mermaid 11.16.0 renders all 5 exact blocks in headless Chromium. SVG sizes are 42,376, 22,613, 30,496, 18,027, and 20,147 bytes.
- The first suppressing boundary is `packages/md/src/signals.ts`: default `startFolded: true` plus `defaultCollapsed()` and `initCollapsedForReadyDoc()`. `packages/md/src/MdPanel.tsx` then omits `MarkdownBody` for collapsed sections, before `MermaidDiagram` can mount.

## Acceptance Criteria

- [ ] Opening a Markdown document containing Mermaid or D2 under the default viewer settings exposes diagram content without requiring a manual section-by-section search.
- [ ] The behavior for a document-level H1 containing diagram-bearing H2 sections is covered.
- [ ] Mermaid and D2 custom renderers still mount lazily only for content selected by the final folding policy.
- [ ] A browser test distinguishes hidden-by-fold state from Mermaid or D2 render failure.
- [ ] Diagram render errors remain visible after the relevant section is revealed.
- [ ] The Instant consumer requires no app-specific diagram detection or renderer fork.

## Tests Run

- [x] Exact document parsed with the installed `@hafley66/md` artifact: 1 H1, 6 H2 sections, 5 retained Mermaid fences.
- [x] Streamdown custom-renderer dispatch receipt: 5 Mermaid renderer mounts.
- [x] Mermaid 11.16.0 headless Chromium receipt: 5 of 5 exact blocks rendered.

## Implementation Notes

Package boundary: `packages/md`. Instant is the consumer and should receive the fix through a packed Verdaccio artifact. Preserve the explicit folded-view option while defining diagram visibility under that option.

## Comments

### 2026-08-31T01:41:59Z · @intake

Obsolete: invalid

### 2026-08-31T01:42:06Z · @codex

Obsoleted after live log inspection. The observed failure was WebKit `Importing a module script failed` in the lazy MarkdownBody import while the running Vite optimizer still served @hafley66/md 0.1.1 after the consumer installed 0.1.1-dev.1788134367104. A clean Tauri/Vite restart re-optimized the generated package. Folded sections remain an explicit viewer option and were not the reported failure.

