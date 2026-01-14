---
description: File and folder naming convention for self-documenting filesystem structure
triggers:
  - creating a new file
  - creating a new folder
  - renaming files or folders
  - organizing code structure
---

# Hafley FS Naming Preference

> **Name files so `ls` explains the system: `{order}_{what}_{how}_{keyidea}.ts`**

## Rules

**Folders** (polyglot filesystem-safe):
```
ALWAYS: underscores              0_vite_plugin_rxjs_patch/
NEVER:  dots or hyphens          0.vite-rxjs-patch/
```

**Files** (underscores for name, dots for extensions):
```
{order}_{what}_{how}_{keyidea}.ts
{order}_{what}_{how}_{keyidea}.test.ts
{order}_{what}_{how}_{keyidea}.browser.test.tsx
```

## Pattern

- **order**: numeric prefix for dependency/read order (00, 01, 02... or 99 for utils)
- **what**: the thing (types, helpers, patch, accumulator)
- **how**: the mechanism (events, scan, recursive, weakmap)
- **keyidea**: distinguishing concept (stack_store, lodash_paths, bidirectional)

## Examples

```
# BAD - requires reading file
00_types.ts
01_patch.ts

# GOOD - ls output IS documentation
00_types_state_events_stack_store.ts
02_patch_observable_pipe_subscribe.ts
04_accumulator_events_to_state_scan.ts
```

## Goal

Reading `ls src/` should explain the architecture without opening any files.
