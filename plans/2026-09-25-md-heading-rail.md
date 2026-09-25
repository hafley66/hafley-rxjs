# md heading rail, heading boxes, explorer fixes

Status: waiting on owner answers (bottom). Nothing implemented yet.
Source: owner messages 2026-09-24/25; reference style hafley.codes
(`/blog/learning/css-anchor-positioning/`), repo `hafley66/le-blog`.

## Target picture (owner correction: ONE rail, headings flush)

```text
┃h1╭──────────────────────────╮
◉  │ 1. md: batched …         ╯   pill right, circle fold toggle on the rail
┃▔▔▔▔▔▔▔▔▔▔▔ underline (heavier than the box border)
┃ body                          rail = --h-1
┃h2╭──────────────────╮         rail blends --h-1 → --h-2 into this box
◉  │ 1. Reference …   ╯
┃ body                          rail = --h-2
┃h3╭────────────╮
◉  │ 1. Types   ╯
┃ body                          rail = --h-3
┃h2╭──────────────────╮         a return to level 2 blends --h-3 → --h-2
```

Today (`packages/md/src/1_reading.css`): one guide per section level
(`.mdview-body` border-inline-start, `--md-guide-1..6`), nested bodies indent
by `--md-section-indent`, so guides stack.

## Items

| # | item | where |
| --- | --- | --- |
| 1 | explorer folders have no expand arrows | instant `plugins/files/1_FileTree.tsx` (grid tree) |
| 2 | "fold on open" is bare text; make a real toggle or move it | md `MdPanel.tsx` act-bar |
| 3 | file name shown twice (tab + toolbar); show once | md act-bar `.spy-title` |
| 4 | tab title hover popover; right-click menu: copy path, copy relative path, reveal, open external | instant dock tab |
| 5 | heading = box, square left, pill right | md CSS |
| 6 | one rail; headings sit flush on it (no stacked guides, no indent) | md CSS + section markup |
| 7 | fold toggle = circle on the rail, vertically centred on the box | md CSS (abs pseudo / twisty) |
| 8 | underline heavier than the box border | md CSS |
| 9 | rail colour changes at each heading with a soft (gaussian-like) blend | md CSS gradient stops |
| 10 | per-level custom properties; headings carry level/depth classes | md CSS + `mdview-h{N}` already present |
| 11 | flatten the h1..h6 size jump | md CSS |
| 12 | "when file type X changes run Y" (format, re-highlight, recompute steps) | md plugin plan (`2026-09-24-md-references-and-plugins.md`) |

## Mechanism (CSS only)

| part | mechanism |
| --- | --- |
| pill box | `border-start-end-radius` / `border-end-end-radius: 999px` |
| rail | one `::before` on the document column, `background: linear-gradient(...)` with a stop pair at each heading's y |
| heading y positions | renderer writes `--h-y-N` per heading (as the blog TOC writes scroll vars), or anchor positioning `anchor(--h-N top)` |
| soft blend | stop pairs spread over `--rail-blend` px either side of the heading top |
| circle toggle | `position: absolute; inset-inline-start: calc(-1 * var(--toggle) / 2); top: 50%; translate: 0 -50%; border-radius: 50%` |
| level scale | `font-size: calc(1em + (6 - var(--h-level)) * 0.08em)` |

## Questions for owner (answer inline)

1. Blend length at a heading: fixed px (e.g. 24px either side), or the whole
   distance from the previous heading? ->
2. Folded section: rail stops at the heading box, or a short stub below it? ->
3. Heading positions: renderer-written custom properties (works everywhere,
   one write per layout change) or CSS anchor positioning (no JS, Chromium
   only; instant's webview is WebKit on macOS)? ->
4. Rail colour per level: keep today's `--md-guide-1..6` palette, or new
   `--h-1..6`? ->
5. Body content: flush with the heading text, or a fixed small inset from the
   rail? ->
6. Items 1-4: file as issues now? ->
