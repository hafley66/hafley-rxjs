---
created: 2026-09-26
updated: 2026-09-26
type: feature
status: open
priority: normal
---

# md tab toolbar: groups, overflow into +N, view options behind a gear

Branch: `feature/the-gang-cleans-the-top-bar`

## Description
The md panel toolbar (`packages/md/src/MdPanel.tsx:480-520`) is one flat row: explorer, filename, fold all, unfold all, fold on open, zoom %, svg/grapht, reading width, external. It wraps to two lines at normal widths. The filename repeats the tab title right above it.

## Want
| group | items | where |
| --- | --- | --- |
| nav | explorer toggle, external | toolbar, left |
| view options | fold all, unfold all, fold on open, reading width, diagram renderer (svg/grapht), zoom reset | behind a gear icon popover. Global config, the same gear on every md tab |
| removed | filename `.spy-title` | the tab title already shows it; keep the full path as the gear popover header or tab tooltip |

- Buttons render in button groups (segmented, one border per group).
- When the row is too narrow, trailing groups fold into a `+N` button. `+N` opens a menu under itself with the folded items, and N counts the folded items.
- The diagram renderer choice stays visible up front. It is the one view option not hidden behind the gear, because it is experimental. It folds into `+N` last.
- Keyboard: the gear and `+N` menus open with Enter/Space, close with Esc, and trap arrow keys.

## Candidates
| option | what it gives | cost |
| --- | --- | --- |
| native `popover` + CSS anchor positioning + `ResizeObserver` overflow | menus, light-dismiss, positioning; instant already loads the anchor polyfill (`main.ts:356`) | overflow measuring is custom |
| MUI (`@mui/material` `Menu`, `ButtonGroup`, `Popover`) | groups, menu, popover, a11y | new dep; styling must be tuned to XP.css |
| Radix (`@radix-ui/react-dropdown-menu`, `react-toolbar`, `react-popover`) | toolbar roving focus, menus, a11y, unstyled | new dep; overflow still custom |

The overflow-to-`+N` measuring exists in none of the three. Search for a priority+/overflow-menu library before writing it.

## Acceptance Criteria
- [ ] Browser test at widths 1400/900/500: snapshot of the visible items and the `+N` count per width.
- [ ] Browser test: the gear popover contains fold all, unfold all, fold on open and reading width. The toggles persist through `setMdUi`.
- [ ] No `.spy-title` in the toolbar.
- [ ] The toolbar is one row at every width.
