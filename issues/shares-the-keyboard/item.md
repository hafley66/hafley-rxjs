---
created: 2026-09-26
updated: 2026-09-26
type: chore
status: open
priority: normal
related: ['@wheel-boost']
---

# Input handling goes through the xdom chord library

## Description

## Want
Keyboard and wheel input handling in boop-xterm and instant goes through the RxJS/signal chord library.

## Facts
- There is no `packages/inputs`. The chord library is `@hafley66/xdom` `src/5_chords.ts` (commit 0dda5897): `parseChord`, `matchesChord`, `chord()`, `sequence()`, `held()`, `typeahead()`. It covers keyboard events only.
- instant uses `tinykeys` (`src/keymap.ts`) plus 17 raw `keydown`/`keyup`/`wheel` listeners.
- boop-xterm has 5 key and wheel handler sites.

## Tasks
- [ ] Decide: keep the chord library inside xdom, or split it out as `@hafley66/inputs` (user's recollection of the name).
- [ ] Extend the chord matchers to modifier state on `WheelEvent`/`PointerEvent`, e.g. `modifiers("mod")`.
- [ ] Move boop-xterm's wheel modifier checks onto it; this unblocks the wheel boost card.
- [ ] Inventory instant's `tinykeys` bindings and raw listeners; migrate them in a separate lane.
