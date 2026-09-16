---
"@hafley66/json-rx": patch
"@hafley66/react-dock-and-flow": patch
---

Depend on `@hafley66/signals` through `workspace:*`, not a frozen range.

The published ranges were `^0.0.2` and an exact `0.0.2`. Neither can ever resolve to the current `@hafley66/signals@0.1.1`, so every consumer of `@hafley66/json-rx@0.1.2` and `@hafley66/react-dock-and-flow@0.0.3` installed the old kernel no matter what was released. `workspace:*` is rewritten to the real version at pack time and bumped by `changeset version`.
