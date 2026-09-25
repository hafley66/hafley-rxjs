---
created: 2026-09-25
updated: 2026-09-25
type: improvement
status: open
priority: normal
---

# md: dataflow-analyze why React totally re-renders the panel

## Description

Owner direction 2026-09-25: next pass on md rendering glitches (scroll drift across tab switch, diagrams rescanning) starts from a React dataflow analysis of WHY a total re-render happens (which signal/prop/context change reaches MdPanel and what subtree remounts), not from single-scenario tests.
