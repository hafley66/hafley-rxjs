---
created: 2026-09-25
updated: 2026-09-25
type: bug
reporter: owner
status: fixed
priority: normal
closed: 2026-09-25
---

# md panel loses DOM and scroll on tab switch (register keepAlive)

## Description

## Comments

### 2026-09-25T05:08:22Z · @claude

Branch fix/overlay-md-remount (instant-wt/overlay-md/hafley-rxjs): 66eb4036 registerMdview instance keepAlive (test failed before: keepAlive undefined, scrollTop 0; passes). 72d98657 header action strip placed in kept-alive overlay (failed before: left 610; passes). instant 78f313cb restore path + e2e md-panel-keepalive pass. Published @hafley66/md@0.1.2-dev.1790312808466, instant bump 015d58cd.
