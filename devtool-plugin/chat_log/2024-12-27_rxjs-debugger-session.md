# Chat Log - RxJS Debugger Session

## Session Summary (Dec 27, 2024)

This was a debugging and feature implementation session focused on getting the pipe tree visualization working correctly.

---

## Issues Fixed

### 1. Piped Observables Not Appearing in Registry

**Problem**: `userProfile$`, `userPosts$`, `notifications$` weren't showing in the tree despite being tracked.

**Root Cause**: `pipe-patch.ts` was using `observableMetadata.set()` directly instead of `registerObservable()`. This added metadata to the WeakMap but NOT to `observableById` Map, so ID-based lookups failed.

**Fix**: Changed to use `registerObservable(result, metadata)` which populates both storage structures.

**Lesson**: When you have dual storage (WeakMap for instance lookup, Map for ID lookup), always use a single registration function to keep them in sync.

---

### 2. Infinite Loop / Stack Overflow

**Problem**: App would crash with stack overflow when emissions flowed.

**Root Cause**: The `inEmissionHandler` guard was set AFTER `recordEmission()` was called, not before. So if `recordEmission()` triggered another emission (via `writeQueue$` → BehaviorSubject chain), the guard wasn't active.

**Fix**: Moved guard to top of handler, set it BEFORE any tracking code runs.

**Lesson**: Recursion guards must be the FIRST thing that happens, before any code that could trigger the recursive call.

---

### 3. `notifications$` Not Showing in Tree

**Problem**: Even after fix #1, `notifications$` appeared as an orphaned root instead of under `interval`.

**Root Cause**: The `interval` observable was being garbage collected. WeakRef lookup returned undefined.

**Investigation Journey**:
1. First thought: parent wasn't being registered → disproved, parentId was set
2. Second thought: opt-in tracking issue → disproved, interval was tracked
3. Actual cause: GC collected interval because no strong refs existed

**Fix (Two-Part)**:
1. Added `sourceRef` field to hold strong reference to parent observable
2. Added `parentInfo` snapshot that preserves parent metadata even after GC
3. Tree builder creates "phantom nodes" from `parentInfo` for GC'd parents

**Lesson**: WeakRef is great for memory management but terrible for debugging. When building dev tools, sometimes you need strong refs to preserve the debug trail.

---

## Design Philosophy Thoughts

### Observable Instances vs Operator Machinery

**Correction from user**: The "three times" framing was wrong. It's really about:

1. **Observable Instances** - The actual streams created at pipeline time
2. **Operator Functions** - The reusable transformation machinery
3. **Operator Returns** - Each operator call creates a new observable instance

These are separate concepts:
- `map` is an operator function (reusable)
- `map(x => x * 2)` returns an OperatorFunction
- `source$.pipe(map(x => x * 2))` creates a new observable instance

The goal is capturing all meaningful observable instances, not categorizing "times".

### Opt-in via Compile-Time Marker is Smart

Using `autotrackRxjs()` as a compile-time marker that the vite plugin detects is elegant:
- Zero runtime cost (it's a no-op)
- File-level granularity
- Prevents tracking recursion (UI layer doesn't get tracked)
- No magic - explicit opt-in

### Phantom Nodes are a Pragmatic Compromise

Ideally we'd keep all observables alive for debugging. But that leaks memory. The phantom node approach is a middle ground:
- Store just the identifying info (id, name, operators)
- Reconstruct minimal nodes for visualization
- Allow the actual observables to be GC'd

---

## User's Final Request

User wants to see the pipe structure "as written" - meaning each operator in a `.pipe()` call should be a separate node in the tree. Current implementation groups them as one node with an operators array.

This would require intercepting each operator's return value within the pipe call, not just the final result. Doable but more invasive.

---

## Personal Observations

1. **The user thinks fast** - they jumped from "wtf is microtask" to "holy fuck yea please" to "how is parent chain breaking" in rapid succession. Good to keep explanations concise.

2. **"3d printer kun"** - amusing nickname for Claude. I'll take it.

3. **The codebase is well-structured** - numbered files, clear separation of concerns, good test coverage. Made debugging easier.

4. **RxJS debugging is genuinely hard** - the combination of lazy evaluation, GC, and nested subscriptions creates a lot of edge cases. No wonder there's demand for better tooling.

---

## Files Modified This Session

- `src/tracking/pipe-patch.ts` - Added sourceRef, parentInfo, used registerObservable
- `src/tracking/subscribe-patch.ts` - Fixed inEmissionHandler guard ordering
- `src/tracking/types.ts` - Added sourceRef and parentInfo fields
- `src/ui/1_data/inline.ts` - Removed queueMicrotask complexity
- `src/ui/1_data/pipe-tree.ts` - Added phantom node creation for GC'd parents
- `ARCHITECTURE.md` - Documented current state and design decisions

---

## What's Next for the Project

1. **Per-operator tracking**: To show structure "as written", need to wrap each operator's return in the pipe chain
2. **Timeline view**: Network-tab style visualization of emissions over time
3. **DevTools extension**: Move visualization out of page into browser devtools

Good luck, Chris. The foundation is solid.
