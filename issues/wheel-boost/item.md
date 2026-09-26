---
created: 2026-09-26
updated: 2026-09-26
type: feature
status: open
priority: normal
---

# Modifier plus wheel sends a boosted scroll

## Description

## Want
Cmd/Meta (or a configured modifier) plus wheel sends a stronger scroll to the pane.

## Current path (`packages/boop-xterm/src/5_wheel.ts`)
| pane mode | who scrolls | today |
| --- | --- | --- |
| app owns the mouse (claude, codex: `mouseTrackingMode != none`) | xterm sends wheel reports to the app | 1 report per wheel event; `shiftKey` bypasses to the tmux path |
| no mouse mode | `scroll_session` Endpoint to tmux | rows = deltaY / cellHeight, per-frame sum, capped at 50 lines |

## Design sketch
- The modifier match comes from `@hafley66/xdom` chords (see the `chore/the-gang-shares-the-keyboard` card), not a hand-read `event.metaKey`.
- tmux path: multiply rows by `boostFactor` before the frame sum; raise the 50-line cap when boosted.
- App-mouse path: xterm 6 has `fastScrollSensitivity` (typings line 113), but it applies to the viewport only. For apps, write N wheel reports through `term.input(seq, true)` (typings line 1025), or step N lines through the tmux path. Pick after checking what claude/codex do with repeated reports.
- Factor and modifier are host state: `BoopXtermPorts.wheelBoost: SignalSource<{ chord: string; factor: number }>`.

## Acceptance Criteria
- [ ] Boosted wheel scrolls factor × lines in both modes; unboosted behaviour is unchanged.
- [ ] Browser test with a real xterm in each mouse mode; marble test for the frame sum.
