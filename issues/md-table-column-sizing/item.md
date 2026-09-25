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

# md tables break inline code mid-word; columns need content-based min widths

## Description

## Comments

### 2026-09-25T12:51:25Z · @claude

77ccf5ff: column minWidth = measured longest whitespace-free code run (hidden probe cell in the grid); code breaks only at spaces. Test 'keeps inline code in a cell on one line': before lines [2,4,1,1], no h-scroll; after pass.
