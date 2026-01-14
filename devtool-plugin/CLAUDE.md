# Project Conventions

## Data/Type/State modeling
I love sql and relational design and functional determination of variables in a data model hoare and cobbs are the shit. Actual relational theory is literally sound. Dont go nuts but when i ask u data model or state modeling questions, i prefer storing things with sql ideas. 

For actual runtime state that can be different of course, we might need a type in _not a flat table design_ bc yea we need it in program ram much different. But relaitonal model will illuminate the functionally dependencies and give you paths thru the data model that are as small as possible. Anyways.

## State Management
- Single source of truth: use existing state containers (state$.stack, state$.store), never create parallel Maps/stacks.
- Runtime emits events only; accumulator handles all state mutations

## Event Patterns
- Follow call/call-return pairs consistently (xyz-call, xyz-call-return)
- Parent relationships inferred from stack peek in accumulator, not passed in events
- Do not pass in functionallity dependent variables that we could derive from data inside the event handler that we would be redundantly passing into the event. 

## Code Structure
- Minimal runtime, maximal accumulator - keep event emitters thin
- Follow numeric file prefixes for dependency order (0_, 1_, 2_)

## Before Writing Code
- Read existing patterns deeply before implementing
- Find the existing technique for similar problems, use it exactly
- Minimal code that follows conventions > clever code that doesn't
