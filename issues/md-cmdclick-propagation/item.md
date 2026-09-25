---
created: 2026-09-25
updated: 2026-09-25
type: bug
reporter: owner
status: fixed
priority: normal
closed: 2026-09-25
closed_by: claude
---

# ⌘-click on md code refs does not stop propagation (double handling)

## Description

## Comments

### 2026-09-25T12:51:25Z · @claude

681feda6: native listeners on the ref element swallow ⌘ pointer events (grid delegates from the document; React stopPropagation arrived after the grid selected the cell). Test MdPanel.browser.test.tsx 'a handled ⌘-click...': before 8 events escaped + 2 cells selected; after pass. Shipped md 0.1.2-dev.1790340639831.
