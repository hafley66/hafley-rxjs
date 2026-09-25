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

# md table cell selection styling is harsh (bright bg, rough text)

## Description

## Comments

### 2026-09-25T12:51:25Z · @claude

77ccf5ff: --md-select-tint (14%) / --md-select-edge; range edges as inset shadows (theme edge borders shifted text 1px). Test 'tints a selection faintly...' across xp light/dark, p5, ac3: before text moved on all 4; after pass, contrast >= 7.
