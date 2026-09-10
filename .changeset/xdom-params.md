---
"@hafley66/xdom": patch
---

`Params<Path>` reads brace templates.

A second path parser lived here and understood `:name` only, so `Dom("/g/{gridId}/r/{rowId}")` typed its `params` as an empty record while matching correctly at run time. It now derives from `@hafley66/path`'s own `ValuesOf`, which already reads `:name`, `{name}`, `{name?}`, and `{name*}`. One parser, one answer, and `Values` and `EventWithParams` follow it.
